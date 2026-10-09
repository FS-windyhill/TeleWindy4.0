// ★ Worker 回归：真实 Queue job / DO 路由与加密凭据，全部上游响应由测试模拟。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../backend/worker.js', import.meta.url), 'utf8');
const { ChatJobObject, runJob, createJob, injectImageDescription } = await import(`data:text/javascript;base64,${Buffer.from(source + '\nexport { runJob, createJob, injectImageDescription };').toString('base64')}`);
class MemoryStorage {
    constructor() { this.values = new Map(); this.alarm = null; }
    async get(key) { return structuredClone(this.values.get(key)); }
    async put(key, value) { this.values.set(key, structuredClone(value)); }
    async delete(key) { this.values.delete(key); }
    async getAlarm() { return this.alarm; }
    async setAlarm(value) { this.alarm = value; }
    async deleteAlarm() { this.alarm = null; }
    async transaction(callback) { return await callback(this); }
}
function environment() {
    const stores = new Map(); const payloads = new Map(); const queued = [];
    const env = { APP_TOKEN: 'worker-test-token', UPSTREAM_CHAT_URL: 'https://api.example.com/v1/chat/completions', UPSTREAM_API_KEY: 'secret-key',
        CHAT_JOBS: { put: async (key, value) => payloads.set(key, value),
            get: async (key, type) => type === 'json' ? JSON.parse(payloads.get(key)) : payloads.get(key),
            delete: async key => payloads.delete(key) },
        CHAT_JOB_QUEUE: { send: async data => queued.push(data) },
        CHAT_JOB_OBJECT: { idFromName: name => name, get: name => {
            if (!stores.has(name)) stores.set(name, new MemoryStorage());
            return { fetch: (input, options) => new ChatJobObject({ storage: stores.get(name) }, env)
                .fetch(input instanceof Request ? input : new Request(input, options)) };
        } }
    };
    return { env, stores, payloads, queued };
}
const capsule = mode => ({ enabled: true, characterId: 'char', characterName: '角色',
    apiUrl: 'https://api.example.com/v1/chat/completions', model: 'model',
    credentialMode: mode, apiKey: mode === 'stored_client_key' ? 'private-key' : '', contextRevision: 1,
    messages: [{ messageId: 'reply', role: 'assistant', content: '晚安', eventAt: 1 },
        { messageId: 'morning', role: 'assistant', content: '旧早安', eventAt: 2 }], policy: { heartbeatHours: 12 } });
const reroll = (mode, revision = 'rev', apiKey) => ({ model: 'model', max_tokens: 1200, temperature: 1,
    messages: [{ role: 'user', content: '重写早安' }], request_body_extra: {},
    proactive_reroll: { objectName: 'install:char', messageId: 'morning', revision,
        capsule: { ...capsule(mode), ...(apiKey !== undefined ? { apiKey } : {}) } } });
