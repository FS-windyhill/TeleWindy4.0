// 线下卡片追加：验证新消息只追加一张卡片、旧卡片 DOM 不重建，并按 messageId 去重。
// 运行：node --test tests/offline-append.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
function block(start, end) {
    const i = source.indexOf(start);
    const j = source.indexOf(end, i);
    assert.ok(i >= 0 && j > i, `missing block: ${start}`);
    return source.slice(i, j);
}

function createHarness() {
    const built = [];
    const container = {
        children: [],
        appendChild(el) { this.children.push(el); }
    };
    const makeCard = (msg, index) => {
        const classes = new Set();
        const card = {
            dataset: { messageId: String(msg.messageId || '') },
            classList: {
                add(name) { classes.add(name); },
                contains(name) { return classes.has(name); }
            },
            remove() {
                const i = container.children.indexOf(this);
                if (i >= 0) container.children.splice(i, 1);
            }
        };
        built.push({ msg, index, card });
        return card;
    };

    const context = vm.createContext({ console });
    const methods = vm.runInContext(
        '({' + block('    appendOfflineCard(contact, msg, options = {}) {', '    updateOfflineHeader(contact) {') + '})',
        context
    );

    let scrollCalls = 0;
    let rerollStateCalls = 0;
    const UI = Object.assign({}, methods, {
        els: { offlineMsgs: container },
        buildOfflineCard(contact, msg, index) { return makeCard(msg, index); },
        scrollToOfflineBottom() { scrollCalls += 1; },
        updateOfflineRerollState() { rerollStateCalls += 1; }
    });
    return {
        UI,
        container,
        built,
        getScrollCalls: () => scrollCalls,
        getRerollStateCalls: () => rerollStateCalls
    };
}

function makeMsg(messageId, role = 'user') {
    return { role, content: messageId, timestamp: '2026-10-31 10:00', messageId };
}

test('线下追加卡片只创建新卡片，旧卡片 DOM 不重建', () => {
    const h = createHarness();
    const contact = { name: '角色', offlineHistory: [] };

    const first = makeMsg('m1');
    contact.offlineHistory.push(first);
    const firstCard = h.UI.appendOfflineCard(contact, first);

    const second = makeMsg('m2', 'assistant');
    contact.offlineHistory.push(second);
    const secondCard = h.UI.appendOfflineCard(contact, second);

    assert.equal(h.container.children.length, 2);
    assert.equal(h.container.children[0], firstCard);
    assert.equal(h.container.children[1], secondCard);
    assert.equal(h.built.length, 2);
    assert.equal(firstCard.classList.contains('card-enter'), true);
    assert.equal(secondCard.classList.contains('card-enter'), true);
    assert.equal(h.getScrollCalls(), 2);
});

test('同一 messageId 不重复追加；关闭动画时不加 card-enter', () => {
    const h = createHarness();
    const contact = { name: '角色', offlineHistory: [] };

    const first = makeMsg('m1');
    contact.offlineHistory.push(first);
    h.UI.appendOfflineCard(contact, first);
    h.UI.appendOfflineCard(contact, first);
    assert.equal(h.container.children.length, 1);
    assert.equal(h.built.length, 1);

    const second = makeMsg('m2');
    contact.offlineHistory.push(second);
    const card = h.UI.appendOfflineCard(contact, second, { animate: false });
    assert.equal(card.classList.contains('card-enter'), false);
});

test('removeOfflineCards 只摘除匹配卡片；缺 messageId 时返回 false 交给整页重绘', () => {
    const h = createHarness();
    const contact = { name: '角色', offlineHistory: [] };

    const first = makeMsg('m1');
    const second = makeMsg('m2', 'assistant');
    contact.offlineHistory.push(first, second);
    h.UI.appendOfflineCard(contact, first);
    h.UI.appendOfflineCard(contact, second);

    assert.equal(h.UI.removeOfflineCards(contact, [second]), true);
    assert.deepEqual(h.container.children.map(card => card.dataset.messageId), ['m1']);

    assert.equal(h.UI.removeOfflineCards(contact, [{ role: 'assistant' }]), false);
    assert.equal(h.container.children.length, 1);
    assert.equal(h.getRerollStateCalls(), 3);
});
