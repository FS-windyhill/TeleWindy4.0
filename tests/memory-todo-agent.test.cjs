// 记忆与 TODO 回归：验证断聊补足日期、旧任务定位，以及长文本批量改期不会被截断。
// 运行：node --test tests/memory-todo-agent.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function harness() {
    const STATE = { todoPlans: [], settings: { AGENT_TODO_MANAGER_ENABLED: true } };
    const context = vm.createContext({ STATE, Date, console: { log() {}, warn() {}, groupCollapsed() {}, groupEnd() {} } });
    for (const file of ['js/character-memory.js', 'js/agent-todo-manager.js']) vm.runInContext(read(file), context);
    return { STATE, context, memory: vm.runInContext('CharacterMemory', context), manager: vm.runInContext('AgentTodoManager', context) };
}
function methods(context, names) {
    const source = read('script.js');
    return vm.runInContext('({' + names.map(([start, end]) => {
        const a = source.indexOf(start);
        const b = source.indexOf(end, a);
        assert.ok(a >= 0 && b > a);
        return source.slice(a, b);
    }).join('\n') + '})', context);
}

test('最近三个非空记忆日期：跳过断聊、空白文本，长期记住额外保留且不重复', () => {
    const { memory } = harness();
    const records = [
        { dateKey: '2026-11-01', memories: [{ text: '长期记忆', alwaysInject: true }, '普通旧记忆'] },
        ...['06', '07', '08'].map(day => ({ dateKey: `2026-11-${day}`, memories: [`记忆${day}`] })),
        { dateKey: '2026-11-11', memories: [] },
        { dateKey: '2026-11-12', memories: [' ', { text: '' }, null] },
        { dateKey: '2026-11-14', memories: ['今天'] },
        { dateKey: '2026-11-15', memories: ['未来'] }
    ];
    const result = memory.getInjectRecords({ enabled: true, injectDays: 3, records }, new Date(2026, 10, 14));
    assert.deepEqual(Array.from(result, r => r.dateKey), ['2026-11-01', '2026-11-06', '2026-11-07', '2026-11-08']);
    assert.equal(result[0].memories.length, 1);
    assert.equal(records[0].memories.length, 2); // 注入筛选不改原始数据。
    assert.equal(memory.getInjectRecords({ enabled: true, injectDays: 10, records }, new Date(2026, 10, 14)).length, 4);
    assert.equal(memory.getInjectRecords({ enabled: false, records }).length, 0);
});

test('近期待办超过80项仍完整保留，ID 不被复述名称或猜测日期筛掉，无效 ID 不猜目标', () => {
    const { STATE, manager } = harness();
    STATE.todoPlans = Array.from({ length: 100 }, (_, i) => ({ id: `id${i}`, text: `旧任务${i}`, dateKey: '2026-11-06' }));
    assert.equal(manager.buildTodoSnapshot(new Date(2026, 10, 14)).length, 100);
    assert.equal(manager.findTodoCandidates({ action: 'complete', targetTodoId: 'id0', targetText: '另一种说法', dateKey: '2026-11-14' })[0].id, 'id0');
    assert.equal(manager.findTodoCandidates({ action: 'complete', targetTodoId: 'missing', targetText: '旧任务0' }).length, 0);
    STATE.todoPlans[0].done = true;
    assert.equal(manager.findTodoCandidates({ action: 'complete', targetTodoId: 'id0' }).length, 0);
    STATE.todoPlans[0].cancelled = true;
    assert.equal(manager.findTodoCandidates({ action: 'restore', targetTodoId: 'id0' }).length, 1);
});