function request(payload) { return new Request('https://worker.local/proactive/install%3Achar/reroll', { method: 'POST', body: JSON.stringify(payload) }); }
for (const mode of ['stored_client_key', 'server_secret']) {
    test(`Worker ${mode} reroll 创建持久化 job，完成后仅替换目标且不改变 Alarm 和计数`, async () => {
        const { env, stores, payloads, queued } = environment();
        const object = env.CHAT_JOB_OBJECT.get('proactive:install:char');
        await object.fetch(new Request('https://worker.local/proactive/install%3Achar/sync', { method: 'PUT', body: JSON.stringify(capsule(mode)) }));
        const storage = stores.get('proactive:install:char');
        const runtime = { dailyCount: 2, unansweredCount: 1, lastProactiveGeneratedAt: 2, nextWakeAt: 9000 };
        await storage.put('runtime', runtime); storage.alarm = 9000;
        await storage.put('pendingMessages', [{ messageId: 'morning', role: 'assistant', content: '旧早安', eventAt: 2 }]);
        await storage.put('outbox', [{ messageId: 'morning', content: '旧早安', sentAt: '2026-10-09T09:00:00+08:00', acknowledged: false }]);
        const response = await object.fetch(request(reroll(mode, 'rev', ''))); // 私人模式验证读取加密保存的 Key。
        assert.equal(response.status, 202);
        const { jobId } = await response.json();
        assert.deepEqual(queued, [{ jobId }]);
        const body = [...payloads.values()].map(JSON.parse)[0];
        assert.equal(body.upstream.apiKey, mode === 'stored_client_key' ? 'private-key' : 'secret-key');
        assert.equal(body.proactiveObjectName, '');
        assert.equal(body.proactiveReplacement.messageId, 'morning');
        assert.equal(body.proactiveReplacement.revision, 'rev');
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (_url, options) => {
            assert.equal(options.headers.Authorization || options.headers.authorization, `Bearer ${mode === 'stored_client_key' ? 'private-key' : 'secret-key'}`);
            return Response.json({ choices: [{ message: { reasoning_content: '思考', content: '[2026-10-09 09:00] 新早安' } }] });
        };
        try { await runJob(jobId, body, env); } finally { globalThis.fetch = previousFetch; }
        const job = await stores.get(jobId).get('job');
        assert.equal(job.status, 'done');
        const saved = await storage.get('capsule');
        assert.equal(saved.messages[0].content, '晚安');
        assert.equal(saved.messages[1].content, '新早安');
        assert.equal((await storage.get('pendingMessages'))[0].content, '新早安');
        const outbox = await storage.get('outbox');
        assert.equal(outbox.length, 1); assert.equal(outbox[0].content, '新早安'); assert.equal(outbox[0].acknowledged, true);
        assert.equal(outbox[0].sentAt, '2026-10-09T09:00:00+08:00');
        assert.deepEqual(await storage.get('runtime'), runtime); assert.equal(storage.alarm, 9000);
    });
}
test('旧 Worker reroll 结果不会覆盖新版本，空正文 job 失败而原文保留', async () => {
    const { env, stores, payloads } = environment();
    const object = env.CHAT_JOB_OBJECT.get('proactive:install:char');
    await object.fetch(new Request('https://worker.local/proactive/install%3Achar/sync', { method: 'PUT', body: JSON.stringify(capsule('stored_client_key')) }));
    const old = await (await object.fetch(request(reroll('stored_client_key', 'old')))).json();
    const oldBody = [...payloads.values()].map(JSON.parse)[0];
    const newer = await (await object.fetch(request(reroll('stored_client_key', 'new')))).json();
    const newBody = [...payloads.values()].map(JSON.parse).find(item => item.proactiveReplacement.revision === 'new');
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '迟到的旧消息' } }] });
    try {
        await runJob(old.jobId, oldBody, env);
        assert.equal((await stores.get('proactive:install:char').get('capsule')).messages[1].content, '旧早安');
        globalThis.fetch = async () => Response.json({ choices: [{ message: { reasoning_content: '只有思考', content: '' } }] });
        await runJob(newer.jobId, newBody, env);
        assert.equal((await stores.get(newer.jobId).get('job')).status, 'failed');
        assert.equal((await stores.get('proactive:install:char').get('capsule')).messages[1].content, '旧早安');
    } finally { globalThis.fetch = previousFetch; }
});
test('图片描述只注入当前图片 user，不回头污染上一条 user', () => {
    const messages = [{ role: 'user', content: '等会拍图' }, { role: 'assistant', content: '等你' },
        { role: 'user', content: '[2026-10-09 09:30] [用户发送了一张图片]' }];
    const output = injectImageDescription(messages, '一只猫', 2);
    assert.equal(output[0].content, '等会拍图'); assert.equal(output[1].content, '等你');
    assert.match(output[2].content, /2026-10-09 09:30/); assert.match(output[2].content, /一只猫/);
    assert.equal(messages[2].content.includes('一只猫'), false);
    assert.throws(() => injectImageDescription(messages, '猫', 1), /vision_user_message_missing/);
    assert.throws(() => injectImageDescription(messages.slice(0, 2), '猫', -1), /vision_user_message_missing/);
});
test('超过 80 条时，后台目标索引随消息窗口裁剪移动', async () => {
    const { env, payloads } = environment();
    const messages = Array.from({ length: 90 }, (_, index) => ({ role: index === 89 ? 'user' : 'assistant', content: String(index) }));
    const response = await createJob(new Request('https://worker.local/jobs', { method: 'POST', body: JSON.stringify({
        api_url: 'https://api.example.com/v1/chat/completions', api_key: 'key', auth_mode: 'client_key', model: 'model',
        messages, request_user_message_index: 89
    }) }), env);
    assert.equal(response.status, 202);
    const body = [...payloads.values()].map(JSON.parse)[0];
    assert.equal(body.messages.length, 80); assert.equal(body.requestUserMessageIndex, 79);
    const output = injectImageDescription(body.messages, '当前图', body.requestUserMessageIndex);
    assert.match(output[79].content, /当前图/); assert.equal(output[0].content, '10');
});
test('外部路由不允许伪造 replace-message 回填', async () => {
    const { env } = environment();
    const response = await (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default.fetch(
        new Request('https://worker.local/proactive/install%3Achar/replace-message', { method: 'POST', headers: { Authorization: 'Bearer worker-test-token' }, body: '{}' }), env);
    assert.equal(response.status, 404);
});
