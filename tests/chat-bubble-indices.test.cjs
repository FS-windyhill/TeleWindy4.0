const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ChatBubbles = require('../js/chat-bubbles.js');

const record = (content, extra = {}) => ({ role: 'user', content, ...extra });
const key = (msg, index) => ChatBubbles.keyAt(msg, index);
const hide = (msg, index) => ChatBubbles.setHidden(msg, key(msg, index), true);

test('新增不同正文、重复正文和唯一气泡改写时保留原身份', () => {
    const msg = record('晚安\n\n月色\n\n你也在看吗');
    hide(msg, 2);
    const oldKey = key(msg, 2);
    ChatBubbles.edit(msg, '晚安\n\n新的一句\n\n月色\n\n你也在看吗');
    assert.equal(key(msg, 3), oldKey);
    assert.deepEqual(msg.hiddenIndices, [3]);

    const repeated = record('好\n\n好');
    hide(repeated, 1);
    const first = key(repeated, 0), second = key(repeated, 1);
    ChatBubbles.edit(repeated, '好\n\n好\n\n好');
    assert.equal(key(repeated, 1), first);
    assert.equal(key(repeated, 2), second);
    assert.equal(ChatBubbles.isHidden(repeated, second), true);

    const unique = record('旧句');
    hide(unique, 0);
    const uniqueKey = key(unique, 0);
    ChatBubbles.edit(unique, '新句');
    assert.equal(key(unique, 0), uniqueKey);
    assert.deepEqual(unique.hiddenIndices, [0]);

    const between = record('开头\n\n旧句\n\n结尾');
    hide(between, 1);
    const middleKey = key(between, 1);
    ChatBubbles.edit(between, '开头\n\n新句\n\n结尾');
    assert.equal(key(between, 1), middleKey);
    assert.deepEqual(between.hiddenIndices, [1]);
});

test('相同正文删除第一个、唯一段落交换顺序和重复正文歧义', () => {
    const repeated = record('好\n\n好');
    hide(repeated, 1);
    const survivor = key(repeated, 1);
    ChatBubbles.deleteParts(repeated, [key(repeated, 0)]);
    assert.equal(key(repeated, 0), survivor);
    assert.deepEqual(repeated.hiddenIndices, [0]);

    const swapped = record('A\n\nB');
    hide(swapped, 0);
    const aKey = key(swapped, 0);
    ChatBubbles.edit(swapped, 'B\n\nA');
    assert.equal(key(swapped, 1), aKey);
    assert.deepEqual(swapped.hiddenIndices, [1]);

    const ambiguous = record('好\n\n好');
    hide(ambiguous, 0);
    ChatBubbles.edit(ambiguous, '好');
    assert.deepEqual(ambiguous.hiddenIndices, [0]);
});

test('普通消息不持久化文字副本，隐藏期间仍保留稳定身份', () => {
    const msg = record('A\n\nB');
    ChatBubbles.ensure(msg);
    const aKey = key(msg, 0);
    assert.equal(Object.hasOwn(msg, 'bubbleTextSnapshot'), false);

    // ★ 无隐藏内容时，整段编辑和运行中的外部正文替换仍可沿用明确匹配的 key。
    ChatBubbles.edit(msg, 'B\n\nA');
    assert.equal(key(msg, 1), aKey);
    msg.content = 'B\n\n新增\n\nA';
    ChatBubbles.ensure(msg);
    assert.equal(key(msg, 2), aKey);
    assert.equal(Object.hasOwn(msg, 'bubbleTextSnapshot'), false);

    ChatBubbles.setHidden(msg, aKey, true);
    assert.deepEqual(msg.bubbleTextSnapshot, ['B', '新增', 'A']);
    const restored = structuredClone(msg);
    ChatBubbles.edit(restored, 'A\n\nB\n\n新增');
    assert.equal(ChatBubbles.isHidden(restored, aKey), true);
    assert.equal(key(restored, 0), aKey);
    ChatBubbles.setHidden(restored, aKey, false);
    assert.equal(Object.hasOwn(restored, 'bubbleTextSnapshot'), false);
});

