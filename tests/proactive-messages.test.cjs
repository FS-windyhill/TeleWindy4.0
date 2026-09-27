const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

global.CONFIG = {
    DEFAULT: {
        PROACTIVE_MESSAGES: {
            enabled: false,
            characterIds: [],
            executionMode: 'frontend',
            privateWorkerCredentialConsent: false,
            followFrontendApiKey: true,
            workerProbeCache: null,
            apiPresetName: '__character__',
            activeStart: '09:00',
            activeEnd: '23:00',
            minCooldownMinutes: 180,
            recentChatQuietMinutes: 45,
            dailyLimit: 3,
            unansweredLimit: 2,
            heartbeatHours: 12,
            catchupEnabled: true,
            catchupMaxHours: 24,
            lastLocalCheckAtByChar: {},
            nextLocalWakeAtByChar: {},
            localRuntimeByChar: {},
            workerStatusByChar: {}
        }
    }
};
global.STATE = { settings: {}, contacts: [] };
global.HistoryVisibility = vm.runInNewContext(`${fs.readFileSync(require.resolve('../js/history-visibility.js'), 'utf8')}\nHistoryVisibility`);

const ProactiveMessages = require('../js/proactive-messages.js');

test('浏览器补发接受本地展示时间，并把唤醒间隔留给程序计算', () => {
    const start = new Date(2026, 8, 23, 9, 0).getTime();
    const end = new Date(2026, 8, 23, 12, 0).getTime();
    const result = ProactiveMessages.parseDecision(JSON.stringify({
        decision: 'send',
        content: '早上好',
        sent_at_local: '2026-09-23 10:15',
        next_check_in_minutes: 45
    }), start, end);

    assert.equal(result.decision, 'send');
    assert.equal(result.content, '早上好');
    assert.equal(result.sentAt, new Date(2026, 8, 23, 10, 15).getTime());
    assert.equal(result.nextCheckMinutes, 45);
});

test('浏览器主动判断统一使用当地时间，返回协议不要求时区偏移', () => {
    STATE.settings.PROACTIVE_MESSAGES = JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES));
    const eventAt = new Date('2026-09-23T10:15:00+08:00').getTime();
    const contact = { id: 'local-time-char', name: '测试角色', prompt: '', history: [{
        role: 'user', content: '[2026-09-23 10:15] 早上好',
        timestamp: '2026-09-23 10:15', eventAt
    }] };
    const originalBuildContextPrompt = ProactiveMessages.buildContextPrompt;
    ProactiveMessages.buildContextPrompt = () => '';
    try {
        const capsule = ProactiveMessages.buildCapsule(contact);
        const messages = ProactiveMessages.buildLocalMessages(contact, eventAt, eventAt + 60000);
        const prompt = messages[1].content;
        assert.equal(capsule.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone);
        assert.ok(prompt.includes(`[${ProactiveMessages.formatChatTime(eventAt)}] 对方：早上好`));
        assert.match(prompt, /当前时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
        assert.doesNotMatch(prompt, /2026-09-23T02:15:00\.000Z/);
        assert.match(prompt, /next_check_in_minutes/);
        assert.match(prompt, /sent_at_local/);
        assert.doesNotMatch(prompt, /当前偏移|带时区偏移|next_wake_at/);
    } finally {
        ProactiveMessages.buildContextPrompt = originalBuildContextPrompt;
    }
});

test('发送正文为空时安全降级为沉默', () => {
    const start = Date.now() - 3600000;
    const result = ProactiveMessages.parseDecision('{"decision":"send","content":"","sent_at_local":null,"next_check_in_minutes":null}', start, Date.now());
    assert.equal(result.decision, 'silent');
    assert.equal(result.content, '');
});

test('主动消息所有角色共用最近 40 条日志，旧角色状态不再重复保存事件', () => {
    STATE.settings.PROACTIVE_MESSAGES = JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES));
    for (let index = 0; index < 45; index += 1) {
        ProactiveMessages.addLocalEvent(index % 2 ? 'char-2' : 'char-1', `event_${index}`);
    }
    const events = ProactiveMessages.settings().diagnosticEvents;
    assert.equal(events.length, 40);
    assert.equal(events[0].code, 'event_5');
    assert.equal(events[39].code, 'event_44');
    assert.equal(ProactiveMessages.localRuntime('char-1').events, undefined);
});

