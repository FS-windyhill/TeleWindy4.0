// 番茄钟回归检查：使用隔离数据和假时钟，不读写真实浏览器数据库，也不请求 API。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const elements = new Map();
let saved;
const requests = [];
const notices = [];
let viewing = false;
// ★ 提供历史记录渲染所需的最小 DOM，避免测试依赖真实浏览器。
// ★ classList 与事件监听要真的生效：设置弹窗“已打开/未打开”的判断和按钮点击都依赖它们。
const createElement = tagName => {
    const classes = new Set();
    const listeners = {};
    return {
        tagName, value: '', textContent: '', className: '', innerHTML: '', src: '', hidden: false, disabled: false,
        style: {}, children: [],
        classList: {
            add(...names) { names.forEach(name => classes.add(name)); },
            remove(...names) { names.forEach(name => classes.delete(name)); },
            toggle(name, force) {
                const next = force === undefined ? !classes.has(name) : !!force;
                if (next) classes.add(name); else classes.delete(name);
                return next;
            },
            contains(name) { return classes.has(name); }
        },
        addEventListener(type, handler) { (listeners[type] = listeners[type] || []).push(handler); },
        // ★ 直接触发监听器，返回 Promise 以便 await 异步处理。
        fire(type, event = {}) { return Promise.all((listeners[type] || []).map(handler => handler(event))); },
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = [...children]; }
    };
};
const context = vm.createContext({ console, crypto: webcrypto, Date, setInterval: () => {},
    getComputedStyle: () => ({ display: viewing ? 'flex' : 'none' }),
    App: { showTopNotice: (message, options) => notices.push({ message, options }) },
    STATE: { contacts: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }], settings: {} },
    API: { chat: async (messages, settings) => { requests.push({ messages, settings }); return '陪你一起。'; } },
    DB: { set: async (_, data) => { saved = structuredClone(data); } },
    document: { getElementById(id) {
        if (!elements.has(id)) elements.set(id, createElement('div'));
        return elements.get(id);
    }, createElement }
});
for (const name of ['js/config.js', 'js/chat-bubbles.js', 'js/history-visibility.js', 'js/pomodoro.js']) {
    vm.runInContext(fs.readFileSync(name, 'utf8'), context, { filename: name });
}
const p = vm.runInContext('Pomodoro', context);

