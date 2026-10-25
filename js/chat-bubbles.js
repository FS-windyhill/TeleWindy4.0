// =========================================
// CHAT BUBBLES (聊天气泡身份)
// 文本、图片和思考气泡都保存独立 key；旧 hiddenIndices 只用于迁移和兼容读取。
// =========================================
const ChatBubbles = {
    timestampRegex: /^\[(?:[A-Z][a-z]{2}\.\d{1,2}|\d{4}-\d{2}-\d{2})\s\d{2}:\d{2}\]\s*/,
    thoughtRegex: /<(?:think|thinking|thought)[^>]*>([\s\S]*?)(?:<\/(?:think|thinking|thought)>|$)/gi,
    // ★ 未隐藏消息只记住原 content 引用；正文被外部链路替换时，仍能在本次运行中对应旧 key。
    contentBeforeChange: new WeakMap(),

    newKey() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        return `bubble_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    },

    transformOutsideCode(text, transform) {
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const output = [];
        let plain = [], code = [], fence = null;
        const flushPlain = () => { if (plain.length) output.push(transform(plain.join('\n'))); plain = []; };
        const flushCode = () => { if (code.length) output.push(code.join('\n')); code = []; };
        lines.forEach(line => {
            if (fence) {
                code.push(line);
                const close = line.match(/^ {0,3}(`+|~+)\s*$/);
                if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
                    fence = null;
                    flushCode();
                }
                return;
            }
            const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
            if (open) {
                flushPlain();
                fence = { char: open[1][0], length: open[1].length };
                code.push(line);
            } else plain.push(line);
        });
        flushCode();
        flushPlain();
        return output.join('\n');
    },

    normalizeQuotes(text) {
        return this.transformOutsideCode(text, plain => plain.replace(/(^|\n)>\s*/g, '\n\n'));
    },

    split(text) {
        if (!text) return [];
        const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
        const parts = [];
        let current = [], fence = null;
        const push = () => {
            const part = current.join('\n').trim();
            if (part) parts.push(part);
            current = [];
        };
        lines.forEach(line => {
            if (fence) {
                current.push(line);
                const close = line.match(/^ {0,3}(`+|~+)\s*$/);
                if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
                return;
            }
            const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
            if (open) {
                fence = { char: open[1][0], length: open[1].length };
                current.push(line);
            } else if (!line.trim()) push();
            else current.push(line);
        });
        push();
        return parts;
    },

    parse(message, content = message?.content) {
        let text = String(content || '');
        let prefix = '';
        if (message?.role === 'user' || message?.proactiveSource) {
            const match = text.match(this.timestampRegex);
            if (match) { prefix = match[0]; text = text.slice(prefix.length); }
        }
        let thought = '';
        if (message?.role === 'assistant') {
            text = text.replace(this.thoughtRegex, (_full, inner) => { thought = inner.trim(); return ''; });
            text = this.normalizeQuotes(text);
        }
        return { prefix, thought, parts: this.split(text) };
    },

    hasImage(message) {
        return !!(message?.images?.length || message?.isImageExpired || message?.image_description);
    },

    // ★ 一次迁移旧下标：文字按原顺序、图片按文字数量、思考用特殊索引。
    ensure(message) {
        if (!message || typeof message !== 'object') return false;
        const parsed = this.parse(message);
        const parts = parsed.parts;
        let changed = false;
        const previousContent = this.contentBeforeChange.get(message);
        if (!Array.isArray(message.bubbleIds)) {
            message.bubbleIds = parts.map(() => this.newKey());
            const hidden = Array.isArray(message.hiddenIndices) ? message.hiddenIndices : [];
            message.hiddenBubbleKeys = hidden.filter(i => Number.isInteger(i) && i >= 0 && i < parts.length)
                .map(i => message.bubbleIds[i]);
            if (this.hasImage(message)) {
                message.imageBubbleKey = this.newKey();
                if (hidden.includes(parts.length)) message.hiddenBubbleKeys.push(message.imageBubbleKey);
            }
            if (parsed.thought) {
                message.thoughtBubbleKey = this.newKey();
                if (hidden.includes('thought')) message.hiddenBubbleKeys.push(message.thoughtBubbleKey);
            }
            changed = true;
        } else if (Array.isArray(message.bubbleTextSnapshot)
            && (message.bubbleIds.length !== parts.length || message.bubbleTextSnapshot.length !== parts.length
                || message.bubbleTextSnapshot.some((part, index) => part !== parts[index]))) {
            // ★ 外部更新正文也走统一对应逻辑；歧义区域采用保守隐藏。
            this.reconcile(message, parts);
            changed = true;
        } else if (previousContent !== undefined && previousContent !== message.content) {
            // ★ 无持久快照时，使用旧正文引用；不会额外保存第二份完整气泡文字。
            this.reconcile(message, parts, this.parse(message, previousContent).parts);
            changed = true;
        } else if (message.bubbleIds.length !== parts.length) {
            // ★ 无旧正文可匹配时废弃旧文字 key；异常隐藏数据采取保守隐藏，不能露出旧内容。
            const hadHiddenText = (message.hiddenBubbleKeys || []).some(key => message.bubbleIds.includes(key));
            message.bubbleIds = parts.map(() => this.newKey());
            if (hadHiddenText) message.hiddenBubbleKeys.push(...message.bubbleIds);
            changed = true;
        }
        if (this.hasImage(message) && !message.imageBubbleKey) { message.imageBubbleKey = this.newKey(); changed = true; }
        if (parsed.thought && !message.thoughtBubbleKey) { message.thoughtBubbleKey = this.newKey(); changed = true; }
        if (!Array.isArray(message.hiddenBubbleKeys)) {
            const hidden = Array.isArray(message.hiddenIndices) ? message.hiddenIndices : [];
            message.hiddenBubbleKeys = hidden.map(index => index === 'thought' ? message.thoughtBubbleKey
                : index === parts.length ? message.imageBubbleKey : message.bubbleIds[index]).filter(Boolean);
            changed = true;
        }
        // ★ 只有存在隐藏气泡时才持久化文字快照；旧备份中的普通消息在加载时自动瘦身。
        if (message.hiddenBubbleKeys.length) {
            if (!Array.isArray(message.bubbleTextSnapshot)) {
                message.bubbleTextSnapshot = [...parts];
                changed = true;
            }
        } else if (Object.hasOwn(message, 'bubbleTextSnapshot')) {
            delete message.bubbleTextSnapshot;
            changed = true;
        }
        if (this.syncIndices(message, parts.length)) changed = true;
        this.contentBeforeChange.set(message, message.content);
        return changed;
    },

    // ★ 唯一正文可跨位置匹配；重复正文按从右到左匹配，前方新增相同正文时保留旧 key。
    // 重复数变化或改写区域无法判定时，候选新气泡全部隐藏，避免旧隐藏内容意外进入上下文。
    reconcile(message, newParts, oldParts = message.bubbleTextSnapshot || []) {
        const oldIds = message.bubbleIds || [];
        const hidden = new Set(message.hiddenBubbleKeys || []);
        const next = Array(newParts.length).fill(null);
        const usedOld = new Set();
        const values = new Set([...oldParts, ...newParts]);
        for (const value of values) {
            const olds = oldParts.map((part, i) => part === value ? i : -1).filter(i => i >= 0);
            const news = newParts.map((part, i) => part === value ? i : -1).filter(i => i >= 0);
            if (!olds.length || !news.length) continue;
            if (olds.length === 1 && news.length === 1) {
                next[news[0]] = oldIds[olds[0]];
                usedOld.add(olds[0]);
            } else {
                const count = Math.min(olds.length, news.length);
                for (let i = 1; i <= count; i++) {
                    next[news[news.length - i]] = oldIds[olds[olds.length - i]];
                    usedOld.add(olds[olds.length - i]);
                }
                if (olds.length !== news.length && olds.some(i => hidden.has(oldIds[i]))) {
                    news.forEach(i => { if (next[i]) hidden.add(next[i]); });
                }
            }
        }
        const oldUnmatched = oldParts.map((_, i) => i).filter(i => !usedOld.has(i));
        const newUnmatched = newParts.map((_, i) => i).filter(i => !next[i]);
        if (oldUnmatched.length === 1 && newUnmatched.length === 1) {
            next[newUnmatched[0]] = oldIds[oldUnmatched[0]];
            usedOld.add(oldUnmatched[0]);
        } else if (oldUnmatched.some(i => hidden.has(oldIds[i]))) {
            newUnmatched.forEach(i => hidden.add(next[i] || (next[i] = this.newKey())));
        }
        message.bubbleIds = next.map(key => key || this.newKey());
        // ★ 已删除正文的旧隐藏 key 暂留在数据中；整段编辑的歧义不能静默抹掉历史隐藏信息。
        message.hiddenBubbleKeys = [...hidden];
        if (hidden.size) message.bubbleTextSnapshot = [...newParts];
        else delete message.bubbleTextSnapshot;
    },

    edit(message, newContent) {
        this.ensure(message);
        const oldParts = this.parse(message).parts;
        const parts = this.parse(message, newContent).parts;
        this.reconcile(message, parts, oldParts);
        message.content = newContent;
        this.syncIndices(message, parts.length);
        this.contentBeforeChange.set(message, message.content);
    },

    deleteParts(message, keys) {
        this.ensure(message);
        const selected = new Set(keys);
        const parsed = this.parse(message);
        const kept = parsed.parts.map((text, i) => ({ text, id: message.bubbleIds[i] }))
            .filter(part => !selected.has(part.id));
        const keepThought = !!parsed.thought && !selected.has(message.thoughtBubbleKey);
        if (selected.has(message.imageBubbleKey)) {
            message.images = null;
            message.image_description = null;
            message.isImageExpired = false;
        }
        const thoughtMatch = String(message.content || '').match(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/i);
        const body = kept.map(part => part.text).join('\n\n');
        message.content = (parsed.prefix + (keepThought && thoughtMatch ? `${thoughtMatch[0]}\n\n` : '') + body).trim();
        message.bubbleIds = kept.map(part => part.id);
        message.hiddenBubbleKeys = (message.hiddenBubbleKeys || []).filter(key => !selected.has(key));
        if (message.hiddenBubbleKeys.length) message.bubbleTextSnapshot = kept.map(part => part.text);
        else delete message.bubbleTextSnapshot;
        this.syncIndices(message, kept.length);
        this.contentBeforeChange.set(message, message.content);
        return !!(kept.length || this.hasImage(message) || keepThought);
    },

    syncIndices(message, count = message.bubbleIds?.length || 0) {
        const hidden = new Set(message.hiddenBubbleKeys || []);
        const indices = (message.bubbleIds || []).map((key, index) => hidden.has(key) ? index : null)
            .filter(index => index !== null);
        if (this.hasImage(message) && hidden.has(message.imageBubbleKey)) indices.push(count);
        if (this.parse(message).thought && hidden.has(message.thoughtBubbleKey)) indices.unshift('thought');
        const old = Array.isArray(message.hiddenIndices) ? message.hiddenIndices : [];
        if (old.length === indices.length && old.every((value, index) => value === indices[index])) return false;
        message.hiddenIndices = indices;
        return true;
    },

    keyAt(message, index) {
        this.ensure(message);
        if (index === 'thought') return this.parse(message).thought ? message.thoughtBubbleKey : null;
        if (index === message.bubbleIds.length && this.hasImage(message)) return message.imageBubbleKey;
        return Number.isInteger(index) ? message.bubbleIds[index] || null : null;
    },

    indexOf(message, key) {
        this.ensure(message);
        if (key === message.thoughtBubbleKey && this.parse(message).thought) return 'thought';
        if (key === message.imageBubbleKey && this.hasImage(message)) return message.bubbleIds.length;
        const index = message.bubbleIds.indexOf(key);
        return index >= 0 ? index : null;
    },

    isHidden(message, key) {
        this.ensure(message);
        return message.hiddenBubbleKeys.includes(key);
    },

    setHidden(message, key, hidden) {
        if (this.indexOf(message, key) === null) return false;
        const keys = new Set(message.hiddenBubbleKeys);
        if (hidden) keys.add(key);
        else keys.delete(key);
        message.hiddenBubbleKeys = [...keys];
        // ★ 第一次隐藏才留快照；最后一个隐藏气泡取消后立即释放。
        if (keys.size) message.bubbleTextSnapshot = this.parse(message).parts;
        else delete message.bubbleTextSnapshot;
        this.syncIndices(message);
        return true;
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = ChatBubbles;