test('浏览器主动判断给模型请求标记独立上下文日志和角色', async () => {
    STATE.settings.PROACTIVE_MESSAGES = {
        ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
        activeStart: '00:00', activeEnd: '00:00'
    };
    const contact = { id: 'log-char', name: '测试角色', prompt: '角色设定', history: [] };
    const originalApi = global.API;
    const originalWindow = global.window;
    let sentSettings;
    global.window = { crypto: { randomUUID: () => 'context-log-test' } };
    global.API = {
        chat: async (_messages, settings) => {
            sentSettings = settings;
            return '{"decision":"silent","content":"","next_check_in_minutes":null}';
        }
    };
    try {
        const result = await ProactiveMessages.runLocalCatchup(contact, true);
        assert.equal(result.decision, 'silent');
        assert.equal(sentSettings.PROACTIVE_CONTEXT_LOG, true);
        assert.equal(sentSettings.PROACTIVE_CHARACTER_ID, 'log-char');
        assert.equal(sentSettings.PROACTIVE_CHARACTER_NAME, '测试角色');
        assert.equal(sentSettings.ASYNC_BACKEND_ENABLED, false);
    } finally {
        global.API = originalApi;
        global.window = originalWindow;
    }
});

test('主动消息弹窗先显示本地日志，Worker 较新记录异步到达后再更新', async () => {
    const originalApi = global.API;
    const originalDocument = global.document;
    const originalRefresh = ProactiveMessages.refreshWorkerContextLog;
    const hidden = new Set(['hidden']);
    const modal = { classList: { remove: value => hidden.delete(value), contains: value => hidden.has(value) } };
    const content = { textContent: '' };
    const meta = { textContent: '', rows: [], appendChild(row) { this.rows.push(row); } };
    global.document = {
        getElementById: id => ({
            'proactive-context-log-modal': modal,
            'proactive-context-log-content': content,
            'proactive-context-log-meta': meta
        })[id],
        createElement: () => ({ textContent: '' })
    };
    global.API = { getLatestProactiveContextLog: async () => ({
        content: '本地请求', source: '浏览器', characterName: '本地角色', createdAt: 1
    }) };
    let resolveWorker;
    ProactiveMessages.refreshWorkerContextLog = () => new Promise(resolve => { resolveWorker = resolve; });
    try {
        await ProactiveMessages.openContextLogModal();
        assert.equal(content.textContent, '本地请求');
        assert.equal(hidden.has('hidden'), false);
        resolveWorker({ content: 'Worker 请求', source: 'Worker', characterName: '后台角色', createdAt: 2 });
        await new Promise(setImmediate);
        assert.equal(content.textContent, 'Worker 请求');
    } finally {
        global.API = originalApi;
        global.document = originalDocument;
        ProactiveMessages.refreshWorkerContextLog = originalRefresh;
    }
});

test('旧版重复同步事件不会进入统一日志', () => {
    STATE.settings.PROACTIVE_MESSAGES = JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES));
    STATE.settings.PROACTIVE_MESSAGES.workerStatusByChar = {
        'char-1': { events: [{ code: 'proactive_sync', ts: 1 }, { code: 'proactive_decision_silent', ts: 2 }] }
    };
    const settings = ProactiveMessages.settings();
    assert.deepEqual(settings.diagnosticEvents.map(event => event.code), ['proactive_decision_silent']);
    assert.equal(settings.workerStatusByChar['char-1'].events, undefined);
    ProactiveMessages.mergeDiagnosticEvents('char-1', [{ code: 'proactive_sync', ts: 3 }], 'Worker');
    assert.equal(settings.diagnosticEvents.length, 1);
});

