// ★ 群聊窗口回归：运行单聊的真实选窗方法，验证整组回复计数和旧记录兼容。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(history) {
    const snapshots = [];
    const context = vm.createContext({
        structuredClone,
        console,
        AbortController,
        formatTimestamp: () => '2026-11-27 10:00',
        UI: { renderContacts() {} },
        STATE: { contacts: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }] },
        DB: { async set(key, value) { snapshots.push(JSON.parse(JSON.stringify(value))); } }
    });
    for (const [file, name] of [
        ['js/config.js', 'CONFIG'],
        ['js/chat-bubbles.js', 'ChatBubbles'],
        ['js/history-visibility.js', 'HistoryVisibility'],
        ['js/group-chat.js', 'GroupChat']
    ]) {
        vm.runInContext(fs.readFileSync(file, 'utf8') + '\nglobalThis.' + name + ' = ' + name + ';', context);
    }
    const source = fs.readFileSync('script.js', 'utf8');
    const start = source.indexOf('    selectHistoryWindowRecords(');
    const end = source.indexOf('\n    },', start);
    vm.runInContext('globalThis.App = ({' + source.slice(start, end + 7) + '});', context);
    const chat = context.GroupChat;
    chat.groups = [{ id: 'group', name: '朋友群', memberIds: ['a', 'b'], history }];
    chat.queueUserWaterfall = () => {};
    const settings = { CONTEXT_LIMIT: 3, HISTORY_WINDOW_MAX_CONTEXT: 7, HISTORY_WINDOW_STRATEGY: 'cache_friendly' };
    return { chat, context, settings, snapshots, signal: new AbortController().signal };
}

function user(number) {
    return { role: 'user', content: '提问' + number, sentAt: number * 100, audience: ['a', 'b'] };
}

function replies(number, batch = number) {
    return ['a', 'b', 'a'].map((senderId, index) => ({
        role: 'assistant', content: '回复' + number + '-' + index + '\n\n第二个气泡',
        senderId, senderName: senderId, sentAt: number * 100 + index + 1,
        replyBatchId: batch, audience: ['a', 'b']
    }));
}

test('严格最近三条按用户和统一AI回复计数，整组成员发言全部进入请求', async () => {
    const h = harness([...userArray(3), user(4)]);
    h.settings.HISTORY_WINDOW_STRATEGY = 'strict_recent';
    const selected = await h.chat.selectHistoryWindow('group', h.chat.groups[0].history, h.settings, h.signal);
    assert.deepEqual(Array.from(selected, item => item.sentAt), [300, 301, 302, 303, 400]);
    assert.equal(h.settings.HISTORY_WINDOW_LOG.sentCount, 3);
    const group = h.chat.groups[0];
    const payload = h.chat.buildRequest(group, h.chat.members(group), selected);
    assert.equal(JSON.parse(payload[1].content).history.length, 5);
});

test('窗口展开后的成员发言超过二十四条时也完整发送', async () => {
    const h = harness([...userArray(12), user(13)]);
    h.settings.HISTORY_WINDOW_STRATEGY = 'strict_recent';
    h.settings.CONTEXT_LIMIT = 15;
    const selected = await h.chat.selectHistoryWindow('group', h.chat.groups[0].history, h.settings, h.signal);
    assert.equal(h.settings.HISTORY_WINDOW_LOG.sentCount, 15);
    assert.equal(selected.length, 29);
    const group = h.chat.groups[0];
    const payload = JSON.parse(h.chat.buildRequest(group, h.chat.members(group), selected)[1].content);
    assert.equal(payload.history.length, 29);
    assert.equal(payload.history[0].content, '提问6');
    assert.equal(payload.history.at(-1).content, '提问13');
});

function userArray(count) {
    return Array.from({ length: count }, (_, index) => [user(index + 1), ...replies(index + 1)]).flat();
}

