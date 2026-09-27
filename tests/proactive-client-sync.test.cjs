const test = require('node:test');
const assert = require('node:assert/strict');

global.CONFIG = { DEFAULT: { PROACTIVE_MESSAGES: {
    enabled: true, characterIds: ['char-1'], localRuntimeByChar: {},
    lastLocalCheckAtByChar: {}, nextLocalWakeAtByChar: {}, workerStatusByChar: {}
} } };
global.STATE = { settings: { PROACTIVE_MESSAGES: { enabled: true, characterIds: ['char-1'] } }, contacts: [] };
global.Storage = { saveSettings: async () => {} };
const ProactiveMessages = require('../js/proactive-messages.js');

test('用户发言只通知活动时刻，角色回复后才同步完整快照', async () => {
    const previousFetch = global.fetch;
    const previousAvailable = ProactiveMessages.workerModeAvailable;
    const previousBaseUrl = ProactiveMessages.workerBaseUrl;
    const previousHeaders = ProactiveMessages.workerHeaders;
    const previousLastActivity = ProactiveMessages.lastActivity;
    const previousSync = ProactiveMessages.syncWorker;
    const requests = [];
    let fullSyncs = 0;
    ProactiveMessages.workerModeAvailable = () => true;
    ProactiveMessages.workerBaseUrl = () => 'https://worker.local/proactive/char-1';
    ProactiveMessages.workerHeaders = () => ({ 'Content-Type': 'application/json' });
    ProactiveMessages.lastActivity = (_contact, role) => role === 'user' ? 1000 : 2000;
    ProactiveMessages.syncWorker = async () => { fullSyncs += 1; };
    global.fetch = async (url, options) => {
        requests.push({ url, options });
        return Response.json({ ok: true });
    };
    try {
        const contact = { id: 'char-1' };
        await ProactiveMessages.onUserMessage(contact);
        assert.equal(requests.length, 1);
        assert.match(requests[0].url, /\/activity$/);
        assert.deepEqual(JSON.parse(requests[0].options.body), { lastUserAt: 1000, lastChatAt: 2000 });
        assert.equal(fullSyncs, 0);
        await ProactiveMessages.onAssistantMessage(contact);
        assert.equal(fullSyncs, 1);
    } finally {
        global.fetch = previousFetch;
        ProactiveMessages.workerModeAvailable = previousAvailable;
        ProactiveMessages.workerBaseUrl = previousBaseUrl;
        ProactiveMessages.workerHeaders = previousHeaders;
        ProactiveMessages.lastActivity = previousLastActivity;
        ProactiveMessages.syncWorker = previousSync;
    }
});
