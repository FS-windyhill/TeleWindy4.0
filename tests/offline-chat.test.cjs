// 线下见面模式纯逻辑测试
// 运行：node tests/offline-chat.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ChatBubbles 是 HistoryVisibility / OfflineChat 的共同依赖
global.ChatBubbles = require('../js/chat-bubbles.js');

// history-visibility.js 没有 CommonJS 导出，用 vm 载入后挂到全局（与 storage-space 测试同一套路）
const hvSource = fs.readFileSync(path.join(__dirname, '../js/history-visibility.js'), 'utf8');
const hvModule = { exports: {} };
vm.runInNewContext(`${hvSource}\nmodule.exports = HistoryVisibility;`, {
    module: hvModule,
    ChatBubbles: global.ChatBubbles
});
global.HistoryVisibility = hvModule.exports;

const OfflineChat = require('../js/offline-chat.js');

function makeMsg(overrides = {}) {
    return {
        role: 'user',
        content: '你好',
        timestamp: '2026-10-29 21:11',
        messageId: `msg_${Math.random().toString(36).slice(2, 10)}`,
        ...overrides
    };
}

test('ensureFields 给旧数据补默认字段，且不覆盖已有值', () => {
    const contact = {};
    assert.equal(OfflineChat.ensureFields(contact), true);
    assert.equal(contact.chatMode, 'online');
    assert.deepEqual(contact.offlineHistory, []);
    assert.equal(contact.offlineBridgeRoundsLeft, 0);
    assert.equal(contact.offlineRecapRoundsLeft, 0);

    // 第二次调用不再产生变更
    assert.equal(OfflineChat.ensureFields(contact), false);

    // 已有 offlineHistory / chatMode 不被清空或覆盖
    contact.offlineHistory = [makeMsg()];
    contact.chatMode = 'offline';
    OfflineChat.ensureFields(contact);
    assert.equal(contact.offlineHistory.length, 1);
    assert.equal(contact.chatMode, 'offline');

    // 非法 chatMode 归位为 online
    const broken = { chatMode: 'whatever' };
    OfflineChat.ensureFields(broken);
    assert.equal(broken.chatMode, 'online');
});

test('buildBridgeMessages 取线上最后 6 条可见消息，隐藏消息被剔除', () => {
    const history = [];
    for (let i = 1; i <= 8; i++) {
        history.push(makeMsg({ content: `[2026-10-29 10:${String(i).padStart(2, '0')}] 线上消息${i}` }));
        history.push(makeMsg({ role: 'assistant', content: `回复${i}` }));
    }
    // 隐藏倒数第 3 条（一条 user 消息）
    history[history.length - 3].isHidden = true;
    history[history.length - 3].content = '[2026-10-29 10:99] 这条不该出现';

    const bridge = OfflineChat.buildBridgeMessages(history);
    assert.equal(bridge.length, 6);
    assert.ok(bridge.every(m => !m.content.includes('这条不该出现')));
    // 最后一条就是线上最新消息
    assert.equal(bridge[bridge.length - 1].content, history[history.length - 1].content);
    // 顺序保持从旧到新：16 条消息隐藏第 14 条（回复7）后，可见的最近 6 条从「回复5」开始
    assert.equal(bridge[0].content, '回复5');
});

test('buildBridgeMessages：user 带时间戳前缀、assistant 不带、图片以描述文本注入', () => {
    const history = [
        makeMsg({ role: 'assistant', content: '角色的话' }),
        makeMsg({ content: '[2026-10-29 21:00] 看这张图', image_description: '一张猫猫图片' })
    ];
    const bridge = OfflineChat.buildBridgeMessages(history);
    assert.equal(bridge.length, 2);
    assert.equal(bridge[0].content, '角色的话');
    assert.ok(bridge[1].content.startsWith('[2026-10-29 21:00] 看这张图'));
    assert.ok(bridge[1].content.includes('[System Info: 对方发送了一张图片，图片内容描述: 一张猫猫图片]'));
});

test('桥接轮次：前 2 轮注入；reroll 同轮不重复扣；第 3 轮停止', () => {
    const contact = {};
    OfflineChat.ensureFields(contact);
    OfflineChat.armBridge(contact);
    assert.ok(OfflineChat.shouldInjectBridge(contact));

    // 第 1 轮成功
    assert.equal(OfflineChat.consumeBridgeRound(contact, 'u1'), true);
    assert.equal(contact.offlineBridgeRoundsLeft, 1);
    // reroll 复用同一轮 id，不重复扣
    assert.equal(OfflineChat.consumeBridgeRound(contact, 'u1'), false);
    assert.equal(contact.offlineBridgeRoundsLeft, 1);
    assert.ok(OfflineChat.shouldInjectBridge(contact));

    // 第 2 轮成功后用完
    assert.equal(OfflineChat.consumeBridgeRound(contact, 'u2'), true);
    assert.equal(contact.offlineBridgeRoundsLeft, 0);
    assert.ok(!OfflineChat.shouldInjectBridge(contact));
    assert.equal(OfflineChat.consumeBridgeRound(contact, 'u3'), false);
});

