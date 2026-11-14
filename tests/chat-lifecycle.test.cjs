// ★ 聊天生命周期回归：执行真实发送/恢复方法，网络、存储和页面切换可控，不调用真实 API。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('script.js', 'utf8');
function method(signature) {
    const start = source.indexOf('    ' + signature);
    const end = source.indexOf('\n    },', start);
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end + 7);
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function harness() {
    const contact = { id: 'a', name: 'A', chatMode: 'offline', history: [], offlineHistory: [
        { role: 'user', content: '问题', messageId: 'user' },
        { role: 'assistant', content: '原回复', messageId: 'old' }
    ], offlineBridgeRoundsLeft: 2 };
    const state = { contacts: [contact], currentContactId: 'a', settings: {}, typingContactId: null };
    const snapshots = [], appended = [], removed = [], events = [];
    let serial = 0, apiCalls = 0;
    const input = { value: '', style: {}, focus() {}, blur() {} };
    const UI = { els: { input, offlineInput: input, offlineSendBtn: {} },
        updateRerollState() {}, renderChatHistory() {},
        appendOfflineCard: (_c, m) => { appended.push(m); return true; },
        removeOfflineCards: (_c, messages) => { removed.push(...messages); return true; },
        renderOfflineChatHistory() {}, setOfflineTyping() {}, renderContacts() {}, setLoading(loading, id) { if (loading) state.typingContactId = id; else if (state.typingContactId === id) state.typingContactId = null; }, touchContactPresence() {} };
    const Storage = { async saveContacts() { events.push('save'); snapshots.push(JSON.parse(JSON.stringify(contact))); } };
    const API = { loadPendingJobs: () => [], shouldUseAsyncBackend: () => false,
        async chat() { apiCalls++; return '新回复'; },
        async deleteChatJob() { events.push('delete'); }, forgetPendingJob() { events.push('forget'); },
        updateAsyncBackendLogWithVision() {}, rememberResumedAsyncJobResult() {}, asyncJobLogId: id => id,
        isAsyncBackendRecoverablePollError: () => false };
    const context = vm.createContext({ STATE: state, UI, Storage, API,
        CONFIG: { SYSTEM_PROMPT: '' }, window: { innerWidth: 400 }, console: { log() {}, info() {}, warn() {}, error() {} },
        confirm: () => true, formatTimestamp: () => '2026-11-14 12:00',
        ProactiveMessages: { makeId: prefix => prefix + ++serial, async onAssistantMessage() {} },
        WorldSense: { buildPromptFromSettings: () => '' }, TodoContext: { buildPrompt: () => '' },
        CharacterMemory: { buildChatPrompt: () => '' }, CharacterSchedule: { buildChatPrompt: () => '' },
        WorldInfoEngine: { scanByType: () => ({}) }, Pomodoro: { async consume() {} }
    });
    vm.runInContext(fs.readFileSync('js/chat-bubbles.js', 'utf8') + '\nthis.ChatBubbles = ChatBubbles;', context);
    vm.runInContext(fs.readFileSync('js/history-visibility.js', 'utf8') + '\nthis.HistoryVisibility = HistoryVisibility;', context);
    vm.runInContext(fs.readFileSync('js/offline-chat.js', 'utf8') + '\nthis.OfflineChat = OfflineChat;', context);
    const signatures = ['async handleOfflineSend(isReroll = false) {', 'async handleSend(isReroll = false) {', 'ensureHistoryCacheMetadata(contact, historyKey = \'history\') {',
        'selectHistoryWindowRecords(contact, requestSettings, historyKey = \'history\') {', 'async resumePendingChatJobs() {',
        'rememberPendingJob(jobId, settings) {'];
    const app = vm.runInContext('({' + signatures.map(method).join('\n') + '})', context);
    const previewSignatures = ["getRerollPreviewIds(contact, historyKey = 'history') {",
        'beginRerollPreview(contact, historyKey, ids) {', 'clearRerollPreview(contact, historyKey, refresh = false) {',
        'refreshRerollPreview(contact, historyKey) {'];
    Object.assign(UI, vm.runInContext('({' + previewSignatures.map(method).join('\n') + '})', context));
    context.App = app;

    Object.assign(app, { buildChatRequestSettings: () => ({ CONTEXT_LIMIT: 5 }),
        async ensureWorldSenseWeatherReady() {}, async ensureCharacterMemoryReady() {}, async ensureCharacterScheduleReady() {},
        buildRequestCacheDebugLog: () => ({}), async maybePromptDynamicContextCompatMode() {},
        isOfflineChatOpen: id => state.currentContactId === id, isViewingContactChat: () => false,
        isAsyncBackendJobStale: () => false, renderAsyncBackendPendingJobs() {}, scheduleAsyncBackendResumeCheck() {} });
    return { app, contact, state, UI, API, Storage, input, snapshots, appended, removed, events, context, calls: () => apiCalls };
}
test('重生成失败/空返回保留原回复，不提前删除卡片', async () => {
    for (const empty of [false, true]) {
        const h = harness(); h.API.chat = async () => { if (empty) return ''; throw Error('断网'); };
        await h.app.handleOfflineSend(true);
        assert.ok(h.contact.offlineHistory.some(m => m.messageId === 'old' && m.content === '原回复'));
        assert.equal(h.removed.length, 0);
        assert.ok(h.snapshots.every(s => s.offlineHistory.some(m => m.messageId === 'old')));
        assert.equal(h.state.typingContactId, null);
    }
});
test('成功后替换旧回复，上下文不包含旧正文，桥接只扣一次', async () => {
    const h = harness(); let messages;
    h.API.chat = async m => { messages = m; return '新回复'; };
    await h.app.handleOfflineSend(true);
    assert.ok(!messages.some(m => m.content === '原回复'));
    assert.equal(h.contact.offlineHistory.some(m => m.messageId === 'old'), false);
    assert.equal(h.contact.offlineHistory.at(-1).content, '新回复');
    assert.equal(h.contact.offlineBridgeRoundsLeft, 1);
    assert.equal(h.removed.length, 1);
});
test('数据库尚未保存完成时再次触发，仍只执行一轮请求', async () => {
    const h = harness(), gate = deferred(); h.Storage.saveContacts = () => gate.promise;
    const first = h.app.handleOfflineSend(true);
    await h.app.handleOfflineSend(true);
    gate.resolve(); await first;
    assert.equal(h.calls(), 1);
});
test('准备上下文抛错也能解锁，允许之后重新生成', async () => {
    const h = harness(); h.app.ensureWorldSenseWeatherReady = async () => { throw Error('准备失败'); };
    await h.app.handleOfflineSend(true);
    assert.equal(h.state.chatRequestActive, false); assert.equal(h.state.typingContactId, null);
    assert.equal(h.UI.els.offlineSendBtn.disabled, false);
    h.app.ensureWorldSenseWeatherReady = async () => {};
    await h.app.handleOfflineSend(true); assert.equal(h.calls(), 1);
});
test('请求期间切换角色，旧角色结果只入库，不混入当前页面', async () => {
    const h = harness(); h.API.chat = async () => { h.state.currentContactId = 'b'; return 'A 的回复'; };
    await h.app.handleOfflineSend(true);
    assert.equal(h.contact.offlineHistory.at(-1).content, 'A 的回复');
    assert.equal(h.appended.length, 0); assert.equal(h.removed.length, 0);
});
test('pending 快照保存模式和替换目标，恢复不需要原用户消息仍存在', () => {
    const h = harness(); let jobs;
    h.app.loadPendingJobs = () => []; h.app.savePendingJobs = value => { jobs = value; }; h.app.asyncJobLogId = id => id;
    h.app.rememberPendingJob('job', { CONTACT_ID: 'a', CHAT_HISTORY_KEY: 'offlineHistory',
        CHAT_REROLL_MESSAGE_IDS: ['old'], ASYNC_BACKEND_USER_MESSAGE_ID: 'deleted', ASYNC_BACKEND_URL: 'https://worker' });
    assert.equal(jobs[0].chatHistoryKey, 'offlineHistory'); assert.deepEqual(Array.from(jobs[0].rerollMessageIds), ['old']);
});
test('用户消息被删除后，后台恢复仍写入线下并扣轮次，本地保存先于远程删除', async () => {
    const h = harness(); h.contact.offlineHistory = []; // ★ 用户在等待期间已删除消息，模式仍以请求快照为准。
    const pending = { jobId: 'job', contactId: 'a', userMessageId: 'deleted', chatHistoryKey: 'offlineHistory' };
    h.API.loadPendingJobs = () => [pending]; h.API.getChatJob = async () => ({ status: 'done', result: '后台回复' });
    await h.app.resumePendingChatJobs();
    assert.equal(h.contact.history.length, 0); assert.equal(h.contact.offlineHistory.length, 1);
    assert.equal(h.contact.offlineHistory[0].content, '后台回复'); assert.equal(h.contact.offlineBridgeRoundsLeft, 1);
    assert.ok(h.events.indexOf('save') < h.events.indexOf('delete')); assert.ok(h.events.includes('forget'));
    await h.app.resumePendingChatJobs(); // ★ 同一任务再查一次不重复插入或扣减。
    assert.equal(h.contact.offlineHistory.length, 1); assert.equal(h.contact.offlineBridgeRoundsLeft, 1);
});
test('后台回复保存失败时不确认或删除服务端副本', async () => {
    const h = harness(); h.API.loadPendingJobs = () => [{ jobId: 'job', contactId: 'a', chatHistoryKey: 'offlineHistory' }];
    h.API.getChatJob = async () => ({ status: 'done', result: '后台回复' });
    h.Storage.saveContacts = async () => { throw Error('数据库不可用'); };
    await h.app.resumePendingChatJobs();
    assert.ok(!h.events.includes('delete')); assert.ok(!h.events.includes('forget'));
});

