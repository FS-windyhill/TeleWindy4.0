// =========================================
// PHONE HISTORY (探索通话记录)
// ★ 联系人 → 按日分组的电话 → 只读原文；复用心笺卡片和通话气泡，不启动音频会话。
// =========================================
const PhoneHistory = {
    contactId: null,
    recordId: null,
    arrow: '<span class="heart-note-contact-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6L16 12L9 18"/></svg></span>',
    records(contact) { return [...(contact.phoneRecords || [])].sort((a, b) => b.startedAt - a.startedAt); },
    duration(record) {
        const seconds = Math.max(0, Math.floor(((record.endedAt || record.updatedAt) - record.startedAt) / 1000)) || 0;
        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    },
    time(value) { return new Date(value).toLocaleString('zh-CN', { hour12: false }); },
    day(value) {
        const date = new Date(value), today = new Date(), yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const key = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        return key(date) === key(today) ? '今天' : key(date) === key(yesterday) ? '昨天' : date.toLocaleDateString('zh-CN');
    },
    card(contact, subtitle, onClick, avatar = true) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `heart-note-contact phone-history-card${avatar ? '' : ' phone-history-call'}`;
        // ★ 名字/时间统一转义；原文详情使用 textContent，角色文本不能变成页面 HTML。
        button.innerHTML = `${avatar ? App.renderHeartNoteAvatar(contact) : ''}<span class="heart-note-contact-info"><span class="heart-note-contact-name">${App.escapeHtml(contact.name)}</span><span class="heart-note-contact-status">${App.escapeHtml(subtitle)}</span></span>${this.arrow}`;
        button.addEventListener('click', onClick);
        return button;
    },
    render(view) {
        const contact = STATE.contacts.find(c => c.id === this.contactId);
        if (view === 'phone-history') {
            const list = document.getElementById('phone-history-contacts');
            list.replaceChildren();
            // ★ 全量展示且不修改通讯录顺序；最近通话者置前，其余联系人及同时间者保持原顺序。
            const contacts = [...STATE.contacts].sort((a, b) =>
                (this.records(b)[0]?.startedAt || 0) - (this.records(a)[0]?.startedAt || 0));
            document.getElementById('phone-history-empty').hidden = !!contacts.length;
            contacts.forEach(c => list.append(this.card(c,
                c.phoneRecords?.length ? `${this.time(this.records(c)[0].startedAt)} · 共 ${c.phoneRecords.length} 通` : '暂无通话记录', () => {
                    this.contactId = c.id; UI.switchView('phone-history-calls');
                })));
            return;
        }
        if (!contact) { UI.switchView('phone-history'); return; }
        if (view === 'phone-history-calls') {
            document.getElementById('phone-history-calls-title').textContent = `${contact.name}的通话记录`;
            const list = document.getElementById('phone-history-calls-list');
            list.replaceChildren();
            // ★ 没打过电话的联系人也能进入，使用明确的空态提示，避免出现空白页面。
            document.getElementById('phone-history-calls-empty').hidden = !!contact.phoneRecords?.length;
            let lastDay;
            this.records(contact).forEach(record => {
                const day = this.day(record.startedAt);
                if (lastDay !== day) {
                    const heading = document.createElement('h2');
                    heading.className = 'phone-history-day'; heading.textContent = day;
                    list.append(heading); lastDay = day;
                }
                list.append(this.card({ name: this.time(record.startedAt) },
                    `${record.endedAt ? '通话' : '通话中断'} ${this.duration(record)}`, () => {
                        this.recordId = record.id; UI.switchView('phone-history-detail');
                    }, false));
            });
            return;
        }
        const record = contact.phoneRecords?.find(r => r.id === this.recordId);
        if (!record) { UI.switchView('phone-history-calls'); return; }
        const avatar = document.getElementById('phone-history-avatar');
        avatar.innerHTML = App.renderHeartNoteAvatar(contact);
        document.getElementById('phone-history-name').textContent = contact.name;
        document.getElementById('phone-history-meta').textContent = `${this.time(record.startedAt)} · ${record.endedAt ? '通话' : '通话中断'} ${this.duration(record)}`;
        const transcript = document.getElementById('phone-history-transcript');
        transcript.replaceChildren();
        record.messages.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `phone-bubble ${message.role === 'user' ? 'user' : 'assistant'}`;
            bubble.textContent = message.content;
            if (message.role === 'assistant' && !message.heard) {
                const note = document.createElement('small');
                note.className = 'phone-history-unheard'; note.textContent = '未完整播放';
                bubble.append(note);
            }
            transcript.append(bubble);
        });
        // ★ 历史从第一句阅读；每次进入重新归顶，不继承上一通电话的位置。
        transcript.scrollTop = 0;
    },
    init() {
        document.getElementById('explore-phone-history-btn').addEventListener('click', () => UI.switchView('phone-history'));
        [['phone-history', 'explore'], ['phone-history-calls', 'phone-history'], ['phone-history-detail', 'phone-history-calls']]
            .forEach(([page, back]) => document.getElementById(`${page}-back-btn`).addEventListener('click', () => UI.switchView(back)));
    }
};
document.addEventListener('DOMContentLoaded', () => PhoneHistory.init());
