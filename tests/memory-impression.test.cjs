// ★ 记忆印象回归：验证五个真实记忆日、全量重生成、并发快照和失败时的正文/进度保护。
// 运行：node --test tests/memory-impression.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
    const nodes = new Map();
    const element = id => {
        if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', hidden: false, disabled: false, checked: false,
            classList: { add() {}, remove() {} }, focus() {}, addEventListener() {} });
        return nodes.get(id);
    };
    const contact = { id: 'char1', name: '测试角色', prompt: '温柔独立，尊重对方。' };
    const STATE = { contacts: [contact], characterMemories: [], momentsSettings: { username: '小雨' } };
    const requests = [];
    const alerts = [];
    const logs = [];
    let saves = 0;
    const context = vm.createContext({ STATE, Date, Map, console: { warn() {},
        info: (...args) => logs.push(args), error: (...args) => logs.push(args), log: (...args) => logs.push(args) },
        document: { getElementById: element }, alert: text => alerts.push(text),
        App: { buildMemoryRequestSettings: () => ({ API_URL: 'mock', API_KEY: 'mock', MODEL: 'mock', COUNT_AS_INTERACTION: false }) },
        Storage: { async saveCharacterMemories() { saves++; } },
        API: { async chat(messages, settings) { requests.push({ messages, settings }); return '{"changed":true,"text":"我们之间逐渐建立了信任。"}'; } }
    });
    for (const name of ['character-memory', 'memory-impression']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
    }
    const memory = vm.runInContext('CharacterMemory.ensureMemory("char1")', context);
    const helper = vm.runInContext('CharacterMemory', context);
    const impression = vm.runInContext('MemoryImpression', context);
    memory.enabled = true;
    const value = impression.ensure(memory);
    const add = (day, text = `经历${day}`) => memory.records.push({ dateKey: `2020-01-${String(day).padStart(2, '0')}`, memories: [text] });
    return { context, STATE, contact, memory, value, helper, impression, add, requests, alerts, logs, element, saves: () => saves };
}

test('仅累计今天以前非空且合法的不同日期，重复条目合并，同一天五条仍算一天', () => {
    const h = setup();
    h.add(1);
    h.add(1, '同一天另一条');
    h.add(3, ' ');
    h.memory.records.push({ dateKey: '2020-02-30', memories: ['无效日期'] },
        { dateKey: '2020-01-10', memories: ['当天'] }, { dateKey: '2020-01-11', memories: ['未来'] });
    const result = h.impression.snapshot(h.memory, new Date(2020, 0, 10));
    assert.equal(result.length, 1);
    assert.equal(result[0].texts.length, 2);
    h.value.processed[result[0].dateKey] = result[0].fingerprint;
    assert.equal(h.impression.pending(h.memory, new Date(2020, 0, 10)).length, 0);
    h.memory.records[0].memories[0] = '后来手动修正';
    assert.equal(h.impression.pending(h.memory, new Date(2020, 0, 10)).length, 1);
});

test('跨过空白月不增加计数，五个新记忆日才自动更新，重复检查只调用一次', async () => {
    const h = setup();
    h.value.text = '旧印象';
    [1, 4, 9, 17].forEach(day => h.add(day));
    h.impression.schedule('char1');
    await h.impression.queue;
    assert.equal(h.requests.length, 0);
    h.add(26);
    h.impression.schedule('char1');
    h.impression.schedule('char1');
    await h.impression.queue;
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].settings.COUNT_AS_INTERACTION, false);
    assert.equal(h.impression.pending(h.memory).length, 0);
});

test('未初始化或关闭的印象不自动产生请求，关闭角色记忆也停止自动归纳', async () => {
    const h = setup();
    [1, 2, 3, 4, 5].forEach(day => h.add(day));
    h.impression.schedule('char1');
    await h.impression.queue;
    assert.equal(h.requests.length, 0);
    h.value.text = '旧印象';
    h.value.enabled = false;
    h.impression.schedule('char1');
    h.value.enabled = true;
    h.memory.enabled = false;
    h.impression.schedule('char1');
    await h.impression.queue;
    assert.equal(h.requests.length, 0);
});

