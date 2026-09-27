// =========================================
// CHARACTER SCHEDULE (探索角色日程)
// 只负责日程数据的日期、解析、校验和 system prompt 文案。
// 页面渲染和按钮事件仍然留在 App 里，避免工具层碰 DOM。
//
// 函数目录：
//   - pad(num): 数字补零
//   - getTodayKey(now): 获取今天日期 key
//   - getSchedule(contactId): 查找某个角色的日程
//   - ensureSchedule(contactId): 没有日程时创建默认壳数据
//   - isFresh(schedule, now): 判断日程是否是今天可用
//   - timeToMinutes(value) / minutesToTime(minutes): 时间和分钟数互转
//   - extractJson(rawText): 从 AI 返回里抽出 JSON
//   - normalizeEntries(rawEntries): 统一 AI 返回条目的字段
//   - validateEntries(entries): 校验条目必须连续覆盖 24 小时
//   - parseAiSchedule(rawText): 解析并校验 AI 日程
//   - getRecentHistoryText(contact, count): 提取最近聊天作为轻微参考
//   - buildGenerationMessages(contact, now): 生成请求 AI 产生日程的 messages
//   - findEntryIndex(entries, now): 找到当前时间对应的日程项
//   - buildChatPrompt(contactId, now): 生成聊天注入的当前/上一段/下一段
// =========================================

