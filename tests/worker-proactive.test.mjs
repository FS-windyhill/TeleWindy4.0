import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// ★ Worker 文件没有单独的 Node 构建入口；用 data URL 载入 ES module，直接覆盖真实加密与 DO 路由。
const workerSource = await readFile(new URL('../backend/worker.js', import.meta.url), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);

class MemoryStorage {
    constructor() {
        this.values = new Map();
        this.alarm = null;
    }

    async get(key) { return this.values.get(key); }
    async put(key, value) { this.values.set(key, value); }
    async delete(key) { this.values.delete(key); }
    async getAlarm() { return this.alarm; }
    async setAlarm(value) { this.alarm = value; }
    async deleteAlarm() { this.alarm = null; }
}

test('未设置真实 APP_TOKEN 时 Worker 拒绝访问，合法口令可读取版本', async () => {
    const request = (token) => new Request('https://worker.local/meta', {
        headers: { Origin: 'https://795799.xyz', Authorization: `Bearer ${token}` }
    });
    const placeholder = await workerModule.default.fetch(request('replace-with-your-own-long-random-token'), {
        APP_TOKEN: 'replace-with-your-own-long-random-token', ALLOWED_ORIGIN: 'https://795799.xyz'
    });
    assert.equal(placeholder.status, 503);
    assert.equal((await placeholder.json()).error, 'app_token_not_configured');

    const env = { APP_TOKEN: 'real-private-test-token', ALLOWED_ORIGIN: 'https://795799.xyz' };
    const denied = await workerModule.default.fetch(request('wrong-token'), env);
    assert.equal(denied.status, 401);
    const response = await workerModule.default.fetch(request(env.APP_TOKEN), env);
    assert.equal(response.status, 200);
    const metadata = await response.json();
    assert.match(metadata.version, /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
    assert.equal(metadata.protocolVersion, 1);
});

function proactiveCapsule(overrides = {}) {
    return {
        enabled: true,
        characterId: 'char-1',
        characterName: '测试角色',
        messages: [],
        credentialMode: 'stored_client_key',
        apiKey: 'private-test-key',
        apiUrl: 'https://api.example.com/v1/chat/completions',
        model: 'test-model',
        policy: { heartbeatHours: 12 },
        ...overrides
    };
}

test('CHAT_JOB_OBJECT 会加密保存主动消息 Key，状态接口不返回明文', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'long-private-worker-token' });
    const response = await object.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proactiveCapsule())
    }));

    assert.equal(response.status, 200);
    const credential = await storage.get('credential');
    const capsule = await storage.get('capsule');
    assert.ok(credential.ciphertext);
    assert.notEqual(credential.ciphertext, 'private-test-key');
    assert.equal(JSON.stringify(credential).includes('private-test-key'), false);
    assert.equal(Object.hasOwn(capsule, 'apiKey'), false);

    const status = await response.json();
    assert.equal(status.credentialMode, 'stored_client_key');
    assert.equal(JSON.stringify(status).includes('private-test-key'), false);
});

test('停用主动角色会删除凭据和 Alarm，不要求再次提供 Key', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'long-private-worker-token' });
    await object.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proactiveCapsule())
    }));

    const response = await object.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proactiveCapsule({ enabled: false, apiKey: '' }))
    }));

    assert.equal(response.status, 200);
    assert.equal(await storage.get('credential'), undefined);
    assert.equal(await storage.getAlarm(), null);
});

test('Worker 连续未回复时仍使用固定的最短主动间隔', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    await object.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'PUT',
        body: JSON.stringify(proactiveCapsule({ policy: {
            activeStartMinutes: 0, activeEndMinutes: 0,
            minCooldownMinutes: 60, recentChatQuietMinutes: 0,
            unansweredLimit: 2, heartbeatHours: 12
        } }))
    }));
    await storage.put('runtime', {
        lastProactiveGeneratedAt: Date.now() - 90 * 60000,
        unansweredCount: 1,
        dailyCount: 1,
        dailyDateKey: new Date().toISOString().slice(0, 10)
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({
        choices: [{ message: { content: '{"decision":"silent","content":"","sent_at":null,"next_wake_at":null}' } }]
    });
    try {
        await object.alarm();
        const events = await storage.get('events');
        assert.ok(events.some(event => event.code === 'proactive_decision_silent'));
        assert.equal(events.some(event => event.code === 'proactive_prefilter_skipped' && event.reason === 'cooldown'), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('未参与角色手动判断绕过自动开关和预筛选，且不创建 Alarm', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    const response = await object.fetch(new Request('https://worker.local/proactive/object/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proactiveCapsule({
            enabled: false,
            apiUrl: 'http://localhost/invalid',
            policy: { activeStartMinutes: 0, activeEndMinutes: 1, dailyLimit: 1 }
        }))
    }));
    const result = await response.json();
    const events = await storage.get('events');

    assert.equal(result.ok, false);
    assert.notEqual(result.error, 'disabled');
    assert.ok(events.some(event => event.code === 'proactive_manual_started' && event.source === 'manual'));
    assert.ok(events.some(event => event.code === 'proactive_run_failed'));
    assert.equal(await storage.getAlarm(), null);
    assert.equal(await storage.get('capsule'), undefined);
});

