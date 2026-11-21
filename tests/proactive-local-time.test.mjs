import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// ★ 直接载入实际 Worker 文件，检查发往模型的主动判断请求，而非只验证格式化函数本身。
const workerSource = await readFile(new URL('../backend/worker.js', import.meta.url), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(workerSource + '\nexport { parseProactiveLocalWakeAt, resolveProactiveWakeAt, formatProactiveLocalTime };').toString('base64')}`);

class MemoryStorage {
    constructor() { this.values = new Map(); }
    async get(key) { return this.values.get(key); }
    async put(key, value) { this.values.set(key, value); }
    async delete(key) { this.values.delete(key); }
    async getAlarm() { return this.alarm ?? null; }
    async setAlarm(value) { this.alarm = value; }
}

test('Worker 使用浏览器时区阅读历史并解析模型选择的具体唤醒时间', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    const eventAt = new Date('2026-09-23T10:15:00+08:00').getTime();
    const originalFetch = globalThis.fetch;
    const wakeText = workerModule.formatProactiveLocalTime(Date.now() + 30 * 60000, { timezone: 'Asia/Shanghai' });
    const expectedWake = Date.parse(wakeText.replace(' ', 'T') + ':00+08:00');
    let sentBody;
    globalThis.fetch = async (_url, options) => {
        sentBody = JSON.parse(options.body);
        return Response.json({ choices: [{ message: { content: JSON.stringify({ decision: 'send', content: '今天忙完了吗？', next_wake_at_local: wakeText }) } }] });
    };
    try {
        const before = Date.now();
        const response = await object.fetch(new Request('https://worker.local/proactive/object/run', {
            method: 'POST',
            body: JSON.stringify({
                enabled: true, characterId: 'char-1', characterName: '测试角色',
                credentialMode: 'stored_client_key', apiKey: 'private-test-key',
                apiUrl: 'https://api.example.com/v1/chat/completions', model: 'test-model',
                timezone: 'Asia/Shanghai', timezoneOffsetMinutes: -480,
                messages: [{ messageId: 'user-1', role: 'user', content: '早上好', eventAt }],
                policy: { heartbeatHours: 12 }
            })
        }));
        const result = await response.json();
        const after = Date.now();
        assert.equal(result.ok, true);
        assert.match(sentBody.messages[1].content, /\[2026-09-23 10:15\] 对方：早上好/);
        assert.doesNotMatch(JSON.stringify(sentBody.messages), /2026-09-23T02:15:00\.000Z/);
        assert.match(sentBody.messages[0].content, /next_wake_at_local/);
        assert.doesNotMatch(sentBody.messages[0].content, /sent_at|next_check_in_minutes|偏移/);
        assert.ok(new Date(result.message.sentAt).getTime() >= before);
        assert.ok(new Date(result.message.sentAt).getTime() <= after);
        assert.equal(result.nextWakeAt, expectedWake);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Worker 按当地日期跨天解析，拒绝无效日期，并识别夏令时缺失或重复时刻', () => {
    const parse = workerModule.parseProactiveLocalWakeAt;
    assert.equal(parse('2026-11-22 00:30', { timezone: 'Asia/Shanghai' }), Date.parse('2026-11-21T16:30:00Z'));
    assert.equal(parse('2026-11-22 00:30', { timezoneOffsetMinutes: -330 }), Date.parse('2026-11-21T19:00:00Z'));
    for (const value of [null, undefined, 30, '', '2026-02-30 12:00', '2026-11-22 24:00', '00:30', '2026-11-22T00:30:00Z']) {
        assert.equal(parse(value, { timezone: 'Asia/Shanghai' }), null, String(value));
    }
    assert.equal(parse('2026-03-08 02:30', { timezone: 'America/New_York' }), null);
    assert.equal(parse('2026-11-01 01:30', { timezone: 'America/New_York' }), Date.parse('2026-11-01T05:30:00Z'));
});

test('Worker 自动判断把有效时间或随机兜底时间写入真实 Alarm 与运行状态', async () => {
    const originalFetch = globalThis.fetch;
    const originalRandom = Math.random;
    try {
        Math.random = () => 0.5;
        for (const valid of [true, false]) {
            const storage = new MemoryStorage();
            const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
            await object.fetch(new Request('https://worker.local/proactive/object/sync', {
                method: 'PUT', body: JSON.stringify({
                    enabled: true, characterId: 'char-1', characterName: '测试角色',
                    credentialMode: 'stored_client_key', apiKey: 'private-test-key',
                    apiUrl: 'https://api.example.com/v1/chat/completions', model: 'test-model',
                    timezone: 'Asia/Shanghai', timezoneOffsetMinutes: -480,
                    policy: { activeStartMinutes: 0, activeEndMinutes: 0, heartbeatHours: 2 }
                })
            }));
            const wakeText = workerModule.formatProactiveLocalTime(Date.now() + (valid ? 30 : 180) * 60000, { timezone: 'Asia/Shanghai' });
            globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({
                decision: 'silent', content: '', next_wake_at_local: wakeText
            }) } }] });
            const before = Date.now();
            await object.alarm();
            const alarm = await storage.getAlarm();
            assert.equal((await storage.get('runtime')).nextWakeAt, alarm);
            if (valid) {
                assert.equal(alarm, Date.parse(wakeText.replace(' ', 'T') + ':00+08:00'));
            } else {
                // ★ 越界时应随机回到窗口中间附近，而不是把模型时间截到窗口末尾。
                assert.ok(alarm > before + 50 * 60000 && alarm < before + 70 * 60000);
            }
        }
    } finally {
        globalThis.fetch = originalFetch;
        Math.random = originalRandom;
    }
});

test('Worker 保留范围内的时间，范围外、漏填和请求期间过期的时间随机兜底', () => {
    const resolve = workerModule.resolveProactiveWakeAt;
    const capsule = { policy: { heartbeatHours: 2 } };
    const requestedAt = Date.parse('2026-11-21T10:00:00Z');
    const now = requestedAt + 10 * 60000;
    const deadline = requestedAt + 2 * 3600000;
    const originalRandom = Math.random;
    try {
        Math.random = () => 0.25;
        assert.equal(resolve(deadline, capsule, requestedAt, now), deadline);
        assert.equal(resolve(now + 60000, capsule, requestedAt, now), now + 60000);
        for (const value of [null, undefined, NaN, now, requestedAt + 60000, deadline + 1]) {
            const wake = resolve(value, capsule, requestedAt, now);
            assert.ok(wake > now && wake < deadline, String(value));
        }
        // ★ 极端慢请求耗尽原窗口时，仍须安排在完成后的新窗口内。
        const finishedAt = deadline + 60000;
        const wake = resolve(deadline, capsule, requestedAt, finishedAt);
        assert.ok(wake > finishedAt && wake < finishedAt + 2 * 3600000);
        Math.random = () => 0;
        assert.equal(resolve(null, capsule, requestedAt, now), now + 1);
        Math.random = () => 1 - Number.EPSILON;
        assert.equal(resolve(null, capsule, requestedAt, now), deadline);
    } finally {
        Math.random = originalRandom;
    }
});
