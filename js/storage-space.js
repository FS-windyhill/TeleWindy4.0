// =========================================
// 存储空间管理：统计现有 IndexedDB 数据，按联系人清理聊天原图
// =========================================
const StorageSpace = {
    colors: ['#8b75df', '#70b9d2', '#efad78', '#80bf9d', '#d39ab9'],
    labels: ['聊天图片', '聊天文字', '其他图片', '其他文字', '设置及其他'],
    selectedSlice: null,
    scanning: false,
    rescanRequested: false,
    saving: false,

    // ★ 统一按 JSON 文本字节估算：饼图各项之和与顶部总数保持同一口径。
    bytes(value) {
        const json = JSON.stringify(value);
        return json === undefined ? 0 : new Blob([json]).size;
    },

    formatBytes(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    },

    // ★ 只统计内嵌图片字符串；远程 URL 和应用自带的 assets 文件不占这份数据库空间。
    imageBytes(value) {
        if (typeof value === 'string') {
            return /^data:image\//i.test(value) ? this.bytes(value) : 0;
        }
        if (Array.isArray(value)) return value.reduce((sum, item) => sum + this.imageBytes(item), 0);
        if (!value || typeof value !== 'object') return 0;
        return Object.values(value).reduce((sum, item) => sum + this.imageBytes(item), 0);
    },

    contactImageBytes(contact) {
        return (contact.history || []).reduce((sum, message) => sum + this.imageBytes(message.images), 0);
    },

    // ★ 老数据无需迁移：直接遍历已有 objectStore；联系人消息单独拆成聊天图片和聊天文字。
    async scan() {
        const totals = [0, 0, 0, 0, 0];
        const db = await DB.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DB.storeName, 'readonly');
            const request = tx.objectStore(DB.storeName).openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                const value = cursor.value;
                const recordBytes = this.bytes(value);
                if (cursor.key === CONFIG.STORAGE_KEY && Array.isArray(value)) {
                    let messageBytes = 0;
                    let otherImages = 0;
                    value.forEach(contact => {
                        (contact.history || []).forEach(message => {
                            const size = this.bytes(message);
                            const imageSize = Math.min(size, this.imageBytes(message.images));
                            totals[0] += imageSize;
                            totals[1] += size - imageSize;
                            messageBytes += size;
                        });
                        const metadata = { ...contact, history: null };
                        otherImages += this.imageBytes(metadata);
                    });
                    totals[2] += otherImages;
                    totals[3] += Math.max(0, recordBytes - messageBytes - otherImages);
                } else {
                    const imageSize = Math.min(recordBytes, this.imageBytes(value));
                    totals[2] += imageSize;
                    const rest = recordBytes - imageSize;
                    if (cursor.key === CONFIG.SETTINGS_KEY || cursor.key === CONFIG.MOMENTS_SETTINGS_KEY) totals[4] += rest;
                    else totals[3] += rest;
                }
                cursor.continue();
            };
            request.onerror = () => reject(request.error);
            tx.onerror = () => reject(tx.error);
            tx.oncomplete = () => resolve(totals);
        });
    },

    async open() {
        if (this.scanning) {
            this.rescanRequested = true;
            return;
        }
        this.scanning = true;
        this.selectedSlice = null;
        document.getElementById('storage-space-total').textContent = '正在统计 IndexedDB 数据…';
        try {
            this.totals = await this.scan();
            this.renderChart();
        } catch (error) {
            document.getElementById('storage-space-total').textContent = '统计失败，请稍后重试';
            throw error;
        } finally {
            this.scanning = false;
            // ★ 清理恰好遇到旧统计未结束时，再读一次刚保存的数据。
            if (this.rescanRequested) {
                this.rescanRequested = false;
                this.open().catch(error => console.warn('[存储空间管理] 重新统计失败:', error));
            }
        }
    },

    renderChart() {
        const totals = this.totals || [0, 0, 0, 0, 0];
        const total = totals.reduce((sum, value) => sum + value, 0);
        document.getElementById('storage-space-total').textContent = `当前 IndexedDB 数据约 ${this.formatBytes(total)}`;
        const chart = document.getElementById('storage-space-chart');
        const legend = document.getElementById('storage-space-legend');
        chart.textContent = '';
        legend.textContent = '';
        if (!total) {
            chart.textContent = '暂无已保存数据';
            chart.classList.add('storage-space-chart-empty');
            return;
        }
        chart.classList.remove('storage-space-chart-empty');
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 220 220');
        svg.setAttribute('aria-hidden', 'true');
        let offset = 0;
        totals.forEach((size, index) => {
            if (!size) return;
            const length = size / total;
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', '110');
            circle.setAttribute('cy', '110');
            circle.setAttribute('r', '82');
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', this.colors[index]);
            // ★ 圆环外缘为 82 + 17 = 99，完整落在 220 的 viewBox 内，桌面端不会溢出卡片。
            circle.setAttribute('stroke-width', '34');
            circle.setAttribute('stroke-dasharray', `${length * 100} ${100 - length * 100}`);
            circle.setAttribute('stroke-dashoffset', String(-offset * 100));
            circle.setAttribute('pathLength', '100');
            circle.setAttribute('transform', 'rotate(-90 110 110)');
            circle.dataset.storageSlice = String(index);
            circle.classList.add('storage-space-slice');
            svg.appendChild(circle);
            offset += length;
        });
        chart.appendChild(svg);
        totals.forEach((size, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'storage-space-legend-item';
            button.dataset.storageSlice = String(index);
            button.setAttribute('aria-pressed', 'false');
            const swatch = document.createElement('span');
            swatch.className = 'storage-space-swatch';
            swatch.style.backgroundColor = this.colors[index];
            const label = document.createElement('span');
            label.textContent = this.labels[index];
            const amount = document.createElement('strong');
            amount.textContent = this.formatBytes(size);
            button.append(swatch, label, amount);
            legend.appendChild(button);
        });
        this.updateSelection();
    },

    updateSelection() {
        document.querySelectorAll('#storage-space-chart [data-storage-slice], #storage-space-legend [data-storage-slice]').forEach(item => {
            const active = this.selectedSlice === Number(item.dataset.storageSlice);
            item.classList.toggle('storage-space-selected', active);
            item.classList.toggle('storage-space-muted', this.selectedSlice !== null && !active);
            if (item.tagName === 'BUTTON') item.setAttribute('aria-pressed', String(active));
        });
    },

    closeModal(force = false) {
        if (this.saving && !force) return;
        const modal = document.getElementById('storage-space-clean-modal');
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    },

    openModal() {
        const list = document.getElementById('storage-space-contact-list');
        list.textContent = '';
        const contacts = STATE.contacts || [];
        if (!contacts.length) list.textContent = '暂无联系人';
        contacts.forEach(contact => {
            const size = this.contactImageBytes(contact);
            const row = document.createElement('label');
            row.className = 'storage-space-contact-row';
            const avatar = document.createElement(/^(data:|https?:)/i.test(contact.avatar || '') ? 'img' : 'span');
            avatar.className = 'storage-space-contact-avatar';
            if (avatar.tagName === 'IMG') avatar.src = contact.avatar;
            else avatar.textContent = contact.avatar || '💬';
            const name = document.createElement('span');
            name.className = 'storage-space-contact-name';
            name.textContent = `${contact.name || '未命名角色'}（${this.formatBytes(size)}）`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = String(contact.id);
            checkbox.dataset.imageBytes = String(size);
            // ★ 旧记录若保存的是远程图片地址，占用显示 0 B，但仍可清理图片气泡。
            checkbox.disabled = !(contact.history || []).some(message => Array.isArray(message.images) && message.images.length);
            row.append(avatar, name, checkbox);
            list.appendChild(row);
        });
        this.updateConfirm();
        const modal = document.getElementById('storage-space-clean-modal');
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    },

    updateConfirm() {
        const selected = document.querySelectorAll('#storage-space-contact-list input:checked');
        const button = document.getElementById('storage-space-clean-confirm');
        button.disabled = !selected.length || this.saving;
        const amount = [...selected].reduce((sum, input) => sum + Number(input.dataset?.imageBytes || 0), 0);
        button.textContent = selected.length ? `确认清理（${selected.length} 位 · ${this.formatBytes(amount)}）` : '确认清理';
    },

    async cleanSelected() {
        if (this.saving) return;
        const ids = new Set([...document.querySelectorAll('#storage-space-contact-list input:checked')].map(input => input.value));
        if (!ids.size) return;
        this.saving = true;
        this.updateConfirm();
        try {
            // ★ 先生成新联系人记录，写入成功后才替换内存；失败时原图仍留在聊天里。
            const nextContacts = STATE.contacts.map(contact => {
                if (!ids.has(String(contact.id))) return contact;
                return {
                    ...contact,
                    history: (contact.history || []).map(message => {
                        if (!Array.isArray(message.images) || !message.images.length) return message;
                        return { ...message, images: null, isImageExpired: true };
                    })
                };
            });
            await DB.set(CONFIG.STORAGE_KEY, nextContacts);
            STATE.contacts = nextContacts;
            this.closeModal(true);
            const current = nextContacts.find(contact => String(contact.id) === String(STATE.currentContactId));
            if (current && ids.has(String(current.id))) UI.renderChatHistory(current, false, true);
            if (typeof Toast !== 'undefined') Toast.show('聊天图片已清理');
            this.open().catch(error => console.warn('[存储空间管理] 清理后统计失败:', error));
        } catch (error) {
            console.error('[存储空间管理] 清理图片失败:', error);
            if (typeof Toast !== 'undefined') Toast.show('清理失败，原图已保留');
        } finally {
            this.saving = false;
            this.updateConfirm();
        }
    },

    bind() {
        document.getElementById('explore-storage-space-btn')?.addEventListener('click', () => UI.switchView('storage-space'));
        document.getElementById('storage-space-back-btn')?.addEventListener('click', () => UI.switchView(App.getReturnView('storage-space', 'explore')));
        document.getElementById('storage-space-clean-images-btn')?.addEventListener('click', () => this.openModal());
        document.getElementById('storage-space-clean-cancel')?.addEventListener('click', () => this.closeModal());
        document.getElementById('storage-space-clean-confirm')?.addEventListener('click', () => this.cleanSelected());
        document.getElementById('storage-space-contact-list')?.addEventListener('change', () => this.updateConfirm());
        document.getElementById('storage-space-clean-modal')?.addEventListener('click', event => {
            if (event.target.id === 'storage-space-clean-modal') this.closeModal();
        });
        document.getElementById('storage-space-chart')?.addEventListener('click', event => {
            const target = event.target.closest('[data-storage-slice]');
            this.selectedSlice = target ? Number(target.dataset.storageSlice) : null;
            this.updateSelection();
        });
        document.getElementById('storage-space-legend')?.addEventListener('click', event => {
            const target = event.target.closest('[data-storage-slice]');
            if (!target) return;
            this.selectedSlice = Number(target.dataset.storageSlice);
            this.updateSelection();
        });
        document.addEventListener('click', event => {
            if (this.selectedSlice === null || event.target.closest('#storage-space-chart, #storage-space-legend')) return;
            this.selectedSlice = null;
            this.updateSelection();
        });
    }
};

StorageSpace.bind();