test('长段自然语言意图完整送达 API，十项改期全部进入确认条，歧义和未找到逐项保留', async () => {
    const { STATE, context, manager } = harness();
    STATE.todoPlans = Array.from({ length: 10 }, (_, i) => ({ id: `id${i}`, text: `任务${i}`, dateKey: '2026-11-01' }));
    STATE.todoPlans.push({ id: 'same1', text: '同名任务', dateKey: '2026-11-02' }, { id: 'same2', text: '同名任务', dateKey: '2026-11-03' });
    const operations = STATE.todoPlans.slice(0, 10).map(item => ({ action: 'reschedule', targetTodoId: item.id, newDateKey: '2026-11-20' }));
    operations.push({ action: 'complete', targetText: '同名任务' }, { action: 'complete', targetText: '不存在的任务' });
    const longIntent = '请把下列十个任务全部改到11月20日：' + STATE.todoPlans.slice(0, 10).map(item => `${item.text}，原因是${'需要调整时间安排'.repeat(8)}`).join('；');
    assert.ok(longIntent.length > 200);
    let apiInput;
    context.API = { async chat(messages) { apiInput = messages; return JSON.stringify({ intent: 'MANAGE_TODO', operations }); } };
    const app = methods(context, [
        ['    normalizeAgentPostTodoSuggestions(', '    buildTodoPatchFromOperation('],
        ['    buildTodoPatchFromOperation(', '    getAgentTodoOperationVerb('],
        ['    getAgentTodoOperationVerb(', '    buildAgentTodoOperationLabel('],
        ['    async runAgentTodoIntentOperations(', '    async runAgentHeartNoteIntentOperations(']
    ]);
    let state;
    let shown;
    Object.assign(app, {
        buildTodoDuplicateKey(text, date) { return `${date}:${text}`; },
        getAgentExecutionState() { return state; },
        async setAgentExecutionState(contact, message, type, value) { state = value; },
        buildAgentTodoManagerRequestSettings() { return { API_URL: 'mock', API_KEY: 'mock', MODEL: 'mock' }; },
        showAgentPostTodoSuggestionNotice(contact, message, suggestions) { shown = suggestions; },
        showTodoTopNotice() {}
    });
    await app.runAgentTodoIntentOperations({ name: '角色' }, [longIntent], {});
    assert.ok(apiInput[1].content.includes(longIntent));
    assert.equal(state.status, 'suggested');
    assert.equal(shown.length, 10);
    assert.ok(shown.every(item => item.patch.dateKey === '2026-11-20'));
    assert.equal(state.failures.length, 2);
    assert.match(state.failures[0], /目标不唯一.*2026-11-02.*2026-11-03/);
    assert.match(state.failures[1], /未找到/);
    assert.equal(STATE.todoPlans[0].dateKey, '2026-11-01'); // 解析只提建议，等待原有确认流程。
    const messages = manager.buildExecutorMessages({}, '改期任务');
    assert.match(messages[0].content, /原日期/);
});
// 候选范围回归：历史数据保留在本地，按本轮任务点名补入，候选筛选不截断批量数量。
test('默认排除上古及已完成记录，点名、引号片段和明确全量请求按需补入', () => {
    const { STATE, manager } = harness();
    STATE.todoPlans = [
        { id: 'recent', text: '最近待办', dateKey: '2026-11-06' },
        { id: 'future', text: '未来待办', dateKey: '2026-12-01' },
        { id: 'ancient', text: '整理旧相册', dateKey: '2026-01-01' },
        { id: 'finished', text: '已经写完的论文', dateKey: '2026-11-01', done: true },
        { id: 'cancelled', text: '取消的行程', dateKey: '2026-11-01', cancelled: true }
    ];
    const now = new Date(2026, 10, 14);
    const ids = intent => Array.from(manager.buildTodoSnapshot(now, intent), item => item.id);
    assert.deepEqual(ids('新增买菜'), ['recent', 'future']);
    assert.ok(ids('完成整理旧相册').includes('ancient'));
    assert.ok(ids('把“旧相册”改到明天').includes('ancient'));
    assert.ok(ids('恢复 cancelled').includes('cancelled'));
    assert.ok(ids('将所有未完成任务改到明天').includes('ancient'));
    assert.ok(!ids('将所有未完成任务改到明天').includes('finished'));
    assert.ok(!ids('将所有未完成任务改到明天').includes('cancelled'));
    assert.ok(ids('恢复所有已取消的任务').includes('cancelled'));
    assert.equal(STATE.todoPlans.length, 5);
    const prompt = manager.buildExecutorMessages({}, '完成整理旧相册', now)[1].content;
    assert.ok(prompt.includes('ancient'));
    assert.ok(!prompt.includes('finished'));
});

// ★ 十天边界：11 月 14 日默认能看到 11 月 4 日，11 月 3 日则须按需点名补入。
test('默认候选仅回看十天，边界外任务仍可点名召回', () => {
    const { STATE, manager } = harness();
    STATE.todoPlans = [
        { id: 'boundary', text: '边界待办', dateKey: '2026-11-04' },
        { id: 'older', text: '更早待办', dateKey: '2026-11-03' }
    ];
    const now = new Date(2026, 10, 14);
    assert.deepEqual(Array.from(manager.buildTodoSnapshot(now), item => item.id), ['boundary']);
    assert.ok(manager.buildTodoSnapshot(now, '完成更早待办').some(item => item.id === 'older'));
});
