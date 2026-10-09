// ★ reroll / 纯图片回归：调用真实模块，模拟 API 返回，不发送真实网络请求。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('script.js', 'utf8');
function block(start, end) { const i = source.indexOf(start); const j = source.indexOf(end, i); assert.ok(i >= 0 && j > i); return source.slice(i, j); }
const context = vm.createContext({ console, Date, Intl, Set, window: { crypto: require('node:crypto').webcrypto }, CONFIG: { DEFAULT: { PROACTIVE_MESSAGES: {
    enabled: true, characterIds: ['char'], executionMode: 'frontend', privateWorkerCredentialConsent: true,
    localRuntimeByChar: {}, lastLocalCheckAtByChar: {}, nextLocalWakeAtByChar: {}, workerStatusByChar: {}
} } }, STATE: { settings: { API_URL: 'https://api.example.com/v1/chat/completions', API_KEY: 'front-key', MODEL: 'model',
    ASYNC_BACKEND_URL: 'https://worker.example.com', ASYNC_BACKEND_TOKEN: 'token', PROACTIVE_MESSAGES: {
    enabled: true, characterIds: ['char'], executionMode: 'frontend', privateWorkerCredentialConsent: true
} }, contacts: [], moments: [], currentContactId: 'char' },
    Storage: { saveContacts: async () => {}, saveMoments: async () => {} },
    UI: {
        setLoading: (loading, id) => { context.STATE.typingContactId = loading ? id : null; },
        renderChatHistory: () => {},
        removeLatestAiBubbles: () => { context.removedAiBubbles += 1; },
        playWaterfall: async (...args) => { context.waterfalls.push(args); }
    },
    WorldInfoEngine: { scan: () => '' }, CharacterSchedule: { buildChatPrompt: () => '' },
    formatTimeForMoments: time => String(time), localStorage: { getItem: () => 'install' },
    Blob, alert: () => {}, confirm: () => true, Toast: { show: () => {} }, removedAiBubbles: 0, waterfalls: []
});
vm.runInContext(fs.readFileSync('js/history-visibility.js', 'utf8') + '\nthis.HistoryVisibility = HistoryVisibility;', context);
vm.runInContext(fs.readFileSync('js/proactive-messages.js', 'utf8') + '\nthis.ProactiveMessages = ProactiveMessages;', context);
const p = context.ProactiveMessages;
p.buildContextPrompt = () => '';
p.onAssistantMessage = async () => {};
const app = vm.runInContext('({' + block('    buildCharacterMomentRerollPrompt(', '    async maybeGenerateCharacterMoment(')
    + block('    getMomentsApiConfig(', '    extractMomentJson(')
    + block('    extractMomentJson(', '    normalizeCharacterMomentResponse(')
    + block('    async markAsyncMomentJobFailed(', '    buildMomentsAsyncContext(')
    + block('    buildMomentsAsyncContext(', '    applyAsyncBackendToMomentConfig(') + '})', context);
app.renderMomentsUI = () => {};
context.App = app;
const h = context.HistoryVisibility;
const image = { role: 'user', content: '[2026-10-09 09:30] ', timestamp: '2026-10-09 09:30', images: ['data:image/png;base64,YQ=='] };

