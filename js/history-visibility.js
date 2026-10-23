// =========================================
// HISTORY VISIBILITY (AI 可见历史清洗)
// 统一所有“把聊天历史发给 AI”的隐藏规则：
//   - 整条隐藏 isHidden：不进入 AI 上下文
//   - 气泡隐藏 hiddenBubbleKeys：只剔除对应气泡，hiddenIndices 用于旧数据兼容
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
        const parsed = ChatBubbles.parse(msg);
        return { timestampPart: msg?.role === 'user' ? parsed.prefix : '', content: parsed.parts.join('\n\n') };
    },

    getTextParagraphs(msg, options = {}) {
        // ★ 界面和模型读取同一个切分器；围栏代码里的空行不会错算为气泡。
        return ChatBubbles.parse(msg).parts;
    },

    buildVisibleMessage(msg, options = {}) {
        if (!msg || msg.role === 'system' || msg.isHidden === true || msg.isTransientError === true) return null;
        if (msg?.asyncJobId && String(msg.content || '').startsWith('(发送失败:')) return null;

        ChatBubbles.ensure(msg);
        const hiddenKeys = new Set(msg.hiddenBubbleKeys);
        const preserveTimestamp = options.preserveTimestamp === true;
        const includeImageDescription = options.includeImageDescription !== false;
        const normalized = this.normalizeBubbleTextForMessage(msg, options);
        const paragraphs = this.getTextParagraphs(msg, options);

        const keptParagraphs = paragraphs
            .filter((_, index) => !hiddenKeys.has(msg.bubbleIds[index]))
            .map(part => part.trim());

        let content = keptParagraphs.join('\n\n');
        // ★ 保留原有防护：用户正文里的思考标签也不送入模型，但气泡位置仍按界面原文计算。
        if (options.stripThought !== false) content = this.stripThought(content);
        // ★ 主动消息的时间前缀属于可见正文元数据；隐藏全部正文时也不能单独留下前缀。
        if (content && msg.proactiveSource) content = ChatBubbles.parse(msg).prefix + content;

        if (includeImageDescription && msg.image_description) {
            // ★ 图片描述使用图片气泡自己的 key；文字数量变化也不能让隐藏描述泄漏。
            if (!hiddenKeys.has(msg.imageBubbleKey)) {
                const imageText = `[System Info: 对方发送了一张图片，图片内容描述: ${msg.image_description}]`;
                content = content ? `${content}\n\n${imageText}` : imageText;
            }
        }

        // ★ 本轮尚未识图的纯图片也要占住自己的 user 位置；隐藏图片不能借占位重新进入上下文。
        if (!content && options.preserveImagePlaceholder === true && msg.role === 'user'
            && msg.images?.length && !hiddenKeys.has(msg.imageBubbleKey)) {
            content = '[用户发送了一张图片]';
        }
        // ★ 描述和占位组装完成后再加时间，纯图片与文字消息使用同一个发送时间。
        if (preserveTimestamp && msg.role === 'user' && content) {
            content = (normalized.timestampPart || (msg.timestamp ? `[${msg.timestamp}] ` : '')) + content;
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
