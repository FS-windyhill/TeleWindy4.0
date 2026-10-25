const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('用量胶囊只展示一张指标卡片，模型与 reroll 各有环形图且费用仍可计算', async () => {
    const root = { innerHTML: '', querySelector: () => ({}) };
    const cost = { textContent: '' };
    const date = '2026-10-24';
    const rows = {
        one: { site: 'https://a.example', model: '模型甲', input: 100, output: 25, chat: true, reroll: false, status: 'done' },
        two: { site: 'https://a.example', model: '模型甲', input: 50, output: 75, chat: true, reroll: true, status: 'done' },
        three: { site: 'https://b.example', model: '模型乙', input: 200, output: 0, chat: false, reroll: false, status: 'done' }
    };
    const prices = {
        [JSON.stringify(['https://a.example', '模型甲'])]: { count: 2 },
        [JSON.stringify(['https://b.example', '模型乙'])]: { count: 3 }
    };
    const context = {
        DB: { get: async key => key.endsWith(':prices') ? prices : rows },
        document: { getElementById: id => id === 'usage-body' ? root : id === 'usage-cost' ? cost : null },
        console
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'usage-stats.js'), 'utf8');
    vm.runInNewContext(`${source}\nglobalThis.stats = UsageStats;`, context);
    const stats = context.stats;
    stats.selected = date;
    stats.workerNotice = 'Worker 用量暂不可读（连接或跨域限制）；本地统计已正常显示。';
    await stats.render();
    assert.match(root.innerHTML, /<div class="usage-week">[\s\S]*?<p class="usage-hint">仅统计本功能启用后的调用。[\s\S]*?<p class="usage-hint">Worker 用量暂不可读（连接或跨域限制）；本地统计已正常显示。<\/p><\/section><section class="usage-card usage-metric-card">/);
    assert.equal((root.innerHTML.match(/class="usage-card usage-metric-card"/g) || []).length, 1);
    assert.equal((root.innerHTML.match(/data-metric=/g) || []).length, 3);
    assert.match(root.innerHTML, /<section class="usage-card usage-metric-card"><h2>输入 token<\/h2><div class="usage-metric-tabs[^\"]*" role="tablist"[^>]*>/);
    assert.equal((root.innerHTML.match(/<svg /g) || []).length, 2);
    assert.ok(!root.innerHTML.includes('<ul>'));
    assert.match(root.innerHTML, /当日 reroll：1 \/ 2 次（50%）/);
    assert.match(cost.textContent, /预估费用：7/);

    const outputTab = { dataset: { metric: 'output' }, hasAttribute: () => false };
    root.onclick({ target: { closest: selector => selector === 'button' ? outputTab : null } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stats.metric, 'output');
    assert.match(root.innerHTML, /(?:今日|当日)总计：<strong>100<\/strong> tokens/);
    assert.equal((root.innerHTML.match(/class="usage-card usage-metric-card"/g) || []).length, 1);
});

test('缓存命中按 token 加权，按量费用区分普通与缓存输入，逐条写入不改旧日账本', async () => {
    const date = '2026-10-24';
    const key = JSON.stringify(['https://a.example', '模型甲']);
    const rows = {
        small: { site: 'https://a.example', model: '模型甲', input: 100, cached: 100, output: 10, status: 'done' },
        large: { site: 'https://a.example', model: '模型甲', input: 900, cached: 0, output: 90, status: 'done' },
        unknown: { site: 'https://a.example', model: '模型甲', input: 200, cached: null, output: 0, status: 'done' }
    };
    const writes = [];
    const root = { innerHTML: '', querySelector: () => ({}) };
    const cost = { textContent: '' };
    const db = {
        get: async name => name.endsWith(':prices') ? { [key]: { input: 2, cached: 0.5, output: 4 } } : rows[name.split(':').at(-1)] || null,
        getByPrefix: async () => rows,
        set: async (name, value) => { writes.push(name); rows[name.split(':').at(-1)] = value; }
    };
    const context = { DB: db, document: { getElementById: id => id === 'usage-body' ? root : id === 'usage-cost' ? cost : null }, console };
    vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '..', 'js', 'usage-stats.js'), 'utf8')}\nglobalThis.stats = UsageStats;`, context);
    const stats = context.stats;
    stats.selected = date;
    stats.mode = 'tokens';
    await stats.render();
    assert.match(root.innerHTML, /当日命中：<strong>10%<\/strong>/);
    assert.match(root.innerHTML, /1 次有输入用量的请求未上报缓存命中/);
    assert.match(cost.textContent, /预估费用：0\.00265/);
    assert.match(cost.textContent, /未上报缓存的输入按普通价估算/);
    const claudeUsage = stats.usage({ input_tokens: 50, cache_read_input_tokens: 100, cache_creation_input_tokens: 25, output_tokens: 5 });
    assert.equal(claudeUsage.input, 175);
    assert.equal(claudeUsage.cacheWrite, 25);
    const ref = stats.start({ site: 'https://a.example', model: '模型甲' }, 'new', date);
    await stats.queue;
    stats.finish(ref, { usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 30 } });
    await stats.queue;
    assert.equal(rows.new.cached, 30);
    assert.ok(writes.every(name => name.startsWith('TW_USAGE_V2:entry:')));
});

test('异步 job 把主回复、Agent 和识图用量分别归入对应模型，重复完成不增加记录', async () => {
    const saved = new Map();
    const context = {
        DB: { get: async key => saved.get(key), set: async (key, value) => saved.set(key, value) },
        document: { getElementById: () => null }, console
    };
    vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '..', 'js', 'usage-stats.js'), 'utf8')}\nglobalThis.stats = UsageStats;`, context);
    const stats = context.stats;
    stats.date = () => '2026-10-24';
    stats.jobStart({ jobId: 'job-one' }, { API_URL: 'https://main.example/chat', MODEL: '主模型' });
    await stats.queue;
    const job = { jobId: 'job-one', status: 'done', usage: { prompt_tokens: 200, completion_tokens: 20, prompt_cache_hit_tokens: 60 },
        agent_usages: [{ site: 'https://agent.example/chat', model: '路由模型', usage: { prompt_tokens: 30, completion_tokens: 4, prompt_cache_hit_tokens: 0 } }],
        vision_usage: { site: 'https://vision.example/chat', model: '视觉模型', usage: { prompt_tokens: 50, completion_tokens: 10 } } };
    stats.jobFinish(job);
    stats.jobFinish(job);
    await stats.queue;
    const entries = [...saved.entries()].filter(([key]) => key.startsWith('TW_USAGE_V2:entry:'));
    assert.equal(entries.length, 3);
    assert.equal(entries.find(([key]) => key.endsWith(':agent:0'))[1].model, '路由模型');
    assert.equal(entries.find(([key]) => key.endsWith(':vision'))[1].input, 50);
    assert.equal(entries.find(([key]) => key.endsWith(':job:job-one'))[1].cached, 60);
});