test('朋友圈 max_tokens 完整继承全局或所选 API 预设，不再压成 1200', () => {
    const originalSettings = context.STATE.settings;
    const originalMomentsSettings = context.STATE.momentsSettings;
    try {
        context.STATE.settings = { ...originalSettings, MAX_TOKENS: 6400, TEMPERATURE: 0.8, API_PRESETS: [] };
        context.STATE.momentsSettings = { apiPresetIndex: -1 };
        assert.equal(app.getMomentsApiConfig().MAX_TOKENS, 6400);

        context.STATE.settings.API_PRESETS = [{
            url: 'https://preset.example.com', key: 'preset-key', model: 'deepseek-flash', max_tokens: 32700, temperature: 0
        }];
        context.STATE.momentsSettings.apiPresetIndex = 0;
        const presetConfig = app.getMomentsApiConfig();
        assert.equal(presetConfig.MAX_TOKENS, 32700);
        assert.equal(presetConfig.TEMPERATURE, 0);
    } finally {
        context.STATE.settings = originalSettings;
        context.STATE.momentsSettings = originalMomentsSettings;
    }
});
test('纯图片首发保留独立 user 及时间，历史描述也保留发送时间', () => {
    const pending = h.buildVisibleMessage(image, { preserveTimestamp: true, preserveImagePlaceholder: true });
    assert.equal(pending.role, 'user');
    assert.equal(pending.content, '[2026-10-09 09:30] [用户发送了一张图片]');
    assert.equal(h.buildVisibleMessage({ ...image, image_description: '一只猫' }, { preserveTimestamp: true }).content,
        '[2026-10-09 09:30] [System Info: 对方发送了一张图片，图片内容描述: 一只猫]');
});
test('隐藏图片或整条隐藏不会因占位和时间戳泄漏，隐藏文字仍可保留可见图片', () => {
    for (const message of [{ ...image, isHidden: true }, { ...image, hiddenIndices: [0], image_description: '秘密' }]) {
        assert.equal(h.buildVisibleMessage(message, { preserveTimestamp: true, preserveImagePlaceholder: true }), null);
    }
    const visible = h.buildVisibleMessage({ ...image, content: '[2026-10-09 09:30] 隐藏文字', hiddenIndices: [0], image_description: '猫' }, { preserveTimestamp: true });
    assert.ok(visible.content.startsWith('[2026-10-09 09:30] '));
    assert.doesNotMatch(visible.content, /隐藏文字/);
});
function chat() {
    const contact = { id: 'char', name: '角色', prompt: '人设', history: [
        { role: 'user', content: '[2026-10-08 22:00] 晚安', eventAt: 1 },
        { role: 'assistant', content: '晚安！', messageId: 'reply', eventAt: 2 },
        { role: 'assistant', content: '[2026-10-09 09:00] 旧早安', timestamp: '2026-10-09 09:00', eventAt: 3,
            messageId: 'proactive-one', proactiveSource: 'proactive_worker', heartbeatRunId: 'heartbeat' }
    ] };
    context.STATE.contacts = [contact]; return contact;
}
test('主动 reroll 固定原消息之前的上下文，不重复回答晚安，不混入旧正文', () => {
    const contact = chat(); const messages = p.buildRerollMessages(contact, contact.history[2]);
    assert.match(messages[1].content, /晚安！/);
    assert.match(messages[1].content, /2026-10-09 09:00/);
    assert.doesNotMatch(messages[1].content, /旧早安|silent/);
    assert.ok(messages[1].content.includes('\n'));
    assert.ok(!messages[1].content.includes('\\n'));
});
for (const mode of ['frontend', 'private_worker', 'server_secret']) {
    test(`主动 reroll 按当前 ${mode} 请求，立即删除旧消息并用 waterfall 播放新消息`, async () => {
        const contact = chat(); context.STATE.settings.PROACTIVE_MESSAGES.executionMode = mode;
        context.removedAiBubbles = 0; context.waterfalls = [];
        let captured;
        context.API = { lastAsyncBackendResult: null, chat: async (messages, settings) => {
            captured = { messages, settings }; return '<think>思考</think>\n[2026-10-09 09:00] 新早安';
        } };
        const rerollPromise = p.reroll(contact);
        // ★ 和普通聊天一样，请求开始后立即从历史与界面移除旧回复，不等待 API 返回。
        assert.equal(contact.history.length, 2);
        assert.equal(contact.history[1].content, '晚安！');
        assert.equal(context.removedAiBubbles, 1);
        await rerollPromise;
        assert.equal(contact.history.length, 3);
        assert.equal(contact.history[2].content, '[2026-10-09 09:00] 新早安');
        assert.equal(contact.history[2].messageId, 'proactive-one');
        assert.equal(contact.history[2].heartbeatRunId, 'heartbeat');
        assert.equal(contact.history[2].eventAt, 3);
        assert.equal(context.waterfalls.length, 1);
        assert.equal(context.waterfalls[0][0], '新早安');
        assert.equal(context.waterfalls[0][2], '2026-10-09 09:00');
        assert.equal(captured.settings.ASYNC_BACKEND_ENABLED, mode !== 'frontend');
        if (mode !== 'frontend') {
            const reroll = captured.settings.ASYNC_BACKEND_PROACTIVE_REROLL;
            assert.equal(reroll.messageId, 'proactive-one');
            assert.equal(reroll.capsule.apiKey, mode === 'private_worker' ? 'front-key' : '');
            assert.equal(captured.settings.ASYNC_BACKEND_KEY_MODE, mode === 'private_worker' ? 'client_key' : 'server_secret');
        }
        assert.equal(p.settings().localRuntimeByChar.char, undefined);
    });
}test('主动生成失败或空正文时不恢复已删除的原消息，旧版本也不能回填', async () => {
    context.STATE.settings.PROACTIVE_MESSAGES.executionMode = 'frontend';
    for (const throwsError of [true, false]) {
        const contact = chat();
        context.API = { chat: async () => { if (throwsError) throw new Error('网络失败'); return '<think>只有思考</think>'; } };
        const rerollPromise = p.reroll(contact);
        assert.equal(contact.history.length, 2);
        await assert.rejects(() => rerollPromise);
        assert.equal(contact.history.length, 2);
        assert.equal(contact.history[1].content, '晚安！');
        assert.equal(contact.proactiveRerollState, undefined);
    }

    const contact = chat();
    const originalMessage = { ...contact.history[2] };
    contact.history.pop();
    contact.proactiveRerollState = { messageId: 'proactive-one', revision: 'new' };
    assert.equal(await p.applyRerollResult(contact, {
        messageId: 'proactive-one', revision: 'old', originalMessage
    }, '迟到'), false);
    assert.equal(contact.history.length, 2);
});test('请求期间的新消息保留，新主动消息在完成后追加且同一结果只写回一次', async () => {
    const contact = chat(); const originalMessage = { ...contact.history[2] };
    contact.history.pop();
    contact.proactiveRerollState = { messageId: originalMessage.messageId, revision: 'rev' };
    const job = { messageId: originalMessage.messageId, revision: 'rev', originalContent: originalMessage.content, originalMessage };
    contact.history.push({ role: 'user', content: '新问题', messageId: 'new-user' });
    assert.equal(await p.applyRerollResult(contact, job, '新早安', 'job-1'), true);
    assert.equal(contact.history.length, 4);
    assert.equal(contact.history[2].content, '新问题');
    assert.equal(contact.history[3].content, '[2026-10-09 09:00] 新早安');
    assert.equal(await p.applyRerollResult(contact, job, '重复回填', 'job-1'), false);
});test('朋友圈原位 reroll 保留时间、点赞评论、注入次数，不接受旧版本或空正文', async () => {
    const moment = { id: 'moment', authorId: 'char', text: '旧帖', timestamp: 3000, createdAt: 4000,
        comments: [{ text: '评论' }], likes: ['user'], chatInjectionStatus: { char: 2 }, rerollRevision: 'rev' };
    context.STATE.moments = [moment];
    const job = { momentId: 'moment', charId: 'char', revision: 'rev', originalText: '旧帖' };
    assert.equal(await app.applyCharacterMomentReroll({ ...job, revision: 'old' }, '{"text":"迟到"}'), false);
    await assert.rejects(() => app.applyCharacterMomentReroll(job, '{"text":""}'));
    assert.equal(moment.text, '旧帖');
    assert.equal(await app.applyCharacterMomentReroll(job, '<think>思考</think>{"text":"新帖","timestamp":"任意时间"}', 'job'), true);
    assert.equal(context.STATE.moments.length, 1);
    assert.equal(moment.text, '新帖'); assert.equal(moment.timestamp, 3000); assert.equal(moment.createdAt, 4000);
    assert.deepEqual(moment.comments, [{ text: '评论' }]); assert.deepEqual(moment.likes, ['user']);
    assert.deepEqual(moment.chatInjectionStatus, { char: 2 });
    assert.equal(await app.applyCharacterMomentReroll(job, '{"text":"重复回填"}', 'job'), false);
});
test('朋友圈 reroll 排除旧帖及发帖后的上下文', () => {
    const contact = chat(); const moment = { id: 'old', authorId: 'char', text: '旧正文标记', timestamp: 2 };
    contact.history.push({ role: 'user', content: '后来聊天标记', eventAt: 5 });
    context.STATE.moments = [moment, { id: 'other', authorId: 'char', text: '此前动态标记', timestamp: 1 },
        { id: 'future', authorId: 'char', text: '后来动态标记', timestamp: 5 }];
    const prompt = app.buildCharacterMomentRerollPrompt(moment, contact);
    assert.match(prompt, /此前动态标记/);
    assert.doesNotMatch(prompt, /旧正文标记|后来聊天标记|后来动态标记/);
    assert.ok(prompt.includes('\n')); assert.ok(!prompt.includes('\\n'));
});