test('armRecap/buildRecapPrompt：线下最后一条消息 + 前后标记 + 时间戳取自存储', () => {
    const contact = {};
    OfflineChat.ensureFields(contact);
    contact.offlineHistory = [
        makeMsg({ content: '[2026-10-29 21:30] 我们到了咖啡馆', timestamp: '2026-10-29 21:30' }),
        makeMsg({ role: 'assistant', content: '你挑了个靠窗的位置。', timestamp: '2026-10-29 21:34' })
    ];
    OfflineChat.armRecap(contact);
    assert.ok(OfflineChat.shouldInjectRecap(contact));
    assert.equal(OfflineChat.buildRecapPrompt(contact), [
        '[你们2026-10-29 21:34线下见面时的场景]',
        '你挑了个靠窗的位置。',
        '[你们线下见面时的场景 END]'
    ].join('\n'));
});

test('recap 消费：2 轮后停止，reroll 不重复扣；空会话不武装回顾', () => {
    const contact = {};
    OfflineChat.ensureFields(contact);
    contact.offlineHistory = [makeMsg({ content: '[2026-10-29 21:00] 见面内容', timestamp: '2026-10-29 21:00' })];
    OfflineChat.armRecap(contact);

    assert.equal(OfflineChat.consumeRecapRound(contact, 'r1'), true);
    assert.equal(contact.offlineRecapRoundsLeft, 1);
    assert.equal(OfflineChat.consumeRecapRound(contact, 'r1'), false); // reroll 同轮
    assert.equal(OfflineChat.consumeRecapRound(contact, 'r2'), true);
    assert.equal(contact.offlineRecapRoundsLeft, 0);
    assert.equal(OfflineChat.buildRecapPrompt(contact), '');

    const empty = {};
    OfflineChat.ensureFields(empty);
    OfflineChat.armRecap(empty);
    assert.equal(empty.offlineRecap, null);
    assert.equal(empty.offlineRecapRoundsLeft, 0);
    assert.equal(OfflineChat.buildRecapPrompt(empty), '');
});

test('recap 回退：最后一条被隐藏时取最近一条可见消息', () => {
    const contact = {};
    OfflineChat.ensureFields(contact);
    contact.offlineHistory = [
        makeMsg({ content: '[2026-10-29 21:00] 可见的话', timestamp: '2026-10-29 21:00' }),
        makeMsg({ role: 'assistant', content: '被隐藏的回复', timestamp: '2026-10-29 21:05', isHidden: true })
    ];
    OfflineChat.armRecap(contact);
    const prompt = OfflineChat.buildRecapPrompt(contact);
    assert.ok(prompt.includes('可见的话'));
    assert.ok(!prompt.includes('被隐藏的回复'));
    assert.ok(prompt.startsWith('[你们2026-10-29 21:00线下见面时的场景]'));
});

test('卡片展示辅助：时间 / 日期 / 楼层号（删除补位按当前序号）', () => {
    assert.equal(OfflineChat.buildTimeLabel('2026-10-29 21:11'), '21:11');
    assert.equal(OfflineChat.buildDateLabel('2026-10-29 21:11'), '2026年10月29日');
    assert.equal(OfflineChat.buildFloorLabel(0), '1#');
    assert.equal(OfflineChat.buildFloorLabel(11), '12#');
    assert.equal(OfflineChat.buildTimeLabel(''), '');
    assert.equal(OfflineChat.buildDateLabel('bad'), '');
});

test('常量 sanity：桥接 6 条 / 桥接 2 轮 / 回顾 2 轮（独立常量）/ 恒定 system', () => {
    assert.equal(OfflineChat.BRIDGE_MESSAGE_COUNT, 6);
    assert.equal(OfflineChat.BRIDGE_ROUNDS, 2);
    assert.equal(OfflineChat.RECAP_ROUNDS, 2);
    assert.equal(OfflineChat.SYSTEM_PROMPT, '你们正在线下见面。');
    assert.equal(OfflineChat.isOffline({ chatMode: 'offline' }), true);
    assert.equal(OfflineChat.isOffline({ chatMode: 'online' }), false);
    assert.equal(OfflineChat.isOffline({}), false);
});