test('旧普通消息的文字快照迁移后释放，旧隐藏消息继续保留快照', () => {
    const ordinary = record('A\n\nB', { bubbleIds: ['a', 'b'],
        bubbleTextSnapshot: ['A', 'B'], hiddenBubbleKeys: [] });
    assert.equal(ChatBubbles.ensure(ordinary), true);
    assert.deepEqual(ordinary.bubbleIds, ['a', 'b']);
    assert.equal(Object.hasOwn(ordinary, 'bubbleTextSnapshot'), false);
    assert.equal(ChatBubbles.ensure(ordinary), false);

    const hidden = record('A\n\nB', { bubbleIds: ['a', 'b'],
        bubbleTextSnapshot: ['A', 'B'], hiddenBubbleKeys: ['b'] });
    ChatBubbles.ensure(hidden);
    assert.deepEqual(hidden.bubbleTextSnapshot, ['A', 'B']);
    const restored = structuredClone(hidden);
    ChatBubbles.edit(restored, '新增\n\nA\n\nB');
    assert.equal(ChatBubbles.isHidden(restored, 'b'), true);
    assert.deepEqual(restored.hiddenIndices, [2]);
});

test('删除前方文字后图片隐藏继续生效，模型没有描述或占位', () => {
    const msg = record('[2026-10-23 22:00] 第一段\n\n第二段', {
        images: ['image'], image_description: '秘密图片'
    });
    hide(msg, 2);
    const imageKey = key(msg, 2);
    ChatBubbles.deleteParts(msg, [key(msg, 0)]);
    assert.equal(key(msg, 1), imageKey);
    assert.deepEqual(msg.hiddenIndices, [1]);
    const visible = HistoryVisibility.buildVisibleMessage(msg, { preserveImagePlaceholder: true });
    assert.equal(visible.content, '第二段');
});

test('模型历史同时过滤隐藏文字、图片描述和纯图片占位', () => {
    const textAndImage = record('[2026-10-23 22:00] 秘密文字\n\n公开文字', {
        images: ['image'], image_description: '秘密图像'
    });
    hide(textAndImage, 0);
    hide(textAndImage, 2);
    assert.equal(HistoryVisibility.buildVisibleMessage(textAndImage).content, '公开文字');
    const onlyImage = record('[2026-10-23 22:00] ', { images: ['image'] });
    hide(onlyImage, 0);
    assert.equal(HistoryVisibility.buildVisibleMessage(onlyImage, { preserveImagePlaceholder: true }), null);
    assert.equal(HistoryVisibility.buildVisibleMessage({ role: 'assistant', content: '<think class="private">秘密思考</think>公开' }).content, '公开');
    assert.equal(HistoryVisibility.buildVisibleMessage({ role: 'assistant', content: '公开\n\n<think>未闭合的秘密' }).content, '公开');
});

// ★ 日期条只属于显示层：覆盖同日去重、跨天、临时提示和分页重建，避免污染消息身份。
test('聊天日期按当前显示范围分隔，未知日期和临时提示不猜日期', () => {
    const { UI } = harness();
    const makeList = () => ({ children: [], lastElementChild: null, appendChild(node) {
        node.previousElementSibling = this.lastElementChild;
        this.lastElementChild = node;
        this.children.push(node);
    } });
    const append = timestamp => {
        const group = { className: 'message-group', dataset: { msgIndex: '7' } };
        UI.appendChatMessageGroup(group, timestamp);
        assert.equal(group.dataset.msgIndex, '7');
    };
    const dates = () => UI.els.chatMsgs.children.filter(node => node.className === 'chat-date-divider');
    UI.els.chatMsgs = makeList();
    append('2026-11-14 09:00');
    append(null);
    append('2026-11-14 23:59');
    append('2026-11-15 00:01');
    assert.deepEqual(dates().map(node => node.textContent), ['2026-11-14', '2026-11-15']);
    assert.ok(dates().every(node => node.dataset.msgIndex === undefined));

    // ★ 加载更多时列表会重建；同一天的新旧分页合并后只保留一个日期条。
    UI.els.chatMsgs = makeList();
    append('08:00');
    assert.equal(dates().length, 0);
    append('2026-11-14 08:30');
    append('2026-11-14 09:00');
    assert.equal(dates().length, 1);
});

