// ============================================================
// ★★★★★ 群聊：会话存储 / 联系人入口 / 发言生成 / 单聊桥接 ★★★★★
// ============================================================
const GroupChat = {
    PRIVATE_TO_GROUP_COUNT: 4,
    REPLY_LIMIT: 4,
    groups: [],
    currentId: null,
    turns: new Map(),
    userWaterfalls: new Map(),
    failedTurns: new Map(),
    drafts: new Map(),
    imageDrafts: new Map(),
    lastSentAt: 0,
    saveQueue: Promise.resolve(),

    async load() {
        const saved = await DB.get(CONFIG.GROUP_CHAT_KEY);
        this.groups = Array.isArray(saved) ? saved : [];
        this.lastSentAt = Math.max(0, ...this.groups.map(group => group.history.at(-1)?.sentAt || 0));
    },

    // ★ 同一份群聊存储串行更新。写入成功后才替换内存，避免插话和群设置互相覆盖。
    commit(update) {
        const task = this.saveQueue.then(async () => {
            const next = update(this.groups);
            if (next === this.groups) return false;
            await DB.set(CONFIG.GROUP_CHAT_KEY, next);
            this.groups = next;
            return true;
        });
        this.saveQueue = task.catch(() => {});
        return task;
    },

    find(id) {
        return this.groups.find(group => group.id === id);
    },

    members(group) {
        return group.memberIds.map(id => STATE.contacts.find(contact => contact.id === id)).filter(Boolean);
    },

    el(id) {
        return document.getElementById(id);
    },

    toggleMenu(open) {
        this.el('contact-add-menu').classList.toggle('hidden', !open);
        this.el('add-contact-btn').setAttribute('aria-expanded', String(open));
    },

    // ================ 联系人入口 / 群资料弹窗 ================
    bindEvents() {
        const add = this.el('add-contact-btn');
        const menu = this.el('contact-add-menu');
        const modal = this.el('group-chat-modal');
        const draft = this.el('group-chat-draft');
        add.onclick = () => this.toggleMenu(menu.classList.contains('hidden'));
        this.el('contact-add-character').onclick = () => {
            this.toggleMenu(false);
            App.openEditModal(null);
        };
        this.el('contact-add-group').onclick = () => {
            this.toggleMenu(false);
            this.openEditor();
        };
        document.addEventListener('click', event => {
            if (!menu.classList.contains('hidden') && !menu.contains(event.target) && !add.contains(event.target)) {
                this.toggleMenu(false);
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if (!modal.classList.contains('hidden')) this.closeEditor();
            else if (!menu.classList.contains('hidden')) {
                this.toggleMenu(false);
                add.focus();
            }
        });
        this.el('group-chat-back').onclick = () => UI.switchView('contact-list');
        const settings = this.el('group-chat-settings');
        settings.replaceChildren(this.el('chat-settings-btn').querySelector('svg').cloneNode(true));
        settings.onclick = () => this.openEditor(this.find(this.currentId));
        modal.onclick = event => { if (event.target === modal) this.closeEditor(); };
        this.el('group-modal-cancel').onclick = () => this.closeEditor();
        this.el('group-chat-form').onsubmit = event => {
            event.preventDefault();
            void this.saveEditor();
        };
        // ★ 用独立按钮打开头像选择器，文件读取和预览仍由原来的流程处理。
        const avatarInput = this.el('group-modal-avatar');
        this.el('group-modal-avatar-upload').onclick = () => avatarInput.click();
        avatarInput.onchange = event => void this.readAvatar(event.target.files[0]);
        this.el('group-modal-avatar-reset').onclick = () => {
            if (this.editor.busy) return;
            this.editor.avatar = '';
            this.editor.upload = null;
            avatarInput.value = '';
            this.renderEditorAvatar();
        };
        this.el('group-modal-member-list').onchange = () => this.renderEditorAvatar();
        this.el('group-modal-clear').onclick = () => void this.changeHistory(false);
        this.el('group-modal-dissolve').onclick = () => void this.changeHistory(true);
        UI.bindComposerInput(draft, () => void this.send(), () => {
            this.drafts.set(this.currentId, draft.value);
            this.renderStatus(this.currentId);
        });
        this.el('group-chat-send').onclick = event => {
            if (event.currentTarget.dataset.action === 'stop-wait') this.stopTurn(this.currentId);
            else void this.send();
        };
        this.el('group-chat-reroll').onclick = () => this.reroll();
        const imageInput = this.el('group-chat-image-input');
        this.el('group-chat-upload').onclick = () => {
            imageInput.value = '';
            imageInput.click();
        };
        imageInput.onchange = () => void this.selectImage(imageInput.files[0]);
        this.el('group-chat-clear-image').onclick = () => {
            this.imageDrafts.delete(this.currentId);
            this.renderImagePreview();
        };
        this.bindMessageActions();
    },

    // ================ 单气泡操作：共用菜单，群聊身份与写库流程独立 ================
    bindMessageActions() {
        const list = this.el('group-chat-messages');
        App.bindMessageSelectionGuard(list);
        let timer, origin;
        const cancel = () => { clearTimeout(timer); timer = null; };
        list.addEventListener('pointerdown', event => {
            cancel();
            this.messageClickLocked = false;
            if (event.button !== 0 || !event.isPrimary || this.selection) return;
            const bubble = event.target.closest('.message-bubble');
            if (!bubble || event.target.closest('.code-copy-btn')) return;
            origin = { x: event.clientX, y: event.clientY };
            timer = setTimeout(() => {
                this.messageClickLocked = true;
                this.showMessageMenu(bubble, { ...origin, pressed: true });
            }, 380);
        });
        list.addEventListener('pointermove', event => {
            if (origin && (Math.abs(event.clientX - origin.x) > 10 || Math.abs(event.clientY - origin.y) > 10)) cancel();
        });
        for (const name of ['pointerup', 'pointercancel', 'pointerleave', 'scroll']) list.addEventListener(name, cancel);
        list.addEventListener('contextmenu', event => {
            event.preventDefault();
            cancel();
            const bubble = event.target.closest('.message-bubble');
            if (bubble && !this.selection) this.showMessageMenu(bubble, { x: event.clientX, y: event.clientY });
        });
        // ★ 捕获阶段拦住图片、链接和代码复制，长按松手与多选都不能穿透到气泡内部。
        list.addEventListener('click', event => {
            const bubble = event.target.closest('.message-bubble');
            if (!this.selection && !this.messageClickLocked) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (this.messageClickLocked) { this.messageClickLocked = false; return; }
            if (!bubble) return;
            const key = JSON.stringify([Number(bubble.dataset.sentAt), bubble.dataset.bubbleKey]);
            if (this.selection.keys.has(key)) this.selection.keys.delete(key);
            else this.selection.keys.add(key);
            bubble.classList.toggle('selected', this.selection.keys.has(key));
            this.updateSelectCount();
        }, true);
        this.el('msg-context-menu').addEventListener('click', event => {
            const menu = this.el('msg-context-menu');
            const button = event.target.closest('button');
            if (menu.dataset.mode !== 'group' || menu.classList.contains('locked') || !button) return;
            const target = this.actionTarget;
            App.hideMessageContextMenu();
            void this.handleMessageAction(button.dataset.action, target);
        });
    },

    resolveBubble(target) {
        const group = this.find(target?.groupId);
        const message = group?.history.find(item => item.sentAt === target.sentAt);
        if (!message) return null;
        const index = ChatBubbles.indexOf(message, target.key);
        return index === null ? null : { group, message, index };
    },

    showMessageMenu(bubble, point) {
        const target = { groupId: this.currentId, sentAt: Number(bubble.dataset.sentAt), key: bubble.dataset.bubbleKey };
        const found = this.resolveBubble(target);
        if (!found) return;
        App.hideMessageContextMenu();
        this.actionTarget = target;
        App.configureMessageContextMenu('group');
        this.el('msg-context-menu').querySelector('[data-action="toggle-hidden"] .message-menu-label').textContent =
            found.message.isHidden || ChatBubbles.isHidden(found.message, target.key) ? '取消隐藏' : '向ta隐藏';
        App.presentMessageContextMenu(bubble.getBoundingClientRect(), point);
    },

    bubbleText(target) {
        const found = this.resolveBubble(target);
        if (!found) return '';
        const { message, index } = found;
        return index === message.bubbleIds.length
            ? (message.image_description ? '[图片描述: ' + message.image_description + ']' : '[图片]')
            : cleanMarkdownForCopy(ChatBubbles.parse(message).parts[index]);
    },

    async copyBubbles(targets) {
        try {
            await navigator.clipboard.writeText(targets.map(target => this.bubbleText(target)).filter(Boolean).join('\n\n'));
            Toast.show('已复制');
        } catch (error) {
            console.warn('[群聊] 复制失败:', error);
            Toast.show('复制失败，请检查浏览器权限');
        }
    },

    async handleMessageAction(action, target) {
        const found = this.resolveBubble(target);
        if (!found) return;
        if (action === 'copy') return this.copyBubbles([target]);
        if (action === 'multi-select') return this.enterSelectMode();
        if (action === 'edit') {
            const image = found.index === found.message.bubbleIds.length;
            const oldText = image ? found.message.image_description || '' : ChatBubbles.parse(found.message).parts[found.index];
            UI.showEditModal(oldText, newText => {
                if (newText.trim() && newText !== oldText) void this.changeBubbles([target], 'edit', newText);
            });
        } else if (action === 'delete') {
            if (confirm('确定要删除这个气泡吗？')) await this.changeBubbles([target], 'delete');
        } else if (action === 'toggle-hidden') {
            const hidden = !(found.message.isHidden || ChatBubbles.isHidden(found.message, target.key));
            await this.changeBubbles([target], 'toggle-hidden', hidden);
        }
    },

    async changeBubbles(targets, action, value) {
        const groupId = targets[0]?.groupId;
        try {
            await this.commit(groups => groups.map(group => {
                if (group.id !== groupId) return group;
                const history = group.history.flatMap(original => {
                    const keys = targets.filter(target => target.sentAt === original.sentAt).map(target => target.key);
                    if (!keys.length) return [original];
                    // ★ 写最新快照，不能用菜单打开时的历史下标；失败时也不修改原记录。
                    const message = structuredClone(original);
                    ChatBubbles.ensure(message);
                    const valid = keys.filter(key => ChatBubbles.indexOf(message, key) !== null);
                    if (!valid.length) return [original];
                    if (action === 'delete') return ChatBubbles.deleteParts(message, valid) ? [message] : [];
                    if (action === 'edit') {
                        const index = ChatBubbles.indexOf(message, valid[0]);
                        if (index === message.bubbleIds.length) message.image_description = value;
                        else ChatBubbles.editPart(message, valid[0], value);
                    } else if (action === 'toggle-hidden') {
                        // ★ 兼容旧备份的整条隐藏，转为逐气泡隐藏后再切换选中项。
                        if (message.isHidden) {
                            for (const key of [...message.bubbleIds, message.imageBubbleKey].filter(Boolean)) ChatBubbles.setHidden(message, key, true);
                            message.isHidden = false;
                        }
                        valid.forEach(key => ChatBubbles.setHidden(message, key, value));
                    }
                    return [message];
                });
                return { ...group, history };
            }));
            if (this.currentId === groupId) {
                this.renderHistory(this.find(groupId), true);
                this.updateSelectCount();
            }
            UI.renderContacts();
            return true;
        } catch (error) {
            console.warn('[群聊] 消息操作保存失败:', error);
            Toast.show('保存失败，请重试');
            return false;
        }
    },

    enterSelectMode() {
        this.messageClickLocked = false;
        this.selection = { groupId: this.currentId, keys: new Set() };
        this.el('group-chat-messages').classList.add('select-mode');
        const bar = this.el('multi-select-bar');
        bar.dataset.mode = 'group';
        bar.classList.remove('hidden');
        this.el('btn-batch-collect').hidden = true;
        this.updateSelectCount();
        App.bindSelectBarEvents();
    },

    exitSelectMode() {
        if (!this.selection) return;
        this.selection = null;
        this.messageClickLocked = false;
        this.el('group-chat-messages').classList.remove('select-mode');
        this.el('group-chat-messages').querySelectorAll('.selected').forEach(bubble => bubble.classList.remove('selected'));
        const bar = this.el('multi-select-bar');
        delete bar.dataset.mode;
        bar.classList.add('hidden');
        this.el('btn-batch-collect').hidden = false;
    },

    selectedTargets() {
        if (!this.selection) return [];
        const targets = [...this.selection.keys].map(value => {
            const [sentAt, key] = JSON.parse(value);
            return { groupId: this.selection.groupId, sentAt, key };
        }).filter(target => this.resolveBubble(target));
        return targets.sort((a, b) => a.sentAt - b.sentAt
            || this.resolveBubble(a).index - this.resolveBubble(b).index);
    },

    updateSelectCount() {
        if (!this.selection) return;
        const targets = this.selectedTargets();
        this.selection.keys = new Set(targets.map(target => JSON.stringify([target.sentAt, target.key])));
        this.el('select-count-num').textContent = targets.length;
    },

    async handleBatchAction(action) {
        const selection = this.selection;
        const targets = this.selectedTargets();
        if (!targets.length) return;
        if (action === 'copy') return this.copyBubbles(targets);
        if (action === 'delete' && !confirm('确定要删除选中的 ' + targets.length + ' 个气泡吗？')) return;
        const hidden = targets.some(target => {
            const { message } = this.resolveBubble(target);
            return !message.isHidden && !ChatBubbles.isHidden(message, target.key);
        });
        if (await this.changeBubbles(targets, action, hidden) && this.selection === selection) this.exitSelectMode();
    },

    // ★ 图片头像用原图地址，文字头像留在格子内；无自定义群头像时取前四位。
    avatarTile(value, fallback) {
        const tile = document.createElement('span');
        tile.className = 'group-avatar-tile';
        tile.textContent = fallback;
        if (value && /^(data:image\/|https?:|file:|blob:|\.?\/|assets\/)/i.test(value)) {
            const image = document.createElement('img');
            image.alt = '';
            image.src = value;
            image.onerror = () => image.remove();
            tile.append(image);
        } else if (value) {
            tile.textContent = value;
        }
        return tile;
    },

    renderAvatar(container, group, inContacts = false) {
        const contacts = this.members(group).slice(0, 4);
        const tiles = group.avatar
            ? [this.avatarTile(group.avatar, '群')]
            : contacts.map(contact => this.avatarTile(contact.avatar, contact.name?.slice(0, 1) || '人'));
        const avatar = document.createElement('span');
        avatar.className = inContacts ? 'contact-avatar group-avatar' : 'group-avatar';
        avatar.dataset.tiles = String(tiles.length || 1);
        avatar.setAttribute('aria-hidden', 'true');
        avatar.append(...(tiles.length ? tiles : [this.avatarTile('', '群')]));
        container.replaceChildren(avatar);
    },

    // ★ 只构造群聊专属的头像和预览，其余点击、置顶和排序由联系人列表统一绑定。
    createContactItem(group, template) {
        const clone = template.content.cloneNode(true);
        const item = clone.querySelector('.contact-item');
        item.classList.add('group-contact-item');
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        clone.querySelector('.contact-name').textContent = group.name;
        const latest = group.history.at(-1);
        clone.querySelector('.contact-preview').textContent = latest
            ? this.speaker(latest) + '：' + (latest.content || (latest.images?.length ? '[图片]' : ''))
            : group.description || '暂无消息';
        this.renderAvatar(clone.querySelector('.avatar-wrapper'), group, true);
        item.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                item.click();
            }
        };
        return clone;
    },

    openEditor(group) {
        this.editor = {
            id: group?.id || null,
            avatar: group?.avatar || '',
            returnFocus: group ? this.el('group-chat-settings') : this.el('add-contact-btn')
        };
        this.el('group-modal-title').textContent = group ? '群聊设置' : '创建群聊';
        this.el('group-modal-name').value = group?.name || '';
        this.el('group-modal-description').value = group?.description || '';
        this.el('group-modal-avatar').value = '';
        this.el('group-modal-model-section').classList.toggle('hidden', !group);
        this.el('group-modal-actions').classList.toggle('hidden', !group);
        const model = this.el('group-modal-model');
        const globalModel = STATE.settings.MODEL;
        model.replaceChildren(new Option(globalModel ? '跟随全局默认设置（' + globalModel + '）' : '跟随全局默认设置', ''));
        for (const preset of STATE.settings.API_PRESETS || []) {
            model.add(new Option(preset.name + ' (' + preset.model + ')', preset.name));
        }
        const modelName = group?.linkedPresetName || '';
        if (modelName && !Array.from(model.options).some(option => option.value === modelName)) {
            model.add(new Option(modelName + '（已删除，当前跟随全局）', modelName));
        }
        model.value = modelName;

        const choices = this.el('group-modal-member-list');
        choices.replaceChildren();
        // ★ 已选成员按入群顺序展示，编辑其它字段时头像排列不会被联系人排序打乱。
        const contacts = group ? this.members(group) : [];
        const selected = new Set(contacts.map(contact => contact.id));
        for (const contact of [...contacts, ...STATE.contacts.filter(item => !selected.has(item.id))]) {
            const label = document.createElement('label');
            label.className = 'group-modal-member';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'group-modal-member-check';
            checkbox.value = String(contact.id);
            checkbox.checked = selected.has(contact.id);
            const avatar = this.avatarTile(contact.avatar, contact.name?.slice(0, 1) || '人');
            avatar.classList.add('group-modal-member-avatar');
            const name = document.createElement('span');
            name.className = 'group-modal-member-name';
            name.textContent = contact.name || '未命名角色';
            label.append(avatar, name, checkbox);
            choices.append(label);
        }
        if (!choices.children.length) choices.textContent = '请先在通讯录创建角色。';
        this.editorError('');
        this.renderEditorAvatar();
        this.el('group-chat-modal').classList.remove('hidden');
        // ★ 编辑群资料时把焦点留在弹窗，避免手机弹出键盘；新建群聊仍可直接输入名称。
        if (group) this.el('group-chat-form').focus({ preventScroll: true });
        else this.el('group-modal-name').focus();
    },

    closeEditor(force = false, restoreFocus = true) {
        if (!this.editor || (this.editor.busy && !force)) return;
        const { returnFocus } = this.editor;
        this.editor = null;
        this.el('group-chat-modal').classList.add('hidden');
        if (restoreFocus) returnFocus.focus();
    },

    editorError(message) {
        const target = this.el('group-modal-error');
        target.textContent = message;
        target.classList.toggle('hidden', !message);
        if (message) target.scrollIntoView({ block: 'nearest' });
    },

    selectedMemberIds() {
        const checked = new Set(Array.from(this.el('group-modal-member-list').querySelectorAll('input:checked'), input => input.value));
        // ★ 保留角色原始 ID 类型，兼容使用数字 ID 的旧联系人。
        const contacts = new Map(STATE.contacts.map(contact => [String(contact.id), contact.id]));
        return [...checked].filter(id => contacts.has(id)).map(id => contacts.get(id));
    },

    renderEditorAvatar() {
        this.renderAvatar(this.el('group-modal-avatar-preview'), {
            avatar: this.editor.avatar,
            memberIds: this.selectedMemberIds()
        });
        this.el('group-modal-avatar-reset').classList.toggle('hidden', !this.editor.avatar);
    },

    async readAvatar(file) {
        const editor = this.editor;
        if (!file || !editor || editor.busy) return;
        const input = this.el('group-modal-avatar');
        if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
            input.value = '';
            this.editorError('请选择 5 MB 以内的图片。');
            return;
        }
        const upload = {};
        editor.upload = upload;
        const source = URL.createObjectURL(file);
        try {
            const image = new Image();
            image.src = source;
            await image.decode();
            if (this.editor !== editor || editor.upload !== upload || input.files[0] !== file) return;
            // ★ 头像只用于小尺寸展示，缩到 256px 再写入备份。
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 256;
            const size = Math.min(image.naturalWidth, image.naturalHeight);
            canvas.getContext('2d').drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
            editor.avatar = canvas.toDataURL('image/webp', 0.88);
            this.renderEditorAvatar();
            this.editorError('');
        } catch (error) {
            if (this.editor === editor && editor.upload === upload && input.files[0] === file) {
                input.value = '';
                this.editorError('无法读取这张图片，请换一张。');
            }
        } finally {
            URL.revokeObjectURL(source);
            if (editor.upload === upload) editor.upload = null;
        }
    },

    async saveEditor() {
        const editor = this.editor;
        if (!editor || editor.busy) return;
        if (editor.upload) return this.editorError('头像正在读取，请稍后确定。');
        const name = this.el('group-modal-name').value.trim();
        if (!name) return this.editorError('请输入群聊名称。');
        const memberIds = this.selectedMemberIds();
        if (memberIds.length < 2) return this.editorError('请至少选择两位角色。');
        const previous = this.find(editor.id);
        const linkedPresetName = this.el('group-modal-model').value;
        const description = this.el('group-modal-description').value.trim();
        const avatar = editor.avatar;
        const rosterChanged = previous && (previous.memberIds.length !== memberIds.length
            || previous.memberIds.some((id, index) => id !== memberIds[index]));
        if (previous && (rosterChanged || previous.linkedPresetName !== linkedPresetName)) this.stopTurn(previous.id);
        const id = editor.id || 'group_' + (globalThis.crypto?.randomUUID?.() || Date.now() + '_' + Math.random().toString(36).slice(2));
        editor.busy = true;
        try {
            await this.commit(groups => {
                const fields = { id, name, avatar, description, memberIds, linkedPresetName };
                if (editor.id) return groups.map(group => group.id === id ? { ...group, ...fields } : group);
                return [...groups, { ...fields, history: [], memberAvatars: {} }];
            });
            if (this.editor === editor) this.closeEditor(true);
            UI.renderContacts();
            if (this.currentId === id) this.renderHeader(this.find(id));
        } catch (error) {
            console.warn('[群聊] 保存群资料失败:', error);
            if (this.editor === editor) this.editorError('保存失败，请重试。');
        } finally {
            editor.busy = false;
        }
    },

    async changeHistory(dissolve) {
        const editor = this.editor;
        const group = this.find(editor?.id);
        if (!group || editor.busy) return;
        if (!confirm(dissolve ? '确定解散群聊？群聊记录将一并删除。' : '确定清空这个群的聊天记录？')) return;
        this.stopTurn(group.id);
        this.failedTurns.delete(group.id);
        editor.busy = true;
        try {
            await this.commit(groups => dissolve
                ? groups.filter(item => item.id !== group.id)
                : groups.map(item => item.id === group.id ? { ...item, history: [] } : item));
            // ★ 清空或解散后取消这个群尚未播放的用户气泡。
            this.userWaterfalls.get(group.id)?.controller.abort();
            this.userWaterfalls.delete(group.id);
            if (this.editor === editor) this.closeEditor(true, !dissolve);
            if (dissolve) {
                this.drafts.delete(group.id);
                this.imageDrafts.delete(group.id);
                UI.switchView('contact-list');
            } else if (this.currentId === group.id) {
                this.renderHistory(this.find(group.id));
            }
            UI.renderContacts();
        } catch (error) {
            console.warn('[群聊] 清理群聊失败:', error);
            if (this.editor === editor) this.editorError('操作失败，请重试。');
        } finally {
            editor.busy = false;
        }
    },

    // ================ 群聊页面与已发消息 ================
    open(id) {
        const group = this.find(id);
        if (!group) return;
        this.exitSelectMode();
        this.currentId = id;
        UI.switchView('group-chat');
        const input = this.el('group-chat-draft');
        input.value = this.drafts.get(id) || '';
        UI.autoGrowComposer(input);
        this.renderHeader(group);
        this.renderHistory(group);
        this.renderImagePreview();
    },

    leave() {
        this.exitSelectMode();
        this.messageClickLocked = false;
        this.toggleMenu(false);
        this.closeEditor(true, false);
        this.currentId = null;
        this.el('view-group-chat').style.display = 'none';
    },

    renderHeader(group) {
        this.el('group-chat-title').textContent = group.name;
        this.el('group-chat-member-count').textContent = (this.members(group).length + 1) + ' 人';
        this.renderAvatar(this.el('group-chat-header-avatar'), group);
    },

    speaker(message, viewerId) {
        if (message.role === 'user') return '我';
        return message.senderId === viewerId ? '你' : message.senderName;
    },

    // ★ 历史和新消息共用气泡模板，瀑布流上屏时才播放入场动画。
    createMessageBubble(group, message, text, image = null, animate = false, partIndex = 0) {
        const own = message.role === 'user';
        const sender = own ? 'user' : 'ai';
        const avatar = own ? UI.getUserAvatar() : group.memberAvatars?.[message.senderId];
        const bubble = UI.createSingleBubble(parseCustomMarkdown(text), sender, avatar, message.timestamp, -1, animate, 0, image);
        // ★ 复用气泡外观；群聊目标用 sentAt + bubbleKey 定位，不能借用单聊历史下标。
        const element = bubble.querySelector('.message-bubble');
        const key = ChatBubbles.keyAt(message, partIndex);
        element.dataset.sentAt = String(message.sentAt);
        element.dataset.bubbleKey = key;
        element.classList.toggle('is-hidden-bubble', !!message.isHidden || ChatBubbles.isHidden(message, key));
        element.classList.toggle('selected', !!this.selection?.keys.has(JSON.stringify([message.sentAt, key])));
        const name = document.createElement('span');
        name.className = 'group-chat-speaker';
        name.textContent = own ? '我' : message.senderName;
        bubble.querySelector('.message-content').prepend(name);
        return bubble;
    },

    messageParts(message) {
        ChatBubbles.ensure(message);
        const text = ChatBubbles.parse(message).parts.map((part, partIndex) => ({ text: part, partIndex }));
        const image = message.images?.[0] || (message.isImageExpired ? 'expired' : null);
        return image ? text.concat({ text: '', image, partIndex: text.length }) : text;
    },

    createMessageRow(group, message, animate = false, count = Infinity) {
        const row = document.createElement('div');
        row.className = 'message-group group-chat-message';
        row.dataset.sentAt = String(message.sentAt);
        for (const { text, image, partIndex } of this.messageParts(message).slice(0, count)) {
            row.append(this.createMessageBubble(group, message, text, image, animate, partIndex));
        }
        return row;
    },

    renderHistory(group, keepScrollPosition = false) {
        const list = this.el('group-chat-messages');
        const scrollTop = list.scrollTop;
        const fragment = document.createDocumentFragment();
        const preview = this.turns.get(group.id);
        const shown = this.userWaterfalls.get(group.id)?.shown;
        for (const message of group.history) {
            // ★ 重生成等待期间只隐藏旧回复，切回这个群也不会提前露出。
            if (!preview?.replaced && preview?.hiddenReplies?.has(message.sentAt)) continue;
            const count = shown?.get(message.sentAt);
            if (count !== 0) fragment.append(this.createMessageRow(group, message, false, count));
        }
        list.replaceChildren(fragment);
        list.scrollTop = keepScrollPosition ? scrollTop : list.scrollHeight;
        this.renderStatus(group.id);
    },

    renderStatus(id) {
        if (!id || this.currentId !== id) return;
        const turn = this.turns.get(id);
        const failure = this.failedTurns.get(id);
        this.el('group-chat-status').textContent = turn?.status || failure || '';
        this.el('group-chat-reroll').disabled = !!turn || !this.find(id)?.history.some(message => message.role === 'user');
        // ★ 有新草稿时直接发送并打断上一轮。空输入时按钮跟单聊一样用于停止等待。
        const hasDraft = !!(this.el('group-chat-draft').value.trim() || this.imageDrafts.get(id)?.image);
        const send = this.el('group-chat-send');
        const stopping = !!turn && !hasDraft;
        send.dataset.action = stopping ? 'stop-wait' : 'send';
        send.title = stopping ? '停止等待' : '发送';
        send.setAttribute('aria-label', send.title);
    },

    async selectImage(file) {
        const id = this.currentId;
        if (!file || !id) return;
        if (!file.type.startsWith('image/')) {
            Toast.show('请选择图片文件。', { icon: 'warning' });
            return;
        }
        // ★ 读图和草稿归属同一个群。切群、取消或重新选图时旧读取不会回填到别处。
        const draft = { image: this.imageDrafts.get(id)?.image || '', loading: true };
        this.imageDrafts.set(id, draft);
        try {
            const image = await App.readFile(file);
            if (this.imageDrafts.get(id) !== draft) return;
            draft.image = image;
            if (this.currentId === id) this.el('group-chat-draft').focus();
        } catch (error) {
            if (this.imageDrafts.get(id) === draft) Toast.show('无法读取这张图片。', { icon: 'warning' });
        } finally {
            draft.loading = false;
            if (this.currentId === id) this.renderImagePreview();
        }
    },

    renderImagePreview() {
        const image = this.imageDrafts.get(this.currentId)?.image;
        const preview = this.el('group-chat-preview-img');
        if (image) preview.src = image;
        else preview.removeAttribute('src');
        this.el('group-chat-image-preview').classList.toggle('hidden', !image);
        this.renderStatus(this.currentId);
    },

    async appendMessage(id, message, turn, sender, continuationAt) {
        let savedMessage;
        const replacing = turn?.hiddenReplies && !turn.replaced;
        const saved = await this.commit(groups => {
            const group = groups.find(item => item.id === id);
            if (!group || turn?.controller.signal.aborted) return groups;
            const audience = this.members(group).map(contact => contact.id);
            if (sender && !audience.includes(sender.id)) return groups;
            let history = group.history;
            if (replacing) {
                const anchor = history.findLastIndex(item => item.role === 'user');
                if (history[anchor]?.sentAt !== turn.replaceAfter) return groups;
                history = history.slice(0, anchor + 1);
            }
            if (continuationAt != null) {
                const previous = history.at(-1);
                if (previous?.sentAt !== continuationAt) return groups;
                // ★ 空行拆出的气泡逐条落库，仍属于同一条发言。插话不会带入尚未显示的正文。
                savedMessage = structuredClone(previous);
                ChatBubbles.appendText(savedMessage, message.content);
                history = [...history.slice(0, -1), savedMessage];
            } else if (message) {
                savedMessage = this.stampMessage(message, audience);
                // ★ 一次模型请求的全部成员发言共用批次，窗口计数时合并为一条 assistant 消息。
                if (sender) {
                    turn.replyBatchId ??= savedMessage.sentAt;
                    savedMessage.replyBatchId = turn.replyBatchId;
                }
                history = [...history, savedMessage];
            }
            // ★ 每位发过言的成员只保留一份头像，避免把大图反复存进每条消息。
            const memberAvatars = sender
                ? { ...group.memberAvatars, [sender.id]: sender.avatar || '' }
                : group.memberAvatars;
            // ★ 第一条群回复落库时确认本轮，瀑布流后续气泡和重生成只复用原轮次。
            const privateChatBridge = sender
                ? this.consumeBridgeRound(group.privateChatBridge, turn.privateBridgeRound)
                : group.privateChatBridge;
            const next = { ...group, memberAvatars, history, privateChatBridge };
            return groups.map(item => item.id === id ? next : item);
        });
        if (!saved) return null;
        if (replacing) turn.replaced = true;
        if (savedMessage?.role === 'user') {
            this.queueUserWaterfall(id, savedMessage);
        } else if (this.currentId === id) {
            const list = this.el('group-chat-messages');
            const nearBottom = list.scrollHeight - list.clientHeight - list.scrollTop < 90;
            if (replacing) {
                for (const sentAt of turn.hiddenReplies) list.querySelector('[data-sent-at="' + sentAt + '"]')?.remove();
            }
            if (savedMessage) {
                const group = this.find(id);
                const row = list.querySelector('[data-sent-at="' + savedMessage.sentAt + '"]');
                const animate = !!turn && !turn.controller.signal.aborted;
                if (!row) list.append(this.createMessageRow(group, savedMessage, animate));
                else if (continuationAt != null && row.childElementCount < splitMessageIntoBubbleParts(savedMessage.content).length) {
                    row.append(this.createMessageBubble(group, savedMessage, message.content, null, animate, ChatBubbles.parse(savedMessage).parts.length - 1));
                }
            }
            if (nearBottom) list.scrollTop = list.scrollHeight;
        }
        UI.renderContacts();
        return savedMessage;
    },

    // ★ 用户消息先完整落库，再按发送顺序播放。下一条发送只打断 AI，已发送的用户气泡继续上屏。
    queueUserWaterfall(id, message) {
        let playback = this.userWaterfalls.get(id);
        if (!playback) {
            playback = { controller: new AbortController(), shown: new Map(), tail: Promise.resolve() };
            this.userWaterfalls.set(id, playback);
        }
        playback.shown.set(message.sentAt, 0);
        const { signal } = playback.controller;
        playback.tail = playback.tail.then(async () => {
            for (const [index, part] of this.messageParts(message).entries()) {
                const { text, partIndex } = part;
                const key = ChatBubbles.keyAt(message, partIndex);
                if (index) await this.wait(getWaterfallBubbleDelayMs(text), signal);
                signal.throwIfAborted();
                playback.shown.set(message.sentAt, index + 1);
                if (this.currentId !== id) continue;
                const group = this.find(id);
                // ★ 编辑或删除可以发生在瀑布流期间，只播放仍存在的最新气泡，不能把旧内容重新插回来。
                const live = group?.history.find(item => item.sentAt === message.sentAt);
                if (!live) continue;
                const liveIndex = ChatBubbles.indexOf(live, key);
                if (liveIndex === null) continue;
                const current = this.messageParts(live).find(item => item.partIndex === liveIndex);
                if (!current) continue;
                const list = this.el('group-chat-messages');
                const row = list.querySelector('[data-sent-at="' + message.sentAt + '"]');
                if (!row) list.append(this.createMessageRow(group, live, true, liveIndex + 1));
                else if (!Array.from(row.querySelectorAll('.message-bubble')).some(bubble => bubble.dataset.bubbleKey === key)) {
                    row.append(this.createMessageBubble(group, live, current.text, current.image, true, liveIndex));
                }
                list.scrollTop = list.scrollHeight;
            }
        }).catch(error => {
            if (!signal.aborted) {
                console.warn('[群聊] 用户气泡播放失败:', error);
                playback.shown.delete(message.sentAt);
                if (this.currentId === id) this.renderHistory(this.find(id));
            }
        }).finally(() => {
            playback.shown.delete(message.sentAt);
            if (!playback.shown.size && this.userWaterfalls.get(id) === playback) this.userWaterfalls.delete(id);
        });
    },

    stampMessage(message, audience) {
        this.lastSentAt = Math.max(Date.now(), this.lastSentAt + 1);
        return { ...message, audience, timestamp: formatTimestamp(), sentAt: this.lastSentAt };
    },

    replyMessage(reply) {
        return { role: 'assistant', senderId: reply.member.id, senderName: reply.member.name, content: reply.content };
    },

    // ================ 一次请求编排多人发言 ================
    stopTurn(id) {
        const turn = this.turns.get(id);
        turn?.controller.abort();
        this.finishTurn(id, turn);
    },

    finishTurn(id, turn) {
        this.turns.delete(id);
        if (this.currentId === id && turn?.hiddenReplies?.size && !turn.replaced) {
            const group = this.find(id);
            if (group) {
                this.renderHistory(group);
                return;
            }
        }
        this.renderStatus(id);
    },

    async send() {
        const group = this.find(this.currentId);
        const draft = this.el('group-chat-draft');
        const content = draft.value.trim();
        if (!group) return;
        const imageDraft = this.imageDrafts.get(group.id);
        if (imageDraft?.loading) {
            Toast.show('图片正在读取，请稍后发送。', { icon: 'warning' });
            return;
        }
        const image = imageDraft?.image;
        if (!content && !image) return;
        this.stopTurn(group.id);
        this.failedTurns.delete(group.id);
        draft.value = '';
        this.drafts.delete(group.id);
        this.imageDrafts.delete(group.id);
        UI.autoGrowComposer(draft);
        // ★ 最后一次发送负责开启新一轮；连续发送期间，旧消息仍按顺序入库。
        const turn = this.makeTurn(group.id);
        this.renderImagePreview();
        try {
            const message = { role: 'user', content };
            if (image) message.images = [image];
            const saved = await this.appendMessage(group.id, message);
            if (saved && !turn.controller.signal.aborted) void this.generate(group.id, turn, 450);
            else if (this.turns.get(group.id) === turn) this.stopTurn(group.id);
        } catch (error) {
            console.warn('[群聊] 保存消息失败:', error);
            if (this.turns.get(group.id) === turn) this.stopTurn(group.id);
            if (!this.drafts.has(group.id)) {
                this.drafts.set(group.id, content);
                if (this.currentId === group.id) draft.value = content;
            }
            if (image && !this.imageDrafts.has(group.id)) this.imageDrafts.set(group.id, imageDraft);
            if (this.currentId === group.id) {
                UI.autoGrowComposer(draft);
                this.renderImagePreview();
            }
            Toast.show('消息未保存，请重试。', { icon: 'warning' });
        }
    },

    makeTurn(id) {
        const turn = { controller: new AbortController(), status: '' };
        this.turns.set(id, turn);
        return turn;
    },

    reroll() {
        const group = this.find(this.currentId);
        if (!group || this.turns.has(group.id)) return;
        const anchor = group.history.findLastIndex(message => message.role === 'user');
        if (anchor < 0) return;
        this.failedTurns.delete(group.id);
        const turn = this.makeTurn(group.id);
        turn.replaceAfter = group.history[anchor].sentAt;
        turn.hiddenReplies = new Set(group.history.slice(anchor + 1).map(message => message.sentAt));
        this.renderHistory(group);
        void this.generate(group.id, turn, 0);
    },

    async wait(ms, signal) {
        signal.throwIfAborted();
        if (!ms) return;
        await new Promise((resolve, reject) => {
            const abort = () => {
                clearTimeout(timer);
                reject(signal.reason);
            };
            const timer = setTimeout(() => {
                signal.removeEventListener('abort', abort);
                resolve();
            }, ms);
            signal.addEventListener('abort', abort, { once: true });
        });
    },

    // ★ 识图遵循线上单聊的设置。原图只用于当前这轮，历史请求和单聊桥接只带描述或占位符。
    async prepareImage(id, history, settings, signal) {
        const lastReply = history.findLastIndex(message => message.role === 'assistant');
        const message = history.slice(lastReply + 1).findLast(item => item.images?.[0]
            && !item.isHidden && !ChatBubbles.isHidden(item, ChatBubbles.keyAt(item, ChatBubbles.parse(item).parts.length)));
        if (!message) return null;
        const image = message.images[0];
        if (settings.IMAGE_API_MODE === 'multimodal') {
            settings.MULTIMODAL_IMAGE = image;
            settings.MULTIMODAL_MESSAGE_INDEX = 1; // 群历史和本轮消息共用第 2 条请求消息。
            return { sentAt: message.sentAt, attached: true };
        }
        if (message.image_description) return null;
        const vision = App.buildChatVisionSettings(signal);
        if (API.shouldUseAsyncBackend(settings)) {
            const authMode = settings.ASYNC_BACKEND_KEY_MODE || 'client_key';
            settings.ASYNC_BACKEND_VISION = {
                image, url: vision.url, model: vision.model, prompt: vision.prompt,
                key: authMode === 'server_secret' ? '' : vision.key, auth_mode: authMode
            };
            return { sentAt: message.sentAt, attached: false };
        }
        let description = '';
        if (vision.url) {
            try {
                description = await API.analyzeImage(image, vision);
            } catch (error) {
                signal.throwIfAborted();
                console.warn('[群聊] 识图失败:', error);
            }
        }
        signal.throwIfAborted();
        return { sentAt: message.sentAt, description };
    },

    async saveImageDescription(id, sentAt, description, signal) {
        if (!description) return;
        await this.commit(groups => {
            const group = groups.find(item => item.id === id);
            if (!group || signal.aborted) return groups;
            const history = group.history.map(message => message.sentAt === sentAt
                ? { ...message, image_description: description }
                : message);
            return groups.map(item => item.id === id ? { ...group, history } : item);
        });
    },

    async playReplies(id, turn, replies) {
        // ★ 合法空数组表示群里没人接话。重生成时也要用这个结果替换旧回复。
        if (!replies.length && turn.hiddenReplies?.size) await this.appendMessage(id, null, turn);
        let firstBubble = true;
        for (const reply of replies) {
            const message = this.replyMessage(reply);
            let continuationAt;
            turn.status = reply.member.name + ' 正在输入…';
            this.renderStatus(id);
            for (const part of splitMessageIntoBubbleParts(message.content)) {
                // ★ 第一条立即显示，之后按单聊的长度和随机间隔逐气泡播放。
                if (!firstBubble) await this.wait(getWaterfallBubbleDelayMs(part), turn.controller.signal);
                const published = await this.appendMessage(id, { ...message, content: part }, turn, reply.member, continuationAt);
                if (!published) return;
                continuationAt = published.sentAt;
                firstBubble = false;
            }
        }
    },

    // ================ 群聊历史窗口：复用单聊策略，按统一回复批次计数 ================
    historyWindowMessages(history) {
        const messages = [];
        for (const [index, message] of history.entries()) {
            const previous = messages.at(-1);
            // ★ 旧群记录没有批次字段：连续的成员回复视作当时的一次统一回复。
            // 新记录按批次区分，即使相邻两次请求都由同一成员发言，也各占一条。
            if (message.role === 'assistant' && previous?.role === 'assistant' && previous.replyBatchId === message.replyBatchId) {
                previous.groupMessages.push(message);
                continue;
            }
            messages.push({
                role: message.role,
                content: '群聊消息',
                cacheSeq: Number.isSafeInteger(message.sentAt) ? message.sentAt : index,
                replyBatchId: message.replyBatchId,
                groupMessages: [message]
            });
        }
        return messages;
    },

    async selectHistoryWindow(id, history, settings, signal) {
        const group = this.find(id);
        const windowContact = {
            history: this.historyWindowMessages(history),
            historyWindowStartSeq: group.historyWindowStartSeq
        };
        // ★ 虚拟记录只负责条数与稳定序号。真正发往模型的仍是原始成员发言，保留人名、图片描述和可见范围。
        const selected = App.selectHistoryWindowRecords(windowContact, settings);
        if (selected.changed) {
            await this.commit(groups => {
                if (signal.aborted) return groups;
                return groups.map(item => item.id === id
                    ? { ...item, historyWindowStartSeq: windowContact.historyWindowStartSeq }
                    : item);
            });
        }
        settings.HISTORY_WINDOW_LOG = {
            ...selected.log,
            sentCount: selected.records.length,
            countUnit: '用户每次发送 / AI一次统一回复'
        };
        return selected.records.flatMap(record => record.msg.groupMessages);
    },

    async generate(id, turn, delay) {
        const { signal } = turn.controller;
        let failure = '';
        try {
            await this.wait(delay, signal);
            // ★ 等本群已发送的用户气泡显示完成，再让群成员开始回复。
            await this.userWaterfalls.get(id)?.tail;
            signal.throwIfAborted();
            const group = this.find(id);
            if (!group || !group.history.length) return;
            const members = this.members(group);
            if (members.length < 2) {
                failure = '群成员不足，请到群设置补充角色。';
                return;
            }
            const settings = App.buildChatRequestSettings(group);
            if (!settings) {
                failure = '请配置群聊模型后重试。';
                return;
            }
            settings.REQUEST_SIGNAL = signal;
            settings.ASYNC_BACKEND_FOREGROUND_ONLY = true;
            settings.ASYNC_BACKEND_RESULT = {};
            settings.ASYNC_BACKEND_REQUEST_USER_MESSAGE_INDEX = 1;
            settings.USAGE_CHAT = true;
            settings.USAGE_REROLL = turn.replaceAfter != null;
            const anchor = settings.USAGE_REROLL ? group.history.findIndex(message => message.sentAt === turn.replaceAfter) : -1;
            if (settings.USAGE_REROLL && anchor < 0) return;
            const history = anchor >= 0 ? group.history.slice(0, anchor + 1) : group.history;
            turn.status = '群成员正在回复…';
            this.renderStatus(id);
            const image = await this.prepareImage(id, history, settings, signal);
            signal.throwIfAborted();
            if (image?.description) await this.saveImageDescription(id, image.sentAt, image.description, signal);
            signal.throwIfAborted();
            const roundId = history.findLast(message => message.role === 'user')?.sentAt;
            const privateContext = this.prepareGroupContext(group, members, roundId);
            turn.privateBridgeRound = privateContext.round;
            const windowHistory = await this.selectHistoryWindow(id, history, settings, signal);
            signal.throwIfAborted();
            const raw = await API.chat(this.buildRequest(group, members, windowHistory, image, privateContext.messages), settings);
            signal.throwIfAborted();
            const backendDescription = settings.ASYNC_BACKEND_RESULT.image_description;
            if (image && backendDescription) await this.saveImageDescription(id, image.sentAt, backendDescription, signal);
            signal.throwIfAborted();
            const replies = this.parseReplies(raw, members);
            if (!replies) {
                failure = '回复格式有误，可以重试。';
                return;
            }
            await this.playReplies(id, turn, replies);
        } catch (error) {
            if (!signal.aborted) {
                console.warn('[群聊] 生成回复失败:', error);
                failure = '群聊回复失败，可以重试。';
            }
        } finally {
            if (this.turns.get(id) === turn) {
                if (failure) this.failedTurns.set(id, failure);
                this.finishTurn(id, turn);
            }
        }
    },

    // ★ 只解析有实际成员 ID 的结构化气泡。完整空数组表示主动沉默，其余无法解析的回复提示重试。
    parseReplies(raw, members) {
        const text = String(raw || '').replace(/<(think|thinking|thought)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '').trim();
        const first = text.indexOf('[');
        const last = text.lastIndexOf(']');
        let entries = null;
        if (first >= 0 && last > first) {
            try { entries = JSON.parse(text.slice(first, last + 1)); } catch { /* 尝试恢复完整气泡 */ }
        }
        if (!Array.isArray(entries)) {
            entries = [];
            // ★ 逐对象恢复时识别 JSON 字符串，正文里的引号和大括号仍按原文处理。
            for (const match of text.matchAll(/\{(?:[^{}"]|"(?:\\[\s\S]|[^"\\])*")*\}/g)) {
                try { entries.push(JSON.parse(match[0])); } catch { /* 跳过单个损坏的气泡 */ }
            }
            if (!entries.length) return null;
        }
        if (!entries.length) return [];
        const byId = new Map(members.map(member => [String(member.id), member]));
        const replies = [];
        for (const entry of entries) {
            const member = byId.get(String(entry?.memberId ?? ''));
            const content = typeof entry?.content === 'string' ? entry.content.trim() : '';
            if (member && content) replies.push({ member, content });
            if (replies.length === this.REPLY_LIMIT) break;
        }
        return replies.length ? replies : null;
    },

    buildRequest(group, members, messages, image, privateMessages) {
        const system = [
            '模拟一个真实的线上群聊。根据成员人设和话题，决定此刻哪些角色自然会接话。',
            '允许同一成员连发、成员互相聊、只有一人回复或整轮沉默。点名或 @ 时优先考虑被点到的人。',
            '私聊背景只用于对应角色的关系和语气，其他成员没有看到。群历史里标有可见成员时，列表之外的新成员没有读过那条消息。',
            '只回复 JSON 数组，每个对象只含 memberId 和 content 字段，每个对象是一条文字气泡。',
            'memberId 必须来自群成员资料，不能输出用户的发言。按实际发言顺序输出，最多 ' + this.REPLY_LIMIT + ' 条，没人想回时输出 []。'
        ].join('\n');
        const memberData = members.map(member => {
            const data = { memberId: String(member.id), name: member.name, persona: member.prompt || '' };
            const recent = privateMessages?.get(member.id);
            if (recent?.length) data.recentPrivateMessages = recent;
            return data;
        });
        const memberIds = members.map(member => member.id);
        const history = messages.map(message => {
            const currentImage = image?.sentAt === message.sentAt ? image : null;
            const entry = {
                timestamp: message.timestamp,
                speaker: message.role === 'user' ? '用户' : message.senderName,
                content: this.contextText(message, currentImage)
            };
            if (message.role === 'assistant') entry.memberId = String(message.senderId);
            if (memberIds.some(id => !message.audience.includes(id))) {
                entry.visibleTo = memberIds.filter(id => message.audience.includes(id)).map(String);
            }
            return entry;
        }).filter(entry => entry.content);
        // ★ 公共群历史只附一份。统一放入一个 user 消息，兼容现有只读取末尾 user 的模型适配器。
        return [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify({ groupName: group.name, description: group.description, members: memberData, history }) }
        ];
    },

    contextText(message, currentImage) {
        // ★ 隐藏不仅影响群聊生成，也影响群聊回注单聊；统一按稳定气泡 key 清洗。
        if (message.isHidden) return '';
        const visible = HistoryVisibility.buildVisibleMessage(message, { includeImageDescription: false });
        const content = visible?.content || '';
        if (!ChatBubbles.hasImage(message) || ChatBubbles.isHidden(message, message.imageBubbleKey)) return content;
        const description = currentImage?.description || message.image_description;
        const imageLabel = currentImage?.attached ? '[图片：原图随本次请求附上]'
            : description ? '[图片：' + description + ']' : '[图片]';
        return [content, imageLabel].filter(Boolean).join('\n');
    },

    // ================ 群聊 / 单聊轮次桥接 ================
    // ★ 按来源和目标用户消息 ID 记账。第三轮重生成仍能用背景，第四条新用户消息才超出本批额度。
    planBridgeRound(state, sourceKey, roundId) {
        const limit = CONFIG.GROUP_CHAT_BRIDGE_ROUNDS;
        if (!limit || !sourceKey || !roundId) return null;
        if (state?.roundIds?.includes(roundId)) return { sourceKey: state.sourceKey, roundId };
        if (state?.sourceKey === sourceKey && state.roundIds?.length >= limit) return null;
        return { sourceKey, roundId };
    },

    // ★ 用请求实际带走的来源记账。扣减随成功回复一起落库，报错和主动停止不会扣轮次。
    consumeBridgeRound(state, round) {
        if (!round || state?.roundIds?.includes(round.roundId)) return state;
        const roundIds = state?.sourceKey === round.sourceKey ? state.roundIds || [] : [];
        if (roundIds.length >= CONFIG.GROUP_CHAT_BRIDGE_ROUNDS) return state;
        return { sourceKey: round.sourceKey, roundIds: [...roundIds, round.roundId] };
    },

    recentPrivateMessages(contact) {
        const result = [];
        const history = contact.history || [];
        let latest = '';
        for (let i = history.length - 1; i >= 0 && result.length < this.PRIVATE_TO_GROUP_COUNT; i--) {
            const source = history[i];
            if (source?.role !== 'user' && source?.role !== 'assistant') continue;
            const visible = HistoryVisibility.buildVisibleMessage(source, { includeImageDescription: false });
            let content = HistoryVisibility.stripTimestamp(visible?.content || '');
            if (source.role === 'assistant' && typeof AgentIntentMarkup !== 'undefined') {
                content = AgentIntentMarkup.strip(content).trim();
            }
            if (!content) continue;
            // ★ 旧记录没有消息 ID 时，用时间、作者和正文识别来源，读取次数不会改变版本。
            if (!latest) latest = source.messageId || JSON.stringify([source.timestamp || '', source.role, content]);
            result.push({ timestamp: source.timestamp || '', speaker: source.role === 'user' ? '用户' : contact.name, content });
        }
        return { latest, messages: result.reverse() };
    },

    prepareGroupContext(group, members, roundId) {
        const sources = new Map(members.map(member => [member.id, this.recentPrivateMessages(member)]));
        // ★ 成员资料换顺序不会续期。任一成员有新私聊记录时，群聊得到下一批桥接额度。
        const sourcesWithMessages = [...sources].filter(([, value]) => value.latest);
        const sourceKey = sourcesWithMessages.length
            ? JSON.stringify(sourcesWithMessages.map(([id, value]) => [String(id), value.latest]).sort())
            : '';
        const round = this.planBridgeRound(group.privateChatBridge, sourceKey, roundId);
        return {
            round,
            messages: round ? new Map(sourcesWithMessages.map(([id, value]) => [id, value.messages])) : null
        };
    },

    // ★ 从后向前取完整问答，兼容已有群记录。一组多人回复和正文空行都归到前面的用户发言。
    recentGroupRounds(group, contactId, limit) {
        const rounds = [];
        let messages = [];
        let hasUser = false;
        const history = group.history;
        // ★ 先按原记录划定轮次，再检查角色的可见范围，避免移出 / 加入群后拼出虚假的问答。
        const collect = () => {
            const visible = messages.filter(message => message.audience?.includes(contactId) && this.contextText(message)).reverse();
            if (visible.some(message => message.role === 'user') && visible.some(message => message.role === 'assistant')) {
                rounds.push({ group, messages: visible });
            }
        };
        for (let i = history.length - 1; i >= 0; i--) {
            const message = history[i];
            if (message.role === 'user') {
                // ★ 末尾尚未收到回复的用户消息不构成完整一轮。
                if (messages.length) {
                    messages.push(message);
                    hasUser = true;
                }
            } else if (message.role === 'assistant') {
                if (hasUser) {
                    collect();
                    if (rounds.length >= limit) return rounds;
                    messages = [];
                    hasUser = false;
                }
                messages.push(message);
            }
        }
        if (hasUser && rounds.length < limit) collect();
        return rounds;
    },

    buildPrivateContext(contact, roundId) {
        const contactId = contact.id;
        const limit = CONFIG.GROUP_CHAT_PRIVATE_CONTEXT_ROUNDS;
        if (!(limit > 0)) return null;
        // ★ 每个群分别取最近几轮完整问答，活跃群不会挤掉其它群的额度。
        const recent = this.groups.flatMap(group => this.recentGroupRounds(group, contactId, limit))
            .sort((a, b) => b.messages.at(-1).sentAt - a.messages.at(-1).sentAt);
        if (!recent.length) return null;
        const bridge = contact.groupChatBridge;
        // ★ 清空一个群后，剩下的旧消息不会被当作新来源续期。
        const sourceKey = Math.max(recent[0].messages.at(-1).sentAt, Number(bridge?.sourceKey) || 0);
        const round = this.planBridgeRound(bridge, sourceKey, roundId);
        if (!round) return null;
        // ★ 同一群只标一次群名，保留正文里的空行；多个群分块，避免同名角色和话题混在一起。
        const blocks = new Map();
        for (const { group, messages } of recent.reverse()) {
            if (!blocks.has(group)) blocks.set(group, []);
            for (const message of messages) {
                const speaker = message.role === 'user' ? '用户' : this.speaker(message, contactId);
                blocks.get(group).push(speaker + '：“' + this.contextText(message) + '”');
            }
        }
        const transcript = [...blocks].map(([group, lines]) => '【' + group.name + '】\n' + lines.join('\n\n'));
        return { prompt: ['【近期群聊背景】', ...transcript].join('\n\n'), round };
    }
};

globalThis.GroupChat = GroupChat;