// ★ 入口集成检查：执行真实 handleSend 分流和 createChatJob，防止 UI 接好了但仍走旧 reroll / 普通 jobs。
function method(start) { const i = source.indexOf(start); const j = source.indexOf('\n    },', i); assert.ok(i >= 0 && j > i); return source.slice(i, j + 7); }
test('底部 reroll 在普通 API 校验和删除 assistant 之前转入独立主动生成', async () => {
    const entry = vm.runInContext('({' + method('    async handleSend(isReroll = false) {') + '})', context);
    const contact = chat(); context.STATE.typingContactId = null;
    const previous = p.reroll; let called = 0;
    p.reroll = async target => { assert.equal(target, contact); called += 1; };
    context.API = { shouldUseAsyncBackend: () => { throw new Error('不应进入普通聊天配置'); } };
    try { await entry.handleSend(true); } finally { p.reroll = previous; }
    assert.equal(called, 1); assert.equal(contact.history.length, 3); assert.equal(contact.history[1].content, '晚安！');
});
test('真实 job 创建入口使用当前 Worker 的角色 reroll 路由，Secret 不传前端 Key', async () => {
    const api = vm.runInContext('({' + method('    async createChatJob(backendUrl, messages, settings) {') + '})', context);
    api.mergeAsyncBackendJobEvents = () => {};
    const captured = [];
    context.fetch = async (url, options) => { captured.push({ url, payload: JSON.parse(options.body) }); return { ok: true, json: async () => ({ jobId: 'job', events: [] }) }; };
    context.STATE.settings.PROACTIVE_MESSAGES.executionMode = 'server_secret';
    await api.createChatJob('https://worker.example.com', [{ role: 'user', content: '重写早安' }], {
        API_URL: 'https://api.example.com/v1/chat/completions', API_KEY: 'must-not-send', MODEL: 'model',
        ASYNC_BACKEND_TOKEN: 'token', ASYNC_BACKEND_KEY_MODE: 'server_secret', CONTACT_ID: 'char',
        ASYNC_BACKEND_PROACTIVE_REROLL: { objectName: 'install:char', messageId: 'morning', revision: 'rev', capsule: { apiKey: '' } }
    });
    assert.equal(captured[0].url, 'https://worker.example.com/proactive/install%3Achar/reroll');
    assert.equal(captured[0].payload.api_key, '');
    assert.equal(captured[0].payload.proactive_object_name, undefined);
    assert.equal(captured[0].payload.proactive_reroll.messageId, 'morning');
});
test('后台轮询被打断时保持旧消息已删除，恢复后按 ID 用 waterfall 写回一次', async () => {
    const contact = chat(); context.STATE.settings.PROACTIVE_MESSAGES.executionMode = 'private_worker';
    context.waterfalls = [];
    let savedContext; let scheduled = 0;
    const oldSchedule = app.scheduleAsyncBackendResumeCheck;
    app.scheduleAsyncBackendResumeCheck = () => { scheduled += 1; };
    context.API = { chat: async (_messages, settings) => {
        savedContext = settings.ASYNC_BACKEND_CONTEXT;
        throw Object.assign(new Error('后台已接收'), { isAsyncBackendPending: true });
    } };
    try {
        await p.reroll(contact);
        assert.equal(contact.history.length, 2);
        assert.equal(contact.history[1].content, '晚安！');
        assert.equal(contact.proactiveRerollState.revision, savedContext.revision);
        assert.equal(scheduled, 1);
        assert.equal(await p.applyRerollResult(contact, savedContext, '恢复后的早安', 'job'), true);
        assert.equal(contact.history.length, 3);
        assert.equal(contact.history[2].content, '[2026-10-09 09:00] 恢复后的早安');
        assert.equal(context.waterfalls.at(-1)[0], '恢复后的早安');
    } finally { app.scheduleAsyncBackendResumeCheck = oldSchedule; }
});
