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
    await stats.render();
    assert.equal((root.innerHTML.match(/class="usage-card usage-metric-card"/g) || []).length, 1);
    assert.equal((root.innerHTML.match(/data-metric=/g) || []).length, 3);
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