test('统计页先显示本地用量，再异步补入 Worker 用量', async () => {
    const date = '2026-10-24';
    const root = { innerHTML: '', querySelector: () => ({}) };
    const cost = { textContent: '' };
    const context = {
        DB: { get: async key => key.endsWith(':prices') ? {} : { local: { site: 'https://local.example', model: '本地模型', input: 100, output: 10 } } },
        STATE: { settings: { ASYNC_BACKEND_URL: 'https://worker.example', ASYNC_BACKEND_TOKEN: 'token' }, contacts: [] },
        ProactiveMessages: {},
        document: { getElementById: id => id === 'usage-body' ? root : id === 'usage-cost' ? cost : id === 'view-usage' ? { style: { display: 'flex' } } : null },
        console
    };
    vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '..', 'js', 'usage-stats.js'), 'utf8')}\nglobalThis.stats = UsageStats;`, context);
    const stats = context.stats;
    stats.selected = date;
    let finishWorker;
    const waitWorker = new Promise(resolve => { finishWorker = resolve; });
    stats.workerRows = async () => {
        await waitWorker;
        stats.workerCache.set(date, { at: Date.now(), rows: { remote: { site: 'https://worker.example', model: '后台模型', input: 40, output: 5 } } });
    };
    await stats.render();
    assert.match(root.innerHTML, /本地模型/);
    assert.doesNotMatch(root.innerHTML, /后台模型/);
    const pending = stats.workerPending.get(date);
    finishWorker();
    await pending;
    assert.match(root.innerHTML, /后台模型/);
});

test('旧 Worker 未声明用量能力时只探测一次，不按角色连发请求', async () => {
    const requests = [];
    const context = {
        DB: {}, document: { getElementById: () => null }, console, AbortController, setTimeout, clearTimeout,
        STATE: { settings: { ASYNC_BACKEND_URL: 'https://worker.example', ASYNC_BACKEND_TOKEN: 'token' },
            contacts: Array.from({ length: 15 }, (_, id) => ({ id })) },
        ProactiveMessages: { workerHeaders: () => ({ Authorization: 'Bearer token' }), workerBaseUrl: id => `https://worker.example/proactive/${id}` },
        fetch: async url => { requests.push(url); return { ok: true, json: async () => ({ version: '2026.10.09.1', features: { proactive: true } }) }; }
    };
    vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '..', 'js', 'usage-stats.js'), 'utf8')}\nglobalThis.stats = UsageStats;`, context);
    const stats = context.stats;
    assert.deepEqual(Object.keys(await stats.workerRows('2026-10-24')), []);
    assert.deepEqual(requests, ['https://worker.example/meta']);
});

test('已部署的 2026.10.24.1 Worker 无需新版 feature 标记也能读取用量', async () => {
    const requests = [];
    const context = {
        DB: {}, document: { getElementById: () => null }, console, AbortController, setTimeout, clearTimeout,
        STATE: { settings: { ASYNC_BACKEND_URL: 'https://worker.example', ASYNC_BACKEND_TOKEN: 'token' }, contacts: [{ id: 'one' }] },
        ProactiveMessages: { workerHeaders: () => ({ Authorization: 'Bearer token' }), workerBaseUrl: id => `https://worker.example/proactive/${id}` },
        fetch: async url => {
            requests.push(url);
            return { ok: true, json: async () => url.endsWith('/meta')
                ? { version: '2026.10.24.1', features: { proactive: true } }
                : { rows: { call: { site: 'https://api.example', model: '模型甲', usage: { prompt_tokens: 100, prompt_cache_hit_tokens: 20, completion_tokens: 5 } } } } };
        }
    };
    vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '..', 'js', 'usage-stats.js'), 'utf8')}\nglobalThis.stats = UsageStats;`, context);
    const rows = await context.stats.workerRows('2026-10-24');
    assert.equal(rows['worker:one:call'].cached, 20);
    assert.equal(requests.length, 2);
});