test('缓存友好从三条增长到七条，超出后回到最近三条并保存起点', async () => {
    const h = harness([...userArray(2), user(3)]);
    const select = () => h.chat.selectHistoryWindow('group', h.chat.groups[0].history, h.settings, h.signal);
    await select();
    assert.equal(h.settings.HISTORY_WINDOW_LOG.sentCount, 3);
    assert.equal(h.chat.groups[0].historyWindowStartSeq, 200);
    h.chat.groups[0].history.push(...replies(3), user(4));
    await select();
    assert.equal(h.settings.HISTORY_WINDOW_LOG.sentCount, 5);
    assert.equal(h.chat.groups[0].historyWindowStartSeq, 200);
    h.chat.groups[0].history.push(...replies(4), user(5));
    await select();
    assert.equal(h.settings.HISTORY_WINDOW_LOG.sentCount, 7);
    h.chat.groups[0].history.push(...replies(5), user(6));
    const latest = await select();
    assert.equal(h.settings.HISTORY_WINDOW_LOG.sentCount, 3);
    assert.deepEqual(Array.from(latest, item => item.sentAt), [500, 501, 502, 503, 600]);
    assert.equal(h.snapshots.at(-1)[0].historyWindowStartSeq, 500);
    // ★ 恢复持久化起点后重查同一轮，窗口保持一致。
    h.chat.groups = h.snapshots.at(-1);
    assert.deepEqual(Array.from(await select(), item => item.sentAt), [500, 501, 502, 503, 600]);
});

test('旧记录的连续成员回复合为一条，连续用户发送分别计数，新回复批次分别计数', () => {
    const history = userArray(2).map(({ replyBatchId, ...message }) => message);
    history.push(user(3), user(4), ...replies(4, 'first'), ...replies(5, 'second'));
    const h = harness(history);
    const units = h.chat.historyWindowMessages(history);
    assert.deepEqual(Array.from(units, item => item.role), ['user', 'assistant', 'user', 'assistant', 'user', 'user', 'assistant', 'assistant']);
    assert.equal(units[1].groupMessages.length, 3);
    assert.equal(units.at(-1).groupMessages.length, 3);
});

test('一个请求发出多位成员和空行气泡时批次相同，重生成得到新批次', async () => {
    const h = harness([user(1)]);
    const turn = h.chat.makeTurn('group');
    const sender = h.context.STATE.contacts[0];
    const first = await h.chat.appendMessage('group', { role: 'assistant', senderId: 'a', content: '第一段' }, turn, sender);
    await h.chat.appendMessage('group', { role: 'assistant', senderId: 'a', content: '第二段' }, turn, sender, first.sentAt);
    await h.chat.appendMessage('group', { role: 'assistant', senderId: 'b', content: '另一位接话' }, turn, h.context.STATE.contacts[1]);
    const saved = h.chat.groups[0].history;
    assert.equal(saved[1].content, '第一段\n\n第二段');
    assert.equal(saved[1].replyBatchId, saved[2].replyBatchId);
    assert.equal(h.chat.historyWindowMessages(saved).length, 2);
    const replacement = h.chat.makeTurn('group');
    replacement.replaceAfter = 100;
    replacement.hiddenReplies = new Set(saved.slice(1).map(item => item.sentAt));
    await h.chat.appendMessage('group', { role: 'assistant', senderId: 'a', content: '新回复' }, replacement, sender);
    assert.notEqual(h.chat.groups[0].history[1].replyBatchId, first.replyBatchId);
    assert.equal(h.chat.groups[0].history.length, 2);
    assert.equal(h.chat.historyWindowMessages(h.chat.groups[0].history).length, 2);
});

test('真实生成入口采用窗口配置，重生成排除待替换回复', async () => {
    const h = harness(userArray(4));
    h.settings.HISTORY_WINDOW_STRATEGY = 'strict_recent';
    h.settings.CONTEXT_LIMIT = 1;
    h.context.App.buildChatRequestSettings = () => ({ ...h.settings });
    h.chat.wait = async () => {};
    h.chat.prepareGroupContext = () => ({ round: null, messages: null });
    h.context.API = { async chat(messages, settings) {
        assert.equal(settings.HISTORY_WINDOW_LOG.sentCount, 1);
        const history = JSON.parse(messages[1].content).history;
        assert.equal(history.length, 1);
        assert.equal(history[0].content, '提问4');
        return '[]';
    } };
    const turn = h.chat.makeTurn('group');
    turn.replaceAfter = 400;
    turn.hiddenReplies = new Set(h.chat.groups[0].history.slice(-3).map(item => item.sentAt));
    await h.chat.generate('group', turn, 0);
    assert.equal(h.chat.failedTurns.size, 0);
    assert.equal(h.chat.groups[0].history.at(-1).content, '提问4');
});
