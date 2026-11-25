// =========================================
// XI SHI (探索夕拾)
// ★ 保存整组或单个气泡的独立快照；不引用聊天正文、不注入上下文，也不提供 Agent 操作入口。
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
        return this.collectMany(contact, [{ message }], source);
    },

    // ★ 批量收藏一次落盘，每个气泡单独成条；整组与单气泡使用不同身份，互不覆盖。
    collectMany(contact, targets, source = 'history') {
        let needsSave = false;
        const snapshots = targets.flatMap(({ message, key }) => {
            if (!contact?.[source]?.includes(message)) return [];
            if (!message.messageId) { message.messageId = ChatBubbles.newKey(); needsSave = true; }
            let text = String(message.content || ''), images = message.images,
                imageDescription = message.image_description, imageExpired = message.isImageExpired;
            let bubbleType = '', bubbleOrder = -1;
            if (key) {
                ChatBubbles.ensure(message);
                needsSave = true; // ★ 单气泡 key 必须先落盘，刷新后才能继续准确去重。
                const index = ChatBubbles.indexOf(message, key);
                if (index === null) return [];
                const parsed = ChatBubbles.parse(message);
                bubbleType = index === 'thought' ? 'thought' : index === message.bubbleIds.length ? 'image' : 'text';
                bubbleOrder = index === 'thought' ? -1 : index;
                text = bubbleType === 'thought' ? parsed.thought : bubbleType === 'text' ? parsed.parts[index] : '';
                if (bubbleType !== 'image') { images = []; imageDescription = ''; imageExpired = false; }
            }
            // ★ 立即复制正文、时间和图片，排队保存期间原消息被编辑或删除也不改变这份纪念。
            return [{
                id: ChatBubbles.newKey(), contactId: contact.id, source,
                sourceMessageId: String(message.messageId), role: message.role,
                sourceBubbleKey: key || '', bubbleType, bubbleOrder,
                sourceOrder: contact[source].indexOf(message),
                text, images: Array.isArray(images) ? images.filter(url => typeof url === 'string') : [],
                imageDescription: String(imageDescription || ''), imageExpired: imageExpired === true,
                messageTime: message.timestamp || message.eventAt || message.recordedAt || '',
                messageTimeMs: this.parseTime(message.eventAt) || this.parseTime(message.timestamp) || this.parseTime(message.recordedAt),
                collectedAt: Date.now(), starredAt: 0
            }];
        });
        if (!snapshots.length) return Promise.resolve(false);
        return this.enqueue(async () => {
            // ★ 极旧消息先补存稳定身份；不能使用会随插入/删除变化的历史数组下标去重。
            if (needsSave) await Storage.saveContacts();
            const next = [...(STATE.xiShiRecords || [])];
            const previousCount = next.length;
            snapshots.forEach(snapshot => {
                if (!next.some(record => record.contactId === contact.id && record.source === source
                    && record.sourceMessageId === snapshot.sourceMessageId
                    && (record.sourceBubbleKey || '') === snapshot.sourceBubbleKey)) next.push(snapshot);
            });
            if (next.length === previousCount) {
                Toast.show('已收藏到夕拾', { icon: 'xi-shi' });
                return false;
            }
            await Storage.saveXiShi(next);
            STATE.xiShiRecords = next;
            Toast.show('已收藏到夕拾', { icon: 'xi-shi' });
            return true;
        });
    },

    content(record) {
        if (record.bubbleType === 'thought') return { text: '', thought: record.text };
        // ★ 用户消息的系统时间戳移到卡片左上角；角色自己写的日期和文字保持原样。
        let text = record.role === 'user' && !record.bubbleType ? record.text.replace(ChatBubbles.timestampRegex, '') : record.text;
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
        const html = this.renderMarkdown(thought, keyword);
        return `<details class="xi-shi-thought"><summary aria-label="思考过程"></summary><div class="xi-shi-thought-content">${html}</div></details>`;
    },

    handleThoughtClick(event) {
        const details = event.target.closest('.xi-shi-thought');
        if (!details) return false;
        // ★ summary 沿用原生展开/收起；展开后点击模块其余任意位置收起，划选复制时保持展开。
        if (!event.target.closest('summary, button, a, .code-block') && details.open && !window.getSelection()?.toString().length) {
            details.removeAttribute('open');
        }
        return true;
    },

    // ★ 不给缺年份的旧时间猜年份；优先快照中的实际时间，旧记录再查原消息，最后按原聊天位置稳定排序。
    parseTime(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const text = String(value || '').trim();
        if (!/^\d{4}[-/]/.test(text)) return 0;
        const time = new Date(text.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T')).getTime();
        return Number.isFinite(time) ? time : 0;
    },

    chronology(record) {
        const contact = STATE.contacts.find(item => item.id === record.contactId);
        const history = contact?.[record.source] || [];
        const index = history.findIndex(item => String(item?.messageId) === record.sourceMessageId);
        const message = history[index];
        return {
            time: record.messageTimeMs || this.parseTime(record.messageTime)
                || this.parseTime(message?.eventAt) || this.parseTime(message?.timestamp) || this.parseTime(message?.recordedAt),
            order: Number.isInteger(record.sourceOrder) ? record.sourceOrder : index,
            bubble: record.bubbleOrder ?? -1
        };
    },

    sorted(keyword = '') {
        const positions = new Map(this.records().map(record => [record, this.chronology(record)]));
        return this.records().filter(record => App.matchesSearch(this.text(record), keyword))
            .sort((a, b) => Number(!!b.starredAt) - Number(!!a.starredAt)
                || positions.get(b).time - positions.get(a).time
                || positions.get(b).order - positions.get(a).order
                || positions.get(b).bubble - positions.get(a).bubble);
    },

    // ★ 分段复用聊天规则，独立的 --- 使用相同渐变线；代码围栏由 ChatBubbles.split 保护。
    renderMarkdown(text, keyword = '') {
        const html = ChatBubbles.split(text).map(part => part.trim() === '---'
            ? '<div class="chat-separator"></div>' : parseCustomMarkdown(part)).join('');
        if (!keyword) return html;
        const template = document.createElement('template');
        template.innerHTML = html;
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            // ★ 公式有可视与无障碍两套节点，跳过以免破坏 KaTeX；代码按钮和语言名也不参与正文高亮。
            if (!node.parentElement?.closest('.katex, .code-block-toolbar, script, style')) nodes.push(node);
        }
        nodes.forEach(node => {
            if (!App.matchesSearch(node.nodeValue, keyword)) return;
            const mark = document.createElement('template');
            mark.innerHTML = App.highlightSearchText(node.nodeValue, keyword);
            node.replaceWith(mark.content);
        });
        return template.innerHTML;
    },

    renderText(text, keyword) {
        const html = this.renderMarkdown(text, keyword);
        if (!keyword) return html;
        const preview = App.buildSearchResultPreview(text, keyword);
        if (preview === `<div class="search-result-snippet">${App.highlightSearchText(text, keyword)}</div>`) return html;
        return `<details class="inline-search-detail"><summary><span class="inline-search-preview">${preview}</span><span class="inline-search-expand">展开全文</span><span class="inline-search-collapse">收起全文</span></summary><div class="inline-search-full">${html}</div></details>`;
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
                ${content.text ? `<div class="heart-note-text xi-shi-text">${this.renderText(content.text, keyword)}</div>` : ''}
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
        document.getElementById('xi-shi-list').addEventListener('click', async event => {
            const copy = event.target.closest('.code-copy-btn');
            if (copy) {
                event.preventDefault();
                event.stopPropagation();
                if (copy.disabled) return;
                const code = copy.closest('.code-block')?.querySelector('pre code');
                if (!code) return;
                copy.disabled = true;
                try {
                    await copyPlainText(code.textContent || '');
                    setCodeCopyButtonIcon(copy, true);
                    copy.classList.add('is-copied');
                } catch (error) {
                    Toast.show('复制失败，请重试', { icon: 'triangle-exclamation-point' });
                } finally {
                    setTimeout(() => {
                        setCodeCopyButtonIcon(copy, false);
                        copy.classList.remove('is-copied');
                        copy.disabled = false;
                    }, 1600);
                }
                return;
            }
            if (this.handleThoughtClick(event)) return;
            const button = event.target.closest('button[data-action]');
            const card = button?.closest('.xi-shi-card');
            if (card) this.update(card.dataset.id, button.dataset.action === 'remove');
        });
    }
};

document.addEventListener('DOMContentLoaded', () => XiShi.init());