test('浏览器连续未回复时仍使用固定的最短主动间隔', () => {
    const now = new Date('2026-09-23T12:00:00+08:00').getTime();
    const contact = { id: 'cooldown-char', history: [] };
    STATE.settings.PROACTIVE_MESSAGES = {
        ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
        activeStart: '00:00',
        activeEnd: '00:00',
        minCooldownMinutes: 60,
        recentChatQuietMinutes: 0
    };
    const runtime = ProactiveMessages.localRuntime(contact.id);
    runtime.lastProactiveGeneratedAt = now - 90 * 60000;
    runtime.unansweredCount = 1;
    assert.equal(ProactiveMessages.localPrefilter(contact, now), null);
    runtime.lastProactiveGeneratedAt = now - 30 * 60000;
    assert.deepEqual(ProactiveMessages.localPrefilter(contact, now), {
        reason: 'cooldown', retryAt: now + 30 * 60000
    });
});

test('纯前端冷却跳过后在冷却结束时重查，而不是等待最长检查间隔', async () => {
    const contact = { id: 'retry-cooldown', name: '测试角色', history: [] };
    const now = Date.now();
    const lastSentAt = now - 30 * 60000;
    STATE.contacts = [contact];
    STATE.settings.PROACTIVE_MESSAGES = {
        ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
        enabled: true,
        characterIds: [contact.id],
        activeStart: '00:00',
        activeEnd: '00:00',
        minCooldownMinutes: 60,
        recentChatQuietMinutes: 0,
        heartbeatHours: 12,
        nextLocalWakeAtByChar: { [contact.id]: now - 1000 },
        localRuntimeByChar: { [contact.id]: { lastProactiveGeneratedAt: lastSentAt, unansweredCount: 1 } }
    };
    const previousApi = global.API;
    global.API = { chat: async () => { throw new Error('冷却期间不应请求模型'); } };
    try {
        await ProactiveMessages.runLocalCatchup(contact);
        const nextWake = ProactiveMessages.settings().nextLocalWakeAtByChar[contact.id];
        assert.equal(nextWake, lastSentAt + 60 * 60000);
        assert.ok(ProactiveMessages.settings().diagnosticEvents.some(event => event.code === 'proactive_prefilter_skipped' && event.reason === 'cooldown'));
    } finally {
        global.API = previousApi;
    }
});

test('浏览器按模型给的分钟数安排下一次判断', async () => {
    const contact = { id: 'relative-wake', name: '测试角色', prompt: '', history: [] };
    STATE.settings.PROACTIVE_MESSAGES = {
        ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
        activeStart: '00:00', activeEnd: '00:00', recentChatQuietMinutes: 0,
        nextLocalWakeAtByChar: { [contact.id]: Date.now() - 1000 }
    };
    const previousApi = global.API;
    const previousWindow = global.window;
    global.window = { crypto: { randomUUID: () => 'relative-wake-test' } };
    global.API = { chat: async () => '{"decision":"silent","content":"","next_check_in_minutes":30}' };
    try {
        const before = Date.now();
        const result = await ProactiveMessages.runLocalCatchup(contact);
        const after = Date.now();
        const nextWake = ProactiveMessages.settings().nextLocalWakeAtByChar[contact.id];
        assert.equal(result.decision, 'silent');
        assert.ok(nextWake >= before + 30 * 60000);
        assert.ok(nextWake <= after + 30 * 60000);
    } finally {
        global.API = previousApi;
        global.window = previousWindow;
    }
});

test('纯前端按聊天安静期和下一允许时段计算重查时间', () => {
    const now = new Date(2026, 8, 23, 12, 0).getTime();
    const contact = { id: 'retry-window', history: [{ role: 'user', eventAt: now - 15 * 60000 }] };
    STATE.settings.PROACTIVE_MESSAGES = {
        ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
        activeStart: '09:00', activeEnd: '23:00', recentChatQuietMinutes: 45
    };
    assert.deepEqual(ProactiveMessages.localPrefilter(contact, now), {
        reason: 'recent_chat', retryAt: now + 30 * 60000
    });
    const late = new Date(2026, 8, 23, 23, 30).getTime();
    assert.deepEqual(ProactiveMessages.localPrefilter(contact, late), {
        reason: 'quiet_hours', retryAt: new Date(2026, 8, 24, 9, 0).getTime()
    });
});