test('聊天日期拒绝无效日历日期，保留消息记录中的日期', () => {
    const { UI } = harness();
    for (const raw of [null, '', '09:00', 'Feb.30 09:00', 'Foo.14 09:00', '2026-02-30 09:00', '2026-13-01 09:00']) {
        assert.equal(UI.getChatDateKey(raw), '');
    }
    assert.equal(UI.getChatDateKey('2028-02-29 00:01'), '2028-02-29');
    assert.equal(UI.getChatDateKey('Nov.14 23:47'), '11-14');
    assert.equal(UI.getChatDateKey('Nov.15 00:47'), '11-15');
    assert.equal(UI.getChatDateKey('Feb.29 09:00'), '02-29');
    assert.equal(UI.getChatDateKey('2026-11-14T23:59:00-08:00'), '2026-11-14');
});

// ★ 完整加载聊天页对象，测试真正由 createSingleBubble 写入的 DOM 身份字段。
function harness() {
    const element = () => ({ style: {}, dataset: {}, className: '',
        classList: { add() {}, remove() {}, contains() { return false; } },
        addEventListener() {}, appendChild() {}, setAttribute(name, value) { this[name] = value; }, querySelector() { return null; } });
    const template = { content: { cloneNode() {
        const bubble = element();
        bubble.querySelector = selector => ['details', '.thought-content'].includes(selector) ? element() : null;
        const nodes = { '.message-wrapper': element(), '.message-bubble': bubble,
            '.msg-time': element(), '.avatar-img': element(), '.avatar-text': element() };
        return { bubble, querySelector: selector => nodes[selector] || null };
    } } };
    const menu = element();
    menu.dataset.initialized = 'true';
    menu.querySelector = () => element();
    const document = { getElementById(id) {
        return id === 'msg-template' ? template : id === 'msg-context-menu' ? menu : element();
    }, createElement: element, querySelectorAll: () => [] };
    const context = vm.createContext({ document, window: { innerWidth: 1000 }, ChatBubbles, console, AbortController,
        CONFIG: { DEFAULT: { MOMENTS_SETTINGS: {}, USER_AVATAR: '🙂' } },
        Storage: { saveContacts: async () => {} }, navigator: { clipboard: { writeText: async () => {} } },
        ProactiveMessages: { makeId: () => 'new-user', onUserMessage: async () => {} },
        requestAnimationFrame: callback => callback(), confirm: () => true, alert() {}, setTimeout() {} });
    vm.runInContext(fs.readFileSync('script.js', 'utf8')
        + '\nthis.App=App;this.UI=UI;this.STATE=STATE;this.Toast=Toast;this.API=API;'
        + '\nparseCustomMarkdown = text => text;', context);
    context.Toast.show = () => {};
    context.UI.els.chatMsgs = { style: {}, appendChild() {}, parentElement: { scrollTop: 0 } };
    context.realRender = context.UI.renderChatHistory;
    context.UI.renderChatHistory = () => {};
    context.UI.scrollToBottom = () => {};
    context.UI.updateChatHeader = () => {};
    context.App.exitSelectMode = () => context.STATE.selectedBubbles.clear();
    context.STATE.settings = { USER_AVATAR: '🙂' };
    context.open = msg => {
        const contact = { id: 'sheep', history: [msg] };
        context.STATE.contacts = [contact];
        context.STATE.currentContactId = contact.id;
        return contact;
    };
    context.bubble = (msg, index) => context.UI.createSingleBubble('', msg.role === 'user' ? 'user' : 'ai',
        '🙂', '2026-10-23 22:00', context.STATE.contacts[0].history.indexOf(msg), false, index).bubble;
    return context;
}