test('手动判断得到 silent 时不改变已有自动 Alarm', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    await storage.setAlarm(123456789);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({
        choices: [{ message: { content: '{"decision":"silent","content":"","sent_at":null,"next_wake_at":null}' } }]
    });
    try {
        const response = await object.fetch(new Request('https://worker.local/proactive/object/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proactiveCapsule({ enabled: false }))
        }));
        const result = await response.json();
        assert.equal(result.ok, true);
        assert.equal(result.decision, 'silent');
        assert.equal(await storage.getAlarm(), 123456789);
        assert.equal(await storage.get('capsule'), undefined);
        assert.ok((await storage.get('events')).some(event => event.code === 'proactive_decision_silent'));
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Worker 上下文日志保存实际模型请求体，且不混入状态或明文凭据', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    const originalFetch = globalThis.fetch;
    let sentBody;
    globalThis.fetch = async (_url, options) => {
        sentBody = JSON.parse(options.body);
        return Response.json({ choices: [{ message: { content: '{"decision":"silent","content":"","sent_at":null,"next_wake_at":null}' } }] });
    };
    try {
        const response = await object.fetch(new Request('https://worker.local/proactive/object/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proactiveCapsule({ requestBodyExtra: { top_p: 0.7, secret: 'hidden-extra' } }))
        }));
        assert.equal((await response.json()).ok, true);
        const logResponse = await object.fetch(new Request('https://worker.local/proactive/object/request-log'));
        const { log } = await logResponse.json();
        const loggedBody = JSON.parse(log.content);
        assert.deepEqual(loggedBody.messages, sentBody.messages);
        assert.equal(loggedBody.top_p, sentBody.top_p);
        assert.equal(loggedBody.secret, '[已隐藏]');
        assert.equal(loggedBody.auth_mode, 'client_key');
        assert.equal(log.source, 'Worker');
        assert.equal(JSON.stringify(log).includes('private-test-key'), false);
        assert.equal(JSON.stringify(log).includes('hidden-extra'), false);
        const status = await object.fetch(new Request('https://worker.local/proactive/object/status'));
        assert.equal(JSON.stringify(await status.json()).includes('proactiveRequestLog'), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Worker 每个角色只暂存最近 10 条诊断事件', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ProactiveCharacterObject({ storage }, {});
    for (let index = 0; index < 15; index += 1) await object.appendEvent(`event_${index}`);
    const events = await storage.get('events');
    assert.equal(events.length, 10);
    assert.equal(events[0].code, 'event_5');
});

test('普通后台 job 的 Alarm 仍保持原有过期删除行为', async () => {
    const storage = new MemoryStorage();
    await storage.put('job', { status: 'completed' });
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    await object.alarm();
    assert.equal(await storage.get('job'), undefined);
});

test('主动消息同步的 CORS 预检明确允许 PUT', async () => {
    const origin = 'https://795799.xyz';
    const response = await workerModule.default.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'OPTIONS',
        headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'PUT',
            'Access-Control-Request-Headers': 'authorization,content-type'
        }
    }), {
        ALLOWED_ORIGIN: origin,
        APP_TOKEN: 'worker-token'
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.match(response.headers.get('Access-Control-Allow-Methods') || '', /\bPUT\b/);
});

test('主动消息同步能给只读的 Durable Object 响应添加 CORS 响应头', async () => {
    const origin = 'https://795799.xyz';
    const immutableResponse = await fetch('data:application/json,%7B%22enabled%22%3Atrue%7D');
    assert.throws(() => immutableResponse.headers.set('X-Test', 'value'), TypeError);

    const response = await workerModule.default.fetch(new Request('https://worker.local/proactive/object/sync', {
        method: 'PUT',
        headers: { Origin: origin, Authorization: 'Bearer worker-token' },
        body: '{}'
    }), {
        ALLOWED_ORIGIN: origin,
        APP_TOKEN: 'worker-token',
        CHAT_JOB_OBJECT: {
            idFromName: name => name,
            get: () => ({ fetch: async () => immutableResponse })
        }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.deepEqual(await response.json(), { enabled: true });
});