(async () => {
    p.data = p.normalize(null);
    assert.equal(p.data.minutes, 25);
    assert.equal(p.data.apiPresetIndex, -1);
    assert.equal(p.data.records.length, 0);
    assert.equal(p.data.speeches.length, 0);
    assert.equal(p.normalize({ session: { status: 'running' } }).session, null);
    p.data.contactId = 'a';
    // ★ 后台心跳只允许更新探索入口，不能每秒重绘隐藏的番茄钟页面。
    p.$('pomodoro-time').textContent = '后台不应改动';
    await p.tick(Date.now(), { renderMode: 'indicator' });
    assert.equal(p.$('pomodoro-time').textContent, '后台不应改动');
    p.openPicker();
    assert.equal(p.$('pomodoro-people').children[0].children[1].className, 'model-picker-result-name');
    p.data.minutes = 29;
    elements.get('pomodoro-task') || p.$('pomodoro-task');
    p.$('pomodoro-task').value = '写论文';
    await p.toggle();
    assert.equal(p.data.session.contactId, 'a');
    assert.equal(p.data.session.durationMs, 29 * 60000);
    assert.equal(p.$('pomodoro-end').hidden, false); // 开始后才显示“结束本轮”。
    assert.equal(p.$('pomodoro-stats').textContent, '今天已经完成 0 个番茄');
    await p.toggle();
    assert.equal(p.data.session.status, 'paused');
    const paused = p.remaining();
    assert.equal(p.remaining(Date.now() + 100000), paused);
    await p.toggle();
    assert.equal(p.data.session.status, 'running');
    assert.deepEqual(requests.map(r => r.messages.at(-1).content), ['我开始专注啦！', '我先暂停一下番茄钟～', '我回来继续专注啦！']);
    assert.match(requests[1].messages[0].content, /当前状态：已暂停/);
    assert.match(requests[0].messages[0].content, /今天已完成 0 个番茄/);

    // 刷新恢复时超过截止时间，只结算一轮，并使用原截止时间归属日期。
    const endAt = Date.now() - 5000;
    p.data.session.endAt = endAt;
    p.data = p.normalize(JSON.parse(JSON.stringify(p.data)));
    await p.tick();
    await p.tick();
    assert.equal(p.data.records.length, 1);
    assert.equal(saved.records[0].completedAt, endAt);
    assert.equal(p.data.session.status, 'completed');
    assert.equal(p.$('pomodoro-end').hidden, true); // 完成后恢复为单个开始按钮。
    assert.equal(p.$('pomodoro-stats').textContent, '今天已经完成 1 个番茄');
    p.showHistory();
    const historyGroup = p.$('pomodoro-history-list').children[0];
    assert.equal(historyGroup.className, 'pomodoro-history-date-group');
    assert.equal(historyGroup.children[0].children[1].textContent, '1 个番茄 · 29 分钟');
    assert.equal(historyGroup.children[1].children[0].children[0].textContent, '写论文');
    assert.equal(requests.at(-1).messages.at(-1).content, '我完成了第 1 个番茄！');
    assert.equal(requests.length, 4); // 重复 tick 不会重复请求完成回复。
    assert.equal(notices.length, 1);
    assert.equal(notices[0].message, '番茄钟已完成！');
    assert.equal(notices[0].options.targetView, 'pomodoro');
    assert.equal(saved.hasUnreadCompletion, true);
    p.data = p.normalize(saved); // 刷新后仍保留未读，已完成状态不重发通知。
    await p.tick();
    assert.equal(p.data.hasUnreadCompletion, true);
    assert.equal(notices.length, 1);
    // ★ 只有真的停留在番茄钟页时才清未读；页面不可见时 markRead 不能消费完成态。
    viewing = false;
    await p.markRead();
    assert.equal(p.data.hasUnreadCompletion, true);
    viewing = true;
    await p.markRead();
    assert.equal(saved.hasUnreadCompletion, false);
    viewing = false;
    assert.equal(p.context('b', 'b1').ids.length, 0);
    // 实时状态放在完成记录前；只属于当前陪伴人，暂停不误报进行中。
    const completedSession = p.data.session;
    p.data.session = { ...completedSession, id: 'active', task: '洗澡', status: 'running', endAt: Date.now() + 60000 };
    const combined = p.context('a', 'ongoing');
    assert.equal(combined.prompt, '【番茄钟】\n\n- 对方正在和你进行一个番茄钟：洗澡\n- 对方和你一起完成了一个29分钟的番茄钟：写论文\n\n【你刚才在番茄钟里说过的话】\n\n- “陪你一起。”\n- “陪你一起。”\n- “陪你一起。”');
    assert.equal((combined.prompt.match(/陪你一起。/g) || []).length, 3);
    assert.equal(combined.ids.length, 1); // 仅完成记录进入扣次列表。
    assert.equal(p.context('b', 'other').prompt, '');
    p.data.session.status = 'paused';
    assert.match(p.context('a', 'paused').prompt, /番茄钟已暂停：洗澡/);
    p.data.session.status = 'running';
    p.data.session.endAt = Date.now() - 1;
    assert.doesNotMatch(p.context('a', 'expired').prompt, /正在/);
    p.data.session = completedSession;

    // 直接运行主聊天现有分流代码，验证三种缓存模式中都排在朋友圈之前。
    const chatSource = fs.readFileSync('script.js', 'utf8');
    const routing = chatSource.slice(chatSource.indexOf("        let dynamicContextContent = '';"),
        chatSource.indexOf('        // ★ 多模态只携带本轮原图'));
    assert.ok(routing.length > 100);
    for (const mode of ['auto', 'user', 'system']) {
        const scope = vm.createContext({ requestSettings: { DYNAMIC_CONTEXT_INSERT_MODE: mode },
            routineDynamicContextPrompts: ['日级背景'], volatileDynamicContextPrompts: [combined.prompt, '【近期朋友圈同步(System Info)】'],
            triggeredWorldInfoPrompt: '', worldInfoByType: {}, messagesToSend: [], historyForPayload: [],
            currentUserMessage: { role: 'user', content: 'hi！' } });
        vm.runInContext(routing, scope);
        const message = scope.messagesToSend.find(m => m.content.includes('【番茄钟】'));
        assert.ok(message);
        assert.equal(message.role, mode === 'system' ? 'system' : 'user');
        assert.ok(message.content.indexOf('【番茄钟】') < message.content.indexOf('【近期朋友圈同步(System Info)】'));
        if (mode !== 'system') assert.ok(message.content.indexOf('【系统信息补充END】') < message.content.indexOf('【用户当前消息】'));
    }
    const first = p.context('a', 't1');
    assert.match(first.prompt, /29分钟的番茄钟：写论文/);
    assert.equal(p.data.records[0].remainingTurns, 3); // 构建请求、请求失败均不消费。
    await p.consume(first);
    await p.consume(first); // 前台成功与后台恢复同时到达，仍只扣一次。
    assert.equal(p.data.records[0].remainingTurns, 2);
    await p.consume(p.context('a', 't2'));
    await p.consume(p.context('a', 't3'));
    assert.equal(p.context('a', 't4').ids.length, 0);
    assert.equal(p.context('a', 't3').ids.length, 1); // 第三轮 Reroll 仍看到记录。
    await p.consume(p.context('a', 't3'));
    assert.equal(p.data.records[0].remainingTurns, 0);
    assert.doesNotMatch(p.context('a', 't4').prompt, /你刚才在番茄钟里说过的话/); // 发言与完成记录同时结束注入。

    // 旧记录耗尽后新增番茄独立获得三轮，已发送请求不会消耗后来新增的记录。
    p.data.records.push({ id: 'second', contactId: 'a', task: '喝水', minutes: 3, remainingTurns: 3, consumedTurns: [] });
    await p.consume(first);
    assert.equal(p.data.records[1].remainingTurns, 3);
    assert.match(p.context('a', 't4').prompt, /3分钟的番茄钟：喝水/);
    assert.doesNotMatch(p.context('a', 't4').prompt, /写论文/);

    const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `消息${i}` }));
    history.push({ role: 'system', content: '不应携带' }, { role: 'user', content: '已隐藏', isHidden: true },
        { role: 'assistant', content: '失败提示', isTransientError: true });
    const recent = p.recentMessages({ history });
    assert.equal(recent.length, 6);
    assert.equal(recent[0].content, '消息4');
    assert.equal(recent[5].content, '消息9');
    assert.equal(p.recentMessages({ history: history.slice(0, 2) }).length, 2);
    const state = vm.runInContext('STATE', context);
    state.settings = { MODEL: 'global', API_URL: 'global-url', API_PRESETS: [
        { name: '专注预设', model: 'focus-model', url: 'focus-url', key: 'test-only', temperature: 0.7, max_tokens: 800 }
    ] };
    p.data.apiPresetIndex = 0;
    assert.equal(p.getApiSettings().MODEL, 'focus-model');
    assert.equal(p.getApiSettings().MAX_TOKENS, 800);
    assert.equal(p.getApiSettings().ASYNC_BACKEND_ENABLED, false);
    assert.equal(p.getApiSettings().COUNT_AS_INTERACTION, false); // 番茄钟的高频陪伴请求不进入互动日志。
    p.data.apiPresetIndex = 99;
    assert.equal(p.getApiSettings().MODEL, 'global');
    p.data.apiPresetIndex = 0;
    state.contacts[0].history = history;
    await p.speak();
    const packet = requests.at(-1);
    assert.equal(packet.messages.length, 2); // 番茄钟请求只携带人设状态和本次动作，不携带聊天记录。
    assert.equal(packet.messages[1].role, 'user');
    assert.doesNotMatch(packet.messages.map(message => message.content).join('\n'), /消息[0-9]/);
    assert.equal(packet.settings.MODEL, 'focus-model');

    // 中途结束请求旧版提示词，保留任务上下文，不增加完成记录或红点。
    p.data.session = { ...completedSession, id: 'end-test', status: 'running', endAt: Date.now() + 60000 };
    const countBeforeEnd = p.data.records.length;
    await p.endRound();
    assert.equal(p.data.session, null);
    assert.equal(p.$('pomodoro-end').hidden, true);
    assert.equal(requests.at(-1).messages.at(-1).content, '番茄钟已清零！重新开始吧～');
    assert.match(requests.at(-1).messages[0].content, /当前任务：写论文/);
    assert.match(requests.at(-1).messages[0].content, /本轮已中途结束并清零/);
    assert.equal(requests.at(-1).messages.length, 2);
    assert.equal(p.data.records.length, countBeforeEnd);
    assert.equal(p.data.hasUnreadCompletion, false);
    assert.equal(notices.length, 1);
    // 用户已经在番茄钟页看完成状态时，不留下未读红点。
    viewing = true;
    p.data.session = { ...completedSession, id: 'visible-finish', status: 'running', endAt: Date.now() - 1 };
    await p.tick();
    assert.equal(p.data.hasUnreadCompletion, false);
    assert.equal(notices.length, 2);
    viewing = false;

    // 模拟先开始、再暂停，但开始的网络回复后到达，旧回复不能覆盖暂停回复。
    const pending = [];
    const speechCountBeforeRace = p.data.speeches.length;
    context.API.chat = () => new Promise(resolve => pending.push(resolve));
    const started = p.speak('start');
    const pausedReply = p.speak('pause');
    assert.equal(pending.length, 2);
    pending[1]('暂停回复');
    await pausedReply;
    pending[0]('开始的迟到回复');
    await started;
    assert.equal(p.$('pomodoro-speech').textContent, '暂停回复');
    assert.equal(p.data.speeches.length, speechCountBeforeRace + 1); // 迟到且未展示的回复不会保存。
    assert.equal(p.data.speeches.at(-1).text, '暂停回复');
    assert.equal(p.speaking, false);

    // ★★★★★ 完成态消费 START：00:00 只在“看过之后的再次进入”时重置 ★★★★★
    // ★ 完成通知的陪伴请求挂起，避免异步发言干扰下面“记录/发言不变”的断言。
    context.API.chat = () => new Promise(() => {});
    const resetTask = p.data.task;
    const resetSpeeches = p.data.speeches.length;

    // 场景 1：在番茄钟页完成 → 留在页面仍是 00:00；退出再进重置为设置时长，任务/记录/发言保持。
    viewing = true;
    p.data.session = { id: 'in-page-finish', contactId: 'a', contactName: '甲', task: resetTask,
        durationMs: 29 * 60000, remainingMs: 0, endAt: Date.now() - 1, status: 'running' };
    await p.tick();
    assert.equal(p.data.hasUnreadCompletion, false);       // 完成瞬间就在页面 = 已经看过
    assert.equal(p.$('pomodoro-time').textContent, '00:00');
    const resetRecords = p.data.records.length;
    assert.ok(saved.records.some(r => r.id === 'in-page-finish')); // 完成记录先落库
    await p.enterView();
    assert.equal(p.data.session, null);
    assert.equal(saved.session, null);
    assert.equal(p.$('pomodoro-time').textContent, '29:00'); // 回到设置时长，从头开始
    assert.equal(p.$('pomodoro-toggle').textContent, '开始专注');
    assert.equal(p.$('pomodoro-status').textContent, '准备开始');
    assert.equal(p.data.task, resetTask);
    assert.equal(p.$('pomodoro-task').value, resetTask);   // 专注内容保持原样
    assert.equal(p.data.records.length, resetRecords);
    assert.equal(saved.records.length, resetRecords);
    assert.equal(saved.records.some(r => r.id === 'in-page-finish'), true); // 重置不删除完成记录
    assert.equal(p.data.speeches.length, resetSpeeches);
    assert.equal(saved.speeches.length, resetSpeeches);
    assert.equal(saved.minutes, 29);
    assert.equal(saved.contactId, 'a');
    assert.equal(saved.apiPresetIndex, 0);
    assert.equal(saved.hasUnreadCompletion, false);

    // 场景 2：不在页面上完成（探索红点）→ 第一次进入仍展示 00:00，退出再进才重置。
    viewing = false;
    p.data.session = { id: 'unread-finish', contactId: 'a', contactName: '甲', task: '洗澡',
        durationMs: 10 * 60000, remainingMs: 0, endAt: Date.now() - 1, status: 'running' };
    await p.tick();
    assert.equal(p.data.hasUnreadCompletion, true);         // 完成时不在页面
    viewing = true;                                        // 用户真正打开番茄钟页
    await p.enterView();                                   // 第一次进入：消费未读，但仍显示完成态
    assert.equal(p.data.session.status, 'completed');
    assert.equal(saved.session.status, 'completed');
    assert.equal(saved.hasUnreadCompletion, false);         // 未读标记要持久化，刷新后才知道已经看过
    assert.equal(saved.session.viewed, undefined);          // 不再有第二份“看过”状态
    assert.equal(p.$('pomodoro-time').textContent, '00:00');
    assert.equal(p.$('pomodoro-toggle').textContent, '开始下一轮');
    await p.enterView();                                   // 退出再进：重置
    assert.equal(p.data.session, null);
    assert.equal(p.$('pomodoro-time').textContent, '29:00');
    assert.equal(p.$('pomodoro-task').value, resetTask);
    assert.equal(saved.records.some(r => r.id === 'unread-finish'), true);

    // ★ 场景 2b：完成时在后台（锁屏/切屏），切回前台看见这一页后，第一次退出再进就要重置。
    viewing = false;
    p.data.session = { id: 'background-finish', contactId: 'a', contactName: '甲', task: resetTask,
        durationMs: 29 * 60000, remainingMs: 0, endAt: Date.now() - 1, status: 'running' };
    await p.tick();
    assert.equal(p.data.hasUnreadCompletion, true);         // 后台结算，用户还没看到
    viewing = true;                                        // 切回前台：visibilitychange → tick + markRead
    await p.tick();
    await p.markRead();
    assert.equal(p.data.hasUnreadCompletion, false);        // 看见这一页就算看过
    assert.equal(saved.hasUnreadCompletion, false);
    assert.equal(p.data.session.status, 'completed');       // 页面此刻仍显示 00:00
    assert.equal(p.$('pomodoro-time').textContent, '00:00');
    await p.enterView();                                   // ★ 第一次退出再进就必须重置
    assert.equal(p.data.session, null);
    assert.equal(p.$('pomodoro-time').textContent, '29:00');
    assert.equal(saved.records.some(r => r.id === 'background-finish'), true);

    // 场景 3：已经停在番茄钟页时重复进入（点完成通知）不消费完成态，退出再进才重置。
    viewing = true;
    p.data.session = { id: 'reenter-finish', contactId: 'a', contactName: '甲', task: resetTask,
        durationMs: 29 * 60000, remainingMs: 0, endAt: Date.now() - 1, status: 'running' };
    await p.tick();
    await p.enterView({ reenter: true });
    assert.equal(p.data.session.status, 'completed');
    assert.equal(p.$('pomodoro-time').textContent, '00:00');
    viewing = true;                                        // 真正退出再进时页面是可见的
    await p.enterView();
    assert.equal(p.data.session, null);
    assert.equal(p.$('pomodoro-time').textContent, '29:00');

    // 场景 4：进行中的计时进入页面不得被重置。
    p.data.session = { id: 'entry-running', contactId: 'a', task: resetTask,
        durationMs: 60000, remainingMs: 60000, endAt: Date.now() + 60000, status: 'running' };
    await p.enterView();
    assert.equal(p.data.session.status, 'running');
    assert.notEqual(p.$('pomodoro-time').textContent, '00:00');
    assert.equal(p.$('pomodoro-end').hidden, false);

    // 场景 5：旧备份多存的 viewed 字段被丢弃；是否看过只看未读标记，完成记录不受影响。
    const legacySession = { id: 'legacy', contactId: 'a', durationMs: 30 * 60000,
        remainingMs: 0, endAt: 1, status: 'completed', viewed: false };
    const legacyNormalized = p.normalize({ hasUnreadCompletion: true, session: legacySession });
    assert.equal(legacyNormalized.session.viewed, undefined);
    assert.equal(legacyNormalized.session.id, 'legacy');
    assert.equal(legacyNormalized.hasUnreadCompletion, true);
    assert.equal(p.normalize({ hasUnreadCompletion: false, session: legacySession }).session.viewed, undefined);
    assert.equal(p.normalize({ session: { id: 'run', contactId: 'a', durationMs: 60000,
        remainingMs: 0, endAt: Date.now() + 1000, status: 'running' } }).session.viewed, undefined);

    // ★ 场景 6：先改时长、再去选陪伴人，返回设置时不能把还没保存的时长冲掉。
    p.data.session = null;
    p.data.minutes = 29;
    p.data.apiPresetIndex = -1;
    p.$('modal-pomodoro-settings').classList.add('hidden');
    p.bind();                                                   // 走真实的按钮绑定
    p.openSettings();
    assert.equal(Number(p.$('pomodoro-minutes').value), 29);    // 首次打开用已保存时长回填
    p.$('pomodoro-minutes').value = '1';                        // 用户先改时长（草稿）
    p.$('pomodoro-api-preset').value = '0';                     // 同时改模型（草稿）
    p.openPicker();
    await p.$('pomodoro-people').children[0].fire('click');     // 选择第一个陪伴人
    assert.equal(p.$('pomodoro-minutes').value, '1');           // ★ 草稿保留，不被重置成 29
    assert.equal(p.$('pomodoro-api-preset').value, '0');         // 模型草稿同样保留
    assert.equal(p.data.minutes, 29);                            // 选陪伴人不会提交时长
    assert.equal(p.data.contactId, 'a');
    assert.equal(p.$('modal-pomodoro-settings').classList.contains('hidden'), false);
    await p.$('pomodoro-settings-save').fire('click');           // 保存才提交
    assert.equal(p.data.minutes, 1);
    assert.equal(saved.minutes, 1);
    assert.equal(p.data.apiPresetIndex, 0);
    assert.equal(p.$('pomodoro-time').textContent, '01:00');
    assert.equal(p.$('modal-pomodoro-settings').classList.contains('hidden'), true);
    // ★ 重新打开弹窗时回填的是刚保存的 1 分钟，而不是默认 25。
    p.openSettings();
    assert.equal(Number(p.$('pomodoro-minutes').value), 1);
    p.$('modal-pomodoro-settings').classList.add('hidden');

    console.log('PASS: 完成/中途结束旧版提示词、完成通知跳转目标、未读持久化/清除、重复结算去重');
    console.log('PASS: 开始/暂停/继续请求、模型预设选择及回退、番茄钟不携带聊天记录、乱序回复保护');
    console.log('PASS: 默认兼容、暂停恢复、刷新结算去重、角色隔离、3轮注入、Reroll/后台恢复去重、请求快照、最近6条消息');
    console.log('PASS: 完成态消费（页内完成重进重置/红点首次仍显示00:00/后台完成切回前台后首次重进即重置/重复进入不消费/进行中不重置/旧数据只保留单份状态）');
    console.log('PASS: 设置弹窗草稿（先改时长再选陪伴人，返回后时长/模型不被已保存值冲掉，保存才生效）');
})().catch(error => { console.error(error); process.exitCode = 1; });
