// =========================================
// XI SHI (探索夕拾)
// ★ 只保存用户收藏时的整组快照；不引用聊天正文、不注入上下文，也不提供 Agent 操作入口。
// =========================================
const XiShi = {
    contactId: null,
    pending: Promise.resolve(),

    records(contactId = this.contactId) {
        return (STATE.xiShiRecords || []).filter(record => record.contactId === contactId);
    },

    // ★ 所有写入串行处理，先落盘再替换内存；连点和保存失败都不能造成重复收藏或假成功。
    enqueue(task) {
        this.pending = this.pending.then(task).catch(error => {
            console.warn('[夕拾] 保存失败:', error);
            Toast.show('夕拾保存失败，请重试', { icon: 'triangle-exclamation-point' });
            return false;
        });
        return this.pending;
    },

    collect(contact, message, source = 'history') {
        if (!contact?.[source]?.includes(message)) return Promise.resolve(false);
        const needsId = !message.messageId;
        if (needsId) message.messageId = ChatBubbles.newKey();
        // ★ 立即复制正文、时间和图片，排队保存期间原消息被编辑或删除也不改变这份纪念。
        const snapshot = {
            id: ChatBubbles.newKey(), contactId: contact.id, source,
            sourceMessageId: String(message.messageId), role: message.role,
            text: String(message.content || ''),
            images: Array.isArray(message.images) ? message.images.filter(url => typeof url === 'string') : [],
            imageDescription: String(message.image_description || ''),
            imageExpired: message.isImageExpired === true,
            messageTime: message.timestamp || message.eventAt || message.recordedAt || '',
            collectedAt: Date.now(), starredAt: 0
        };
        return this.enqueue(async () => {
            if (this.records(contact.id).some(record => record.source === source
                && record.sourceMessageId === snapshot.sourceMessageId)) {
                Toast.show('已收藏到夕拾');
                return false;
            }
            // ★ 极旧消息先补存稳定身份；不能使用会随插入/删除变化的历史数组下标去重。
            if (needsId) await Storage.saveContacts();
            const next = [...(STATE.xiShiRecords || []), snapshot];
            await Storage.saveXiShi(next);
            STATE.xiShiRecords = next;
            Toast.show('已收藏到夕拾');
            return true;
        });
    },

    content(record) {
        // ★ 用户消息的系统时间戳移到卡片左上角；角色自己写的日期和文字保持原样。
        let text = record.role === 'user' ? record.text.replace(ChatBubbles.timestampRegex, '') : record.text;
        const thoughts = [];
        // ★ 只拆分角色快照中的思考块，兼容聊天使用的三种标签和未闭合块；原始快照不改写。
        if (record.role === 'assistant') {
            text = text.replace(ChatBubbles.thoughtRegex, (_match, inner) => {
                if (inner.trim()) thoughts.push(inner.trim());
                return '';
            }).trim();
        }
        const imageText = record.imageDescription ? `[图片描述] ${record.imageDescription}`
            : record.imageExpired && !record.images?.length ? '[图片（原图已清理）]' : '';
        return { text: [text, imageText].filter(Boolean).join('\n\n'), thought: thoughts.join('\n\n') };
    },

    text(record) {
        // ★ 全文搜索继续覆盖折叠的思考链，不把标签本身当成正文，也不受展开状态影响。
        const content = this.content(record);
        return [content.thought, content.text].filter(Boolean).join('\n\n');
    },

    renderThought(thought, keyword) {
        if (!thought) return '';
        // ★ 沿用聊天的 Markdown 解析，折叠面板使用夕拾独立类名；搜索高亮避免嵌套摘要。
        const html = keyword ? App.highlightSearchText(thought, keyword) : parseCustomMarkdown(thought);
        return `<details class="xi-shi-thought"><summary aria-label="思考过程"></summary><div class="xi-shi-thought-content">${html}</div></details>`;
    },

    handleThoughtClick(event) {
        const details = event.target.closest('.xi-shi-thought');
        if (!details) return false;
        // ★ summary 沿用原生展开/收起；展开后点击模块其余任意位置收起，划选复制时保持展开。
        if (!event.target.closest('summary') && details.open && !window.getSelection()?.toString().length) {
            details.removeAttribute('open');
        }
        return true;
    },

    sorted(keyword = '') {
        return this.records().filter(record => App.matchesSearch(this.text(record), keyword))
            .sort((a, b) => Number(!!b.starredAt) - Number(!!a.starredAt)
                || (b.starredAt || b.collectedAt) - (a.starredAt || a.collectedAt));
    },

    time(record) {
        if (typeof record.messageTime === 'string' && record.messageTime.trim()) return record.messageTime;
        return new Date(record.messageTime || record.collectedAt).toLocaleString('zh-CN', { hour12: false });
    },

    update(id, remove = false) {
        const contactId = this.contactId;
        if (remove && !confirm('确定取消收藏吗？不会删除聊天记录原文')) return Promise.resolve(false);
        return this.enqueue(async () => {
            const records = STATE.xiShiRecords || [];
            const record = records.find(item => item.id === id && item.contactId === contactId);
            if (!record) return false;
            // ★ 星标只决定展示顺序，独立于心笺的 alwaysInject；取消收藏只移除此表中的快照。
            const next = remove ? records.filter(item => item !== record)
                : records.map(item => item === record ? { ...item, starredAt: item.starredAt ? 0 : Date.now() } : item);
            await Storage.saveXiShi(next);
            STATE.xiShiRecords = next;
            if (this.contactId === contactId) this.render('xi-shi-detail');
            return true;
        });
    },

    render(view) {
        if (view === 'xi-shi') {
            const list = document.getElementById('xi-shi-contacts');
            list.replaceChildren();
            document.getElementById('xi-shi-empty').hidden = !!STATE.contacts.length;
            STATE.contacts.forEach(contact => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'heart-note-contact xi-shi-contact';
                button.innerHTML = `${App.renderHeartNoteAvatar(contact)}<span class="heart-note-contact-info"><span class="heart-note-contact-name">${App.escapeHtml(contact.name)}</span><span class="heart-note-contact-status">共 ${this.records(contact.id).length} 条夕拾</span></span><span class="heart-note-contact-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6L16 12L9 18"/></svg></span>`;
                button.addEventListener('click', () => {
                    this.contactId = contact.id;
                    UI.switchView('xi-shi-detail');
                });
                list.append(button);
            });
            return;
        }
        const contact = STATE.contacts.find(item => item.id === this.contactId);
        if (!contact) { UI.switchView('xi-shi'); return; }
        document.getElementById('xi-shi-detail-title').textContent = `${contact.name}的夕拾`;
        // ★ 复用列表搜索的中文输入、全文匹配和摘要高亮；夕拾拥有独立 scope，换角色自动清空。
        const keyword = App.getInlineSearch('xi-shi', contact.id, () => this.render('xi-shi-detail'));
        const records = this.sorted(keyword);
        App.setInlineSearchStatus('xi-shi', keyword, records.length
            ? `找到 ${records.length} 条夕拾` : `没有找到包含“${keyword}”的夕拾`);
        const list = document.getElementById('xi-shi-list');
        list.replaceChildren();
        document.getElementById('xi-shi-detail-empty').hidden = !!records.length || !!keyword;
        records.forEach(record => {
            const card = document.createElement('article');
            card.className = 'heart-note-card xi-shi-card';
            card.dataset.id = record.id;
            // ★ Pin 图形与角色记忆一致，使用夕拾独立类名；署名按快照 role 区分我和对方。
            const speaker = record.role === 'user' ? '我' : contact.name;
            const content = this.content(record);
            card.innerHTML = `
                <div class="heart-note-card-foot">
                    <span class="heart-note-time">${App.escapeHtml(this.time(record))}</span>
                    <div class="heart-note-actions">
                        <button type="button" class="xi-shi-icon-btn xi-shi-pin-btn${record.starredAt ? ' active' : ''}" data-action="star" title="${record.starredAt ? '取消星标' : '星标'}" aria-label="${record.starredAt ? '取消星标' : '星标'}" aria-pressed="${!!record.starredAt}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path class="xi-shi-pin-shape" d="M12 17v5"></path>
                                <path class="xi-shi-pin-shape" d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path>
                            </svg>
                        </button>
                        <button type="button" class="xi-shi-icon-btn danger" data-action="remove" title="取消收藏" aria-label="取消收藏"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
                    </div>
                </div>
                ${this.renderThought(content.thought, keyword)}
                ${content.text ? `<div class="heart-note-text xi-shi-text">${App.renderSearchableText(content.text, keyword)}</div>` : ''}
                <div class="xi-shi-source">- 来自${App.escapeHtml(speaker)} -</div>
            `;
            // ★ 图片快照独立保存；只接受图片 data URL 和 HTTP(S)，不将聊天内容作为 HTML 执行。
            (record.images || []).forEach(url => {
                if (!/^(?:data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,|https?:\/\/)/i.test(url)) return;
                const image = document.createElement('img');
                image.className = 'xi-shi-image'; image.src = url; image.alt = '收藏的聊天图片'; image.loading = 'lazy';
                card.append(image);
            });
            list.append(card);
        });
    },

    init() {
        document.getElementById('explore-xi-shi-btn').addEventListener('click', () => UI.switchView('xi-shi'));
        [['xi-shi', 'explore'], ['xi-shi-detail', 'xi-shi']].forEach(([page, back]) => {
            document.getElementById(`${page}-back-btn`).addEventListener('click', () => UI.switchView(back));
        });
        document.getElementById('xi-shi-list').addEventListener('click', event => {
            if (this.handleThoughtClick(event)) return;
            const button = event.target.closest('button[data-action]');
            const card = button?.closest('.xi-shi-card');
            if (card) this.update(card.dataset.id, button.dataset.action === 'remove');
        });
    }
};

document.addEventListener('DOMContentLoaded', () => XiShi.init());