test('运行摘要展示参与角色最早的下次计划唤醒', () => {
    const now = Date.now();
    STATE.contacts = [
        { id: 'char-later', name: '较晚角色' },
        { id: 'char-first', name: '较早角色' },
        { id: 'char-unused', name: '未参与角色' }
    ];
    STATE.settings.PROACTIVE_MESSAGES = {
        ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
        enabled: true,
        characterIds: ['char-later', 'char-first'],
        nextLocalWakeAtByChar: {
            'char-later': now + 7200000,
            'char-first': now + 3600000,
            'char-unused': now + 60000
        },
        workerStatusByChar: {
            'char-later': { runtime: { nextWakeAt: now + 1800000 } },
            'char-first': { runtime: { nextWakeAt: now + 5400000 } }
        }
    };
    const previousDocument = global.document;
    const originalWorkerModeAvailable = ProactiveMessages.workerModeAvailable;
    const summary = { textContent: '' };
    const list = { textContent: '', appendChild() {} };
    global.document = {
        getElementById(id) {
            return id === 'proactive-status-summary' ? summary : id === 'proactive-event-list' ? list : null;
        },
        createElement() { return { className: '', textContent: '' }; }
    };
    try {
        ProactiveMessages.workerModeAvailable = () => false;
        ProactiveMessages.renderDebug();
        assert.match(summary.textContent, new RegExp(`下次计划唤醒：较早角色 · ${new Date(now + 3600000).toLocaleString()}`));
        ProactiveMessages.workerModeAvailable = () => true;
        ProactiveMessages.renderDebug();
        assert.match(summary.textContent, new RegExp(`下次计划唤醒：较晚角色 · ${new Date(now + 1800000).toLocaleString()}`));
    } finally {
        global.document = previousDocument;
        ProactiveMessages.workerModeAvailable = originalWorkerModeAvailable;
    }
});

test('浏览器手动判断未参与角色不会创建自动唤醒', async () => {
    STATE.settings.PROACTIVE_MESSAGES = JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES));
    STATE.settings.API_URL = 'https://example.com/v1/chat/completions';
    STATE.settings.API_KEY = 'test-key';
    STATE.settings.MODEL = 'test-model';
    const contact = { id: 'manual-only', name: '手动角色', prompt: '角色设定', history: [] };
    STATE.contacts = [contact];
    const previousWindow = global.window;
    const previousApi = global.API;
    global.window = { crypto: { randomUUID: () => 'manual-test-run' } };
    global.API = { chat: async () => '{"decision":"silent","content":"","next_check_in_minutes":null}' };
    try {
        const result = await ProactiveMessages.runLocalCatchup(contact, true);
        const settings = ProactiveMessages.settings();
        assert.equal(result.decision, 'silent');
        assert.deepEqual(settings.characterIds, []);
        assert.equal(settings.nextLocalWakeAtByChar[contact.id], undefined);
        assert.ok(settings.diagnosticEvents.some(event => event.code === 'proactive_decision_silent' && event.characterId === contact.id));
    } finally {
        global.window = previousWindow;
        global.API = previousApi;
    }
});

test('主动判断胶囊只携带最近 15 条文字聊天', () => {
    STATE.settings.API_URL = 'https://example.com/v1/chat/completions';
    STATE.settings.API_KEY = 'test-key';
    STATE.settings.MODEL = 'test-model';
    const contact = {
        id: 'char-limit',
        name: '测试角色',
        prompt: '测试设定',
        history: Array.from({ length: 20 }, (_, index) => ({
            messageId: `message_${index}`,
            role: index % 2 ? 'assistant' : 'user',
            content: `内容 ${index}`,
            eventAt: 1000 + index
        }))
    };

    const capsule = ProactiveMessages.buildCapsule(contact);
    assert.equal(capsule.messages.length, 15);
    assert.equal(capsule.messages[0].messageId, 'message_5');
    assert.equal(capsule.messages[14].messageId, 'message_19');
});

