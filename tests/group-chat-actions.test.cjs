// ★ 群聊交互回归：稳定气泡身份、隐藏上下文、失败回滚，以及角色与群聊的混合排序。
// 运行：node --test tests/group-chat-actions.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
    const saves = [];
    const context = vm.createContext({ structuredClone, console, AbortController,
        STATE: { contacts: [{ id: 1, name: '甲' }, { id: 'b', name: '乙' }], settings: {} },
        UI: { renderContacts() {} }, Toast: { show() {} },
        Storage: { async saveSettings() {} },
        DB: { async set(key, value) { saves.push(structuredClone(value)); } }
    });
    for (const file of ['config', 'chat-bubbles', 'history-visibility', 'group-chat']) {
        vm.runInContext(fs.readFileSync('js/' + file + '.js', 'utf8'), context);
    }
    const bubbles = vm.runInContext('ChatBubbles', context);
    const chat = context.GroupChat;
    const group = { id: 'g', name: '朋友群', memberIds: [1, 'b'], history: [
        { role: 'user', content: '提问', sentAt: 1, audience: [1, 'b'] },
        { role: 'assistant', senderId: 1, senderName: '甲', content: '重复\n\n重复\n\n结尾', sentAt: 2, audience: [1, 'b'] },
        { role: 'assistant', senderId: 'b', senderName: '乙', content: '乙的回复', sentAt: 3, audience: [1, 'b'] }
    ] };
    chat.groups = [group];
    const target = index => ({ groupId: 'g', sentAt: 2, key: bubbles.keyAt(chat.find('g').history[1], index) });
    return { context, chat, bubbles, saves, target };
}

test('只编辑目标气泡，重复正文与其他成员不受影响，追加同文气泡保留原 key', async () => {
    const h = setup();
    const target = h.target(0), other = h.target(1);
    await h.chat.changeBubbles([other], 'toggle-hidden', true);
    await h.chat.changeBubbles([target], 'edit', '改过\n\n新增');
    const message = h.chat.find('g').history[1];
    assert.equal(message.content, '改过\n\n新增\n\n重复\n\n结尾');
    assert.equal(h.bubbles.indexOf(message, target.key), 0);
    assert.equal(h.bubbles.indexOf(message, other.key), 2);
    assert.equal(h.bubbles.isHidden(message, other.key), true);
    h.bubbles.appendText(message, '重复');
    assert.equal(h.bubbles.indexOf(message, other.key), 2);
    assert.equal(h.bubbles.isHidden(message, message.bubbleIds.at(-1)), false);
    assert.equal(h.chat.find('g').history[2].content, '乙的回复');
});

test('隐藏同时过滤群请求与单聊背景，隐藏图片不会进入上下文，纯图片仍能正常发送', async () => {
    const h = setup();
    const message = h.chat.find('g').history[1];
    message.images = ['image-data'];
    message.image_description = '图片秘密';
    const image = { groupId: 'g', sentAt: 2, key: h.bubbles.keyAt(message, 3) };
    const first = h.target(0);
    await h.chat.changeBubbles([first, image], 'toggle-hidden', true);
    assert.equal(h.chat.contextText(h.chat.find('g').history[1]), '重复\n\n结尾');
    const payload = h.chat.buildRequest(h.chat.find('g'), h.chat.members(h.chat.find('g')), h.chat.find('g').history);
    assert.ok(!JSON.stringify(payload).includes('图片秘密'));
    const privateContext = h.chat.buildPrivateContext({ id: 1 }, 'round');
    assert.ok(!privateContext.prompt.includes('图片秘密'));
    const pureImage = { role: 'user', content: '', images: ['image'], audience: [1, 'b'] };
    assert.equal(h.chat.contextText(pureImage, { attached: true }), '[图片：原图随本次请求附上]');
    h.bubbles.setHidden(pureImage, h.bubbles.keyAt(pureImage, 0), true);
    assert.equal(h.chat.contextText(pureImage, { attached: true }), '');
});

test('删除只命中稳定 key，插入消息不会串目标，重复操作不删邻居，写库失败保留原始记录', async () => {
    const h = setup();
    const target = h.target(1), other = h.target(0);
    h.chat.find('g').history.unshift({ role: 'user', content: '插入消息', sentAt: 0 });
    await h.chat.changeBubbles([target], 'delete');
    await h.chat.changeBubbles([target], 'delete');
    assert.equal(h.chat.resolveBubble(other).message.content, '重复\n\n结尾');
    const before = JSON.stringify(h.chat.groups);
    h.context.DB.set = async () => { throw Error('模拟保存失败'); };
    assert.equal(await h.chat.changeBubbles([other], 'delete'), false);
    assert.equal(JSON.stringify(h.chat.groups), before);
});

test('角色与群聊按同一顺序移动并保存，数字 ID 与同名群 ID 不冲突，置顶边界保持有效', async () => {
    const h = setup();
    const source = fs.readFileSync('script.js', 'utf8');
    const entries = source.slice(source.indexOf('    getContactListEntries('), source.indexOf('    showContactActionMenu('));
    const move = source.slice(source.indexOf('    async moveContactInList('), source.indexOf('    // ★★★★★ 联系人列表长按菜单 END'));
    const app = vm.runInContext('({' + entries + move + '})', h.context);
    h.chat.groups.push({ id: 1, name: '同 ID 群', history: [] });
    await app.moveContactInList('g', 'up', 'group');
    assert.deepEqual(Array.from(app.getContactListEntries(), item => item.key), ['contact:1', 'group:g', 'contact:b', 'group:1']);
    const saved = JSON.parse(JSON.stringify(h.context.STATE.settings.CONTACT_LIST_ORDER));
    h.context.STATE.settings = { CONTACT_LIST_ORDER: saved };
    assert.deepEqual(Array.from(app.getContactListEntries(), item => item.key), saved);
    h.context.STATE.contacts[0].isPinned = true;
    await app.moveContactInList('g', 'up', 'group');
    assert.equal(app.getContactListEntries()[0].key, 'contact:1');
    h.context.Storage.saveSettings = async () => { throw Error('模拟保存失败'); };
    await app.moveContactInList('g', 'down', 'group');
    assert.deepEqual(Array.from(app.getContactListEntries(), item => item.key), saved);
});
