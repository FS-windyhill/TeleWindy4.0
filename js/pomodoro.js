// =========================================
// POMODORO (探索番茄钟)
// 单次计时、轻陪伴和完成通知独立管理；正式聊天仍走原有动态背景管线。
// =========================================
const Pomodoro = {
    data: null,
    busy: false,
    speaking: false,
    speechRequestId: 0,
    writeQueue: Promise.resolve(),
    $(id) { return document.getElementById(id); },
    normalize(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const minutes = Number(source.minutes);
        const session = source.session;
        return {
            ...source,
            version: 1,
            contactId: source.contactId || null,
            // ★ 老版本没有模型选择时跟随全局默认，与记忆页保持一致。
            apiPresetIndex: Number.isInteger(source.apiPresetIndex) ? source.apiPresetIndex : -1,
            // ★ 完成未读单独持久化，旧数据默认已读，不把已有历史全部点亮。
            hasUnreadCompletion: source.hasUnreadCompletion === true,
            minutes: Number.isInteger(minutes) && minutes >= 1 && minutes <= 180 ? minutes : 25,
            task: typeof source.task === 'string' ? source.task : '',
            // ★ 旧备份没有新字段时补默认值；损坏的运行状态不能误结算成完成记录。
            session: session && session.id && session.contactId
                && Number.isFinite(session.durationMs) && session.durationMs > 0
                && ['running', 'paused', 'completed'].includes(session.status)
                && Number.isFinite(session.remainingMs) && session.remainingMs >= 0
                && (session.status !== 'running' || Number.isFinite(session.endAt)) ? session : null,
            records: Array.isArray(source.records) ? source.records.filter(r => r && r.id && r.contactId).map(r => ({
                ...r, remainingTurns: Math.max(0, Math.floor(Number(r.remainingTurns) || 0)),
                consumedTurns: Array.isArray(r.consumedTurns) ? r.consumedTurns : []
            })) : [],
            // ★ 旧备份没有陪伴发言时补空数组；无归属轮次或空文本的数据不进入正式聊天上下文。
            speeches: Array.isArray(source.speeches) ? source.speeches.filter(item => item && item.sessionId
                && item.contactId && String(item.text || '').trim()).map(item => ({
                sessionId: item.sessionId,
                contactId: item.contactId,
                text: String(item.text).trim(),
                createdAt: Number(item.createdAt) || 0
            })) : []
        };
    },
    async init() {
        this.data = this.normalize(await DB.get(CONFIG.POMODORO_KEY));
        this.bind();
        await this.tick();
        // ★ 后台只校正状态和入口提示；真正停留在番茄钟页时才刷新时钟，避免每秒重绘整个应用。
        setInterval(() => {
            const view = this.$('view-pomodoro');
            const renderMode = !document.hidden && view?.style.display !== 'none' ? 'clock' : 'indicator';
            this.tick(Date.now(), { renderMode }).catch(e => this.report(e));
        }, 1000);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.tick().then(() => {
                if (this.isViewing()) return this.markRead();
            }).catch(e => this.report(e));
        });
    },
    save() {
        // ★ 串行保存快照，防止较早的设置写入覆盖刚完成的记录。
        const snapshot = JSON.parse(JSON.stringify(this.data));
        this.writeQueue = this.writeQueue.catch(() => {}).then(() => DB.set(CONFIG.POMODORO_KEY, snapshot));
        return this.writeQueue;
    },
    report(error) {
        console.error('[Pomodoro]', error);
        this.$('pomodoro-speech').textContent = '保存或读取失败，请检查浏览器存储后重试。';
    },
    active() { return ['running', 'paused'].includes(this.data.session?.status); },
    isViewing() {
        // ★ 与朋友圈一样按实际页面显隐判断；浏览器切后台时不能自动认作已读。
        const view = this.$('view-pomodoro');
        return !document.hidden && !!view && getComputedStyle(view).display !== 'none'
            && !this.$('app-container')?.classList.contains('in-chat-mode');
    },
    async markRead() {
        if (!this.data.hasUnreadCompletion) return;
        this.data.hasUnreadCompletion = false;
        this.render();
        await this.save();
    },
    contact() {
        const id = this.data.session?.contactId || this.data.contactId;
        return STATE.contacts.find(c => c.id === id);
    },
    avatarSource(contact) {
        const value = String(contact?.avatar || '');
        return /^(data:image\/|https?:\/\/|blob:|\.\/assets\/|assets\/)/i.test(value) ? value : '';
    },
    remaining(now = Date.now()) {
        const s = this.data.session;
        return s ? (s.status === 'running' ? Math.max(0, s.endAt - now) : s.remainingMs) : this.data.minutes * 60000;
    },
    async tick(now = Date.now(), options = {}) {
        const renderMode = options.renderMode || 'full';
        const s = this.data.session;
        let stateChanged = false;
        if (s?.status === 'running' && this.remaining(now) <= 0 && !this.busy) {
            this.busy = true;
            try {
                // ★ 同一轮以唯一 ID 去重；完成记录和计时状态放在同一份数据中落库。
                if (!this.data.records.some(r => r.id === s.id)) {
                    this.data.records.push({ id: s.id, contactId: s.contactId, contactName: s.contactName,
                        task: s.task, minutes: s.durationMs / 60000, completedAt: s.endAt,
                        remainingTurns: CONFIG.POMODORO_INJECT_COUNT, consumedTurns: [] });
                }
                s.status = 'completed';
                s.remainingMs = 0;
                this.data.hasUnreadCompletion = !this.isViewing();
                stateChanged = true;
                await this.save();
                this.$('pomodoro-speech').textContent = '这一轮完成啦，拍拍头像，和陪伴人说句话吧。';
                // ★ 通知不依赖 API 成功，点击走统一页面路由；横幅关闭不会清除未读。
                App.showTopNotice('番茄钟已完成！', { type: 'pomodoro-complete', targetView: 'pomodoro', timeout: 6500 });
                // 不等待陪伴接口，以免完成结算阻塞计时按钮或正在发送的正式聊天。
                void this.speak('complete').catch(e => this.report(e));
            } finally { this.busy = false; }
        }
        // ★ 完成结算需要完整刷新一次；普通后台心跳只维护探索入口，不再碰头像、按钮和表单状态。
        if (stateChanged || renderMode === 'full') this.render(now);
        else if (renderMode === 'clock') {
            this.renderClock(now);
            this.renderEntry(now);
        } else {
            this.renderEntry(now);
        }
    },
    setText(id, value) {
        const element = this.$(id);
        const text = String(value);
        if (element.textContent !== text) element.textContent = text;
    },
    setBoolean(id, property, value) {
        const element = this.$(id);
        const nextValue = !!value;
        if (element[property] !== nextValue) element[property] = nextValue;
    },
    renderClock(now = Date.now()) {
        const s = this.data.session;
        const remainingMs = this.remaining(now);
        const seconds = Math.ceil(remainingMs / 1000);
        this.setText('pomodoro-time', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
        const offset = String(528 * (1 - remainingMs / (s?.durationMs || this.data.minutes * 60000)));
        const progress = this.$('pomodoro-progress');
        if (progress.style.strokeDashoffset !== offset) progress.style.strokeDashoffset = offset;
    },
    renderEntry(now = Date.now()) {
        const seconds = Math.ceil(this.remaining(now) / 1000);
        const clockText = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        this.setText('pomodoro-entry-status', this.active() ? clockText : '');
        const unreadDot = this.$('explore-pomodoro-unread-dot');
        if (unreadDot.classList.contains('hidden') === this.data.hasUnreadCompletion) {
            unreadDot.classList.toggle('hidden', !this.data.hasUnreadCompletion);
        }
    },
    render(now = Date.now()) {
        const s = this.data.session;
        const contact = this.contact();
        this.renderClock(now);
        // ★ 老角色可能使用 Emoji 头像，不能把表情文字赋给 img.src。
        const imageAvatar = this.avatarSource(contact);
        const avatar = this.$('pomodoro-avatar');
        const avatarSource = imageAvatar || 'assets/images/char.jpg';
        const currentAvatarSource = typeof avatar.getAttribute === 'function' ? avatar.getAttribute('src') : avatar.src;
        if (currentAvatarSource !== avatarSource) avatar.src = avatarSource;
        this.setBoolean('pomodoro-avatar', 'hidden', !!contact && !imageAvatar);
        this.setText('pomodoro-avatar-emoji', contact && !imageAvatar ? (contact.avatar || '😊') : '');
        this.setText('pomodoro-name', contact?.name || (s ? '陪伴人已不存在' : '还没有选择陪伴人'));
        this.setText('pomodoro-toggle', s?.status === 'running' ? '暂停' : s?.status === 'paused' ? '继续专注' : s?.status === 'completed' ? '开始下一轮' : '开始专注');
        this.setBoolean('pomodoro-toggle', 'disabled', this.busy);
        // ★ “结束本轮”只在计时已开始后出现，暂停时仍可主动结束本轮。
        const active = this.active();
        this.setBoolean('pomodoro-end', 'hidden', !active);
        this.setBoolean('pomodoro-end', 'disabled', !active || this.busy);
        this.setBoolean('pomodoro-task', 'disabled', active);
        this.setText('pomodoro-status', s?.status === 'running' ? '正在专注' : s?.status === 'paused' ? '已暂停' : s?.status === 'completed' ? '本轮已完成' : '准备开始');
        const today = new Date().toDateString();
        const records = this.data.records.filter(r => new Date(r.completedAt).toDateString() === today);
        this.setText('pomodoro-stats', `今天已经完成 ${records.length} 个番茄`);
        this.renderEntry(now);
    },
    async toggle() {
        await this.tick();
        if (this.busy) return;
        const s = this.data.session;
        const action = s?.status === 'running' ? 'pause' : s?.status === 'paused' ? 'resume' : 'start';
        if (s?.status === 'running') {
            s.remainingMs = this.remaining();
            s.status = 'paused';
        } else if (s?.status === 'paused') {
            s.endAt = Date.now() + s.remainingMs;
            s.status = 'running';
        } else {
            const contact = STATE.contacts.find(c => c.id === this.data.contactId);
            if (!contact) { this.openSettings(); return; }
            const durationMs = this.data.minutes * 60000;
            this.data.task = this.$('pomodoro-task').value.trim();
            this.data.session = { id: crypto.randomUUID(), contactId: contact.id, contactName: contact.name,
                task: this.data.task || '专注', durationMs, remainingMs: durationMs,
                endAt: Date.now() + durationMs, status: 'running' };
        }
        this.$('pomodoro-speech').textContent = this.data.session.status === 'paused' ? '歇一会儿，准备好后继续。' : '我在这里，想说话时拍拍头像。';
        this.render();
        // ★ 控制按钮即时生效；开始/暂停/继续各自请求一句陪伴回复，不等待网络才切换计时。
        await Promise.all([this.save(), this.speak(action)]);
    },
    openSettings() {
        const select = this.$('pomodoro-api-preset');
        const selected = select.value;
        select.replaceChildren();
        const addOption = (value, text) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            select.append(option);
        };
        addOption('-1', '-- 跟随全局默认 --');
        (STATE.settings.API_PRESETS || []).forEach((preset, index) => {
            addOption(String(index), `${preset.name} (${preset.model || '未知模型'})`);
        });
        // ★ 从陪伴人选择框返回时保留尚未保存的模型选择。
        const current = this.$('modal-pomodoro-settings').classList.contains('hidden') ? this.data.apiPresetIndex : Number(selected);
        select.value = STATE.settings.API_PRESETS?.[current] ? String(current) : '-1';
        this.$('pomodoro-minutes').value = this.data.minutes;
        this.$('pomodoro-minutes').disabled = this.active();
        this.$('pomodoro-pick').disabled = this.active();
        this.$('pomodoro-selected').textContent = STATE.contacts.find(c => c.id === this.data.contactId)?.name || '未选择';
        this.$('pomodoro-settings-hint').textContent = this.active() ? '本轮进行中，结束后可以更换陪伴人和时长。' : '选择一位角色，陪你完成这一轮专注。';
        this.$('modal-pomodoro-settings').classList.remove('hidden');
    },
    openPicker() {
        const list = this.$('pomodoro-people');
        list.replaceChildren();
        this.$('pomodoro-people-count').textContent = `${STATE.contacts.length} 位陪伴人`;
        for (const contact of STATE.contacts) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'model-picker-result-item';
            const imageAvatar = this.avatarSource(contact);
            const avatar = document.createElement(imageAvatar ? 'img' : 'span');
            if (imageAvatar) { avatar.src = imageAvatar; avatar.alt = ''; }
            else { avatar.className = 'pomodoro-picker-emoji'; avatar.textContent = contact.avatar || '😊'; }
            const name = document.createElement('span');
            name.className = 'model-picker-result-name';
            name.textContent = contact.name;
            button.append(avatar, name);
            if (contact.id === this.data.contactId) {
                const badge = document.createElement('span');
                badge.className = 'model-picker-current-badge';
                badge.textContent = '当前';
                button.append(badge);
            }
            button.addEventListener('click', async () => {
                if (this.active()) return;
                this.data.contactId = contact.id;
                this.data.session = null;
                this.$('pomodoro-picker').classList.add('hidden');
                this.openSettings();
                this.render();
                try { await this.save(); } catch (e) { this.report(e); }
            });
            list.append(button);
        }
        if (!STATE.contacts.length) list.textContent = '还没有角色，请先在联系人页添加角色。';
        this.$('pomodoro-picker').classList.remove('hidden');
    },
    recentMessages(contact) {
        // ★ “条”按一条 user / assistant 消息计算，不按问答轮次，也不按渲染出来的分气泡计算。
        return (contact.history || []).filter(m => ['user', 'assistant'].includes(m.role))
            .map(m => HistoryVisibility.buildVisibleMessage(m, { includeImageDescription: true, stripThought: true }))
            .filter(Boolean).slice(-CONFIG.POMODORO_CHAT_CONTEXT_COUNT);
    },
    getApiSettings() {
        // ★ 模型来源与记忆页相同：独立选择 API 预设，-1 或已删除的预设回退全局。
        // ★ 番茄钟里的开始、暂停、完成和拍头像都是陪伴功能，不写入桌面的互动日志。
        const settings = { ...STATE.settings, ASYNC_BACKEND_ENABLED: false, COUNT_AS_INTERACTION: false, MAX_TOKENS: 400 };
        const preset = (STATE.settings.API_PRESETS || [])[this.data.apiPresetIndex];
        if (preset) {
            Object.assign(settings, { API_URL: preset.url, API_KEY: preset.key, MODEL: preset.model,
                CUSTOM_REQUEST_BODY_JSON: preset.extra_body_json || '' });
            if (Number.isFinite(Number(preset.temperature)) && preset.temperature !== '') settings.TEMPERATURE = Number(preset.temperature);
            if (Number(preset.max_tokens) > 0) settings.MAX_TOKENS = Number(preset.max_tokens);
        }
        return settings;
    },
    async rememberSpeech(contactId, sessionId, text) {
        const cleanText = String(text || '').replace(/[\r\n]+/g, ' ').trim();
        if (!contactId || !sessionId || !cleanText) return;

        this.data.speeches.push({ contactId, sessionId, text: cleanText, createdAt: Date.now() });
        // ★ 每个角色只留最近 10 条原话，正式聊天再按配置截取最后几条，避免本地数据无限增长。
        const ownSpeeches = this.data.speeches.filter(item => item.contactId === contactId);
        const expired = new Set(ownSpeeches.slice(0, Math.max(0, ownSpeeches.length - 10)));
        if (expired.size) this.data.speeches = this.data.speeches.filter(item => !expired.has(item));
        await this.save();
    },
    async speak(action = 'pat', endedSession = null) {
        if (action === 'pat' && this.speaking) return;
        const contact = endedSession ? STATE.contacts.find(c => c.id === endedSession.contactId) : this.contact();
        // ★ 自动完成或结束时角色可能已删除，只跳过陪伴请求，不弹出设置打断其它页面。
        if (!contact && ['complete', 'end'].includes(action)) return;
        if (!contact) { this.openSettings(); return; }
        this.speaking = true;
        // ★ 开始后立刻暂停也要发出新请求；只让最新一次操作的回复更新界面。
        const requestId = ++this.speechRequestId;
        const sessionId = this.data.session?.id;
        const status = this.data.session?.status;
        const isCurrent = () => requestId === this.speechRequestId && this.contact()?.id === contact.id
            && this.data.session?.id === sessionId && this.data.session?.status === status;
        this.$('pomodoro-pat').disabled = true;
        this.$('pomodoro-speech').textContent = '对方正在输入…';
        try {
            const s = endedSession || this.data.session;
            const remainingMs = endedSession ? endedSession.remainingMs : this.remaining();
            const today = new Date().toDateString();
            const completed = this.data.records.filter(r => new Date(r.completedAt).toDateString() === today).length;
            // ★ 拍头像沿用旧项目验证过的原文，只替换当前任务。
            const currentTask = s?.task || this.data.task || '专注';
            const patPrompt = `我现在准备完成${currentTask}，但是我有时候也会分心来找你。我现在来找你啦！你想说啥就说啥，不必拘束，比如督促我专心完成任务，或者关心我一下，想说什么都行，不过不要长篇大论哦。`;
            // ★ 中途清零与正常完成采用旧项目原句；次数包含刚刚完成的这一轮。
            const actionText = { start: '我开始专注啦！', pause: '我先暂停一下番茄钟～', resume: '我回来继续专注啦！',
                end: '番茄钟已清零！重新开始吧～', complete: `我完成了第 ${completed} 个番茄！`, pat: patPrompt }[action] || patPrompt;
            // ★ 沿用旧项目的轻陪伴口吻，补上明确状态，避免暂停时还催用户继续倒计时。
            const prompt = `用户的角色扮演请求：请完全带入以下角色，并以该角色的语气和思考方式说话。你是${contact.name}。以下是人设：${contact.prompt || ''}
用户在进行一个番茄钟任务。
- 当前任务：${s?.task || this.data.task || '专注'}
- 今天已完成 ${completed} 个番茄
- 本轮总时长：${(s?.durationMs || this.data.minutes * 60000) / 60000} 分钟
- 距离下次休息还有 ${Math.ceil(remainingMs / 60000)} 分钟
- 已经专注了 ${s ? Math.floor((s.durationMs - remainingMs) / 60000) : 0} 分钟
- 当前状态：${endedSession ? '本轮已中途结束并清零' : ({ running: '专注中', paused: '已暂停', completed: '已完成' }[status] || '尚未开始')}
请参考“已经专注的时间”“距离下次休息的时间”“当前任务”，根据你人设的性格回复用户。人类说话是不会带括号和动作描写的。你想说啥就说啥，不必拘束，不过不要长篇大论哦。你的任务：模仿人类说话，直接输出说话的内容。不要长篇大论哦，简单一点。`;
            // ★ 暂停向番茄钟携带聊天记录：实测会干扰轻量陪伴效果，需要恢复时取消下一行注释。
            const result = await API.chat([{ role: 'system', content: prompt }, /* ...this.recentMessages(contact), */
                { role: 'user', content: actionText }], this.getApiSettings());
            if (isCurrent()) {
                const speechText = String(result).replace(/<(think|thinking|thought)[^>]*>[\s\S]*?(<\/\1>|$)/gi, '').trim() || '我在这里陪你。';
                this.$('pomodoro-speech').textContent = speechText;
                // ★ 只保存真正展示出来的当前回复；迟到且被新操作覆盖的回复不能混入聊天上下文。
                await this.rememberSpeech(contact.id, s?.id, speechText);
            }
        } catch (error) {
            console.error('[Pomodoro] 陪伴回复失败', error);
            if (isCurrent()) this.$('pomodoro-speech').textContent = '暂时没收到回复，可以再拍拍我。计时状态已保存。';
        } finally {
            if (requestId === this.speechRequestId) {
                this.speaking = false;
                this.$('pomodoro-pat').disabled = false;
            }
        }
    },
    context(contactId, turnId) {
        // ★ 每条记录各有三轮额度；Reroll 复用 turnId，第三轮耗尽后重生成仍可见。
        const records = this.data.records.filter(r => r.contactId === contactId
            && (r.remainingTurns > 0 || r.consumedTurns.includes(turnId)));
        const cleanTask = task => String(task || '专注').replace(/[\r\n]+/g, ' ');
        const lines = [];
        const session = this.data.session;
        // ★ 实时状态只通知本轮陪伴人，置于完成记录之前；不占用完成后的三轮额度。
        if (session?.contactId === contactId) {
            if (session.status === 'running' && this.remaining() > 0) {
                lines.push(`- 对方正在和你进行一个番茄钟：${cleanTask(session.task)}`);
            } else if (session.status === 'paused') {
                lines.push(`- 对方和你的番茄钟已暂停：${cleanTask(session.task)}`);
            }
        }
        records.forEach(r => lines.push(`- 对方和你一起完成了一个${r.minutes}分钟的番茄钟：${cleanTask(r.task)}`));
        // ★ 发言与所属番茄共用生命周期：进行中跟随实时状态，完成后跟随记录原有的三轮额度。
        const visibleSessionIds = new Set(records.map(record => record.id));
        if (session?.contactId === contactId && ['running', 'paused'].includes(session.status)) visibleSessionIds.add(session.id);
        const speechLimit = Math.max(0, Math.floor(Number(CONFIG.POMODORO_SPEECH_CONTEXT_COUNT) || 0));
        const speeches = speechLimit > 0
            ? this.data.speeches.filter(item => item.contactId === contactId && visibleSessionIds.has(item.sessionId))
                .sort((a, b) => a.createdAt - b.createdAt).slice(-speechLimit)
            : [];
        const speechPrompt = speeches.length
            ? '\n\n【你刚才在番茄钟里说过的话】\n\n' + speeches.map(item => `- “${item.text}”`).join('\n')
            : '';
        return { contactId, turnId, ids: records.map(r => r.id),
            prompt: lines.length ? '【番茄钟】\n\n' + lines.join('\n') + speechPrompt : '' };
    },
    async consume(packet) {
        if (!packet?.turnId) return;
        let changed = false;
        for (const record of this.data.records) {
            if (record.contactId !== packet.contactId || !packet.ids?.includes(record.id)
                || record.consumedTurns.includes(packet.turnId) || record.remainingTurns <= 0) continue;
            record.remainingTurns--;
            record.consumedTurns.push(packet.turnId);
            changed = true;
        }
        if (changed) await this.save();
    },
    showHistory() {
        const list = this.$('pomodoro-history-list');
        list.replaceChildren();
        const groups = new Map();
        for (const record of [...this.data.records].sort((a, b) => b.completedAt - a.completedAt)) {
            // ★ 按本地日期分组，避免 UTC 换日把深夜完成的番茄归到前一天。
            const date = new Date(record.completedAt);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (!groups.has(dateKey)) groups.set(dateKey, []);
            groups.get(dateKey).push(record);
        }
        for (const [dateKey, records] of groups) {
            const group = document.createElement('section');
            group.className = 'pomodoro-history-date-group';

            const title = document.createElement('div');
            title.className = 'pomodoro-history-date-title';
            const dateLabel = document.createElement('span');
            dateLabel.textContent = dateKey;
            const summary = document.createElement('span');
            summary.className = 'pomodoro-history-date-summary';
            summary.textContent = `${records.length} 个番茄 · ${records.reduce((total, record) => total + record.minutes, 0)} 分钟`;
            title.append(dateLabel, summary);

            const body = document.createElement('div');
            body.className = 'pomodoro-history-date-body';
            for (const record of records) {
                const item = document.createElement('div');
                item.className = 'pomodoro-history-item';
                const task = document.createElement('span');
                task.className = 'pomodoro-history-task';
                // ★ 任务和角色名统一用 textContent，避免用户输入被当成 HTML。
                task.textContent = String(record.task || '专注').replace(/[\r\n]+/g, ' ');
                const meta = document.createElement('span');
                meta.className = 'pomodoro-history-meta';
                const completedAt = new Date(record.completedAt);
                const timeText = `${String(completedAt.getHours()).padStart(2, '0')}:${String(completedAt.getMinutes()).padStart(2, '0')}`;
                meta.textContent = `${timeText} · ${record.minutes} 分钟 · with ${record.contactName || '陪伴人'}`;
                item.append(task, meta);
                body.append(item);
            }
            group.append(title, body);
            list.append(group);
        }
        if (!this.data.records.length) {
            list.classList.add('pomodoro-history-empty');
            list.textContent = '还没有完成记录，开始你的第一个番茄吧。';
        } else {
            list.classList.remove('pomodoro-history-empty');
        }
        this.$('pomodoro-history').classList.remove('hidden');
    },
    async endRound() {
        await this.tick();
        if (!this.active()) return;
        // ★ 清空计时前保留请求快照，结束回复仍能知道刚刚做的任务和实际专注时间。
        const endedSession = { ...this.data.session, remainingMs: this.remaining() };
        this.data.session = null;
        this.render();
        await Promise.all([this.save(), this.speak('end', endedSession)]);
    },
    bind() {
        const on = (id, fn) => this.$(id).addEventListener('click', () => Promise.resolve().then(fn).catch(e => this.report(e)));
        on('explore-pomodoro-btn', () => UI.switchView('pomodoro'));
        on('pomodoro-back-btn', () => UI.switchView(App.getReturnView('pomodoro', 'explore')));
        on('pomodoro-settings-btn', () => this.openSettings());
        on('pomodoro-pick', () => this.openPicker());
        on('pomodoro-toggle', () => this.toggle());
        on('pomodoro-pat', () => this.speak());
        on('pomodoro-history-btn', () => this.showHistory());
        on('pomodoro-end', async () => {
            if (!this.active() || !confirm('结束本轮？未完成的番茄不会计入历史。')) return;
            await this.endRound();
        });
        on('pomodoro-settings-save', async () => {
            const minutes = Number(this.$('pomodoro-minutes').value);
            if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) { alert('请输入 1～180 之间的整数分钟。'); return; }
            if (!this.active()) { this.data.minutes = minutes; this.data.session = null; }
            this.data.apiPresetIndex = Number(this.$('pomodoro-api-preset').value);
            await this.save();
            this.$('modal-pomodoro-settings').classList.add('hidden');
            this.render();
        });
        for (const [button, modal] of [['pomodoro-settings-close', 'modal-pomodoro-settings'], ['pomodoro-picker-close', 'pomodoro-picker'], ['pomodoro-history-close', 'pomodoro-history']]) {
            on(button, () => this.$(modal).classList.add('hidden'));
            this.$(modal).addEventListener('click', e => { if (e.target === this.$(modal)) this.$(modal).classList.add('hidden'); });
        }
        this.$('pomodoro-task').value = this.data.session?.task || this.data.task;
        this.$('pomodoro-task').addEventListener('change', () => {
            if (this.active()) return;
            this.data.task = this.$('pomodoro-task').value.trim();
            this.save().catch(e => this.report(e));
        });
        // ★ 设置图标直接复用朋友圈的 SVG，保持同一套线条和尺寸。
        this.$('pomodoro-settings-btn').innerHTML = this.$('moments-settings-btn').innerHTML;
    }
};