test('主动判断快照清洗思考链，并跳过只含思考的消息', () => {
    const contact = {
        id: 'char-thought',
        name: '测试角色',
        history: [
            { messageId: 'one', role: 'assistant', content: '<think>不应传给模型</think>\n\n你好', eventAt: 1000 },
            { messageId: 'two', role: 'assistant', content: '<think>只有思考</think>', eventAt: 2000 },
            { messageId: 'three', role: 'user', content: '最近说的话', eventAt: 3000 }
        ]
    };

    const capsule = ProactiveMessages.buildCapsule(contact);
    assert.deepEqual(capsule.messages.map(message => message.messageId), ['one', 'three']);
    assert.equal(capsule.messages[0].content, '你好');
    const localMessages = ProactiveMessages.buildLocalMessages(contact, 1000, 3000, true);
    assert.equal(localMessages.some(message => message.content.includes('不应传给模型') || message.content.includes('只有思考')), false);
});

test('主动消息把实际发送时间写入正文，但聊天气泡隐藏该前缀', async () => {
    const eventAt = new Date(2026, 8, 4, 7, 0).getTime();
    const contact = { id: 'char-time', history: [] };
    const previousStorage = global.Storage;
    global.Storage = { saveContacts: async () => {} };
    try {
        const inserted = await ProactiveMessages.insertMessage(contact, {
            messageId: 'proactive_time_test',
            content: '早上好',
            sentAt: new Date(eventAt).toISOString(),
            source: 'proactive_worker'
        });
        assert.equal(inserted, true);
        assert.equal(contact.history[0].content, '[2026-09-04 07:00] 早上好');
        assert.equal(ProactiveMessages.displayContent(contact.history[0]), '早上好');
    } finally {
        global.Storage = previousStorage;
    }
});

test('主动消息可按稳定预设名称选择独立模型', () => {
    STATE.settings.PROACTIVE_MESSAGES.apiPresetName = '主动专用';
    STATE.settings.API_PRESETS = [{
        name: '主动专用',
        url: 'https://preset.example/v1/chat/completions',
        key: 'preset-key',
        model: 'preset-model',
        temperature: 0.6,
        max_tokens: 777,
        extra_body_json: '{"top_p":0.8}'
    }];
    const settings = ProactiveMessages.getRequestSettings({ linkedPresetName: '' });
    assert.equal(settings.API_URL, 'https://preset.example/v1/chat/completions');
    assert.equal(settings.API_KEY, 'preset-key');
    assert.equal(settings.MODEL, 'preset-model');
    assert.equal(settings.MAX_TOKENS, 777);
    const capsule = ProactiveMessages.buildCapsule({ id: 'char-preset', name: '测试角色', history: [] });
    assert.equal(capsule.maxTokens, 777);
    assert.deepEqual(capsule.requestBodyExtra, { top_p: 0.8 });
});

test('时间策略保留用户填写的小数且次数取整', () => {
    Object.assign(STATE.settings.PROACTIVE_MESSAGES, {
        minCooldownMinutes: 0.25,
        recentChatQuietMinutes: 0.5,
        heartbeatHours: 0.01,
        dailyLimit: 2.4,
        unansweredLimit: 1.6
    });
    const policy = ProactiveMessages.getPolicy();
    assert.equal(policy.minCooldownMinutes, 0.25);
    assert.equal(policy.recentChatQuietMinutes, 0.5);
    assert.equal(policy.heartbeatHours, 0.01);
    assert.equal(policy.dailyLimit, 2);
    assert.equal(policy.unansweredLimit, 2);
});

