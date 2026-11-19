import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// ★ 直接调用实际构造函数，覆盖同步后数小时再唤醒、跨天以及本地页面的时间边界。
const source = await readFile(new URL('../backend/worker.js', import.meta.url), 'utf8');
const worker = await import(`data:text/javascript;base64,${Buffer.from(source + '\nexport { sanitizeProactiveCapsule, buildProactiveDecisionMessages };').toString('base64')}`);
const raw = {
    timezone: 'Asia/Shanghai', policy: { heartbeatHours: 16 }, messages: [],
    characterSchedule: { enabled: true, dateKey: '2026-11-19', entries: [
        { start: '00:00', end: '08:00', text: '睡觉' },
        { start: '08:00', end: '12:00', text: '工作' },
        { start: '12:00', end: '24:00', text: '休息' }
    ] }
};
test('后台按唤醒时当地时间选取日程，并把16小时上限展示为跨日日期', () => {
    const capsule = worker.sanitizeProactiveCapsule(raw);
    const messages = worker.buildProactiveDecisionMessages(capsule, {}, Date.parse('2026-11-19T08:00:00+08:00'));
    assert.match(messages[1].content, /当前：08:00-12:00 工作/);
    assert.match(messages[1].content, /上一段：00:00-08:00 睡觉/);
    assert.match(messages[1].content, /下一段：12:00-24:00 休息/);
    assert.match(messages[0].content, /下一次判断最晚时间：2026-11-20 00:00/);
    assert.match(messages[0].content, /next_check_in_minutes/);
    const later = worker.buildProactiveDecisionMessages(capsule, {}, Date.parse('2026-11-19T12:00:00+08:00'));
    assert.match(later[1].content, /当前：12:00-24:00 休息/);
    const tomorrow = worker.buildProactiveDecisionMessages(capsule, {}, Date.parse('2026-11-20T08:00:00+08:00'));
    assert.doesNotMatch(tomorrow[1].content, /角色当前日程/);
    capsule.characterSchedule.enabled = false;
    assert.doesNotMatch(worker.buildProactiveDecisionMessages(capsule, {}, Date.parse('2026-11-19T08:00:00+08:00'))[1].content, /角色当前日程/);
});

test('页面高亮按当天时间切换，过期日程清除金框', async () => {
    const app = await readFile(new URL('../script.js', import.meta.url), 'utf8');
    const scheduleSource = await readFile(new URL('../js/character-schedule.js', import.meta.url), 'utf8');
    const state = { currentScheduleContactId: 'c', characterSchedules: [{ charId: 'c', ...raw.characterSchedule }] };
    const rows = raw.characterSchedule.entries.map(() => ({ classList: { toggle(_name, active) { this.active = active; } } }));
    let now = new Date(2026, 10, 19, 8, 0);
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } }
    const context = vm.createContext({ STATE: state, Date: Clock, document: { querySelectorAll: () => rows } });
    vm.runInContext(scheduleSource, context);
    const body = app.match(/    updateCharacterScheduleHighlight\(\) \{([\s\S]*?)\n    \},/)[1];
    const update = vm.runInContext(`(function () {${body}\n})`, context);
    update();
    assert.deepEqual(rows.map(row => row.classList.active), [false, true, false]);
    now = new Date(2026, 10, 19, 12, 0); update();
    assert.deepEqual(rows.map(row => row.classList.active), [false, false, true]);
    now = new Date(2026, 10, 20, 12, 0); update();
    assert.deepEqual(rows.map(row => row.classList.active), [false, false, false]);
});