test('新发送的用户文字和图片首次上屏就带真实身份，菜单与多选可直接操作', () => {
    const c = harness();
    const contact = c.open({ role: 'assistant', messageId: 'previous', content: '晚安哦' });
    c.STATE.settings = { ...c.STATE.settings, API_URL: 'url', API_KEY: 'key', MODEL: 'model',
        IMAGE_API_MODE: 'separate', VISION_URL: 'vision' };
    c.STATE.pendingImage = 'data:image/png;base64,image';
    c.UI.els.input = { value: '晚安\n\n月色', style: {} };
    c.UI.els.previewContainer = { style: {} };
    c.UI.touchContactPresence = () => {};
    c.UI.setLoading = () => {};
    c.API.shouldUseAsyncBackend = () => false;
    c.API.analyzeImage = () => new Promise(() => {});
    const shown = [];
    const create = c.UI.createSingleBubble.bind(c.UI);
    c.UI.createSingleBubble = (...args) => {
        const rendered = create(...args);
        shown.push(rendered.bubble);
        return rendered;
    };

    // ★ 识图请求仍在等待时，首次上屏的气泡已经可以按 ID 定位。
    c.App.handleSend();
    const sent = contact.history.at(-1);
    assert.equal(sent.messageId, 'new-user');
    assert.equal(shown.length, 3);
    assert.deepEqual(shown.map(node => node.dataset.bubbleKey),
        [ChatBubbles.keyAt(sent, 0), ChatBubbles.keyAt(sent, 1), sent.imageBubbleKey]);
    assert.ok(shown.every(node => node.messageRef === sent && node.dataset.messageId === sent.messageId));

    c.STATE.selectedBubbles = new Set([shown[1], shown[2]]);
    c.App.handleBatchToggleHidden();
    assert.deepEqual(sent.hiddenIndices, [1, 2]);
    c.App.showMessageContextMenu(1, {}, shown[0]);
    contact.history.unshift({ role: 'assistant', messageId: 'proactive', content: '早安' });
    c.App.handleMessageAction('delete');
    assert.ok(!contact.history.includes(sent));
    assert.equal(contact.history[1].messageId, 'previous');
});

// ★ 线上状态切换直接检查原发送按钮，同一位置要可点，停完要能重试没有 AI 回复的首条消息。
test('发送按钮等待时原位变成停止按钮，停止后恢复发送和重试', () => {
    const c = harness();
    const contact = c.open({ role: 'user', content: '第一条消息', messageId: 'first' });
    const { sendBtn, rerollBtn } = c.UI.els;
    const controller = new AbortController();
    c.STATE.onlineChatWait = { contactId: contact.id, controller };
    c.STATE.chatRequestActive = true;
    c.App.renderAsyncBackendPendingJobs = () => {};
    c.UI.setLoading(true, contact.id);
    assert.equal(sendBtn.dataset.action, 'stop-wait');
    assert.equal(sendBtn['aria-label'], '停止等待');
    assert.equal(sendBtn.disabled, false);
    assert.equal(rerollBtn.disabled, true);

    c.App.stopOnlineChatWait();
    assert.equal(controller.signal.aborted, true);
    assert.equal(sendBtn.dataset.action, 'send');
    assert.equal(sendBtn['aria-label'], '发送');
    assert.equal(sendBtn.disabled, false);
    assert.equal(rerollBtn.disabled, false);
});

test('删除全部文字保留图片后，真实历史渲染不会把用户时间前缀当正文', () => {
    const c = harness();
    const msg = { role: 'user', messageId: 'image-only',
        content: '[2026-10-23 22:00] 第一段\n\n第二段', images: ['image'] };
    const contact = c.open(msg);
    ChatBubbles.deleteParts(msg, [ChatBubbles.keyAt(msg, 0), ChatBubbles.keyAt(msg, 1)]);
    assert.equal(ChatBubbles.parse(msg).parts.length, 0);
    const shown = [];
    const create = c.UI.createSingleBubble.bind(c.UI);
    c.UI.createSingleBubble = (...args) => {
        shown.push(args);
        return create(...args);
    };
    c.UI.renderChatHistory = c.realRender;
    c.STATE.visibleMsgCount = 15;
    c.UI.renderChatHistory(contact, false, true);
    assert.equal(shown.length, 1);
    assert.equal(shown[0][7], 'image');
    assert.equal(shown[0][6], 0);
});

test('图片和思考气泡的真实 DOM key 可批量隐藏、取消隐藏、删除', () => {
    const c = harness();
    const msg = { role: 'assistant', messageId: 'assistant-1', content: '<think>先想想</think>正文', images: ['image'] };
    c.open(msg);
    const thought = c.bubble(msg, 'thought'), image = c.bubble(msg, 1);
    assert.equal(thought.dataset.bubbleKey, msg.thoughtBubbleKey);
    assert.equal(image.dataset.bubbleKey, msg.imageBubbleKey);
    c.STATE.selectedBubbles = new Set([thought, image]);
    c.App.handleBatchToggleHidden();
    assert.deepEqual(msg.hiddenIndices, ['thought', 1]);
    c.STATE.selectedBubbles = new Set([thought, image]);
    c.App.handleBatchToggleHidden();
    assert.deepEqual(msg.hiddenIndices, []);
    c.STATE.selectedBubbles = new Set([thought, image]);
    c.App.handleBatchDelete();
    assert.equal(msg.images, null);
    assert.equal(msg.content, '正文');
});