test('私人 Worker 胶囊跟随角色 API 并携带待加密 Key', () => {
    STATE.settings.PROACTIVE_MESSAGES.executionMode = 'private_worker';
    STATE.settings.PROACTIVE_MESSAGES.apiPresetName = '__character__';
    STATE.settings.API_PRESETS = [{
        name: '角色专用',
        url: 'https://role.example/v1/chat/completions',
        key: 'role-private-key',
        model: 'role-model'
    }];
    const capsule = ProactiveMessages.buildCapsule({
        id: 'char-worker',
        name: '测试角色',
        linkedPresetName: '角色专用',
        history: []
    });
    assert.equal(capsule.credentialMode, 'stored_client_key');
    assert.equal(capsule.apiUrl, 'https://role.example/v1/chat/completions');
    assert.equal(capsule.apiKey, 'role-private-key');
    assert.equal(capsule.model, 'role-model');
});

test('高级 Worker Secret 模式不会上传前端 API Key', () => {
    STATE.settings.PROACTIVE_MESSAGES.executionMode = 'server_secret';
    STATE.settings.API_URL = 'https://secret.example/v1/chat/completions';
    STATE.settings.API_KEY = 'should-not-upload';
    STATE.settings.MODEL = 'secret-model';
    STATE.settings.PROACTIVE_MESSAGES.apiPresetName = '__global__';
    const capsule = ProactiveMessages.buildCapsule({ id: 'char-secret', name: '测试角色', history: [] });
    assert.equal(capsule.credentialMode, 'server_secret');
    assert.equal(capsule.apiKey, '');
});

test('私人 Worker 未确认凭据时保持启用但不会误进后台模式', () => {
    STATE.settings.ASYNC_BACKEND_URL = 'https://worker.example';
    STATE.settings.ASYNC_BACKEND_TOKEN = 'worker-token';
    STATE.settings.PROACTIVE_MESSAGES.executionMode = 'private_worker';
    STATE.settings.PROACTIVE_MESSAGES.privateWorkerCredentialConsent = false;
    assert.equal(ProactiveMessages.workerConfigured(), false);
    STATE.settings.PROACTIVE_MESSAGES.privateWorkerCredentialConsent = true;
    assert.equal(ProactiveMessages.workerConfigured(), true);
});

test('Worker URL、访问密钥或模式变化后检测缓存签名会失效', () => {
    STATE.settings.ASYNC_BACKEND_URL = 'https://worker.example';
    STATE.settings.ASYNC_BACKEND_TOKEN = 'token-a';
    STATE.settings.PROACTIVE_MESSAGES.executionMode = 'server_secret';
    const first = ProactiveMessages.probeSignature([]);
    STATE.settings.ASYNC_BACKEND_TOKEN = 'token-b';
    const second = ProactiveMessages.probeSignature([]);
    STATE.settings.PROACTIVE_MESSAGES.executionMode = 'private_worker';
    const third = ProactiveMessages.probeSignature([]);
    assert.notEqual(first, second);
    assert.notEqual(second, third);
    assert.equal(first.includes('token-a'), false);
});

test('Worker 检测失败会明确保存为浏览器运行模式', async () => {
    const settings = STATE.settings.PROACTIVE_MESSAGES;
    settings.executionMode = 'private_worker';
    settings.followFrontendApiKey = false;
    const originalRememberWorkerProbe = ProactiveMessages.rememberWorkerProbe;
    let rememberedProbe = null;
    // ★ 这里只隔离持久化与 DOM 渲染，专门验证失败回退时保存的模式和提示信息。
    ProactiveMessages.rememberWorkerProbe = async probe => { rememberedProbe = probe; };
    try {
        await ProactiveMessages.fallbackToFrontendAfterFailedApply('后台访问密钥错误', 'unauthorized');
        assert.equal(ProactiveMessages.settings().executionMode, 'frontend');
        assert.equal(ProactiveMessages.settings().followFrontendApiKey, true);
        assert.equal(rememberedProbe.code, 'unauthorized');
        assert.match(rememberedProbe.message, /已自动改用浏览器运行/);
        assert.equal(rememberedProbe.signature, ProactiveMessages.probeSignature());
    } finally {
        ProactiveMessages.rememberWorkerProbe = originalRememberWorkerProbe;
    }
});

