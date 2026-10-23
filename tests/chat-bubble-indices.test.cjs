const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// ★ 直接运行聊天页使用的切分与索引迁移函数，避免测试复制出另一套气泡规则。
const script = fs.readFileSync('script.js', 'utf8');
const start = script.indexOf('function splitMessageIntoBubbleParts(text)');
const end = script.indexOf('function getWaterfallBubbleDelayMs(text)', start);
assert.ok(start >= 0 && end > start);
const context = vm.createContext({
    normalizeChatQuoteBreaks: text => text,
    ProactiveMessages: { displayContent: (_message, text) => text.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*/, '') }
});
vm.runInContext(script.slice(start, end), context);

test('编辑时在隐藏气泡前插入气泡，隐藏标记跟随原气泡', () => {
    const message = { role: 'user', hiddenIndices: [2] };
    const before = '[2026-10-23 22:00] 晚安\n\n今天晚上月色真美\n\n你也在看月亮吗\n\n做个好梦';
    const after = '[2026-10-23 22:00] 晚安\n\n今天晚上月色真美\n\n我抬头看了看\n\n你也在看月亮吗\n\n做个好梦';
    assert.deepEqual(Array.from(context.remapHiddenBubbleIndices(message, before, after)), [3]);
});

test('编辑时新增文字气泡，隐藏图片索引跟随文字数量', () => {
    const message = { role: 'user', images: ['image'], hiddenIndices: [2] };
    const before = '[2026-10-23 22:00] 晚安\n\n做个好梦';
    const after = '[2026-10-23 22:00] 晚安\n\n你也一样\n\n做个好梦';
    assert.deepEqual(Array.from(context.remapHiddenBubbleIndices(message, before, after)), [3]);
});

test('主动消息正文前缀不占气泡索引，改写唯一气泡仍保持隐藏', () => {
    const message = { role: 'assistant', proactiveSource: 'proactive', hiddenIndices: [0] };
    const before = '[2026-10-23 08:00] 嗨早上好';
    const after = '[2026-10-23 08:00] 早安呀';
    assert.deepEqual(Array.from(context.remapHiddenBubbleIndices(message, before, after)), [0]);
});

test('消息前方插入主动消息后，删除菜单仍只删除选中的原消息', () => {
    const methodStart = script.indexOf('    handleMessageAction(action) {');
    const methodEnd = script.indexOf('    // ===================2. 进入多选模式', methodStart);
    assert.ok(methodStart >= 0 && methodEnd > methodStart);
    const prior = { role: 'assistant', content: '晚安哦' };
    const proactive = { role: 'assistant', content: '嗨早上好', proactiveSource: 'proactive' };
    const contact = { id: 'sheep', history: [{ role: 'user', content: '晚安' }, prior, proactive] };
    const state = {
        currentContactId: 'sheep', contacts: [contact],
        selectedMessageIndex: 1, selectedMessageRef: prior
    };
    // ★ 菜单打开后有新消息插到前面，旧数组下标 1 已经不再指向“晚安哦”。
    contact.history.splice(1, 0, { role: 'assistant', content: '更早的主动消息', proactiveSource: 'proactive' });
    const actionContext = vm.createContext({
        STATE: state,
        UI: { els: { chatMsgs: { parentElement: { scrollTop: 0 } } }, renderChatHistory() {} },
        Storage: { saveContacts() {} },
        confirm: () => true,
        console
    });
    const app = vm.runInContext(`({${script.slice(methodStart, methodEnd)}})`, actionContext);
    app.handleMessageAction('delete');
    assert.equal(contact.history.includes(prior), false);
    assert.equal(contact.history.includes(proactive), true);
    assert.equal(contact.history.length, 3);
});
