// =========================================
// AGENT HEART NOTE MANAGER (探索 Agent / 心笺管理)
// 只负责心笺数据、注入规则、Agent 提示词和 JSON 校验。
// 页面渲染、用户确认和 IndexedDB 写入仍由 App 负责。
//
// 函数目录：
//   - ensureNotebook(contactId): 为角色创建/修复心笺数据壳
//   - getInjectRecords(notebook, now): 读取最近 N 天和星标心笺
//   - buildChatPrompt(contactId, now): 生成聊天注入文本
//   - buildCapabilityPrompt(): 生成主角色模型的心笺能力说明
//   - buildExecutorMessages(contact, intentTexts, now): 生成心笺解析请求
//   - parseResult(rawText): 解析并规范化小模型返回
//   - findCandidates(contactId, operation): 匹配要修改的心笺
// =========================================

// ★★★★★ Agent Heart Note Manager START：独立工具层 ★★★★★
const AgentHeartNoteManager = {
    defaultInjectDays: 3,
    allowedIntents: ['NONE', 'MANAGE_HEART_NOTE', 'ASK_CONFIRMATION'],
    allowedActions: ['create', 'update', 'delete', 'star', 'unstar'],

    pad(num) {
        return String(num).padStart(2, '0');
    },

    toDateKey(date) {
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
    },

    getTodayKey(now = new Date()) {
        return this.toDateKey(new Date(now));
    },

    fromDateKey(dateKey) {
        const [year, month, day] = String(dateKey || '').split('-').map(Number);
        return new Date(year || 1970, (month || 1) - 1, day || 1);
    },

    addDays(date, days) {
        const next = new Date(date);
        next.setHours(0, 0, 0, 0);
        next.setDate(next.getDate() + days);
        return next;
    },

    cleanText(value, maxLength = 1200) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    },

    normalizeMatchText(value) {
        return String(value || '')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[“”"『』「」'`]/g, '')
            .replace(/\s+/g, '')
            .trim();
    },

    getNotebook(contactId) {
        return (STATE.characterHeartNotes || []).find(item => item && item.charId === contactId) || null;
    },

    ensureNotebook(contactId) {
        // ★ 整体结构跟随角色记忆：一个角色一份数据，records 内一项就是一条心笺。
        if (!Array.isArray(STATE.characterHeartNotes)) STATE.characterHeartNotes = [];
        let notebook = this.getNotebook(contactId);
        if (!notebook) {
            notebook = {
                charId: contactId,
                injectDays: this.defaultInjectDays,
                records: [],
                updatedAt: Date.now()
            };
            STATE.characterHeartNotes.push(notebook);
        }
        notebook.injectDays = Math.max(1, Number.parseInt(notebook.injectDays, 10) || this.defaultInjectDays);
        if (!Array.isArray(notebook.records)) notebook.records = [];
        notebook.records.forEach(record => {
            if (!record || typeof record !== 'object') return;
            record.alwaysInject = record.alwaysInject === true;
            // ★ 旧数据没有 cancelled 字段时补成 false；取消只影响注入，不移除原心笺。
            record.cancelled = record.cancelled === true;
            if (!record.dateKey && record.createdAt) record.dateKey = this.getTodayKey(new Date(record.createdAt));
        });
        return notebook;
    },

    getInjectRecords(notebook, now = new Date()) {
        if (!notebook) return [];
        const injectDays = Math.max(1, Number.parseInt(notebook.injectDays, 10) || this.defaultInjectDays);
        const today = this.fromDateKey(this.getTodayKey(now));
        const minDate = this.addDays(today, -(injectDays - 1));

        return (notebook.records || [])
            .filter(record => {
                if (!record || !record.text) return false;
                // ★ 与 TODO cancel 一致：已取消心笺保留在列表，但无论是否星标都不注入上下文。
                if (record.cancelled === true) return false;
                if (record.alwaysInject === true) return true;
                const date = this.fromDateKey(record.dateKey || this.getTodayKey(new Date(record.createdAt || 0)));
                return date >= minDate && date <= today;
            })
            .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    },

    buildChatPrompt(contactId, now = new Date()) {
        const notebook = this.getNotebook(contactId);
        const records = this.getInjectRecords(notebook, now);
        if (!records.length) return '';

        const lines = [
            '# 心笺',
            '以下是你曾经为自己记下的内容：',
        ];
        records.forEach(record => {
            // ★ 星标心笺注入时加上状态前缀，让角色下一轮仍能识别；标记不写回心笺原文。
            lines.push(`- ${record.alwaysInject === true ? '[星标]' : ''}${record.text}`);
        });
        return lines.join('\n');
    },

    buildCapabilityPrompt() {
        return [
            '“心笺”是你的记事本，你可以在其中记录任何你想记录备忘的东西，也可修改、删除、星标（星标=长期记住）或取消星标每条“心笺”。',
            '当你需要操作心笺时，把你的意图放进『』内，例如『添加/删除/星标心笺：XXX』、『修改心笺：XXX，修改为：YYY』，系统会为你解析并执行',
        ].join(' ');
    },

    buildSnapshot(contactId) {
        const notebook = this.ensureNotebook(contactId);
        return (notebook.records || [])
            .filter(record => record && record.text)
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
            .map(record => ({
                id: record.id,
                text: this.cleanText(record.text),
                dateKey: record.dateKey || '',
                createdAt: Number(record.createdAt) || 0,
                alwaysInject: record.alwaysInject === true,
                cancelled: record.cancelled === true
            }));
    },

    normalizeAction(value) {
        const action = String(value || '').trim().toLowerCase();
        if (['create', 'add', 'new'].includes(action)) return 'create';
        if (['update', 'edit', 'modify', 'rename'].includes(action)) return 'update';
        if (['delete', 'remove'].includes(action)) return 'delete';
        if (['star', 'pin', 'favorite'].includes(action)) return 'star';
        if (['unstar', 'unpin', 'unfavorite'].includes(action)) return 'unstar';
        return '';
    },

    normalizeOperation(raw = {}) {
        if (!raw || typeof raw !== 'object') return null;
        const action = this.normalizeAction(raw.action);
        if (!action) return null;
        const operation = {
            action,
            text: this.cleanText(raw.text || raw.content || ''),
            targetNoteId: this.cleanText(raw.targetNoteId || raw.noteId || raw.id || '', 100),
            targetText: this.cleanText(raw.targetText || raw.oldText || raw.matchText || ''),
            newText: this.cleanText(raw.newText || raw.replacement || '')
        };
        if (action !== 'create' && !operation.targetText && operation.text) {
            operation.targetText = operation.text;
            operation.text = '';
        }
        return operation;
    },

    buildExecutorMessages(contact, intentTexts = [], now = new Date()) {
        const systemPrompt = [
            '你是一个心笺（记事本）管理 Agent，只把角色的心笺动作意图转成规范 JSON。',
            '不要输出 Markdown，不要解释，只输出 JSON。',
            '',
            'intent 只能选择：NONE、MANAGE_HEART_NOTE、ASK_CONFIRMATION。',
            'operation.action 只能选择：create、update、delete、star、unstar。',
            '',
            '规则：',
            '- 每个输入意图可以产生一个或多个 operations，不要遗漏。',
            '- create 只填 text。',
            '- update/delete/star/unstar 必须填 targetNoteId 或 targetText。',
            '- update 额外填 newText。',
            '- 能从现有心笺确定 id 时优先填 targetNoteId。',
            '- 不要伪造日期、时间、ID 或心笺内容。',
            '- 信息不足或目标不唯一时输出 ASK_CONFIRMATION。',
            '',
            'JSON 格式：',
            '{"intent":"MANAGE_HEART_NOTE","operations":[{"action":"create","text":"想记下的内容","targetNoteId":"","targetText":"","newText":""},{"action":"update","text":"","targetNoteId":"","targetText":"原内容","newText":"新内容"}],"confirmation":{"message":""}}'
        ].join('\n');

        const userPrompt = [
            `当前日期：${this.getTodayKey(now)}`,
            '',
            '【当前角色】',
            contact?.name || '未命名角色',
            '',
            '【现有心笺】',
            JSON.stringify(this.buildSnapshot(contact?.id), null, 2),
            '',
            '【角色动作意图】',
            (intentTexts || []).join('\n')
        ].join('\n');

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
    },

    extractJson(rawText) {
        const text = String(rawText || '').trim();
        if (!text) throw new Error('心笺管理返回为空');
        try {
            return JSON.parse(text);
        } catch (error) {
            const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fenced) return JSON.parse(fenced[1].trim());
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
            throw error;
        }
    },

    parseResult(rawText) {
        const data = this.extractJson(rawText);
        const intent = String(data.intent || '').trim().toUpperCase();
        if (!this.allowedIntents.includes(intent)) throw new Error(`未知心笺 intent：${intent || '空'}`);
        return {
            intent,
            operations: Array.isArray(data.operations)
                ? data.operations.map(item => this.normalizeOperation(item)).filter(Boolean)
                : [],
            confirmation: data.confirmation && typeof data.confirmation === 'object' ? data.confirmation : {}
        };
    },

    findCandidates(contactId, operation = {}) {
        const notebook = this.ensureNotebook(contactId);
        const targetId = this.cleanText(operation.targetNoteId || '', 100);
        const targetKey = this.normalizeMatchText(operation.targetText || '');
        let records = (notebook.records || []).filter(record => record && record.text);
        if (targetId) return records.filter(record => record.id === targetId);
        if (!targetKey) return [];

        const exact = records.filter(record => this.normalizeMatchText(record.text) === targetKey);
        if (exact.length) return exact;
        return records.filter(record => this.normalizeMatchText(record.text).includes(targetKey));
    },

    buildDuplicateKey(text, dateKey) {
        return `${dateKey}::${this.normalizeMatchText(text)}`;
    }
};
// ★★★★★ Agent Heart Note Manager END：独立工具层 ★★★★★