test('已授权时可从浏览器模式应用私人 Worker，不会把模式写入失效设置对象', async () => {
    STATE.settings = {
        ASYNC_BACKEND_URL: 'https://worker.example',
        ASYNC_BACKEND_TOKEN: 'worker-token',
        PROACTIVE_MESSAGES: {
            ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
            executionMode: 'frontend',
            privateWorkerCredentialConsent: true
        }
    };
    STATE.contacts = [];

    const previousDocument = global.document;
    const previousStorage = global.Storage;
    const originalProbeWorkerCapability = ProactiveMessages.probeWorkerCapability;
    const originalRunStartup = ProactiveMessages.runStartup;
    const originalRender = ProactiveMessages.render;
    const originalDisableWorkerContacts = ProactiveMessages.disableWorkerContacts;
    let modeSeenByProbe = '';

    global.document = {
        getElementById(id) {
            return id === 'proactive-execution-mode' ? { value: 'private_worker' } : null;
        }
    };
    global.Storage = { saveSettings: async () => {} };
    ProactiveMessages.probeWorkerCapability = async () => {
        modeSeenByProbe = ProactiveMessages.executionMode();
        ProactiveMessages.workerProbe = { status: 'ready', code: '', message: 'Worker 主动消息可用' };
        return true;
    };
    ProactiveMessages.runStartup = async () => {};
    ProactiveMessages.render = () => {};
    ProactiveMessages.disableWorkerContacts = async () => {};

    try {
        await ProactiveMessages.manualProbeWorker();
        assert.equal(modeSeenByProbe, 'private_worker');
        assert.equal(ProactiveMessages.executionMode(), 'private_worker');
        assert.equal(ProactiveMessages.settings().followFrontendApiKey, false);
    } finally {
        global.document = previousDocument;
        global.Storage = previousStorage;
        ProactiveMessages.probeWorkerCapability = originalProbeWorkerCapability;
        ProactiveMessages.runStartup = originalRunStartup;
        ProactiveMessages.render = originalRender;
        ProactiveMessages.disableWorkerContacts = originalDisableWorkerContacts;
    }
});

test('保存角色只持久化勾选角色，并让 Worker 胶囊保持启用', async () => {
    const contact = { id: 'char-selected', name: '测试角色', prompt: '', history: [] };
    STATE.contacts = [contact];
    STATE.settings = {
        API_URL: 'https://api.example.com/v1/chat/completions',
        API_KEY: 'private-test-key',
        MODEL: 'test-model',
        API_PRESETS: [],
        PROACTIVE_MESSAGES: {
            ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
            enabled: true,
            executionMode: 'private_worker',
            privateWorkerCredentialConsent: true
        }
    };

    const previousDocument = global.document;
    const previousStorage = global.Storage;
    const originalDisableWorkerContacts = ProactiveMessages.disableWorkerContacts;
    const originalRunStartup = ProactiveMessages.runStartup;
    const originalRender = ProactiveMessages.render;
    let savedCharacterIds = null;

    global.document = {
        getElementById(id) {
            const values = {
                'proactive-heartbeat-hours': '12',
                'proactive-catchup-hours': '24',
                'proactive-active-start': '11:00',
                'proactive-active-end': '23:00',
                'proactive-min-cooldown': '180',
                'proactive-chat-quiet': '45',
                'proactive-daily-limit': '3',
                'proactive-unanswered-limit': '2'
            };
            return Object.hasOwn(values, id) ? { value: values[id] } : null;
        },
        querySelectorAll(selector) {
            return selector === '[data-proactive-character-id]:checked'
                ? [{ dataset: { proactiveCharacterId: contact.id } }]
                : [];
        }
    };
    global.Storage = {
        saveSettings: async () => {
            savedCharacterIds = [...STATE.settings.PROACTIVE_MESSAGES.characterIds];
        }
    };
    ProactiveMessages.disableWorkerContacts = async () => {};
    ProactiveMessages.runStartup = async () => {};
    ProactiveMessages.render = () => {};

    try {
        await ProactiveMessages.saveCharacters();
        assert.deepEqual(savedCharacterIds, [contact.id]);
        assert.deepEqual(ProactiveMessages.settings().characterIds, [contact.id]);
        assert.equal(ProactiveMessages.settings().activeStart, '09:00');
        assert.equal(ProactiveMessages.buildCapsule(contact).enabled, true);
    } finally {
        global.document = previousDocument;
        global.Storage = previousStorage;
        ProactiveMessages.disableWorkerContacts = originalDisableWorkerContacts;
        ProactiveMessages.runStartup = originalRunStartup;
        ProactiveMessages.render = originalRender;
    }
});