// ★ 线上使用同一套保存和异常清理约定，也要验证准备阶段失败不会删掉旧回复。
test('线上重生成准备失败保留原回复并释放请求槽', async () => {
    const h = harness(); h.contact.chatMode = 'online'; h.contact.history = [...h.contact.offlineHistory];
    h.app.ensureHistoryCacheMetadata = () => { throw Error('准备历史失败'); };
    await h.app.handleSend(true);
    assert.ok(h.contact.history.some(m => m.messageId === 'old' && m.content === '原回复'));
    assert.ok(h.snapshots.every(s => s.history.some(m => m.messageId === 'old')));
    assert.equal(h.state.chatRequestActive, false); assert.equal(h.state.typingContactId, null);
});
test('新回复写库失败会回滚旧回复，恢复后可重新生成', async () => {
    const h = harness(); const save = h.Storage.saveContacts; let failNext = false;
    h.API.chat = async () => { failNext = true; return '新回复'; };
    h.Storage.saveContacts = async () => { if (failNext) { failNext = false; throw Error('写库失败'); } await save(); };
    await h.app.handleOfflineSend(true);
    assert.ok(h.contact.offlineHistory.some(m => m.messageId === 'old'));
    assert.ok(!h.contact.offlineHistory.some(m => m.content === '新回复'));
    assert.equal(h.contact.offlineBridgeRoundsLeft, 2);
    assert.equal(h.state.chatRequestActive, false);
});