test('重新生成覆盖全部记忆并发送角色设定，称呼不取朋友圈昵称', async () => {
    const h = setup();
    h.add(1, '很早以前的经历');
    h.value.text = '不满意的旧印象';
    h.value.processed['2020-01-01'] = h.impression.snapshot(h.memory)[0].fingerprint;
    h.add(15, '开始使用以后新增的经历');
    assert.equal(await h.impression.generate('char1', { full: true }), true);
    const messages = h.requests[0].messages;
    assert.match(messages[0].content, /温柔独立/);
    assert.doesNotMatch(messages[0].content, /小雨/);
    assert.match(messages[0].content, /称呼沿用角色人设或记忆/);
    assert.match(messages[1].content, /很早以前的经历/);
    assert.match(messages[1].content, /开始使用以后新增的经历/);
    assert.doesNotMatch(JSON.stringify(messages), /不满意的旧印象/);
    assert.equal(h.impression.pending(h.memory).length, 0);
    assert.equal(h.value.previous.text, '不满意的旧印象');
});

test('立即更新不用等满五日，不修改仍推进进度，保持正文更新时间和恢复版本', async () => {
    const h = setup();
    h.add(1, '已经处理');
    h.value.text = '有效的手动印象';
    h.value.updatedAt = '2020-01-02T00:00:00Z';
    h.value.previous = { text: '上一版' };
    h.value.processed['2020-01-01'] = h.impression.snapshot(h.memory)[0].fingerprint;
    h.add(2, '新的一天');
    h.context.API.chat = async messages => {
        assert.match(messages[1].content, /有效的手动印象/);
        assert.match(messages[1].content, /新的一天/);
        assert.doesNotMatch(messages[1].content, /已经处理/);
        return '{"changed":false}';
    };
    assert.equal(await h.impression.generate('char1'), true);
    assert.equal(h.value.text, '有效的手动印象');
    assert.equal(h.value.updatedAt, '2020-01-02T00:00:00Z');
    assert.equal(h.value.previous.text, '上一版');
    assert.ok(h.value.checkedAt);
    assert.equal(h.impression.pending(h.memory).length, 0);
    const saves = h.saves();
    assert.equal(await h.impression.generate('char1'), false);
    assert.equal(h.saves(), saves);
    assert.match(h.alerts.at(-1), /暂无新记忆/);
});