test('保存时段只更新本卡片设置，不保存未提交的角色勾选', async () => {
    STATE.contacts = [{ id: 'char-unsaved', name: '未保存角色' }];
    STATE.settings = { PROACTIVE_MESSAGES: JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)) };
    const previousDocument = global.document;
    const previousStorage = global.Storage;
    const originalRunStartup = ProactiveMessages.runStartup;
    const originalRender = ProactiveMessages.render;
    let saved = null;

    global.document = {
        getElementById(id) {
            const values = {
                'proactive-active-start': '10:30',
                'proactive-active-end': '21:45',
                'proactive-min-cooldown': '90',
                'proactive-chat-quiet': '30',
                'proactive-daily-limit': '4',
                'proactive-unanswered-limit': '3',
                'proactive-heartbeat-hours': '6',
                'proactive-catchup-hours': '12'
            };
            return Object.hasOwn(values, id) ? { value: values[id] } : null;
        },
        querySelectorAll() {
            throw new Error('保存时段不应读取角色勾选');
        }
    };
    global.Storage = { saveSettings: async () => { saved = structuredClone(STATE.settings.PROACTIVE_MESSAGES); } };
    ProactiveMessages.runStartup = async () => {};
    ProactiveMessages.render = () => {};

    try {
        await ProactiveMessages.saveTimeSettings();
        assert.equal(saved.activeStart, '10:30');
        assert.equal(saved.activeEnd, '21:45');
        assert.equal(saved.heartbeatHours, 6);
        assert.deepEqual(saved.characterIds, []);
    } finally {
        global.document = previousDocument;
        global.Storage = previousStorage;
        ProactiveMessages.runStartup = originalRunStartup;
        ProactiveMessages.render = originalRender;
    }
});

test('后台重绘保留其他卡片未保存的时段、角色和运行方式输入', () => {
    STATE.contacts = [];
    STATE.settings = { PROACTIVE_MESSAGES: JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)) };
    const previousDocument = global.document;
    const originalRenderModeStatus = ProactiveMessages.renderModeStatus;
    const originalRenderCharacters = ProactiveMessages.renderCharacters;
    const originalRenderDebugSelector = ProactiveMessages.renderDebugSelector;
    const originalRenderDebug = ProactiveMessages.renderDebug;
    const elements = {
        'proactive-active-start': { value: '11:30' },
        'proactive-execution-mode': { value: 'private_worker' }
    };
    let characterRenders = 0;
    global.document = { getElementById: id => elements[id] || null };
    ProactiveMessages.renderModeStatus = () => {};
    ProactiveMessages.renderCharacters = () => { characterRenders += 1; };
    ProactiveMessages.renderDebugSelector = () => {};
    ProactiveMessages.renderDebug = () => {};
    ProactiveMessages.dirtyCards.add('time');
    ProactiveMessages.dirtyCards.add('characters');
    ProactiveMessages.dirtyCards.add('mode');

    try {
        ProactiveMessages.render();
        assert.equal(elements['proactive-active-start'].value, '11:30');
        assert.equal(elements['proactive-execution-mode'].value, 'private_worker');
        assert.equal(characterRenders, 0);
    } finally {
        ProactiveMessages.dirtyCards.clear();
        global.document = previousDocument;
        ProactiveMessages.renderModeStatus = originalRenderModeStatus;
        ProactiveMessages.renderCharacters = originalRenderCharacters;
        ProactiveMessages.renderDebugSelector = originalRenderDebugSelector;
        ProactiveMessages.renderDebug = originalRenderDebug;
    }
});