// ★ 点击后立即隐藏，但历史和保存快照必须完整；失败时同一条旧消息恢复。
test('线下重生成立即隐藏旧卡片，失败后恢复，历史从未删除旧回复', async () => {
    const h = harness(), gate = deferred();
    h.API.chat = async () => { await gate.promise; throw Error('网络失败'); };
    const request = h.app.handleOfflineSend(true);
    assert.equal(h.UI.getRerollPreviewIds(h.contact, 'offlineHistory').has('old'), true);
    assert.equal(h.contact.offlineHistory.at(-1).content, '原回复');
    gate.resolve(); await request;
    assert.equal(h.UI.getRerollPreviewIds(h.contact, 'offlineHistory').has('old'), false);
    assert.ok(h.snapshots.every(s => s.offlineHistory.some(m => m.messageId === 'old')));
});
test('请求成功后解除临时隐藏，只保留新正文', async () => {
    const h = harness(), gate = deferred(); h.API.chat = () => gate.promise;
    const request = h.app.handleOfflineSend(true);
    assert.equal(h.UI.getRerollPreviewIds(h.contact, 'offlineHistory').has('old'), true);
    gate.resolve('新回复'); await request;
    assert.equal(h.UI.getRerollPreviewIds(h.contact, 'offlineHistory').size, 0);
    assert.equal(h.contact.offlineHistory.some(m => m.messageId === 'old'), false);
    assert.equal(h.appended.at(-1).content, '新回复');
});
test('切换页面或重载后按 pending 隐藏，任务失败后恢复，线上线下互不影响', () => {
    const h = harness(); const pending = { jobId: 'job', contactId: 'a', status: 'running',
        chatHistoryKey: 'offlineHistory', rerollMessageIds: ['old'] };
    h.API.loadPendingJobs = () => [pending];
    assert.equal(h.UI.getRerollPreviewIds(h.contact, 'offlineHistory').has('old'), true);
    assert.equal(h.UI.getRerollPreviewIds(h.contact, 'history').size, 0);
    pending.status = 'failed';
    assert.equal(h.UI.getRerollPreviewIds(h.contact, 'offlineHistory').size, 0);
    assert.equal(h.contact.offlineHistory.at(-1).content, '原回复');
});
test('线上临时隐藏同样不改历史，恢复动作只刷新所属角色页面', () => {
    const h = harness(); let renders = 0;
    h.app.isViewingContactChat = id => h.state.currentContactId === id;
    h.UI.renderChatHistory = () => renders++;
    h.contact.history = [...h.contact.offlineHistory];
    h.UI.beginRerollPreview(h.contact, 'history', ['old']);
    assert.equal(renders, 1); assert.equal(h.UI.getRerollPreviewIds(h.contact).has('old'), true);
    h.state.currentContactId = 'b';
    h.UI.clearRerollPreview(h.contact, 'history', true);
    assert.equal(renders, 1); assert.equal(h.UI.getRerollPreviewIds(h.contact).size, 0);
    assert.equal(h.contact.history.at(-1).content, '原回复');
});