test('请求期间新增和改动的记忆仍待处理，同角色不并发生成', async () => {
    const h = setup();
    h.add(1);
    h.value.text = '旧印象';
    let release;
    h.context.API.chat = () => new Promise(resolve => { release = resolve; });
    const first = h.impression.generate('char1', { full: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(await h.impression.generate('char1'), false);
    h.add(2);
    h.memory.records[0].memories[0] = '生成期间修改';
    release('{"changed":true,"text":"新印象"}');
    assert.equal(await first, true);
    assert.equal(h.impression.pending(h.memory).length, 2);
});

test('失败、无效 JSON 或空正文不覆盖已有印象和进度，锁释放后允许手动重试', async () => {
    const h = setup();
    h.add(1);
    h.value.text = '旧印象';
    h.value.processed.old = '保留进度';
    for (const output of ['错误内容', '{"changed":true,"text":" "}', '{"changed":false}']) {
        h.context.API.chat = async () => output;
        assert.equal(await h.impression.generate('char1', { full: true }), false);
        assert.equal(h.value.text, '旧印象');
        assert.equal(h.value.processed.old, '保留进度');
        assert.equal(h.impression.jobs.size, 0);
    }
    h.context.API.chat = async () => '{"changed":true,"text":"重试成功"}';
    assert.equal(await h.impression.generate('char1', { full: true }), true);
});

test('保存失败回滚正文和已处理进度，不把失败的一批记为成功', async () => {
    const h = setup();
    h.add(1);
    h.value.text = '原正文';
    h.context.Storage.saveCharacterMemories = async () => { throw new Error('磁盘已满'); };
    assert.equal(await h.impression.generate('char1'), false);
    assert.equal(h.value.text, '原正文');
    assert.equal(h.impression.pending(h.memory).length, 1);
    assert.match(h.value.error, /磁盘已满/);
});

test('生成过程中关闭开关，自动归纳不再覆盖；关闭时仍允许手动生成', async () => {
    const h = setup();
    [1, 2, 3, 4, 5].forEach(day => h.add(day));
    h.value.text = '原正文';
    h.context.API.chat = async () => { h.value.enabled = false; return '{"changed":true,"text":"自动结果"}'; };
    assert.equal(await h.impression.generate('char1', { automatic: true }), false);
    assert.equal(h.value.text, '原正文');
    assert.equal(h.impression.pending(h.memory).length, 5);
    assert.equal(await h.impression.generate('char1'), true);
    assert.equal(h.value.text, '自动结果');
    assert.equal(h.value.enabled, false);
});

test('长资料分批覆盖全部输入，先提炼事实，再把所有分批材料交给最终归纳', async () => {
    const h = setup();
    for (let day = 1; day <= 20; day++) h.add(day, `批次标记${day}：` + '长期相处经历'.repeat(180));
    const evidenceInputs = [];
    let finalInput;
    h.context.API.chat = async messages => {
        if (messages[0].content.includes('这是分批提炼阶段')) {
            evidenceInputs.push(messages[1].content);
            assert.match(messages[0].content, /温柔独立/);
            return JSON.stringify({ evidence: `第${evidenceInputs.length}批事实，保留关系变化。` });
        }
        finalInput = messages[1].content;
        return '{"changed":true,"text":"完整资料形成的印象"}';
    };
    assert.equal(await h.impression.generate('char1', { full: true }), true);
    assert.ok(evidenceInputs.length > 1);
    const joined = evidenceInputs.join('');
    for (let day = 1; day <= 20; day++) assert.ok(joined.includes(`批次标记${day}：`));
    evidenceInputs.forEach((_, index) => assert.ok(finalInput.includes(`第${index + 1}批事实`)));
    assert.equal(h.impression.pending(h.memory).length, 0);
});

test('恢复上一版与手动编辑只改变正文，保留进度；后续增量以编辑后的正文为基础', async () => {
    const h = setup();
    h.add(1);
    await h.impression.generate('char1');
    h.impression.contactId = 'char1';
    h.value.previous = { text: '想要恢复的印象' };
    await h.impression.saveEdit(true);
    assert.equal(h.value.text, '想要恢复的印象');
    assert.equal(h.impression.pending(h.memory).length, 0);
    h.element('memory-impression-editor').value = '用户亲手编辑';
    await h.impression.saveEdit();
    assert.equal(h.value.text, '用户亲手编辑');
    assert.equal(h.impression.pending(h.memory).length, 0);
    h.add(2);
    h.context.API.chat = async messages => {
        assert.match(messages[1].content, /用户亲手编辑/);
        return '{"changed":false}';
    };
    assert.equal(await h.impression.generate('char1'), true);
    assert.equal(h.value.text, '用户亲手编辑');
});

test('印象排在普通记忆前，无近期条目也能注入；关闭印象仅移除印象', () => {
    const h = setup();
    h.value.text = '相处留下的长期影响';
    h.add(1);
    let prompt = h.helper.buildChatPrompt('char1');
    assert.ok(prompt.indexOf('[记忆印象]') < prompt.indexOf('[2020-01-01]'));
    h.value.enabled = false;
    prompt = h.helper.buildChatPrompt('char1');
    assert.doesNotMatch(prompt, /相处留下的长期影响/);
    assert.match(prompt, /经历1/);
    h.value.enabled = true;
    h.memory.records = [];
    assert.match(h.helper.buildChatPrompt('char1'), /相处留下的长期影响/);
    h.memory.enabled = false;
    assert.equal(h.helper.buildChatPrompt('char1'), '');
});

test('自动失败的一批在本次打开期间不反复消耗请求，手动更新仍可重试', async () => {
    const h = setup();
    [1, 2, 3, 4, 5].forEach(day => h.add(day));
    h.value.text = '原正文';
    let calls = 0;
    h.context.API.chat = async () => { calls++; throw new Error('网络失败'); };
    h.impression.schedule('char1');
    await h.impression.queue;
    h.impression.schedule('char1');
    await h.impression.queue;
    assert.equal(calls, 1);
    assert.equal(h.impression.pending(h.memory).length, 5);
    await h.impression.generate('char1');
    assert.equal(calls, 2);
});

// ★ F12 诊断覆盖最终归纳、分批提炼及接口层失败；日志不能夹带请求配置里的密钥。
test('JSON 后出现多余内容时打印完整原文与最终归纳阶段，旧印象和进度不变', async () => {
    const h = setup();
    h.add(1);
    h.value.text = '已有印象';
    const raw = '{"changed":true}，这是解释。{"text":"另一个对象"}';
    h.context.API.chat = async () => raw;
    assert.equal(await h.impression.generate('char1'), false);
    const failure = h.logs.find(args => args[0] === '[记忆印象] 模型返回解析失败');
    assert.equal(failure[1].stage, '最终归纳');
    assert.equal(failure[1].mode, '增量更新');
    assert.ok(h.logs.some(args => args[1] === raw));
    assert.doesNotMatch(JSON.stringify(h.logs), /API_KEY|API_URL/);
    assert.match(h.alerts.at(-1), /F12/);
    assert.equal(h.value.text, '已有印象');
    assert.equal(h.impression.pending(h.memory).length, 1);
});

test('分批返回格式错误时标明失败的层数和批次，并打印完整原文', async () => {
    const h = setup();
    h.add(1, '长期经历'.repeat(3000));
    const raw = '{"evidence":"片段"}额外内容{"另一段":"错误"}';
    h.context.API.chat = async () => raw;
    assert.equal(await h.impression.generate('char1'), false);
    const failure = h.logs.find(args => args[0] === '[记忆印象] 模型返回解析失败');
    assert.equal(failure[1].stage, '分批提炼');
    assert.equal(failure[1].level, 1);
    assert.equal(failure[1].batch, 1);
    assert.equal(failure[1].batches, 2);
    assert.ok(h.logs.some(args => args[1] === raw));
    assert.equal(h.value.text, '');
    assert.equal(h.impression.pending(h.memory).length, 1);
});

test('接口自身失败明确标为请求失败，不误报为模型返回 JSON 错误', async () => {
    const h = setup();
    h.add(1);
    h.context.API.chat = async () => { throw new SyntaxError('接口响应不是 JSON'); };
    assert.equal(await h.impression.generate('char1'), false);
    assert.ok(h.logs.some(args => args[0].includes('API 请求失败')));
    assert.ok(!h.logs.some(args => args[0].includes('模型原始返回')));
    assert.ok(!h.logs.some(args => args[0].includes('模型返回解析失败')));
});

// ★ 模型思考里可能有 JSON 草稿甚至代码围栏，分批与最终归纳都必须只读正式正文。
test('分批提炼剔除 think 内的 JSON 草稿，最终归纳也只保存正式返回', async () => {
    const h = setup();
    h.add(1, '长期经历'.repeat(3000));
    let batches = 0;
    h.context.API.chat = async messages => {
        if (messages[0].content.includes('这是分批提炼阶段')) {
            batches++;
            return '<think>整理材料，下面是草稿：```json\n{"evidence":"不要读取草稿"}\n```检查格式。\n</think>\n'
                + JSON.stringify({ evidence: `第${batches}批正式材料` });
        }
        assert.doesNotMatch(messages[1].content, /不要读取草稿/);
        assert.match(messages[1].content, /第1批正式材料/);
        assert.match(messages[1].content, /第2批正式材料/);
        return '<think>{"changed":false}考虑后应该更新。</think>\n```json\n{"changed":true,"text":"正式印象"}\n```';
    };
    assert.equal(await h.impression.generate('char1'), true);
    assert.equal(h.value.text, '正式印象');
    assert.equal(h.impression.pending(h.memory).length, 0);
});

test('支持多个开头思考块和大小写标签，保留正式 JSON 字符串里的字面标签', () => {
    const h = setup();
    const text = '我们讨论过 <think>示例标签</think>，也展示过 {"key":"value"}。';
    const raw = '<THINK data-source="model">第一段草稿。</THINK>\n<thinking>第二段草稿。</thinking>\n<thought>第三段。</thought>\n'
        + JSON.stringify({ changed: true, text });
    assert.equal(h.impression.parseResult(raw, false).text, text);
});

test('未闭合或只有思考的返回不能读取草稿或推进进度，仍保留原始诊断日志', async () => {
    for (const raw of ['<think>{"changed":true,"text":"截断的草稿"}', '<think>只有思考</think>']) {
        const h = setup();
        h.add(1);
        h.value.text = '原印象';
        h.context.API.chat = async () => raw;
        assert.equal(await h.impression.generate('char1'), false);
        assert.equal(h.value.text, '原印象');
        assert.equal(h.impression.pending(h.memory).length, 1);
        assert.ok(h.logs.some(args => args[1] === raw));
        assert.match(h.value.error, /思考/);
    }
});

// ★ JSON 字符串内直接换行是模型常见偏差，只修复编码，不删除内容或猜测丢失的结构。
test('带 think 和代码围栏的多行 evidence 可解析，所有真实控制字符保留原值', () => {
    const h = setup();
    const evidence = '【基本身份与关系】示例。\n\n【反复出现的模式】\r\n1. 睡眠：示例\t2. 日常：示例\b\f\u0000\u001f';
    const raw = '<think>{"evidence":"草稿"}</think>\n```json\n{"evidence":"' + evidence + '"}\n```';
    assert.equal(h.impression.parseJson(raw).evidence, evidence);
    assert.ok(h.logs.some(args => args[0].includes('已兼容 JSON 字符串')));
});

test('已有转义引号、反斜杠、换行和字符串外排版不重复编码', () => {
    const h = setup();
    const value = '他说"一起走"，路径 C:\\notes\\new；下一行\n继续。';
    const raw = JSON.stringify({ evidence: value }, null, 2);
    assert.equal(h.impression.escapeJsonControls(raw), raw);
    assert.equal(h.impression.parseJson(raw).evidence, value);
    const mixed = '{"evidence":"' + JSON.stringify(value).slice(1, -1) + '\n补充"}';
    assert.equal(h.impression.parseJson(mixed).evidence, value + '\n补充');
});

test('兼容字符串内反斜杠后紧跟真实换行，不影响其余合法转义', () => {
    const h = setup();
    const raw = '{"evidence":"前一段' + '\\' + '\n后一段\\n第三段"}';
    assert.equal(h.impression.parseJson(raw).evidence, '前一段\n后一段\n第三段');
});

test('第二批提炼返回多行 JSON 后仍能完成全量生成，最终正文也支持真实换行', async () => {
    const h = setup();
    h.add(1, '长期经历'.repeat(3000));
    let batch = 0;
    h.context.API.chat = async messages => {
        if (messages[0].content.includes('这是分批提炼阶段')) {
            batch++;
            return '<think>整理事实。</think>\n{"evidence":"第' + batch + '批材料\n\n相处模式"}';
        }
        assert.match(messages[1].content, /第2批材料\n\n相处模式/);
        return '{"changed":true,"text":"她常与我分享日常。\n我们逐渐建立了信任。"}';
    };
    assert.equal(await h.impression.generate('char1'), true);
    assert.equal(h.value.text, '她常与我分享日常。 我们逐渐建立了信任。');
    assert.equal(h.impression.pending(h.memory).length, 0);
});

test('不修复未转义引号、截断结构或多个 JSON 对象，避免误存猜测结果', () => {
    const h = setup();
    for (const raw of ['{"evidence":"他说"你好"\n下一段"}', '{"evidence":"不完整\n',
        '{"evidence":"第一段\n内容"}{"evidence":"第二段"}']) {
        assert.throws(() => h.impression.parseJson(raw));
    }
});
