// ★ 群聊回注单聊回归：用真实旧记录验证完整问答边界、成员可见范围和注入次数。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync('js/config.js', 'utf8') + '\nthis.CONFIG = CONFIG;', context);
    // ★ 群历史与回注单聊共用气泡可见性清洗，测试也加载实际依赖。
    for (const file of ['js/chat-bubbles.js', 'js/history-visibility.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
    vm.runInContext(fs.readFileSync('js/group-chat.js', 'utf8'), context);
    return { chat: context.GroupChat, config: context.CONFIG };
}

function message(role, content, sentAt, audience = ['a', 'b']) {
    return { role, content, sentAt, audience, senderId: 'a', senderName: '小甲' };
}

function conversation(number, sentAt) {
    return [
        message('user', '第' + number + '问', sentAt),
        message('assistant', '第' + number + '答甲\n\n补充气泡', sentAt + 1),
        { ...message('assistant', '第' + number + '答乙', sentAt + 2), senderId: 'b', senderName: '小乙' },
        message('assistant', '第' + number + '答甲续', sentAt + 3)
    ];
}

test('默认只回注最近三轮完整问答，保留每轮全部成员回复和正文空行', () => {
    const { chat, config } = harness();
    assert.equal(config.GROUP_CHAT_PRIVATE_CONTEXT_ROUNDS, 3);
    chat.groups = [{ name: '朋友群', history: [1, 2, 3, 4, 5].flatMap(number => conversation(number, number * 10)) }];
    const { prompt } = chat.buildPrivateContext({ id: 'a' }, 'private-1');
    assert.ok(prompt.startsWith('【近期群聊背景】'));
    assert.ok(!prompt.includes('第1') && !prompt.includes('第2'));
    for (const number of [3, 4, 5]) {
        assert.ok(prompt.includes('用户：“第' + number + '问”'));
        assert.ok(prompt.includes('你：“第' + number + '答甲\n\n补充气泡”'));
        assert.ok(prompt.includes('小乙：“第' + number + '答乙”'));
        assert.ok(prompt.includes('你：“第' + number + '答甲续”'));
    }
    assert.equal((prompt.match(/【朋友群】/g) || []).length, 1);
    assert.ok(prompt.indexOf('第3问') < prompt.indexOf('第4问'));
    assert.ok(prompt.indexOf('第4问') < prompt.indexOf('第5问'));
});

test('用户连发合并一轮，末尾未回答和开头无提问的回复不构成完整问答', () => {
    const { chat } = harness();
    const group = { name: '朋友群', history: [
        message('assistant', '孤立回复', 1),
        message('user', '连发第一句', 2),
        message('user', '连发第二句', 3),
        message('assistant', '统一回答', 4),
        message('user', '还没收到回答', 5)
    ] };
    chat.groups = [group];
    const rounds = chat.recentGroupRounds(group, 'a', 3);
    assert.equal(rounds.length, 1);
    assert.deepEqual(Array.from(rounds[0].messages, item => item.content), ['连发第一句', '连发第二句', '统一回答']);
    assert.ok(!chat.buildPrivateContext({ id: 'a' }, 'private-1').prompt.includes('还没收到回答'));
});

test('先划分问答再过滤可见成员，加入前的提问不会与加入后的回复拼成一轮', () => {
    const { chat } = harness();
    chat.groups = [{ name: '朋友群', history: [
        ...conversation('旧', 10).map(item => ({ ...item, audience: ['b'] })),
        message('user', '加入前提问', 20, ['b']),
        message('assistant', '加入后单独可见的回复', 21),
        ...conversation('新', 30)
    ] }];
    const { prompt } = chat.buildPrivateContext({ id: 'a' }, 'private-1');
    assert.ok(prompt.includes('第新问'));
    assert.ok(!prompt.includes('第旧'));
    assert.ok(!prompt.includes('加入前') && !prompt.includes('加入后'));
});

test('每个群分别取最近三轮，配置按群生效并且图片以描述回注', () => {
    const { chat, config } = harness();
    const photo = conversation('图', 80);
    photo[0] = { ...photo[0], images: ['data:image/png;base64,ORIGINAL'], image_description: '一只猫' };
    chat.groups = [
        { name: '群一', history: [1, 3, 5, 7].flatMap(number => conversation(number, number * 10)) },
        { name: '群二', history: [...[2, 4, 6].flatMap(number => conversation(number, number * 10)), ...photo] }
    ];
    const { prompt } = chat.buildPrivateContext({ id: 'a' }, 'private-1');
    assert.ok(!prompt.includes('第1问') && !prompt.includes('第2问'));
    for (const number of [3, 4, 5, 6, 7, '图']) {
        assert.ok(prompt.includes('第' + number + '问'));
        assert.ok(prompt.includes('第' + number + '答甲续'));
    }
    assert.equal((prompt.match(/【群一】/g) || []).length, 1);
    assert.equal((prompt.match(/【群二】/g) || []).length, 1);
    assert.ok(prompt.includes('[图片：一只猫]'));
    assert.ok(!prompt.includes('base64'));
    config.GROUP_CHAT_PRIVATE_CONTEXT_ROUNDS = 1;
    const latest = chat.buildPrivateContext({ id: 'a' }, 'private-1').prompt;
    assert.ok(latest.includes('第7问') && latest.includes('第图问'));
    assert.ok(!latest.includes('第5问') && !latest.includes('第6问'));
    config.GROUP_CHAT_PRIVATE_CONTEXT_ROUNDS = 0;
    assert.equal(chat.buildPrivateContext({ id: 'a' }, 'private-1'), null);
});

test('消息较少的群带全部完整问答，安静群的内容不被活跃群挤掉', () => {
    const { chat } = harness();
    chat.groups = [
        { name: '安静群', history: conversation('安静', 1) },
        { name: '活跃群', history: [1, 2, 3, 4, 5].flatMap(number => conversation(number, number * 10)) }
    ];
    const { prompt } = chat.buildPrivateContext({ id: 'a' }, 'private-1');
    assert.ok(prompt.includes('第安静问') && prompt.includes('第安静答甲续'));
    assert.ok(!prompt.includes('第1问') && !prompt.includes('第2问'));
    for (const number of [3, 4, 5]) assert.ok(prompt.includes('第' + number + '问'));
});

test('最近三轮内容仍只注入三个成功单聊轮次，第三轮重生成保留且第四轮停止', () => {
    const { chat } = harness();
    const contact = { id: 'a' };
    chat.groups = [{ name: '朋友群', history: conversation(1, 10) }];
    for (const roundId of ['private-1', 'private-2', 'private-3']) {
        const context = chat.buildPrivateContext(contact, roundId);
        assert.ok(context);
        contact.groupChatBridge = chat.consumeBridgeRound(contact.groupChatBridge, context.round);
    }
    for (let index = 0; index < 10; index++) {
        const context = chat.buildPrivateContext(contact, 'private-3');
        assert.ok(context);
        contact.groupChatBridge = chat.consumeBridgeRound(contact.groupChatBridge, context.round);
    }
    assert.equal(contact.groupChatBridge.roundIds.length, 3);
    assert.equal(chat.buildPrivateContext(contact, 'private-4'), null);
    chat.groups[0].history.push(...conversation(2, 20));
    assert.ok(chat.buildPrivateContext(contact, 'private-4'));
});