test('Agent 面板占据源索引，后续正文气泡仍使用自己的 key', () => {
    const c = harness();
    const msg = { role: 'assistant', messageId: 'agent', content: '前文\n\n『调用』\n\n后文' };
    c.open(msg);
    const layout = c.UI.buildAgentMessageParts(msg.content);
    assert.equal(layout.sourcePartCount, 3);
    assert.equal(layout.displayParts.find(part => part.text === '后文').partIndex, 2);
    const last = c.bubble(msg, 2);
    c.STATE.selectedBubbles = new Set([last]);
    c.App.handleBatchToggleHidden();
    assert.deepEqual(msg.hiddenIndices, [2]);
});

test('批量删除重复正文直接使用 DOM key，复制操作也跟随原气泡', async () => {
    const c = harness();
    const msg = { role: 'user', messageId: 'twice', content: '好\n\n好' };
    c.open(msg);
    const first = c.bubble(msg, 0), second = c.bubble(msg, 1);
    ChatBubbles.setHidden(msg, second.dataset.bubbleKey, true);
    c.STATE.selectedBubbles = new Set([first]);
    c.App.handleBatchDelete();
    assert.equal(msg.content, '好');
    assert.equal(msg.bubbleIds[0], second.dataset.bubbleKey);
    assert.deepEqual(msg.hiddenIndices, [0]);
    c.STATE.selectedBubbles = new Set([second]);
    let copied = '';
    c.navigator.clipboard.writeText = async text => { copied = text; };
    c.App.handleBatchCopy();
    await Promise.resolve();
    assert.equal(copied, '好');
});

test('菜单和多选期间主动消息插入仍命中原目标，删除目标后不误操作邻居', () => {
    const c = harness();
    const reply = { role: 'assistant', messageId: 'reply', content: '晚安哦' };
    const morning = { role: 'assistant', messageId: 'morning', proactiveSource: 'proactive', content: '[2026-10-23 08:00] 早安' };
    const contact = c.open(reply);
    contact.history.push(morning);
    const bubble = c.bubble(reply, 0);
    c.App.showMessageContextMenu(0, {}, bubble);
    contact.history.unshift({ role: 'assistant', messageId: 'inserted', content: '先插入' });
    c.App.handleMessageAction('delete');
    assert.deepEqual(contact.history.map(msg => msg.messageId), ['inserted', 'morning']);

    const selected = c.bubble(morning, 0);
    c.STATE.selectedBubbles = new Set([selected]);
    contact.history.unshift({ role: 'assistant', messageId: 'another', content: '再插入' });
    c.App.handleBatchToggleHidden();
    assert.deepEqual(morning.hiddenIndices, [0]);
    c.STATE.selectedBubbles = new Set([selected]);
    contact.history.splice(contact.history.indexOf(morning), 1);
    c.App.handleBatchDelete();
    c.App.showMessageContextMenu(1, {}, selected);
    c.App.handleMessageAction('delete');
    assert.deepEqual(contact.history.map(msg => msg.messageId), ['another', 'inserted']);
});

test('编辑弹窗打开后主动消息插入或原目标删除，回调只处理仍存在的原消息', () => {
    const c = harness();
    const original = { role: 'user', messageId: 'user-1', content: '[2026-10-23 22:00] A\n\nB' };
    const contact = c.open(original);
    const bubble = c.bubble(original, 1);
    ChatBubbles.setHidden(original, bubble.dataset.bubbleKey, true);
    let submit;
    c.UI.showEditModal = (_text, callback) => { submit = callback; };
    c.App.showMessageContextMenu(0, {}, bubble);
    c.App.handleMessageAction('edit');
    contact.history.unshift({ role: 'assistant', messageId: 'proactive', content: '早安' });
    submit('新的一句\n\nA\n\nB');
    assert.deepEqual(original.hiddenIndices, [2]);
    assert.equal(contact.history[0].content, '早安');

    c.App.showMessageContextMenu(1, {}, bubble);
    c.App.handleMessageAction('edit');
    contact.history.splice(contact.history.indexOf(original), 1);
    submit('不应该写入');
    assert.equal(contact.history[0].content, '早安');
});

