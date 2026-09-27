import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workerSource = await readFile(new URL('../backend/worker.js', import.meta.url), 'utf8');
const { ChatJobObject, runJob } = await import(`data:text/javascript;base64,${Buffer.from(`${workerSource}\nexport { runJob };`).toString('base64')}`);

class MemoryStorage {
    constructor() { this.values = new Map(); this.alarm = null; }
    async get(key) { return this.values.get(key); }
    async put(key, value) { this.values.set(key, value); }
    async delete(key) { this.values.delete(key); }
    async getAlarm() { return this.alarm; }
    async setAlarm(value) { this.alarm = value; }
    async deleteAlarm() { this.alarm = null; }
}

const capsule = (overrides = {}) => ({
    enabled: true, characterId: 'char-1', characterName: '角色', messages: [],
    credentialMode: 'stored_client_key', apiKey: 'test-key',
    apiUrl: 'https://api.example.com/v1/chat/completions', model: 'test-model',
    contextRevision: 1, policy: { heartbeatHours: 12 }, ...overrides
});

test('用户活动只更新时刻，旧快照不会覆盖新回复', async () => {
    const storage = new MemoryStorage();
    const object = new ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    const sync = (revision, content) => object.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'PUT', body: JSON.stringify(capsule({ contextRevision: revision,
            messages: [{ messageId: `message_${revision}`, role: 'assistant', content, eventAt: revision }] }))
    }));
    await sync(10, '最新回复');
    await object.fetch(new Request('https://worker.local/proactive/object/activity', {
        method: 'POST', body: JSON.stringify({ lastUserAt: 1000, lastChatAt: 1000 })
    }));
    await sync(9, '过时回复');
    const saved = await storage.get('capsule');
    assert.equal(saved.messages[0].content, '最新回复');
    assert.equal(saved.lastUserAt, 1000);
    assert.equal(saved.lastChatAt, 1000);
});

test('后台回复和主动发言无需前端重开，也能进入下一次判断', async () => {
    const storage = new MemoryStorage();
    const object = new ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    await object.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'PUT', body: JSON.stringify(capsule())
    }));
    await object.fetch(new Request('https://worker.local/proactive/append-chat-reply', {
        method: 'POST', body: JSON.stringify({ messageId: 'job_123', content: '<think>隐藏</think>刚回答过', eventAt: Date.now() - 1000 })
    }));
    const requests = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
        requests.push(JSON.parse(options.body));
        return Response.json({ choices: [{ message: { content: JSON.stringify({
            decision: requests.length === 1 ? 'send' : 'silent',
            content: requests.length === 1 ? '我再联系你' : '',
            sent_at: new Date().toISOString(), next_wake_at: null
        }) } }] });
    };
    try {
        const run = () => object.fetch(new Request('https://worker.local/proactive/object/run', {
            method: 'POST', body: JSON.stringify(capsule())
        }));
        await run();
        await run();
        const context = requests[1].messages[1].content;
        assert.match(context, /刚回答过/);
        assert.match(context, /我再联系你/);
        assert.doesNotMatch(context, /隐藏/);
        const pending = await storage.get('pendingMessages');
        assert.equal(pending.length, 2);
        await object.fetch(new Request('https://worker.local/proactive/object/sync', {
            method: 'PUT', body: JSON.stringify(capsule({
                contextRevision: 2, messages: [pending[1]],
                acknowledgedMessageIds: [pending[0].messageId]
            }))
        }));
        assert.deepEqual(await storage.get('pendingMessages'), []);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('普通后台 job 完成时直接补入对应主动角色对象', async () => {
    const storages = new Map();
    const env = {
        APP_TOKEN: 'worker-token',
        CHAT_JOB_OBJECT: {
            idFromName: name => name,
            get: name => {
                if (!storages.has(name)) storages.set(name, new MemoryStorage());
                return { fetch: (input, options) => new ChatJobObject({ storage: storages.get(name) }, env)
                    .fetch(input instanceof Request ? input : new Request(input, options)) };
            }
        }
    };
    const proactive = env.CHAT_JOB_OBJECT.get('proactive:install:char-1');
    await proactive.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'PUT', body: JSON.stringify(capsule())
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ choices: [{ message: {
        reasoning_content: '不会进主动上下文', content: '已经回答了你的问题'
    } }] });
    try {
        await runJob('job-123', {
            upstream: { id: 'test', url: 'https://api.example.com/v1/chat/completions', apiKey: 'test-key' },
            messages: [{ role: 'user', content: '问题' }], model: 'test-model',
            temperature: 1, max_tokens: 100, request_body_extra: {}, ttlSeconds: 3600,
            proactiveObjectName: 'install:char-1'
        }, env);
        const pending = await storages.get('proactive:install:char-1').get('pendingMessages');
        assert.equal(pending[0].messageId, 'job_job-123');
        assert.equal(pending[0].content, '已经回答了你的问题');
        const job = await storages.get('job-123').get('job');
        assert.equal(job.status, 'done');
    } finally {
        globalThis.fetch = originalFetch;
    }
});