// ★★★★★ 角色日程 START：独立工具层 ★★★★★
const CharacterSchedule = {
    maxRetry: 2,

    pad(num) {
        return String(num).padStart(2, '0');
    },

    getTodayKey(now = new Date()) {
        if (typeof TodoContext !== 'undefined' && TodoContext.getTodayKey) {
            return TodoContext.getTodayKey(now);
        }
        return `${now.getFullYear()}-${this.pad(now.getMonth() + 1)}-${this.pad(now.getDate())}`;
    },

    getSchedule(contactId) {
        return (STATE.characterSchedules || []).find(item => item && item.charId === contactId) || null;
    },

    ensureSchedule(contactId) {
        // ★ 日程按角色保存：第一次点开或打开开关时，先给这个角色补一个空壳。
        let schedule = this.getSchedule(contactId);
        if (!schedule) {
            schedule = {
                charId: contactId,
                enabled: false,
                dateKey: '',
                entries: [],
                generatedAt: null,
                updatedAt: Date.now()
            };
            STATE.characterSchedules.push(schedule);
        }
        if (!Array.isArray(schedule.entries)) schedule.entries = [];
        return schedule;
    },

    isFresh(schedule, now = new Date()) {
        return !!(schedule && schedule.dateKey === this.getTodayKey(now) && Array.isArray(schedule.entries) && schedule.entries.length);
    },

    timeToMinutes(value) {
        if (value === '24:00') return 1440;
        const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
        if (!match) return NaN;
        return Number(match[1]) * 60 + Number(match[2]);
    },

    minutesToTime(minutes) {
        if (minutes >= 1440) return '24:00';
        return `${this.pad(Math.floor(minutes / 60))}:${this.pad(minutes % 60)}`;
    },

    extractJson(rawText) {
        const text = String(rawText || '').trim();
        if (!text) throw new Error('AI 返回为空');

        try {
            return JSON.parse(text);
        } catch (error) {
            // ★ 兼容模型偷偷包了 ```json 代码块，或者在 JSON 前后加了废话。
            const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fenced) return JSON.parse(fenced[1].trim());

            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start >= 0 && end > start) {
                return JSON.parse(text.slice(start, end + 1));
            }
            throw error;
        }
    },

    normalizeEntries(rawEntries) {
        if (!Array.isArray(rawEntries)) throw new Error('entries 必须是数组');
        // ★ 允许模型用 activity/title 这种近义字段，但最终统一成 start/end/text。
        const entries = rawEntries.map((item, index) => ({
            id: item.id || `schedule_entry_${Date.now()}_${index}`,
            start: String(item.start || item.startTime || '').trim(),
            end: String(item.end || item.endTime || '').trim(),
            text: String(item.text || item.activity || item.title || '').trim()
        }));
        return entries.sort((a, b) => this.timeToMinutes(a.start) - this.timeToMinutes(b.start));
    },

    validateEntries(entries) {
        if (!Array.isArray(entries) || entries.length < 4 || entries.length > 32) {
            throw new Error('日程条数需要在 4 到 32 条之间');
        }

        // ★ cursor 像一根时间尺：每条的 start 必须接上上一条的 end。
        let cursor = 0;
        entries.forEach((entry, index) => {
            const start = this.timeToMinutes(entry.start);
            const end = this.timeToMinutes(entry.end);
            if (!Number.isFinite(start) || !Number.isFinite(end)) {
                throw new Error(`第 ${index + 1} 条时间格式不正确`);
            }
            if (!entry.text) throw new Error(`第 ${index + 1} 条内容为空`);
            if (start !== cursor) throw new Error(`第 ${index + 1} 条没有连续覆盖 24 小时`);
            if (end <= start) throw new Error(`第 ${index + 1} 条结束时间必须晚于开始时间`);
            cursor = end;
        });

        if (cursor !== 1440) throw new Error('日程必须覆盖到 24:00');
        return true;
    },

    parseAiSchedule(rawText) {
        const data = this.extractJson(rawText);
        const rawEntries = Array.isArray(data) ? data : data.entries;
        const entries = this.normalizeEntries(rawEntries);
        this.validateEntries(entries);
        return entries;
    },

    getRecentHistoryText(contact, count = 10) {
        // ★★★ 日程生成的最近聊天参考也走统一 AI 可见历史，隐藏内容不会进入生成日程的 API。★★★
        const rows = HistoryVisibility.collectVisibleMessages(contact, {
            limit: count,
            preserveTimestamp: false,
            includeImageDescription: false,
            maxChars: 260
        }).map(msg => {
            const role = msg.role === 'assistant' ? contact.name : '用户';
            return `${role}: ${msg.content}`;
        });
        return rows.length ? rows.join('\n') : '暂无最近聊天记录。';
    },

    buildGenerationMessages(contact, now = new Date()) {
        const dateKey = this.getTodayKey(now);
        // ★ 这里强约束 JSON 和 24h 覆盖；解析失败时 App 层会静默重试。
        const prompt = [
            '你要为一个虚拟聊天角色生成“今天的一整天日程”。',
            '请只返回 JSON，不要 Markdown，不要解释。',
            '',
            'JSON 格式必须是：',
            '{"entries":[{"start":"00:00","end":"07:30","text":"睡觉"}]}',
            '',
            '硬性要求：',
            '- entries 必须从 00:00 连续覆盖到 24:00。',
            '- 时间格式必须是 HH:mm，最后一条 end 必须是 24:00。',
            '- 不允许时间重叠，不允许时间空档。',
            '- 每条 text 简短自然，像真实一天会做的事。',
            '- 日程要贴合角色设定，但不要把一天安排得过满。',
            '- 最近 10 条聊天只作为轻微参考，不能让全天日程全部围绕这些聊天展开。',
            '- 不要生成危险、血腥、露骨、仇恨或明显冒犯用户的内容。',
            '',
            `今天日期：${dateKey}`,
            '',
            '【角色设定】',
            contact.prompt || '暂无角色设定。',
            '',
            '【最近聊天，仅供参考】',
            this.getRecentHistoryText(contact, 10)
        ].join('\n');

        return [{ role: 'system', content: prompt }];
    },

    findEntryIndex(entries, now = new Date()) {
        const minute = now.getHours() * 60 + now.getMinutes();
        // ★ 命中规则是左闭右开：21:00 属于 21:00-23:00，不属于上一段。
        return entries.findIndex(entry => {
            const start = this.timeToMinutes(entry.start);
            const end = this.timeToMinutes(entry.end);
            return minute >= start && minute < end;
        });
    },

    buildChatPrompt(contactId, now = new Date()) {
        const schedule = this.getSchedule(contactId);
        if (!schedule || schedule.enabled !== true || !this.isFresh(schedule, now)) return '';

        const entries = schedule.entries || [];
        const currentIndex = this.findEntryIndex(entries, now);
        if (currentIndex < 0) return '';

        // ★ 聊天里只注入当前 + 前后各一段，少占 token，也不会把全天安排压给 AI。
        const prev = entries[currentIndex - 1] || null;
        const current = entries[currentIndex];
        const next = entries[currentIndex + 1] || null;
        const lines = [
            '# 角色当前日程',
            `当前时间：${this.minutesToTime(now.getHours() * 60 + now.getMinutes())}`,
            `当前：${current.start}-${current.end} ${current.text}`
        ];

        if (prev) lines.push(`上一段：${prev.start}-${prev.end} ${prev.text}`);
        if (next) lines.push(`下一段：${next.start}-${next.end} ${next.text}`);

        return lines.join('\n');
    }
};
// ★★★★★ 角色日程 END：独立工具层 ★★★★★
