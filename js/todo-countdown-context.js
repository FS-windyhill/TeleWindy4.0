// =========================================
// TODO / COUNTDOWN CONTEXT (探索 TO DO / 倒数日)
// 从 script.js 拆出来的独立工具层：只负责日期、排序和 system prompt 文案。
// 页面按钮、弹窗、列表渲染仍然留在 App 里。
// =========================================

// ★★★★★ 探索 TO DO / 倒数日 START：独立工具层 ★★★★★
const TodoContext = {
    weekNameMap: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],

    pad(num) {
        return String(num).padStart(2, '0');
    },

    toDateKey(date) {
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
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

    getTodayKey(now = new Date()) {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return this.toDateKey(today);
    },

    diffDays(dateKey, now = new Date()) {
        const target = this.fromDateKey(dateKey);
        const today = this.fromDateKey(this.getTodayKey(now));
        return Math.round((target - today) / 86400000);
    },

    formatMonthLabel(dateKey) {
        const date = this.fromDateKey(dateKey);
        return `${date.getFullYear()} - ${this.pad(date.getMonth() + 1)}`;
    },

    formatMonthRangeLabel(startDate) {
        // ★ 胶囊显示的是这一屏 7 天的范围，不跟着“选中日期”来回跳。
        const start = new Date(startDate);
        const end = this.addDays(start, 6);
        const startText = `${start.getFullYear()} - ${this.pad(start.getMonth() + 1)}`;
        const endText = `${end.getFullYear()} - ${this.pad(end.getMonth() + 1)}`;

        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
            return startText;
        }
        if (start.getFullYear() === end.getFullYear()) {
            return `${start.getFullYear()} - ${this.pad(start.getMonth() + 1)} / ${this.pad(end.getMonth() + 1)}`;
        }
        return `${startText} / ${endText}`;
    },

    formatDateLabel(dateKey) {
        const date = this.fromDateKey(dateKey);
        return `${date.getFullYear()} - ${this.pad(date.getMonth() + 1)} - ${this.pad(date.getDate())}`;
    },

    formatWeekLabel(dateKey) {
        return this.weekNameMap[this.fromDateKey(dateKey).getDay()] || '';
    },

    limitForPrompt(items) {
        // ★ 预留限制函数：第一版先无限注入，后面要做“最多注入 N 条”时改这里。
        return items;
    },

    hasTodoTime(item) {
        return !!(item && item.startTime && item.endTime);
    },

    compareTodoPlans(a, b) {
        // ★ prompt 里的排序和页面一致：未归档在前；同组内有时间的先按开始时间排。
        const aArchived = a.done === true || a.cancelled === true;
        const bArchived = b.done === true || b.cancelled === true;
        if (aArchived !== bArchived) return aArchived ? 1 : -1;

        const aHasTime = this.hasTodoTime(a);
        const bHasTime = this.hasTodoTime(b);
        if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
        if (aHasTime && bHasTime) {
            if (a.startTime !== b.startTime) return String(a.startTime).localeCompare(String(b.startTime));
            if (a.endTime !== b.endTime) return String(a.endTime).localeCompare(String(b.endTime));
        }

        return (a.createdAt || 0) - (b.createdAt || 0);
    },

    formatTodoPromptText(item) {
        const timeText = this.hasTodoTime(item) ? `${item.startTime}-${item.endTime}｜` : '';
        return `${timeText}${item.text}`;
    },

    buildPrompt(now = new Date()) {
        const sections = [];

        if (STATE.settings.TODO_PLAN_INJECT_ENABLED === true) {
            const todoLines = this.buildTodoPromptLines(now);
            if (todoLines.length) {
                sections.push('## TODO 计划', ...todoLines);
            }
        }

        if (STATE.settings.COUNTDOWN_INJECT_ENABLED === true) {
            const countdownLines = this.buildCountdownPromptLines(now);
            const countupLines = this.buildCountupPromptLines(now);

            if (countdownLines.length || countupLines.length) {
                if (sections.length) sections.push('');
                sections.push('## 日期提醒');
            }
            if (countdownLines.length) {
                sections.push('', '### 倒数日', ...countdownLines);
            }
            if (countupLines.length) {
                sections.push('', '### 正数日', ...countupLines);
            }
        }

        if (!sections.length) return '';
        return ['# 用户计划', '', ...sections].join('\n');
    },

    buildTodoPromptLines(now = new Date()) {
        const todayKey = this.getTodayKey(now);
        const visiblePlans = (STATE.todoPlans || [])
            .filter(item => item && item.text && item.cancelled !== true && (item.dateKey >= todayKey || item.done !== true))
            .sort((a, b) => {
                if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
                return this.compareTodoPlans(a, b);
            });

        const limited = this.limitForPrompt(visiblePlans);
        const overdue = limited
            .filter(item => item.dateKey < todayKey && item.done !== true)
            .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || this.compareTodoPlans(a, b));
        const todayPlans = limited
            .filter(item => item.dateKey === todayKey)
            .sort((a, b) => this.compareTodoPlans(a, b));
        const todayActivePlans = todayPlans.filter(item => item.done !== true);
        const todayDonePlans = todayPlans.filter(item => item.done === true);
        const futurePlans = limited
            .filter(item => item.dateKey > todayKey)
            .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || this.compareTodoPlans(a, b));
        const lines = [];

        if (overdue.length) {
            lines.push('', '### 逾期未完成');
            overdue.forEach(item => {
                lines.push(`- ${this.formatDateLabel(item.dateKey)}：${this.formatTodoPromptText(item)}`);
            });
        }

        if (todayActivePlans.length) {
            lines.push('', '### 今天未完成');
            todayActivePlans.forEach(item => {
                lines.push(`- ${this.formatTodoPromptText(item)}`);
            });
        }

        if (todayDonePlans.length) {
            lines.push('', '### 今天已完成');
            todayDonePlans.forEach(item => {
                lines.push(`- ${this.formatTodoPromptText(item)}`);
            });
        }

        if (futurePlans.length) {
            lines.push('', '### 未来计划');
            futurePlans.forEach(item => {
                lines.push(`- ${this.formatDateLabel(item.dateKey)}：${this.formatTodoPromptText(item)}`);
            });
        }

        return lines;
    },

    buildCountdownPromptLines(now = new Date()) {
        const items = (STATE.countdownDays || [])
            .filter(item => item && item.mode === 'down' && item.text && item.done !== true)
            .sort((a, b) => this.diffDays(a.dateKey, now) - this.diffDays(b.dateKey, now));

        return this.limitForPrompt(items).map(item => {
            const days = this.diffDays(item.dateKey, now);
            return days >= 0
                ? `- ${item.text}：还有 ${days} 天`
                : `- ${item.text}：已过去 ${Math.abs(days)} 天`;
        });
    },

    buildCountupPromptLines(now = new Date()) {
        const items = (STATE.countdownDays || [])
            .filter(item => item && item.mode === 'up' && item.text && item.done !== true)
            .sort((a, b) => this.diffDays(a.dateKey, now) - this.diffDays(b.dateKey, now));

        return this.limitForPrompt(items).map(item => {
            const days = -this.diffDays(item.dateKey, now);
            return `- ${item.text}：已有 ${days} 天`;
        });
    }
};
// ★★★★★ 探索 TO DO / 倒数日 END：独立工具层 ★★★★★