test('旧数据迁移、保存形态重新加载后文字图片思考隐藏不变', () => {
    const legacy = { role: 'assistant', content: '<think>秘密</think>A\n\nB', images: ['image'], hiddenIndices: ['thought', 1, 2] };
    ChatBubbles.ensure(legacy);
    const restored = structuredClone(legacy);
    ChatBubbles.ensure(restored);
    assert.deepEqual(restored.hiddenIndices, ['thought', 1, 2]);
    assert.deepEqual(restored.hiddenBubbleKeys, legacy.hiddenBubbleKeys);
});

test('Storage.load 迁移旧数据并落库，saveContacts 后重新加载保持气泡 key', async () => {
    const db = new Map();
    db.set('contacts', [{ id: 'sheep', history: [{ role: 'user',
        content: '[2026-10-23 22:00] A\n\nB', images: ['image'], hiddenIndices: [1, 2] },
    { role: 'user', content: '普通消息', bubbleIds: ['plain'],
        bubbleTextSnapshot: ['普通消息'], hiddenBubbleKeys: [] }] }]);
    const storageContext = vm.createContext({ ChatBubbles, console,
        CONFIG: { STORAGE_KEY: 'contacts', SETTINGS_KEY: 'settings', DEFAULT: {
            PROACTIVE_MESSAGES: {}, MOMENTS_SETTINGS: {}
        } }, STATE: { contacts: [], momentsSettings: {} },
        mockDB: { get: async key => structuredClone(db.get(key)), set: async (key, value) => db.set(key, structuredClone(value)) },
        localStorage: { getItem: () => null, removeItem() {} } });
    vm.runInContext(fs.readFileSync('js/storage.js', 'utf8') + '\nDB.get=mockDB.get;DB.set=mockDB.set;this.Storage=Storage;', storageContext);
    await storageContext.Storage.load();
    const migrated = storageContext.STATE.contacts[0].history[0];
    assert.deepEqual(Array.from(migrated.hiddenIndices), [1, 2]);
    const keys = [...migrated.hiddenBubbleKeys];
    // ★ 迁移落库时仅移除普通消息的重复正文，已隐藏消息仍保留快照。
    assert.equal(Object.hasOwn(db.get('contacts')[0].history[1], 'bubbleTextSnapshot'), false);
    assert.deepEqual(Array.from(db.get('contacts')[0].history[0].bubbleTextSnapshot), ['A', 'B']);
    await storageContext.Storage.saveContacts();
    storageContext.STATE.contacts = [];
    await storageContext.Storage.load();
    const restored = storageContext.STATE.contacts[0].history[0];
    assert.deepEqual(Array.from(restored.hiddenBubbleKeys), keys);
    assert.deepEqual(Array.from(restored.hiddenIndices), [1, 2]);
    assert.equal(Object.hasOwn(storageContext.STATE.contacts[0].history[1], 'bubbleTextSnapshot'), false);
});

test('主动时间前缀、引用和代码围栏空行保持同一气泡边界', () => {
    const msg = { role: 'assistant', proactiveSource: 'proactive',
        content: '[2026-10-23 08:00] 开头\n> 引用\n\n```js\na\n\nb\n```\n\n结尾' };
    assert.equal(ChatBubbles.parse(msg).parts.length, 4);
    hide(msg, 2);
    const visible = HistoryVisibility.buildVisibleMessage(msg);
    assert.doesNotMatch(visible.content, /a\n\nb/);
    assert.match(visible.content, /^\[2026-10-23 08:00\] 开头/);
});

test('临时失败提示没有可操作气泡 key，也不借用真实消息身份', () => {
    const c = harness();
    const msg = { role: 'assistant', messageId: 'real', content: '真实回复' };
    c.open(msg);
    const transient = c.UI.createSingleBubble('(发送失败)', 'ai', '🙂', null, 0, true, 0, null, false, true).bubble;
    assert.equal(transient.dataset.bubbleKey, undefined);
    c.App.showMessageContextMenu(0, {}, transient);
    c.App.handleMessageAction('delete');
    assert.equal(c.STATE.contacts[0].history[0], msg);
});

// ★ 历史过滤脚本与浏览器共用 ChatBubbles，而不是复制一份切分实现。
const visibilityContext = vm.createContext({ ChatBubbles });
vm.runInContext(fs.readFileSync('js/history-visibility.js', 'utf8') + '\nthis.HistoryVisibility=HistoryVisibility;', visibilityContext);
const HistoryVisibility = visibilityContext.HistoryVisibility;
