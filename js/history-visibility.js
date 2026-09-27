// =========================================
// HISTORY VISIBILITY (AI 可见历史清洗)
// 统一所有“把聊天历史发给 AI”的隐藏规则：
//   - 整条隐藏 isHidden：不进入 AI 上下文
//   - 气泡隐藏 hiddenIndices：只剔除对应气泡
//   - 图片气泡隐藏：不注入 image_description
//   - AI 思考链：默认不进入业务模型上下文
// 新增需要注入 contact.history 的功能时，优先走这里，避免各模块各写一套隐私口径。
// =========================================

// ★★★★★ AI 可见历史清洗 START ★★★★★
const HistoryVisibility = {
    timestampRegex: /^\[(?:[A-Z][a-z]{2}\.\d{1,2}|\d{4}-\d{2}-\d{2})\s\d{2}:\d{2}\]\s*/,
    datePrefixRegex: /^\[(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}\]/,
    thoughtRegex: /<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi,

    parseMessageDateKey(msg) {
        const timestamp = String(msg?.timestamp || '').trim();
        const direct = timestamp.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}/);
        if (direct) return direct[1];

        const content = String(msg?.content || '');
        const prefixed = content.match(this.datePrefixRegex);
        if (prefixed) return prefixed[1];

        return '';
    },

    stripTimestamp(content) {
        return String(content || '').replace(this.timestampRegex, '');
    },

    stripThought(content) {
        return String(content || '').replace(this.thoughtRegex, '').trim();
    },

    normalizeBubbleTextForMessage(msg, options = {}) {
        let content = String(msg?.content || '');
        let timestampPart = '';

        if (msg?.role === 'user') {
            const match = content.match(this.timestampRegex);
            if (match) {
                timestampPart = match[0];
                content = content.replace(this.timestampRegex, '');
            }
        }

        if (msg?.role === 'assistant') {
            // ★ 和 UI 气泡边界保持一致：AI 引用块在界面里会被拆成独立气泡。
            content = content.replace(/(^|\n)>\s*/g, '\n\n');
        }

        if (options.stripThought !== false) {
            content = this.stripThought(content);
        }

        return {
            timestampPart,
            content
        };
    },

    getTextParagraphs(msg, options = {}) {
        const normalized = this.normalizeBubbleTextForMessage(msg, options);
        return normalized.content
            .split(/\n\s*\n/)
            .filter(part => part.trim());
    },

    buildVisibleMessage(msg, options = {}) {
        if (!msg || msg.role === 'system' || msg.isHidden === true || msg.isTransientError === true) return null;
        if (msg?.asyncJobId && String(msg.content || '').startsWith('(发送失败:')) return null;

        const hiddenIndices = Array.isArray(msg.hiddenIndices) ? msg.hiddenIndices : [];
        const preserveTimestamp = options.preserveTimestamp === true;
        const includeImageDescription = options.includeImageDescription !== false;
        const normalized = this.normalizeBubbleTextForMessage(msg, options);
        const paragraphs = normalized.content
            .split(/\n\s*\n/)
            .filter(part => part.trim());

        const keptParagraphs = paragraphs
            .filter((_, index) => !hiddenIndices.includes(index))
            .map(part => part.trim());

        let content = keptParagraphs.join('\n\n');
        if (preserveTimestamp && msg.role === 'user' && content) {
            content = normalized.timestampPart + content;
        }

        if (includeImageDescription && msg.image_description) {
            // ★ 图片气泡的索引等于文本气泡数量，和 render/delete/隐藏逻辑保持一致。
            const imagePartIndex = paragraphs.length;
            if (!hiddenIndices.includes(imagePartIndex)) {
                const imageText = `[System Info: 对方发送了一张图片，图片内容描述: ${msg.image_description}]`;
                content = content ? `${content}\n\n${imageText}` : imageText;
            }
        }

        content = String(content || '').trim();
        if (!content) return null;

        return {
            role: msg.role,
            content
        };
    },

    collectVisibleMessages(contact, options = {}) {
        const history = Array.isArray(contact?.history) ? contact.history : [];
        const limit = Math.max(0, parseInt(options.limit, 10) || 0);
        const dateKey = options.dateKey || '';
        const preserveTimestamp = options.preserveTimestamp === true;
        const includeImageDescription = options.includeImageDescription !== false;
        const maxChars = Math.max(0, parseInt(options.maxChars, 10) || 0);
        const scanFromLatest = options.scanDirection !== 'oldest';
        const source = scanFromLatest ? [...history].reverse() : [...history];
        const rows = [];

        for (const msg of source) {
            if (dateKey && this.parseMessageDateKey(msg) !== dateKey) continue;

            const visible = this.buildVisibleMessage(msg, {
                preserveTimestamp,
                includeImageDescription,
                stripThought: options.stripThought
            });
            if (!visible) continue;

            if (maxChars > 0) {
                visible.content = visible.content.replace(/\s+/g, ' ').slice(0, maxChars);
            }

            rows.push(visible);
            if (limit > 0 && rows.length >= limit) break;
        }

        return scanFromLatest ? rows.reverse() : rows;
    },

    formatForRoleLines(contact, messages, options = {}) {
        const assistantName = options.assistantName || contact?.name || '你';
        const userName = options.userName || '用户';
        return (messages || []).map(msg => {
            const roleName = msg.role === 'assistant' ? assistantName : userName;
            return `${roleName}: ${msg.content}`;
        }).join('\n');
    }
};
// ★★★★★ AI 可见历史清洗 END ★★★★★
