import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// ★ 直接载入实际 Worker 文件，检查发往模型的主动判断请求，而非只验证格式化函数本身。
const workerSource = await readFile(new URL('../backend/worker.js', import.meta.url), 'utf8');
const workerModule = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);

class MemoryStorage {
    constructor() { this.values = new Map(); }
    async get(key) { return this.values.get(key); }
    async put(key, value) { this.values.set(key, value); }
    async delete(key) { this.values.delete(key); }
    async getAlarm() { return null; }
    async setAlarm() {}
}

test('Worker 使用浏览器时区阅读历史，由程序记录发送时间并计算下次间隔', async () => {
    const storage = new MemoryStorage();
    const object = new workerModule.ChatJobObject({ storage }, { APP_TOKEN: 'worker-token' });
    const eventAt = new Date('2026-09-23T10:15:00+08:00').getTime();
    const originalFetch = globalThis.fetch;
    let sentBody;
    globalThis.fetch = async (_url, options) => {
        sentBody = JSON.parse(options.body);
        return Response.json({ choices: [{ message: { content: '{"decision":"send","content":"今天忙完了吗？","next_check_in_minutes":30}' } }] });
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
        assert.match(sentBody.messages[0].content, /next_check_in_minutes/);
        assert.doesNotMatch(sentBody.messages[0].content, /sent_at|next_wake_at|偏移/);
        assert.ok(new Date(result.message.sentAt).getTime() >= before);
        assert.ok(new Date(result.message.sentAt).getTime() <= after);
        assert.ok(result.nextWakeAt >= before + 30 * 60000);
        assert.ok(result.nextWakeAt <= after + 30 * 60000);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
