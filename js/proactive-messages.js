// =========================================
// 主动消息：Worker Alarm + 纯前端离线补发
// =========================================
// 设计约束：
// 1. 定时器只提供思考机会，模型可以选择 silent；
// 2. sentAt 是聊天界面的角色时间，generatedAt 是真实生成时间，冷却永远使用后者；
// 3. Worker 和前端都用 messageId / heartbeatRunId 去重，避免 Alarm 重试或重复拉取产生两条消息；
// 4. 浏览器统一保留最近 40 条调试事件；Worker 每个角色只暂存少量离线事件。

const ProactiveMessages = {
    installationKey: 'telewindy_proactive_installation_v1',
    // ★ Worker 与纯前端共用同一份精简窗口，防止两种模式切换后角色判断尺度突然变化。
    contextMessageLimit: 15,
    contextRevision: 0,
    running: false,
    wakeTimer: null,
    savingCard: false,
    diagnosticMigrationPending: false,
    // ★ 卡片有未保存输入时，后台同步触发的 render 不覆盖用户正在编辑的内容。
    dirtyCards: new Set(),
    draftRevisions: { time: 0, characters: 0, mode: 0 },
    // ★ 只持久化无敏感信息的检测摘要；启动时恢复上次结果，新的真实检测必须由用户点击按钮触发。
    workerProbe: { status: 'idle', code: '', message: '尚未检测', signature: '', checkedAt: 0 },

    defaults() {
        return JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES));
    },

    settings() {
        const current = STATE.settings.PROACTIVE_MESSAGES;
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            STATE.settings.PROACTIVE_MESSAGES = this.defaults();
        } else {
            // ★ 只补默认字段，不替换已被保存、开关或同步流程持有的设置对象。
            Object.assign(current, { ...this.defaults(), ...current });
        }
        const settings = STATE.settings.PROACTIVE_MESSAGES;
        ['characterIds'].forEach(key => { if (!Array.isArray(settings[key])) settings[key] = []; });
        ['lastLocalCheckAtByChar', 'nextLocalWakeAtByChar', 'localRuntimeByChar', 'workerStatusByChar'].forEach(key => {
            if (!settings[key] || typeof settings[key] !== 'object' || Array.isArray(settings[key])) settings[key] = {};
        });
        if (!Array.isArray(settings.diagnosticEvents)) settings.diagnosticEvents = [];
        // ★ 旧版频繁写入的同步事件没有排障价值，升级后从统一日志清除；旧 Worker 回传时也不再收录。
        const withoutSyncEvents = settings.diagnosticEvents.filter(event => event?.code !== 'proactive_sync');
        if (withoutSyncEvents.length !== settings.diagnosticEvents.length) {
            settings.diagnosticEvents = withoutSyncEvents;
            this.diagnosticMigrationPending = true;
        }
        if (settings.diagnosticEvents.length > 40) {
            settings.diagnosticEvents = settings.diagnosticEvents.slice(-40);
            this.diagnosticMigrationPending = true;
        }
        // ★ 旧版本把事件数组放在每个角色状态中；迁入统一日志后只保留运行状态，避免备份重复携带日志。
        for (const [id, runtime] of Object.entries(settings.localRuntimeByChar)) {
            if (!Array.isArray(runtime?.events)) continue;
            this.mergeDiagnosticEvents(id, runtime.events, '浏览器', settings);
            delete runtime.events;
            this.diagnosticMigrationPending = true;
        }
        for (const [id, status] of Object.entries(settings.workerStatusByChar)) {
            if (!Array.isArray(status?.events)) continue;
            this.mergeDiagnosticEvents(id, status.events, 'Worker', settings);
            delete status.events;
            this.diagnosticMigrationPending = true;
        }
        if (!settings.lastDecisionSummary) {
            const latest = [...settings.diagnosticEvents].reverse().find(event => ['proactive_decision_send', 'proactive_decision_silent'].includes(event.code));
            if (latest) {
                settings.lastDecisionSummary = {
                    code: latest.code, ts: latest.ts, characterId: latest.characterId, characterName: latest.characterName
                };
                this.diagnosticMigrationPending = true;
            }
        }
        return settings;
    },

    mergeDiagnosticEvents(contactId, events, source, settings = this.settings()) {
        const list = settings.diagnosticEvents;
        const contact = (STATE.contacts || []).find(item => String(item.id) === String(contactId));
        for (const event of events || []) {
            if (!event?.code || event.code === 'proactive_sync') continue;
            const entry = {
                ...event,
                characterId: String(contactId),
                characterName: contact?.name || event.characterName || '已删除角色',
                source,
                ts: Number(event.ts || Date.now())
            };
            const key = `${entry.characterId}:${entry.source}:${entry.code}:${entry.heartbeatRunId || ''}:${entry.ts}`;
            if (!list.some(item => `${item.characterId}:${item.source}:${item.code}:${item.heartbeatRunId || ''}:${item.ts}` === key)) list.push(entry);
            if (['proactive_decision_send', 'proactive_decision_silent'].includes(entry.code)
                && entry.ts >= Number(settings.lastDecisionSummary?.ts || 0)) {
                // ★ 最近决策单独保留一份简要状态，防止统一日志滚动到 40 条后摘要变回“无”。
                settings.lastDecisionSummary = {
                    code: entry.code, ts: entry.ts, characterId: entry.characterId, characterName: entry.characterName
                };
            }
        }
        // ★ 先按时间排序再裁剪，旧快照迁移和多角色 Worker 回传都不能冲掉较新的记录。
        list.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
        settings.diagnosticEvents = list.slice(-40);
    },

    installationId() {
        let value = localStorage.getItem(this.installationKey);
        if (!value) {
            value = window.crypto?.randomUUID?.() || `install_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(this.installationKey, value);
        }
        return value;
    },

    objectName(contactId) {
        return encodeURIComponent(`${this.installationId()}:${String(contactId)}`);
    },

    workerConfigured() {
        const executionMode = this.executionMode();
        return !!(
            STATE.settings.ASYNC_BACKEND_URL
            && STATE.settings.ASYNC_BACKEND_TOKEN
            && executionMode !== 'frontend'
            && (executionMode !== 'private_worker' || this.settings().privateWorkerCredentialConsent === true)
        );
    },

    executionMode() {
        const settings = this.settings();
        if (['frontend', 'private_worker', 'server_secret'].includes(settings.executionMode)) {
            return settings.executionMode;
        }
        // ★ 旧备份只有 followFrontendApiKey；true 原本就是纯前端，false 原本就是 Worker Secret。
        return settings.followFrontendApiKey === false ? 'server_secret' : 'frontend';
    },

    workerCredentialMode() {
        return this.executionMode() === 'private_worker' ? 'stored_client_key' : 'server_secret';
    },

    probeTokenFingerprint() {
        const text = String(STATE.settings.ASYNC_BACKEND_TOKEN || '');
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return `${text.length}:${(hash >>> 0).toString(16)}`;
    },

    probeSignature(apiUrls = this.getCapabilityApiUrls()) {
        return JSON.stringify([
            STATE.settings.ASYNC_BACKEND_URL || '',
            this.probeTokenFingerprint(),
            this.executionMode(),
            apiUrls
        ]);
    },

    restoreWorkerProbe() {
        const cache = this.settings().workerProbeCache;
        const signature = this.probeSignature();
        if (cache && cache.signature === signature && cache.status) {
            this.workerProbe = { ...cache, providers: [] };
            return;
        }
        this.workerProbe = { status: 'idle', code: '', message: '尚未检测', signature, checkedAt: 0 };
    },

    async rememberWorkerProbe(probe, persist = true) {
        this.workerProbe = { ...probe };
        if (persist) {
            const { status, code, message, signature, checkedAt } = this.workerProbe;
            this.settings().workerProbeCache = { status, code, message, signature, checkedAt };
            await Storage.saveSettings();
        }
        this.renderModeStatus();
    },

    invalidateWorkerProbe(message = '配置已变化，请重新检测') {
        this.settings().workerProbeCache = null;
        this.workerProbe = {
            status: 'idle', code: 'config_changed', message,
            signature: this.probeSignature(), checkedAt: 0
        };
        this.renderModeStatus();
    },

    workerModeAvailable() {
        return this.workerConfigured() && this.workerProbe.status === 'ready';
    },

    workerBaseUrl(contactId) {
        return `${String(STATE.settings.ASYNC_BACKEND_URL || '').replace(/\/+$/, '')}/proactive/${this.objectName(contactId)}`;
    },

    workerHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${STATE.settings.ASYNC_BACKEND_TOKEN || ''}`
        };
    },

    capabilityUrl() {
        return `${String(STATE.settings.ASYNC_BACKEND_URL || '').replace(/\/+$/, '')}/proactive/capabilities`;
    },

    makeId(prefix = 'msg') {
        return `${prefix}_${window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    },

    parseChatTime(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const text = String(value || '').trim();
        if (!text) return 0;
        const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(text) ? text.replace(' ', 'T') : text;
        const parsed = new Date(normalized).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    },

    formatChatTime(value) {
        const date = new Date(Number(value) || Date.now());
        const pad = number => String(number).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },

    displayContent(message, content = message?.content) {
        const text = String(content || '');
        // ★ 主动消息把真实发送时间写进正文供角色读取；聊天气泡仍沿用 timestamp 字段显示时间，不重复展示前缀。
        if (message?.role === 'assistant' && message?.proactiveSource) {
            return text.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*/, '');
        }
        return text;
    },

    ensureMessageIds() {
        let changed = false;
        (STATE.contacts || []).forEach(contact => {
            if (!Array.isArray(contact.history)) contact.history = [];
            contact.history.forEach((message, index) => {
                if (!message || typeof message !== 'object') return;
                if (!message.messageId) {
                    message.messageId = this.makeId(`legacy_${index}`);
                    changed = true;
                }
                if (!Number(message.eventAt)) {
                    message.eventAt = this.parseChatTime(message.timestamp || message.createdAt || message.updatedAt) || (Date.now() + index);
                    changed = true;
                }
                if (!Number(message.recordedAt)) {
                    message.recordedAt = Number(message.createdAt || message.eventAt || Date.now());
                    changed = true;
                }
            });
        });
        return changed;
    },

    getRequestSettings(contact) {
        const settings = {
            API_URL: STATE.settings.API_URL,
            API_KEY: STATE.settings.API_KEY,
            MODEL: STATE.settings.MODEL,
            MAX_TOKENS: 1200,
            TEMPERATURE: STATE.settings.TEMPERATURE ?? 1,
            CUSTOM_REQUEST_BODY_JSON: STATE.settings.CUSTOM_REQUEST_BODY_JSON || '',
            ASYNC_BACKEND_ENABLED: false
        };
        const selectedName = String(this.settings().apiPresetName || '__character__');
        let preset = null;
        if (selectedName === '__character__' && contact?.linkedPresetName) {
            preset = (STATE.settings.API_PRESETS || []).find(item => item?.name === contact.linkedPresetName);
        } else if (selectedName !== '__character__' && selectedName !== '__global__') {
            preset = (STATE.settings.API_PRESETS || []).find(item => item?.name === selectedName);
            // ★ 专属预设被删除或改名时回退旧版角色模型，不把请求悄悄发给数组里的另一个预设。
            if (!preset && contact?.linkedPresetName) {
                preset = (STATE.settings.API_PRESETS || []).find(item => item?.name === contact.linkedPresetName);
            }
        }
        if (preset) {
            settings.API_URL = preset.url || settings.API_URL;
            settings.API_KEY = preset.key || settings.API_KEY;
            settings.MODEL = preset.model || settings.MODEL;
            settings.TEMPERATURE = Number.isFinite(Number(preset.temperature)) && preset.temperature !== '' ? Number(preset.temperature) : settings.TEMPERATURE;
            settings.MAX_TOKENS = Number(preset.max_tokens) > 0 ? Number(preset.max_tokens) : settings.MAX_TOKENS;
            settings.CUSTOM_REQUEST_BODY_JSON = preset.extra_body_json || '';
        }
        return settings;
    },

    selectedPresetLabel() {
        const selectedName = String(this.settings().apiPresetName || '__character__');
        if (selectedName === '__character__') return '跟随角色对话模型';
        if (selectedName === '__global__') return '跟随全局默认';
        const preset = (STATE.settings.API_PRESETS || []).find(item => item?.name === selectedName);
        return preset ? `${preset.name}（${preset.model || '未知模型'}）` : '预设已删除，回退角色模型';
    },

    getCapabilityApiUrls() {
        const selectedIds = new Set(this.settings().characterIds.map(String));
        let contacts = (STATE.contacts || []).filter(contact => selectedIds.has(String(contact.id)));
        if (!contacts.length) contacts = (STATE.contacts || []).slice(0, 1);
        const urls = contacts.map(contact => this.getRequestSettings(contact).API_URL).filter(Boolean);
        if (!urls.length && STATE.settings.API_URL) urls.push(STATE.settings.API_URL);
        return [...new Set(urls.map(url => String(url).trim()).filter(Boolean))];
    },

    getPolicy() {
        const settings = this.settings();
        const timeToMinutes = (value, fallback) => {
            const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
            return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
        };
        return {
            activeStartMinutes: timeToMinutes(settings.activeStart, 9 * 60),
            activeEndMinutes: timeToMinutes(settings.activeEnd, 23 * 60),
            minCooldownMinutes: this.duration(settings.minCooldownMinutes, 10080, 180, true),
            recentChatQuietMinutes: this.duration(settings.recentChatQuietMinutes, 1440, 45, true),
            dailyLimit: this.integer(settings.dailyLimit, 1, 20, 3),
            unansweredLimit: this.integer(settings.unansweredLimit, 1, 10, 2),
            heartbeatHours: this.duration(settings.heartbeatHours, 168, 12, false)
        };
    },

    clamp(value, min, max, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    },

    duration(value, max, fallback, allowZero = false) {
        const number = Number(value);
        if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) return fallback;
        return Math.min(max, number);
    },

    integer(value, min, max, fallback) {
        return Math.round(this.clamp(value, min, max, fallback));
    },

    lastActivity(contact, role = null) {
        const messages = (contact?.history || []).filter(message => !role || message?.role === role);
        return messages.reduce((latest, message) => Math.max(latest, Number(message?.eventAt) || this.parseChatTime(message?.timestamp)), 0);
    },

    buildContextPrompt(contact) {
        const blocks = [];
        try {
            const memory = typeof CharacterMemory !== 'undefined' ? CharacterMemory.buildChatPrompt(contact.id, new Date()) : '';
            if (memory) blocks.push(memory);
        } catch (error) { console.warn('[主动消息] 读取角色记忆失败:', error); }
        try {
            const note = typeof AgentHeartNoteManager !== 'undefined' ? AgentHeartNoteManager.buildChatPrompt(contact.id, new Date()) : '';
            if (note) blocks.push(note);
        } catch (error) { console.warn('[主动消息] 读取心笺失败:', error); }
        try {
            const schedule = typeof CharacterSchedule !== 'undefined' ? CharacterSchedule.buildChatPrompt(contact.id, new Date()) : '';
            if (schedule) blocks.push(schedule);
        } catch (error) { console.warn('[主动消息] 读取角色日程失败:', error); }
        try {
            const worldSense = typeof WorldSense !== 'undefined' ? WorldSense.buildPromptFromSettings(STATE.settings, new Date()) : '';
            if (worldSense) blocks.push(worldSense);
        } catch (error) { console.warn('[主动消息] 读取世界感知失败:', error); }
        return blocks.join('\n\n').slice(0, 30000);
    },

    buildCapsule(contact) {
        const requestSettings = this.getRequestSettings(contact);
        let requestBodyExtra = {};
        try {
            const parsed = JSON.parse(requestSettings.CUSTOM_REQUEST_BODY_JSON || '{}');
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) requestBodyExtra = parsed;
        } catch (error) {
            // ★ API 预设保存时已经校验 JSON；这里仍兜底为空对象，避免旧数据阻断整次后台同步。
            console.warn('[主动消息] API 预设附加参数不是有效 JSON，Worker 模式将忽略:', error);
        }
        // ★ 与普通聊天共用 AI 可见历史规则：主动判断不读取思考链、隐藏气泡或纯思考消息。
        const messages = [];
        const history = contact.history || [];
        for (let index = history.length - 1; index >= 0 && messages.length < this.contextMessageLimit; index -= 1) {
            const message = history[index];
            const visible = HistoryVisibility.buildVisibleMessage(message);
            if (!visible) continue;
            messages.unshift({
                // ★ 后台普通回复用 jobId 对齐 Worker 已补写的消息，避免页面恢复后出现两份上下文。
                messageId: message.asyncJobId ? `job_${message.asyncJobId}` : message.messageId,
                role: visible.role,
                content: visible.content.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*/, '').slice(0, 4000),
                eventAt: Number(message.eventAt) || this.parseChatTime(message.timestamp)
            });
        }
        return {
            enabled: this.settings().enabled === true && this.settings().characterIds.map(String).includes(String(contact.id)),
            characterId: String(contact.id),
            characterName: contact.name || '角色',
            characterPrompt: contact.prompt || '',
            contextPrompt: this.buildContextPrompt(contact),
            messages,
            // ★ 即使某条后台回复被隐藏，也要告诉 Worker 已在前端落库，清掉服务端暂存的原文。
            acknowledgedMessageIds: history.slice(-100).filter(message => message?.asyncJobId || message?.proactiveSource)
                .map(message => message.asyncJobId ? `job_${message.asyncJobId}` : String(message.messageId || ''))
                .filter(Boolean),
            contextRevision: this.contextRevision = Math.max(Date.now(), this.contextRevision + 1),
            credentialMode: this.workerCredentialMode(),
            // ★ 私人 Worker 会立即加密并只保存密文；高级 Secret 模式不向 Worker 发送前端 Key。
            apiKey: this.executionMode() === 'private_worker' ? (requestSettings.API_KEY || '') : '',
            apiUrl: requestSettings.API_URL || '',
            model: requestSettings.MODEL || '',
            temperature: requestSettings.TEMPERATURE,
            maxTokens: requestSettings.MAX_TOKENS,
            requestBodyExtra,
            // ★ Worker 没有用户浏览器的本地时区；同步 IANA 时区供后台按消息发生时的当地时间排版。
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            lastUserAt: this.lastActivity(contact, 'user'),
            lastChatAt: this.lastActivity(contact),
            nextWakeAt: Number(this.settings().nextLocalWakeAtByChar[String(contact.id)] || 0) || null,
            policy: this.getPolicy()
        };
    },

    async probeWorkerCapability(force = false) {
        const executionMode = this.executionMode();
        const apiUrls = this.getCapabilityApiUrls();
        const signature = this.probeSignature(apiUrls);
        if (executionMode === 'frontend') {
            await this.rememberWorkerProbe({ status: 'frontend', code: 'frontend_mode', message: '浏览器模式无需检测', signature, checkedAt: Date.now() });
            return false;
        }
        if (!STATE.settings.ASYNC_BACKEND_URL || !STATE.settings.ASYNC_BACKEND_TOKEN) {
            await this.rememberWorkerProbe({ status: 'unconfigured', code: 'backend_missing', message: '请先在后台运行服务填写 Worker URL 和访问密钥', signature, checkedAt: Date.now() });
            return false;
        }

        if (!force && this.workerProbe.signature === signature && Date.now() - Number(this.workerProbe.checkedAt || 0) < 30000) {
            return this.workerProbe.status === 'ready';
        }

        this.workerProbe = { status: 'checking', code: '', message: '正在检测 Worker…', signature, checkedAt: Date.now() };
        this.renderModeStatus();
        try {
            const response = await fetch(this.capabilityUrl(), {
                method: 'POST',
                headers: this.workerHeaders(),
                body: JSON.stringify({ api_urls: apiUrls, credential_mode: this.workerCredentialMode() })
            });
            let data = {};
            try { data = await response.json(); } catch (error) {}
            if (!response.ok || data.ok !== true) {
                const code = data.error || (response.status === 404 ? 'proactive_endpoint_missing' : response.status === 401 ? 'unauthorized' : `http_${response.status}`);
                throw Object.assign(new Error(code), { code });
            }
            if (executionMode === 'private_worker' && data.encryptedClientKey !== true) {
                throw Object.assign(new Error('encrypted_credential_unsupported'), { code: 'encrypted_credential_unsupported' });
            }
            await this.rememberWorkerProbe({ status: 'ready', code: '', message: 'Worker 主动消息可用', signature, checkedAt: Date.now(), providers: data.providers || [] });
            return true;
        } catch (error) {
            const code = error?.code || error?.message || 'network_error';
            const messages = {
                proactive_endpoint_missing: 'Worker 版本过旧，请重新部署',
                proactive_binding_missing: 'Worker 未配置可用的 Durable Object',
                encrypted_credential_unsupported: 'Worker 版本过旧，请重新部署以支持加密 API Key',
                unauthorized: '后台访问密钥错误',
                client_api_key_missing: '角色 API 预设没有填写 Key',
                upstream_provider_key_missing: 'Worker 模型 Key 未配置',
                upstream_provider_not_configured: 'Worker 未配置该 API 服务商',
                upstream_provider_url_missing: 'Worker 服务商 URL 未配置'
            };
            await this.rememberWorkerProbe({ status: 'error', code, message: messages[code] || `Worker 检测失败：${code}`, signature, checkedAt: Date.now() });
            return false;
        }
    },

    renderModeStatus() {
        const badge = document.getElementById('proactive-mode-badge');
        const help = document.getElementById('proactive-mode-help');
        const probe = this.workerProbe;
        const worker = this.workerModeAvailable();
        const executionMode = this.executionMode();
        const workerSelected = executionMode !== 'frontend';
        const waitingConsent = executionMode === 'private_worker' && this.settings().privateWorkerCredentialConsent !== true;
        const checkedTime = Number(probe.checkedAt || 0) ? new Date(probe.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const checkStatus = document.getElementById('proactive-worker-check-status');
        const actualMode = document.getElementById('proactive-worker-actual-mode');
        const probeButton = document.getElementById('proactive-worker-probe-btn');
        if (badge) badge.textContent = probe.status === 'checking'
            ? '检测中'
            : worker
                ? 'Worker 后台'
                : !workerSelected
                    ? '浏览器运行'
                    : waitingConsent && probe.status === 'ready'
                        ? '等待授权 · 已回退'
                    : probe.status === 'idle'
                        ? '尚未检测'
                        : 'Worker 异常 · 已回退';
        if (help) help.textContent = probe.status === 'checking'
            ? '正在确认新版主动消息接口、Durable Object 和凭据模式。'
            : worker
                ? executionMode === 'private_worker'
                    ? '角色会由 Alarm 在后台唤醒；API 跟随角色预设，Key 加密保存于你的私人 Worker。'
                    : '角色会由 Alarm 在后台唤醒；API 跟随角色预设，Key 由 Worker Secret 提供。'
                : probe.status === 'error'
                    ? `${probe.message}；当前会退回纯前端补发。`
                    : waitingConsent
                        ? 'Worker 已选择但尚未授权保存凭据；当前先按纯前端模式运行。'
                        : '使用角色 API 预设，在下次打开 PWA 后补做离线期间的主动判断。';
        if (checkStatus) {
            checkStatus.textContent = probe.status === 'frontend'
                ? '无需检测'
                : probe.status === 'checking'
                    ? '检测中…'
                    : `${probe.message || '尚未检测'}${checkedTime ? ` · ${checkedTime}` : ''}`;
            checkStatus.className = probe.status === 'ready' ? 'ready' : probe.status === 'checking' ? 'checking' : ['error', 'unconfigured'].includes(probe.status) ? 'error' : '';
        }
        if (actualMode) {
            actualMode.textContent = worker
                ? 'Worker 后台'
                : !workerSelected
                    ? '浏览器运行'
                    : waitingConsent
                        ? '纯前端（等待凭据授权）'
                        : '纯前端（安全回退）';
            actualMode.className = worker ? 'ready' : workerSelected ? 'error' : '';
        }
        if (probeButton) {
            // ★ 即使当前保存的是浏览器模式也保持可点击：用户可能刚在下拉框选了 Worker、尚未保存。
            probeButton.disabled = probe.status === 'checking';
            probeButton.textContent = probe.status === 'checking' ? '正在检测并应用…' : '检测并应用运行方式';
        }
    },

    async init() {
        this.settings();
        if (this.diagnosticMigrationPending) {
            await Storage.saveSettings();
            this.diagnosticMigrationPending = false;
        }
        this.restoreWorkerProbe();
        if (this.ensureMessageIds()) await Storage.saveContacts();
        this.bindUi();
        this.render();
        // ★ 连接检测完全交给“检测并应用运行方式”；启动时只恢复上次已保存的检测结果，不暗中请求 Worker。
        // ★ 先让原有 pending job 恢复一拍，再按已保存的运行结果同步或补发，避免两套异步恢复抢同一份历史。
        setTimeout(async () => {
            await this.runStartup().catch(error => console.warn('[主动消息] 启动检查失败:', error));
        }, 1800);
    },

    bindUi() {
        document.getElementById('explore-proactive-messages-btn')?.addEventListener('click', event => {
            if (event.target.closest('.proactive-menu-switch')) return;
            UI.switchView('proactive-messages');
            // ★ 打开运行日志时拉取最新 Worker 状态，避免摘要继续显示上次打开页面时的唤醒计划。
            this.runStartup().catch(error => console.warn('[主动消息] 打开页面检查失败:', error));
            // ★ 后台预取只更新本地最新请求缓存；查看弹窗仍然先走本地日志。
            this.refreshWorkerContextLog().catch(error => console.warn('[主动消息] 后台预取上下文日志失败:', error));
        });
        // ★ 从后台能力行进入时返回后台服务；探索页直达时仍返回探索。
        document.getElementById('proactive-messages-back-btn')?.addEventListener('click', () => UI.switchView(App.getReturnView('proactive-messages', 'explore')));
        ['proactive-messages-enable-toggle', 'async-backend-proactive-capability-toggle'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', event => this.setEnabled(event.target.checked, event.target));
        });
        document.getElementById('proactive-time-save-btn')?.addEventListener('click', () => this.saveTimeSettings());
        document.getElementById('proactive-characters-save-btn')?.addEventListener('click', () => this.saveCharacters());
        const timeCard = document.querySelector('.proactive-settings-grid');
        ['input', 'change'].forEach(type => timeCard?.addEventListener(type, event => {
            if (event.target?.matches('input')) this.markDraft('time');
        }));
        document.getElementById('proactive-character-list')?.addEventListener('change', event => {
            if (event.target?.matches('[data-proactive-character-id]')) this.markDraft('characters');
        });
        document.getElementById('proactive-execution-mode')?.addEventListener('change', () => this.markDraft('mode'));
        document.getElementById('proactive-test-btn')?.addEventListener('click', () => this.testSelectedCharacter());
        document.getElementById('proactive-context-log-btn')?.addEventListener('click', () => this.openContextLogModal());
        document.getElementById('proactive-context-log-modal')?.addEventListener('click', event => {
            if (event.target.id === 'proactive-context-log-modal' || event.target.closest('#proactive-context-log-close-btn')) {
                event.currentTarget.classList.add('hidden');
            }
        });
        document.getElementById('proactive-worker-probe-btn')?.addEventListener('click', () => this.manualProbeWorker());
        document.getElementById('proactive-api-preset-btn')?.addEventListener('click', () => this.openApiPresetModal());
        document.getElementById('proactive-api-cancel-btn')?.addEventListener('click', () => this.closeApiPresetModal());
        document.getElementById('proactive-api-save-btn')?.addEventListener('click', () => this.saveApiPresetModal());
        document.getElementById('proactive-api-modal')?.addEventListener('click', event => {
            if (event.target?.id === 'proactive-api-modal') this.closeApiPresetModal();
        });
        window.addEventListener('pageshow', () => this.runStartup().catch(error => console.warn('[主动消息] pageshow 检查失败:', error)));
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.runStartup().catch(error => console.warn('[主动消息] 前台检查失败:', error));
        });
    },

    markDraft(card) {
        this.dirtyCards.add(card);
        this.draftRevisions[card] += 1;
    },

    render() {
        const settings = this.settings();
        const setValue = (id, value) => { const element = document.getElementById(id); if (element) element.value = value; };
        const master = document.getElementById('proactive-messages-enable-toggle');
        if (master) master.checked = settings.enabled === true;
        const serviceToggle = document.getElementById('async-backend-proactive-capability-toggle');
        if (serviceToggle) serviceToggle.checked = settings.enabled === true;
        if (!this.dirtyCards.has('time')) {
            setValue('proactive-active-start', settings.activeStart);
            setValue('proactive-active-end', settings.activeEnd);
            setValue('proactive-min-cooldown', settings.minCooldownMinutes);
            setValue('proactive-chat-quiet', settings.recentChatQuietMinutes);
            setValue('proactive-daily-limit', settings.dailyLimit);
            setValue('proactive-unanswered-limit', settings.unansweredLimit);
            setValue('proactive-heartbeat-hours', settings.heartbeatHours);
            setValue('proactive-catchup-hours', settings.catchupMaxHours);
            const catchup = document.getElementById('proactive-catchup-enabled');
            if (catchup) catchup.checked = settings.catchupEnabled !== false;
        }
        const executionMode = this.executionMode();
        if (!this.dirtyCards.has('mode')) setValue('proactive-execution-mode', executionMode);
        const apiButton = document.getElementById('proactive-api-preset-btn');
        if (apiButton) apiButton.title = `主动消息 API：${this.selectedPresetLabel()}`;
        this.renderModeStatus();
        if (!this.dirtyCards.has('characters')) this.renderCharacters();
        this.renderDebugSelector();
        this.renderDebug();
    },

    async setEnabled(enabled, sourceToggle = null) {
        const settings = this.settings();
        const previous = settings.enabled === true;
        settings.enabled = enabled === true;
        // ★ 先更新两处滑块，再异步落盘；避免保存期间旧状态 render 把用户刚拨开的开关弹回去。
        this.render();
        try {
            await Storage.saveSettings();
            if (!settings.enabled) await this.disableWorkerContacts(settings.characterIds);
            await this.runStartup();
        } catch (error) {
            settings.enabled = previous;
            this.render();
            if (sourceToggle) sourceToggle.checked = previous;
            console.warn('[主动消息] 切换总开关失败:', error);
            alert(`主动消息开关保存失败：${error?.message || error}`);
        }
    },

    async manualProbeWorker() {
        const selectedMode = document.getElementById('proactive-execution-mode')?.value || this.executionMode();
        const previousMode = this.executionMode();

        if (selectedMode === 'private_worker' && !this.ensurePrivateWorkerConsent()) {
            this.dirtyCards.delete('mode');
            this.render();
            return;
        }

        // ★ 凭据确认后再取得当前设置；后续检测和同步会继续使用这份对象。
        const settings = this.settings();
        // ★ 这里只应用三种运行方式；时段和参与角色分别由各自卡片的按钮保存。
        settings.executionMode = selectedMode;
        settings.followFrontendApiKey = selectedMode === 'frontend';
        this.dirtyCards.delete('mode');
        this.invalidateWorkerProbe('运行方式已变化，正在检测');
        await Storage.saveSettings();

        // ★ 离开旧 Worker 模式时先撤销旧 Alarm；新模式只有检测成功后才会重新同步启用。
        if (previousMode !== selectedMode && previousMode !== 'frontend' && selectedMode !== 'frontend') {
            await this.disableWorkerContacts(settings.characterIds);
        }

        if (selectedMode === 'frontend') {
            await this.disableWorkerContacts(settings.characterIds);
            await this.probeWorkerCapability(true);
            await this.runStartup();
            this.render();
            if (typeof Toast !== 'undefined') Toast.show('已应用浏览器运行模式', { icon: 'settings' });
            return;
        }

        if (selectedMode === 'private_worker') {
            const missingKeyContact = (STATE.contacts || [])
                .filter(contact => settings.characterIds.map(String).includes(String(contact.id)))
                .find(contact => !this.getRequestSettings(contact).API_KEY);
            if (missingKeyContact) {
                await this.fallbackToFrontendAfterFailedApply(
                    `角色“${missingKeyContact.name || '未命名'}”的 API 预设没有填写 Key`,
                    'client_api_key_missing'
                );
                await this.disableWorkerContacts(settings.characterIds);
                await this.runStartup();
                this.render();
                if (typeof Toast !== 'undefined') Toast.show('角色缺少 API Key，已改用浏览器运行', { icon: 'warning', duration: 2400 });
                return;
            }
        }

        const available = await this.probeWorkerCapability(true);
        if (!available) {
            await this.fallbackToFrontendAfterFailedApply(this.workerProbe.message, this.workerProbe.code);
            await this.disableWorkerContacts(settings.characterIds);
        }
        await this.runStartup();
        this.render();
        if (typeof Toast !== 'undefined') {
            Toast.show(available ? '已应用 Worker 运行模式' : 'Worker 检测失败，已改用浏览器运行', {
                icon: available ? 'settings' : 'warning',
                duration: available ? 1500 : 2400
            });
        }
    },

    async fallbackToFrontendAfterFailedApply(message, code = 'worker_apply_failed') {
        const settings = this.settings();
        // ★ 检测失败时让“已选择”和“实际运行”保持一致，同时保留失败原因，避免用户误以为 Worker 已经启用。
        settings.executionMode = 'frontend';
        settings.followFrontendApiKey = true;
        await this.rememberWorkerProbe({
            status: 'error',
            code: code || 'worker_apply_failed',
            message: `${message || 'Worker 检测失败'}；已自动改用浏览器运行`,
            signature: this.probeSignature(),
            checkedAt: Date.now()
        });
    },

    ensurePrivateWorkerConsent() {
        const settings = this.settings();
        if (settings.privateWorkerCredentialConsent === true) return true;
        const accepted = window.confirm(
            '私人 Worker 后台模式需要把角色 API Key 经 HTTPS 发送到你自己的 Worker，并使用后台访问密钥派生的加密密钥保存。Key 不会出现在日志中，也不能通过接口读回。是否继续？'
        );
        if (accepted) settings.privateWorkerCredentialConsent = true;
        return accepted;
    },

    openApiPresetModal() {
        const modal = document.getElementById('proactive-api-modal');
        const select = document.getElementById('proactive-api-preset-select');
        if (!modal || !select) return;
        select.textContent = '';
        const addOption = (value, text) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            select.appendChild(option);
        };
        addOption('__character__', '-- 跟随角色对话模型 --');
        addOption('__global__', '-- 跟随全局默认 --');
        (STATE.settings.API_PRESETS || []).forEach(preset => {
            if (preset?.name) addOption(String(preset.name), `${preset.name} (${preset.model || '未知模型'})`);
        });
        const selectedName = String(this.settings().apiPresetName || '__character__');
        select.value = [...select.options].some(option => option.value === selectedName) ? selectedName : '__character__';
        modal.classList.remove('hidden');
    },

    closeApiPresetModal() {
        document.getElementById('proactive-api-modal')?.classList.add('hidden');
    },

    async saveApiPresetModal() {
        const select = document.getElementById('proactive-api-preset-select');
        this.settings().apiPresetName = select?.value || '__character__';
        // ★ API 来源变化后让旧检测结果失效；是否重新检测由用户明确点击按钮决定。
        this.invalidateWorkerProbe('API 预设已变化，请重新检测并应用运行方式');
        await Storage.saveSettings();
        this.closeApiPresetModal();
        await this.runStartup();
        this.render();
    },

    onSharedBackendSettingsChanged() {
        this.invalidateWorkerProbe();
        Storage.saveSettings().catch(error => console.warn('[主动消息] 检测缓存失效保存失败:', error));
    },

    renderCharacters() {
        const container = document.getElementById('proactive-character-list');
        if (!container) return;
        container.textContent = '';
        const selected = new Set(this.settings().characterIds.map(String));
        (STATE.contacts || []).forEach(contact => {
            const row = document.createElement('label');
            row.className = 'proactive-character-item';
            const avatar = document.createElement(contact.avatar?.startsWith?.('data:') || contact.avatar?.startsWith?.('http') ? 'img' : 'span');
            avatar.className = 'proactive-character-avatar';
            if (avatar.tagName === 'IMG') avatar.src = contact.avatar;
            else avatar.textContent = contact.avatar || '💬';
            const name = document.createElement('span');
            name.className = 'proactive-character-name';
            name.textContent = contact.name || '未命名角色';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.dataset.proactiveCharacterId = String(contact.id);
            input.checked = selected.has(String(contact.id));
            row.append(avatar, name, input);
            container.appendChild(row);
        });
    },

    renderDebugSelector() {
        const select = document.getElementById('proactive-debug-character');
        if (!select) return;
        const previous = select.value;
        select.textContent = '';
        (STATE.contacts || []).forEach(contact => {
            const option = document.createElement('option');
            option.value = String(contact.id);
            option.textContent = contact.name || '未命名角色';
            select.appendChild(option);
        });
        if ([...select.options].some(option => option.value === previous)) select.value = previous;
    },

    renderDebug() {
        const summary = document.getElementById('proactive-status-summary');
        const list = document.getElementById('proactive-event-list');
        if (!summary || !list) return;
        const settings = this.settings();
        const events = settings.diagnosticEvents.slice(-12).reverse();
        const lastDecision = settings.lastDecisionSummary
            || [...settings.diagnosticEvents].reverse().find(event => ['proactive_decision_send', 'proactive_decision_silent'].includes(event.code));
        const lastDecisionText = lastDecision
            ? `上次决策：${lastDecision.characterName} · ${lastDecision.code === 'proactive_decision_send' ? '发送' : '未发送'} · ${new Date(lastDecision.ts).toLocaleString()}`
            : '上次决策：无';
        // ★ 摘要只看当前参与角色的自动唤醒；Worker 与浏览器分别读取各自实际保存的计划时间。
        const worker = this.workerModeAvailable();
        const selectedIds = new Set(settings.characterIds.map(String));
        const plannedWakes = settings.enabled && (worker || settings.catchupEnabled !== false)
            ? (STATE.contacts || [])
                .filter(contact => selectedIds.has(String(contact.id)))
                .map(contact => ({
                    name: contact.name || '未命名角色',
                    at: Number(worker
                        ? settings.workerStatusByChar[String(contact.id)]?.runtime?.nextWakeAt
                        : settings.nextLocalWakeAtByChar[String(contact.id)])
                }))
                .filter(item => Number.isFinite(item.at) && item.at > 0)
            : [];
        const nextWake = plannedWakes.sort((a, b) => a.at - b.at)[0];
        const nextWakeText = nextWake
            ? `下次计划唤醒：${nextWake.name} · ${new Date(nextWake.at).toLocaleString()}`
            : '下次计划唤醒：暂无';
        summary.textContent = `${lastDecisionText}\n${nextWakeText}`;
        list.textContent = '';
        if (!events.length) {
            const empty = document.createElement('div');
            empty.className = 'todo-empty-hint';
            empty.textContent = '暂无运行日志';
            list.appendChild(empty);
            return;
        }
        const descriptions = {
            proactive_sync: '已同步角色运行配置',
            proactive_alarm_fired: '开始主动消息判断',
            proactive_manual_started: '手动开始主动消息判断',
            proactive_model_request_started: '正在请求模型',
            proactive_model_request_finished: '模型判断完成',
            proactive_decision_send: '角色决定发送主动消息',
            proactive_decision_silent: '角色决定暂不发送',
            proactive_prefilter_skipped: '本次判断被运行规则跳过',
            proactive_run_failed: '主动消息运行失败',
            proactive_next_alarm_set: '已安排下次唤醒',
            proactive_initial_wake_set: '已安排首次唤醒',
            proactive_disabled: '角色的自动运行已停用'
        };
        events.forEach(event => {
            const row = document.createElement('div');
            row.className = 'diagnostic-log-item';
            const main = document.createElement('div');
            main.className = 'diagnostic-log-main';
            const code = document.createElement('span');
            code.className = 'diagnostic-log-code';
            code.textContent = event.code;
            const description = document.createElement('span');
            description.className = 'diagnostic-log-text';
            description.textContent = `${descriptions[event.code] || '主动消息事件'}${event.reason ? ` · ${event.reason}` : ''}${event.error ? ` · ${event.error}` : ''}`;
            main.append(code, description);
            const meta = document.createElement('div');
            meta.className = 'diagnostic-log-meta';
            // ★ 纯前端运行 ID 带固定前缀；展示随机部分才能区分不同的判断。
            const shortRunId = String(event.heartbeatRunId || '').replace(/^proactive_local_/, '').slice(0, 8);
            const runId = shortRunId ? ` · ${shortRunId}` : '';
            meta.textContent = `${new Date(event.ts).toLocaleTimeString()}${runId} · ${event.source} · ${event.characterName}`;
            row.append(main, meta);
            list.appendChild(row);
        });
    },

    async saveTimeSettings() {
        if (this.savingCard) return;
        const settings = this.settings();
        const value = id => document.getElementById(id)?.value;
        const heartbeatHours = Number(value('proactive-heartbeat-hours'));
        const catchupHours = Number(value('proactive-catchup-hours'));
        if (!Number.isFinite(heartbeatHours) || heartbeatHours <= 0 || !Number.isFinite(catchupHours) || catchupHours <= 0) {
            alert('“最长判断间隔”和“离线补做最多回看”需要填写大于 0 的数字，可以使用小数。');
            return;
        }
        const fields = ['activeStart', 'activeEnd', 'minCooldownMinutes', 'recentChatQuietMinutes', 'dailyLimit', 'unansweredLimit', 'heartbeatHours', 'catchupMaxHours', 'catchupEnabled'];
        const previous = Object.fromEntries(fields.map(key => [key, settings[key]]));
        settings.activeStart = value('proactive-active-start') || '09:00';
        settings.activeEnd = value('proactive-active-end') || '23:00';
        settings.minCooldownMinutes = this.duration(value('proactive-min-cooldown'), 10080, 180, true);
        settings.recentChatQuietMinutes = this.duration(value('proactive-chat-quiet'), 1440, 45, true);
        settings.dailyLimit = this.integer(value('proactive-daily-limit'), 1, 20, 3);
        settings.unansweredLimit = this.integer(value('proactive-unanswered-limit'), 1, 10, 2);
        settings.heartbeatHours = this.duration(heartbeatHours, 168, 12, false);
        settings.catchupMaxHours = this.duration(catchupHours, 168, 24, false);
        settings.catchupEnabled = document.getElementById('proactive-catchup-enabled')?.checked !== false;
        await this.persistCard('time', previous);
    },

    async saveCharacters() {
        if (this.savingCard) return;
        const settings = this.settings();
        const previousCharacterIds = [...settings.characterIds];
        const nextCharacterIds = [...document.querySelectorAll('[data-proactive-character-id]:checked')].map(input => String(input.dataset.proactiveCharacterId));
        if (this.executionMode() === 'private_worker') {
            const missingKeyContact = (STATE.contacts || [])
                .filter(contact => nextCharacterIds.includes(String(contact.id)))
                .find(contact => !this.getRequestSettings(contact).API_KEY);
            if (missingKeyContact) {
                alert(`角色“${missingKeyContact.name || '未命名'}”当前 API 预设没有填写 Key，无法启用私人 Worker 后台。`);
                return;
            }
        }
        // ★ 只更新角色选择；时段卡片里尚未保存的输入不会随本次保存落盘。
        settings.characterIds = nextCharacterIds;
        await this.persistCard('characters', { characterIds: previousCharacterIds }, async () => {
            // ★ 取消角色时主动撤销旧 Alarm，并删除该角色留在 Worker 的加密凭据。
            const removedIds = previousCharacterIds.filter(id => !nextCharacterIds.includes(String(id)));
            await this.disableWorkerContacts(removedIds);
        });
    },

    async openContextLogModal() {
        const modal = document.getElementById('proactive-context-log-modal');
        const content = document.getElementById('proactive-context-log-content');
        const meta = document.getElementById('proactive-context-log-meta');
        if (!modal || !content || !meta) return;

        // ★ 与常规聊天一致：先从内存或 IndexedDB 取本地最新一条，再打开已经填好内容的弹窗。
        const latest = typeof API !== 'undefined' && API.getLatestProactiveContextLog
            ? await API.getLatestProactiveContextLog() : null;
        this.renderContextLog(latest, content, meta);
        modal.classList.remove('hidden');

        // ★ 常规聊天的 Worker 请求由前端先记快照；主动 Alarm 无前端参与，所以后台核对最新记录。
        // 网络请求不阻塞弹窗，取得较新日志后再更新本地缓存和当前打开的内容。
        this.refreshWorkerContextLog().then(updated => {
            if (updated && !modal.classList.contains('hidden')) this.renderContextLog(updated, content, meta);
        }).catch(error => console.warn('[主动消息] Worker 上下文日志刷新失败:', error));
    },

    renderContextLog(log, content, meta) {
        content.textContent = log?.content || '暂无主动消息 API 请求记录。';
        meta.textContent = '';
        const lines = log ? [
            `来源：${log.source || '未知'}${log.trigger ? ` · ${log.trigger}` : ''}`,
            `角色：${log.characterName || '未知角色'}`,
            `请求时间：${new Date(log.createdAt).toLocaleString()}`,
            log.source === '浏览器'
                ? `输入 Token：${log.prompt_tokens ?? 0} · 输出 Token：${log.completion_tokens ?? 0} · 总 Token：${log.total_tokens ?? 0}${log.isEstimated ? '（估算）' : ''}`
                : 'Token：Worker 未记录'
        ] : ['来源：无'];
        lines.forEach(line => {
            const row = document.createElement('div');
            row.textContent = line;
            meta.appendChild(row);
        });
    },

    async refreshWorkerContextLog(contacts = STATE.contacts || []) {
        if (!STATE.settings.ASYNC_BACKEND_URL || !STATE.settings.ASYNC_BACKEND_TOKEN) return null;
        // ★ Worker 按角色各存一条；只在后台查询所有角色，手动触发的非参与角色也能参与最近记录比较。
        const results = await Promise.allSettled(contacts.map(async contact => {
            const response = await fetch(`${this.workerBaseUrl(contact.id)}/request-log`, { headers: this.workerHeaders() });
            if (!response.ok) return null;
            return (await response.json()).log || null;
        }));
        let latest = typeof API !== 'undefined' && API.getLatestProactiveContextLog
            ? await API.getLatestProactiveContextLog() : null;
        let changed = false;
        for (const result of results) {
            const workerLog = result.status === 'fulfilled' ? result.value : null;
            if (workerLog && Number(workerLog.createdAt) > Number(latest?.createdAt || 0)) {
                latest = workerLog;
                changed = true;
            }
        }
        if (changed && typeof API !== 'undefined' && API.setLatestProactiveContextLog) {
            API.setLatestProactiveContextLog(latest);
        }
        return changed ? latest : null;
    },

    async persistCard(card, previous, afterSave = null) {
        this.savingCard = true;
        const buttons = ['proactive-time-save-btn', 'proactive-characters-save-btn']
            .map(id => document.getElementById(id)).filter(Boolean);
        const revision = this.draftRevisions[card];
        this.dirtyCards.add(card);
        // ★ 两张卡片共用一份设置对象，保存期间禁止另一张卡片同时写入落盘。
        buttons.forEach(button => { button.disabled = true; });
        let persisted = false;
        try {
            await Storage.saveSettings();
            persisted = true;
            if (afterSave) await afterSave();
            await this.runStartup();
            // ★ 保存期间若又改了输入，保留新草稿，不用已保存的值重绘覆盖它。
            if (this.draftRevisions[card] === revision) this.dirtyCards.delete(card);
            this.render();
            if (typeof Toast !== 'undefined') Toast.show('已保存');
        } catch (error) {
            if (!persisted) Object.assign(this.settings(), previous);
            console.warn(`[主动消息] ${card === 'time' ? '时段' : '角色'}保存或同步失败:`, error);
            alert(`${persisted ? '设置已保存，但同步失败' : '设置保存失败'}：${error?.message || error}`);
        } finally {
            buttons.forEach(button => { button.disabled = false; });
            this.savingCard = false;
        }
    },

    async runStartup() {
        if (this.running) return;
        const settings = this.settings();
        this.running = true;
        try {
            if (!settings.enabled) {
                if (this.workerConfigured()) await this.disableWorkerContacts(settings.characterIds);
                return;
            }
            const contacts = (STATE.contacts || []).filter(contact => settings.characterIds.map(String).includes(String(contact.id)));
            for (const contact of contacts) {
                if (this.workerModeAvailable()) {
                    await this.pullWorkerMessages(contact);
                    await this.syncWorker(contact);
                } else if (settings.catchupEnabled !== false) {
                    await this.runLocalCatchup(contact, false);
                }
            }
            await Storage.saveSettings();
            this.render();
            this.scheduleNextLocalCheck();
        } finally {
            this.running = false;
        }
    },

    scheduleNextLocalCheck() {
        if (this.wakeTimer) clearTimeout(this.wakeTimer);
        this.wakeTimer = null;
        if (this.workerModeAvailable() || !this.settings().enabled) return;
        const selected = new Set(this.settings().characterIds.map(String));
        const times = Object.entries(this.settings().nextLocalWakeAtByChar)
            .filter(([id, value]) => selected.has(String(id)) && Number(value) > 0)
            .map(([, value]) => Number(value));
        if (!times.length) return;
        // ★ 不附加隐藏的秒级下限；用户设置和模型建议的间隔共同决定实际等待时间。
        const delay = Math.min(2147483647, Math.max(0, Math.min(...times) - Date.now()));
        this.wakeTimer = setTimeout(() => this.runStartup().catch(error => console.warn('[主动消息] 定时检查失败:', error)), delay);
    },

    async syncWorker(contact) {
        return await this.syncWorkerState(contact, null);
    },

    async syncWorkerState(contact, enabledOverride = null) {
        const capsule = this.buildCapsule(contact);
        if (enabledOverride !== null) capsule.enabled = enabledOverride === true;
        const response = await fetch(`${this.workerBaseUrl(contact.id)}/sync`, {
            method: 'PUT', headers: this.workerHeaders(), body: JSON.stringify(capsule)
        });
        if (!response.ok) {
            let data = {};
            try { data = await response.json(); } catch (error) {}
            const reason = data.error ? ` · ${data.error}` : '';
            throw new Error(`主动消息同步失败：HTTP ${response.status}${reason}`);
        }
        const status = await response.json();
        this.mergeDiagnosticEvents(contact.id, status.events, 'Worker');
        // ★ Worker 事件只进入统一日志；按角色状态快照不再重复保存事件数组。
        const { events, ...runtimeStatus } = status;
        this.settings().workerStatusByChar[String(contact.id)] = runtimeStatus;
    },

    async refreshWorkerStatus(contact) {
        const response = await fetch(`${this.workerBaseUrl(contact.id)}/status`, { headers: this.workerHeaders() });
        if (!response.ok) throw new Error(`主动消息状态读取失败：HTTP ${response.status}`);
        const status = await response.json();
        this.mergeDiagnosticEvents(contact.id, status.events, 'Worker');
        const { events, ...runtimeStatus } = status;
        this.settings().workerStatusByChar[String(contact.id)] = runtimeStatus;
    },

    async disableWorkerContacts(contactIds) {
        if (!STATE.settings.ASYNC_BACKEND_URL || !STATE.settings.ASYNC_BACKEND_TOKEN) return;
        const ids = [...new Set((contactIds || []).map(String).filter(Boolean))];
        for (const contactId of ids) {
            const contact = (STATE.contacts || []).find(item => String(item.id) === contactId)
                || { id: contactId, name: '已移除角色', prompt: '', history: [] };
            try {
                await this.syncWorkerState(contact, false);
            } catch (error) {
                console.warn('[主动消息] 撤销 Worker 角色状态失败:', error);
            }
        }
    },

    async pullWorkerMessages(contact) {
        const response = await fetch(`${this.workerBaseUrl(contact.id)}/messages`, { headers: this.workerHeaders() });
        if (!response.ok) {
            if (response.status === 404) return;
            throw new Error(`主动消息拉取失败：HTTP ${response.status}`);
        }
        const data = await response.json();
        const applied = [];
        for (const message of data.messages || []) {
            if (!message?.messageId) continue;
            await this.insertMessage(contact, message);
            // ★ messageId 已在本地时同样确认，避免刷新中断或旧 outbox 迁移后反复领取同一条消息。
            applied.push(message.messageId);
        }
        if (applied.length) {
            await fetch(`${this.workerBaseUrl(contact.id)}/ack`, {
                method: 'POST', headers: this.workerHeaders(), body: JSON.stringify({ messageIds: applied })
            });
        }
    },

    localRuntime(contactId) {
        const key = String(contactId);
        const settings = this.settings();
        const runtime = settings.localRuntimeByChar[key] || {};
        settings.localRuntimeByChar[key] = runtime;
        return runtime;
    },

    addLocalEvent(contactId, code, detail = {}) {
        this.mergeDiagnosticEvents(contactId, [{ code, ts: Date.now(), ...detail }], '浏览器');
    },

    localPrefilter(contact, now) {
        const policy = this.getPolicy();
        const runtime = this.localRuntime(contact.id);
        const today = new Date(now).toLocaleDateString('sv-SE');
        if (runtime.dailyDateKey !== today) { runtime.dailyDateKey = today; runtime.dailyCount = 0; }
        const minutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
        const inWindow = policy.activeStartMinutes === policy.activeEndMinutes
            || (policy.activeStartMinutes < policy.activeEndMinutes
                ? minutes >= policy.activeStartMinutes && minutes < policy.activeEndMinutes
                : minutes >= policy.activeStartMinutes || minutes < policy.activeEndMinutes);
        if (!inWindow) {
            // ★ 用本地日历时间求下次允许时段，跨午夜和夏令时切换时都不按固定 24 小时推算。
            const nextStart = new Date(now);
            nextStart.setHours(Math.floor(policy.activeStartMinutes / 60), policy.activeStartMinutes % 60, 0, 0);
            if (nextStart.getTime() <= now) nextStart.setDate(nextStart.getDate() + 1);
            return { reason: 'quiet_hours', retryAt: nextStart.getTime() };
        }
        if (Number(runtime.dailyCount || 0) >= policy.dailyLimit) return { reason: 'daily_limit' };
        if (Number(runtime.unansweredCount || 0) >= policy.unansweredLimit) return { reason: 'unanswered_limit' };
        const quietUntil = this.lastActivity(contact) + policy.recentChatQuietMinutes * 60000;
        if (quietUntil > now) return { reason: 'recent_chat', retryAt: quietUntil };
        // ★ 最短主动间隔按用户填写的固定值执行；未回复次数只交给连发上限控制。
        const cooldownUntil = Number(runtime.lastProactiveGeneratedAt || 0) + policy.minCooldownMinutes * 60000;
        if (cooldownUntil > now) return { reason: 'cooldown', retryAt: cooldownUntil };
        return null;
    },

    buildLocalMessages(contact, windowStart, windowEnd, manual = false) {
        const capsule = this.buildCapsule(contact);
        const history = capsule.messages.map(message => `[${this.formatChatTime(message.eventAt || windowStart)}] ${message.role === 'assistant' ? capsule.characterName : '对方'}：${message.content}`).join('\n');
        // ★ 模型只选判断间隔；绝对唤醒时刻由程序计算，避免把时区换算交给模型。
        const maxCheckMinutes = this.getPolicy().heartbeatHours * 60;
        return [
            { role: 'system', content: `${capsule.characterPrompt}\n\n${capsule.contextPrompt}`.trim() },
            { role: 'system', content: [
                manual
                    ? `你是 ${capsule.characterName}。离你们上次对话已经过去了一会儿，想给对方发一条消息吗？还是先不发？你可以自由决定。`
                    : `你是 ${capsule.characterName}。离你们上次对话已经过去了一会儿，想给对方发一条消息吗？还是先不发？你可以自由决定。如果此前离线，只需判断一次是否联系对方。`,
                '不要解释，不要提到补发、系统、PWA、JSON 或 AI。',
                `当前时间：${this.formatChatTime(windowEnd)}。`,
                manual ? '发送时刻由程序记录。' : `如果决定发送，可在 ${this.formatChatTime(windowStart)} 至 ${this.formatChatTime(windowEnd)} 之间选一个本地展示时间。`,
                `下次判断请选在 ${maxCheckMinutes} 分钟内；是否实际发送由程序按设置检查。`,
                // ★ 离线补发才允许模型选本地展示时间；唤醒间隔由程序换算成绝对时间。
                manual
                    ? '只输出严格 JSON：{"decision":"silent或send","content":"send时的正文，silent时为空","next_check_in_minutes":"下次判断距离现在的分钟数或null"}'
                    : '只输出严格 JSON：{"decision":"silent或send","content":"send时的正文，silent时为空","sent_at_local":"send时的本地YYYY-MM-DD HH:mm，silent时为null","next_check_in_minutes":"下次判断距离现在的分钟数或null"}',
                `【最近聊天快照】\n${history || '暂无聊天记录'}`
            ].join('\n\n') },
            { role: 'user', content: '现在自行决定是否主动联系，并安排下一次唤醒。只输出 JSON。' }
        ];
    },

    parseDecision(rawText, windowStart, windowEnd) {
        const clean = String(rawText || '').replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        let data = null;
        try { data = JSON.parse(clean); } catch (error) {
            const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
            if (start >= 0 && end > start) { try { data = JSON.parse(clean.slice(start, end + 1)); } catch (nested) {} }
        }
        const decision = data?.decision === 'send' && String(data?.content || '').trim() ? 'send' : 'silent';
        // ★ 兼容升级途中尚未返回的旧请求；新协议的本地时间不需要模型填写时区偏移。
        const parsedSentAt = this.parseChatTime(data?.sent_at_local || data?.sent_at);
        const sentAt = parsedSentAt >= windowStart && parsedSentAt <= windowEnd ? parsedSentAt : windowEnd;
        const proposedMinutes = Number(data?.next_check_in_minutes);
        const nextCheckMinutes = Number.isFinite(proposedMinutes) && proposedMinutes > 0 ? proposedMinutes : null;
        return { decision, content: decision === 'send' ? String(data.content).trim().slice(0, 4000) : '', sentAt, nextCheckMinutes };
    },

    async runLocalCatchup(contact, force = false) {
        const now = Date.now();
        const settings = this.settings();
        const key = String(contact.id);
        const existingNext = Number(settings.nextLocalWakeAtByChar[key] || 0);
        if (!force && !existingNext) {
            // ★ 首次默认半小时后思考，但不能超过用户自己填写的最长唤醒间隔。
            settings.nextLocalWakeAtByChar[key] = now + Math.min(30 * 60 * 1000, this.getPolicy().heartbeatHours * 3600000);
            settings.lastLocalCheckAtByChar[key] = now;
            this.addLocalEvent(key, 'proactive_initial_wake_set', { nextWakeAt: settings.nextLocalWakeAtByChar[key] });
            return;
        }
        if (!force && existingNext > now) return;
        const blocked = this.localPrefilter(contact, now);
        if (blocked && !force) {
            // ★ 有明确解禁时间就优先到点再查；最长检查间隔仍作为上限和未知解禁时间的兜底。
            const maxWake = now + this.getPolicy().heartbeatHours * 3600000;
            settings.nextLocalWakeAtByChar[key] = blocked.retryAt > now ? Math.min(blocked.retryAt, maxWake) : maxWake;
            this.addLocalEvent(key, 'proactive_prefilter_skipped', { reason: blocked.reason, nextWakeAt: settings.nextLocalWakeAtByChar[key] });
            return;
        }
        const lastCheck = Number(settings.lastLocalCheckAtByChar[key] || existingNext || now);
        const windowStart = force ? now : Math.max(lastCheck, now - this.duration(settings.catchupMaxHours, 168, 24, false) * 3600000);
        const windowEnd = now;
        const heartbeatRunId = this.makeId('proactive_local');
        if (!force) settings.lastLocalCheckAtByChar[key] = now;
        this.addLocalEvent(key, 'proactive_model_request_started', { heartbeatRunId, source: force ? 'manual' : 'browser' });
        try {
            // ★ buildLocalMessages 在 fetch 前完成，用户随后快速发出的新消息不会倒灌进这次离线补发判断。
            const frozenMessages = this.buildLocalMessages(contact, windowStart, windowEnd, force);
            const raw = await API.chat(frozenMessages, {
                ...this.getRequestSettings(contact),
                PROACTIVE_CONTEXT_LOG: true,
                PROACTIVE_CHARACTER_ID: String(contact.id),
                PROACTIVE_CHARACTER_NAME: contact.name || '角色'
            });
            const result = this.parseDecision(raw, windowStart, windowEnd);
            const runtime = this.localRuntime(key);
            runtime.lastDecision = result.decision;
            runtime.lastHeartbeatAt = now;
            if (result.decision === 'send') {
                // ★ 手动触发不补写过去的展示时间，按模型返回后的实际时刻落库。
                const sentAt = force ? Date.now() : result.sentAt;
                await this.insertMessage(contact, {
                    messageId: `proactive_${heartbeatRunId}`,
                    heartbeatRunId,
                    content: result.content,
                    sentAt: new Date(sentAt).toISOString(),
                    generatedAt: Date.now(),
                    source: 'proactive_catchup'
                });
                runtime.lastProactiveGeneratedAt = Date.now();
                runtime.unansweredCount = Number(runtime.unansweredCount || 0) + 1;
                runtime.dailyCount = Number(runtime.dailyCount || 0) + 1;
                this.addLocalEvent(key, 'proactive_decision_send', { heartbeatRunId, sentAt });
            } else {
                this.addLocalEvent(key, 'proactive_decision_silent', { heartbeatRunId });
            }
            const scheduleFrom = Date.now();
            const maxWake = scheduleFrom + this.getPolicy().heartbeatHours * 3600000;
            if (!force) {
                settings.nextLocalWakeAtByChar[key] = result.nextCheckMinutes ? Math.min(scheduleFrom + result.nextCheckMinutes * 60000, maxWake) : maxWake;
                runtime.nextWakeAt = settings.nextLocalWakeAtByChar[key];
                this.addLocalEvent(key, 'proactive_next_alarm_set', { nextWakeAt: runtime.nextWakeAt });
            }
            return { decision: result.decision };
        } catch (error) {
            if (!force) settings.nextLocalWakeAtByChar[key] = now + this.getPolicy().heartbeatHours * 3600000;
            this.addLocalEvent(key, 'proactive_run_failed', { error: String(error?.message || error).slice(0, 180) });
            return { error: String(error?.message || error) };
        }
    },

    async insertMessage(contact, source) {
        if (!contact || !source?.messageId || !String(source.content || '').trim()) return false;
        if ((contact.history || []).some(message => String(message?.messageId) === String(source.messageId))) return false;
        const sentAt = new Date(source.sentAt || '').getTime();
        const eventAt = Number.isFinite(sentAt) ? sentAt : Date.now();
        const content = String(source.content).trim().replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*/, '');
        const message = {
            role: 'assistant',
            // ★ 离线补发可采用模型选的本地展示时间；写进正文后，普通聊天和其它上下文入口也能读到。
            content: `[${this.formatChatTime(eventAt)}] ${content}`,
            timestamp: this.formatChatTime(eventAt),
            messageId: String(source.messageId),
            eventAt,
            recordedAt: Date.now(),
            generatedAt: Number(source.generatedAt || Date.now()),
            heartbeatRunId: source.heartbeatRunId || '',
            proactiveSource: source.source || 'proactive'
        };
        const history = contact.history || (contact.history = []);
        let index = history.findIndex(item => (Number(item?.eventAt) || this.parseChatTime(item?.timestamp)) > eventAt);
        if (index < 0) index = history.length;
        history.splice(index, 0, message);
        await Storage.saveContacts();
        if (STATE.currentContactId === contact.id && typeof UI !== 'undefined') UI.renderChatHistory(contact);
        if (typeof App !== 'undefined' && typeof App.markContactIncomingMessage === 'function') {
            App.markContactIncomingMessage(contact);
        }
        return true;
    },

    async testSelectedCharacter() {
        const contactId = document.getElementById('proactive-debug-character')?.value;
        const contact = (STATE.contacts || []).find(item => String(item.id) === String(contactId));
        if (!contact) return;
        const button = document.getElementById('proactive-test-btn');
        if (button) button.disabled = true;
        try {
            let decision;
            // ★ 手动判断沿用已保存的运行方式，但不改变“参与角色”和自动定时安排。
            if (this.workerModeAvailable()) {
                const response = await fetch(`${this.workerBaseUrl(contact.id)}/run`, {
                    method: 'POST', headers: this.workerHeaders(), body: JSON.stringify(this.buildCapsule(contact))
                });
                if (!response.ok) throw new Error(`测试失败：HTTP ${response.status}`);
                const result = await response.json();
                if (result.ok === false) throw new Error(`主动消息测试失败：${result.error || 'Worker 运行失败'}`);
                if (result.skipped) throw new Error(`本次未请求模型：${result.skipped}`);
                decision = result.decision;
                await this.pullWorkerMessages(contact);
                await this.refreshWorkerStatus(contact);
                // ★ 手动 Worker 请求完成后提前缓存该角色请求，和常规聊天发送时先记录日志的体验一致。
                this.refreshWorkerContextLog([contact]).catch(error => console.warn('[主动消息] 手动请求日志同步失败:', error));
            } else {
                const result = await this.runLocalCatchup(contact, true);
                if (result?.error) throw new Error(result.error);
                decision = result?.decision;
            }
            await Storage.saveSettings();
            this.renderDebug();
            if (typeof Toast !== 'undefined') Toast.show(decision === 'send' ? '角色已发送主动消息' : '角色决定暂不发送', { icon: 'settings' });
        } catch (error) {
            // ★ Worker 已执行但返回业务失败时，仍取回本次失败事件，供统一日志排查。
            if (this.workerModeAvailable()) {
                try { await this.refreshWorkerStatus(contact); } catch (statusError) {}
            }
            await Storage.saveSettings();
            this.renderDebug();
            alert(error?.message || String(error));
        } finally {
            if (button) button.disabled = false;
        }
    },

    async onUserMessage(contact) {
        if (!contact || !this.settings().enabled) return;
        const runtime = this.localRuntime(contact.id);
        runtime.unansweredCount = 0;
        await Storage.saveSettings();
        if (this.workerModeAvailable() && this.settings().characterIds.map(String).includes(String(contact.id))) {
            // ★ 用户刚说话时只更新活跃时间与未回复计数；完整聊天等角色回复落库后再同步。
            const response = await fetch(`${this.workerBaseUrl(contact.id)}/activity`, {
                method: 'POST', headers: this.workerHeaders(), body: JSON.stringify({
                    lastUserAt: this.lastActivity(contact, 'user'),
                    lastChatAt: this.lastActivity(contact)
                })
            });
            // ★ 旧版 Worker 没有轻量路由，或首次启动还没有角色胶囊；两者都退回完整同步建档。
            if (response.status === 404 || response.status === 409) return await this.syncWorker(contact);
            if (!response.ok) throw new Error(`主动消息活动同步失败：HTTP ${response.status}`);
        }
    },

    async onAssistantMessage(contact) {
        if (!contact || !this.settings().enabled || !this.workerModeAvailable()
            || !this.settings().characterIds.map(String).includes(String(contact.id))) return;
        // ★ 回复已经写入聊天历史后再上传快照，Worker 的下一次主动判断才能读到这句回答。
        await this.syncWorker(contact);
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = ProactiveMessages;
