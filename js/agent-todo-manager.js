// =========================================
// AGENT TODO MANAGER (探索 Agent / TODO 管理)
// 只负责 TODO 管理的提示词、JSON 解析和 TODO 匹配校验。
// 真正的页面渲染、API 调用和写入 IndexedDB 仍然留在 App 里。
//
// 函数目录：
//   - getTodayKey(now): 获取今天日期 key
//   - buildCapabilityPrompt(): 生成注入主模型角色描述的 TODO 能力说明
//   - buildTodoSnapshot(now): 给 worker model 的精简 TODO 列表
//   - buildExecutorMessages(contact, userText, now, sourceLabel): 生成 TODO 管理执行请求 messages，可标记输入来自用户消息或角色动作意图
//   - buildPostSuggestionMessages(contact, assistantText, now): 生成回复后 TODO 建议请求 messages
//   - extractJson(rawText): 从 worker model 返回里抽出 JSON
//   - parseRouterResult(rawText): 解析并规范化 intent
//   - parsePostSuggestionResult(rawText): 解析回复后 TODO 建议
//   - findTodoCandidates(routerResult): 按 worker 给出的线索匹配 TODO
//   - formatTodoLabel(item): 生成弹窗/摘要里可读的 TODO 名称
// =========================================

// ★★★★★ Agent TODO Manager START：独立工具层 ★★★★★
const AgentTodoManager = {
    allowedIntents: ['NONE', 'MANAGE_TODO', 'CREATE_TODO', 'UPDATE_TODO', 'ASK_CONFIRMATION'],
    allowedPostIntents: ['NONE', 'SUGGEST_TODO_MANAGE', 'SUGGEST_TODO_CREATE'],

    pad(num) {
        return String(num).padStart(2, '0');
    },

    getTodayKey(now = new Date()) {
        if (typeof TodoContext !== 'undefined' && TodoContext.getTodayKey) {
            return TodoContext.getTodayKey(now);
        }
        return `${now.getFullYear()}-${this.pad(now.getMonth() + 1)}-${this.pad(now.getDate())}`;
    },

    addDays(dateKey, days) {
        if (typeof TodoContext !== 'undefined' && TodoContext.fromDateKey && TodoContext.toDateKey) {
            const date = TodoContext.fromDateKey(dateKey);
            date.setDate(date.getDate() + days);
            return TodoContext.toDateKey(date);
        }
        const [year, month, day] = String(dateKey || '').split('-').map(Number);
        const date = new Date(year || 1970, (month || 1) - 1, day || 1);
        date.setDate(date.getDate() + days);
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
    },

    isDateKey(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
    },

    isTimeValue(value) {
        return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
    },

    cleanText(value, maxLength = 120) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    },

    normalizeMatchText(value) {
        // ★ TODO 匹配用：抹平全半角、空白和常见引号，避免模型多/少一点标点就找不到目标。
        return String(value || '')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[“”"『』「」'`]/g, '')
            .replace(/\s+/g, '')
            .trim();
    },

    buildCapabilityPrompt() {
        // ★ 能力说明跟随 TODO skill 自己走；Router 只负责分发，不背业务提示词。
        return '你能管理对方的 todo 日程。当你想为对方新增、修改、完成或删除一件日程时，把你的意图放进『』内，如『把“论文整理”设为已完成』或『加一个“吃肯德基”的计划』，todo系统会为你解析并执行';
    },

    buildTodoSnapshot(now = new Date()) {
        const todayKey = this.getTodayKey(now);
        return (STATE.todoPlans || [])
            .filter(item => item && item.text)
            // ★ 只给 Agent 今天和未来的 TODO，避免过往已完成/已取消事项把注意力和 token 都拖走。
            .filter(item => (this.isDateKey(item.dateKey) ? item.dateKey : todayKey) >= todayKey)
            .sort((a, b) => {
                if (a.done !== b.done) return a.done ? 1 : -1;
                if (a.dateKey !== b.dateKey) return String(a.dateKey).localeCompare(String(b.dateKey));
                return (a.createdAt || 0) - (b.createdAt || 0);
            })
            .slice(0, 80)
            .map(item => ({
                id: item.id,
                text: this.cleanText(item.text, 80),
                dateKey: item.dateKey || todayKey,
                done: item.done === true,
                cancelled: item.cancelled === true,
                startTime: item.startTime || '',
                endTime: item.endTime || ''
            }));
    },

    normalizeAction(value) {
        const action = String(value || '').trim().toLowerCase();
        if (['create', 'add', 'new'].includes(action)) return 'create';
        if (['complete', 'done', 'completed', 'finish', 'finished'].includes(action)) return 'complete';
        if (['cancel', 'cancelled', 'canceled', 'delete', 'deleted', 'remove', 'removed'].includes(action)) return 'cancel';
        if (['restore', 'active', 'undone', 'resume'].includes(action)) return 'restore';
        if (['reschedule', 'date', 'change_date', 'move'].includes(action)) return 'reschedule';
        if (['rename', 'text', 'change_text'].includes(action)) return 'rename';
        if (['retime', 'time', 'change_time'].includes(action)) return 'retime';
        return '';
    },

    normalizeOperation(raw = {}) {
        if (!raw || typeof raw !== 'object') return null;
        const status = String(raw.status || '').trim().toLowerCase();
        const action = this.normalizeAction(raw.action || status || (raw.newDateKey ? 'reschedule' : raw.newText ? 'rename' : ''));
        if (!action) return null;

        const operation = {
            action,
            text: this.cleanText(raw.text || raw.title || '', 120),
            dateKey: this.isDateKey(raw.dateKey) ? raw.dateKey : '',
            startTime: this.isTimeValue(raw.startTime) ? raw.startTime : '',
            endTime: this.isTimeValue(raw.endTime) ? raw.endTime : '',
            targetTodoId: this.cleanText(raw.targetTodoId || raw.todoId || raw.id || '', 80),
            targetText: this.cleanText(raw.targetText || raw.matchText || raw.oldText || '', 120),
            newText: this.cleanText(raw.newText || '', 120),
            newDateKey: this.isDateKey(raw.newDateKey) ? raw.newDateKey : '',
            reason: this.cleanText(raw.reason || '', 160)
        };

        // ★ 兼容旧模型：UPDATE_TODO 经常只给 matchText/text，这里补成统一 targetText。
        if (operation.action !== 'create' && !operation.targetText && operation.text) {
            operation.targetText = operation.text;
            operation.text = '';
        }
        return operation;
    },

    buildOperationsFromLegacy(data = {}) {
        const intent = String(data.intent || '').trim().toUpperCase();
        if (intent === 'CREATE_TODO' || intent === 'SUGGEST_TODO_CREATE') {
            const rawTodos = Array.isArray(data.todos) && data.todos.length ? data.todos : [data.todo || {}];
            return rawTodos
                .map(item => this.normalizeOperation({ ...item, action: 'create' }))
                .filter(Boolean);
        }
        if (intent === 'UPDATE_TODO') {
            return [this.normalizeOperation(data.update || {})].filter(Boolean);
        }
        return [];
    },

    buildExecutorMessages(contact, userText, now = new Date(), sourceLabel = '输入文字') {
        const todayKey = this.getTodayKey(now);
        const tomorrowKey = this.addDays(todayKey, 1);
        const systemPrompt = [
            '你是一个 TODO 管理 Agent，负责把输入文字解析成 TODO 管理操作包。',
            '你只能从 intent 枚举中选择：NONE、MANAGE_TODO、ASK_CONFIRMATION。',
            '不要输出 Markdown，不要解释，只输出 JSON。',
            '',
            'operation.action 只能选择：create、complete、cancel、restore、reschedule、rename、retime。',
            '',
            '规则：',
            '- 理解用户意图，做出intent和operation.action选择。',
            '- 普通聊天，选 NONE。',
            '- 需要安排任务，或者做记录、提醒时，输出 MANAGE_TODO 且 action=create。',
            '- 用户表示事项完成，输出 MANAGE_TODO 且 action=complete。',
            '- 用户表示某事需要改日期，输出 MANAGE_TODO 且 action=reschedule。',
            '- 某事项需要改内容，输出 MANAGE_TODO 且 action=rename。',
            '- 某事项需要改时间，输出 MANAGE_TODO 且 action=retime。',
            '- 删除、取消、不需要某个事项，输出 MANAGE_TODO 且 action=cancel。',
            '- 找不到唯一目标、信息不足，选 ASK_CONFIRMATION。',
            '- 不确定日期时，放在今天。',
            '- 不要编造用户没有说的日期、任务或目标。',
            '- 多个事项拆成多个 operations，不要合并。',
            '',
            'JSON 格式：',
            '{"intent":"MANAGE_TODO","operations":[{"action":"create","text":"继续写论文","dateKey":"2026-06-10","startTime":"","endTime":""},{"action":"complete","targetText":"买东方树叶","dateKey":"2026-06-10"},{"action":"reschedule","targetText":"喝茶","dateKey":"2026-06-10","newDateKey":"2026-06-29"}],"confirmation":{"message":""}}',
            '',
            '字段说明：',
            '- create 填 text/dateKey/startTime/endTime；没有明确时间就留空 startTime/endTime。',
            '- complete/cancel/restore/reschedule/rename/retime 必须填写 targetText 或 targetTodoId。',
            '- 能从现有 TODO 里确定 id 时，优先填写 targetTodoId。',
            '- reschedule 填 newDateKey；rename 填 newText；retime 填 startTime/endTime。',
            '- ASK_CONFIRMATION 时 confirmation.message 写给前端确认/提示用的一句话。',
            '- 不需要的对象字段留空字符串。'
        ].join('\n');

        // ★ 缓存友好：固定规则放 system，日期/TODO 快照/用户原话放 user，尽量提高前缀缓存命中。
        const userPrompt = [
            `今天日期：${todayKey}`,
            `明天日期：${tomorrowKey}`,
            '',
            '【当前角色】',
            contact?.name || '未命名角色',
            '',
            '【现有 TODO】',
            JSON.stringify(this.buildTodoSnapshot(now), null, 2),
            '',
            `【${sourceLabel}】`,
            userText || ''
        ].join('\n');

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
    },

    buildRouterMessages(contact, userText, now = new Date()) {
        // ★ 兼容旧调用名：现在真正的“总路由”在 AgentSkillRouter。
        // TODO Manager 这里只保留专用执行 prompt，避免以后 Agent 多了之后继续膨胀。
        return this.buildExecutorMessages(contact, userText, now);
    },

    buildPostSuggestionMessages(contact, assistantText, now = new Date()) {
        const todayKey = this.getTodayKey(now);
        const tomorrowKey = this.addDays(todayKey, 1);
        const systemPrompt = [
            '你是一个 TODO 管理 Agent，只从刚刚的回复里提取“可让用户确认执行”的 TODO 管理建议。',
            '你不能执行 TODO，只能建议新增、完成、取消、恢复、改期、改名或改时间，最终必须由用户确认。',
            '不要输出 Markdown，不要解释，只输出 JSON。',
            '',
            'intent 只能选择：NONE、SUGGEST_TODO_MANAGE。',
            'operation.action 只能选择：create、complete、cancel、restore、reschedule、rename、retime。',
            '',
            '规则：',
            '- 回复里建议了一个可执行事项或 TODO 调整，输出 SUGGEST_TODO_MANAGE。',
            '- 闲聊、泛泛建议、角色语气承诺，选 NONE。',
            '- 不确定日期时，就放在今天。',
            '- 不要编造回复里没有的任务、日期或时间。',
            '- complete/cancel/restore/reschedule/rename/retime 只有能匹配唯一现有 TODO 时才输出。',
            '- 多个事项拆成多个 operations，不要合并。',
            '- 最多返回 5 项操作。',
            '',
            'JSON 格式：',
            '{"intent":"SUGGEST_TODO_MANAGE","operations":[{"action":"create","text":"导出发票","dateKey":"2026-06-10","startTime":"21:00","endTime":""},{"action":"cancel","targetText":"去图书馆","dateKey":"2026-06-10"},{"action":"reschedule","targetText":"喝茶","dateKey":"2026-06-10","newDateKey":"2026-06-29"}],"confirmation":{"message":""}}',
            '',
            '字段说明：',
            '- NONE 时 operations 为空数组。',
            '- create 的 text 写清晰简短的任务名，不要长篇大论。',
            '- 能从现有 TODO 里确定 id 时，优先填写 targetTodoId。',
            '- dateKey/newDateKey 必须是 YYYY-MM-DD。',
            '- 没有明确时间就留空 startTime/endTime。'
        ].join('\n');

        // ★★★★★ Post Agent：TODO 建议 prompt START ★★★★★
        // 角色侧可以建议完成/取消/改期，所以这里带精简 TODO 快照，避免模型凭空改不存在的事项。
        const userPrompt = [
            `今天日期：${todayKey}`,
            `明天日期：${tomorrowKey}`,
            '',
            '【当前角色】',
            contact?.name || '未命名角色',
            '',
            '【现有 TODO】',
            JSON.stringify(this.buildTodoSnapshot(now), null, 2),
            '',
            '【角色刚刚回复】',
            assistantText || ''
        ].join('\n');
        // ★★★★★ Post Agent：TODO 建议 prompt END ★★★★★

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
    },

    extractJson(rawText) {
        const text = String(rawText || '').trim();
        if (!text) throw new Error('TODO 管理返回为空');

        try {
            return JSON.parse(text);
        } catch (error) {
            // ★ worker model 偶尔会包一层 ```json，这里只做容错抽取，不接受自然语言正文。
            const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fenced) return JSON.parse(fenced[1].trim());

            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
            throw error;
        }
    },

    parseRouterResult(rawText) {
        const data = this.extractJson(rawText);
        const intent = String(data.intent || '').trim().toUpperCase();
        if (!this.allowedIntents.includes(intent)) {
            throw new Error(`未知 intent：${intent || '空'}`);
        }

        return {
            intent,
            todo: data.todo && typeof data.todo === 'object' ? data.todo : {},
            todos: Array.isArray(data.todos) ? data.todos.filter(item => item && typeof item === 'object') : [],
            update: data.update && typeof data.update === 'object' ? data.update : {},
            operations: Array.isArray(data.operations)
                ? data.operations.map(item => this.normalizeOperation(item)).filter(Boolean)
                : this.buildOperationsFromLegacy(data),
            confirmation: data.confirmation && typeof data.confirmation === 'object' ? data.confirmation : {}
        };
    },

    parsePostSuggestionResult(rawText) {
        const data = this.extractJson(rawText);
        const intent = String(data.intent || '').trim().toUpperCase();
        if (!this.allowedPostIntents.includes(intent)) {
            throw new Error(`未知 post-agent intent：${intent || '空'}`);
        }

        return {
            intent,
            todos: Array.isArray(data.todos) ? data.todos.filter(item => item && typeof item === 'object') : [],
            operations: Array.isArray(data.operations)
                ? data.operations.map(item => this.normalizeOperation(item)).filter(Boolean)
                : this.buildOperationsFromLegacy(data),
            confirmation: data.confirmation && typeof data.confirmation === 'object' ? data.confirmation : {}
        };
    },

    findTodoCandidates(routerResult) {
        const update = routerResult?.update || routerResult || {};
        const matchId = this.cleanText(update.id || update.todoId || update.targetTodoId || '', 80);
        const matchText = this.cleanText(update.matchText || update.targetText || update.text || update.oldText || '', 80);
        const matchTextKey = this.normalizeMatchText(matchText);
        const dateKey = this.isDateKey(update.dateKey) ? update.dateKey : '';

        const action = this.normalizeAction(update.action);
        const includeCancelled = action === 'restore';
        let items = (STATE.todoPlans || []).filter(item => item && item.text && (includeCancelled || item.cancelled !== true));
        if (action === 'complete') {
            items = items.filter(item => item.done !== true);
        }
        if (matchId) items = items.filter(item => item.id === matchId);
        const beforeDateFilter = items;
        if (dateKey) items = items.filter(item => (item.dateKey || this.getTodayKey()) === dateKey);
        if (matchTextKey) {
            const pickByText = sourceItems => {
                const keyedItems = sourceItems
                    .map(item => ({ item, key: this.normalizeMatchText(item.text || '') }))
                    .filter(entry => entry.key);
                const exactMatches = keyedItems
                    .filter(entry => entry.key === matchTextKey)
                    .map(entry => entry.item);
                if (exactMatches.length) return exactMatches;

                const containsMatches = keyedItems
                    .filter(entry => entry.key.includes(matchTextKey))
                    .map(entry => entry.item);
                if (containsMatches.length) return containsMatches;

                // ★ 只有没有更完整匹配时，才允许 targetText 包含现有 TODO 文本；否则会把拆开的旧任务一起捞进来。
                return keyedItems
                    .filter(entry => matchTextKey.includes(entry.key))
                    .map(entry => entry.item);
            };
            const textMatchedItems = pickByText(items);
            // ★ 日期被模型猜错时，先在全列表里找“精确文本”唯一命中，再考虑宽松匹配。
            items = textMatchedItems.length ? textMatchedItems : (dateKey ? pickByText(beforeDateFilter) : textMatchedItems);
        }

        // ★ 没给任何线索时不猜，交回确认流程。
        if (!matchId && !matchTextKey && !dateKey) return [];
        return items;
    },

    formatTodoLabel(item) {
        if (!item) return '未知 TODO';
        const dateText = item.dateKey || this.getTodayKey();
        const timeText = item.startTime && item.endTime ? ` ${item.startTime}-${item.endTime}` : '';
        return `${dateText}${timeText}：${item.text}`;
    }
};
// ★★★★★ Agent TODO Manager END：独立工具层 ★★★★★
