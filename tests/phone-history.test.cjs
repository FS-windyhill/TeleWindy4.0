// ★ 通话历史只读浏览：验证三级导航、排序和原文安全展示，不调用真实语音/模型接口。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
    const elements = new Map(), views = [];
    const element = () => ({ children: [], events: {}, scrollTop: 80,
        append(child) { this.children.push(child); },
        replaceChildren() { this.children = []; },
        addEventListener(name, callback) { this.events[name] = callback; } });
    const get = id => {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
    };
    const context = { STATE: { contacts: [] }, UI: { switchView: view => views.push(view) },
        App: { escapeHtml: value => String(value).replaceAll('<', '&lt;'), renderHeartNoteAvatar: () => '<img>' },
        document: { getElementById: get, createElement: element, addEventListener() {} } };
    vm.runInNewContext(fs.readFileSync('js/phone-history.js', 'utf8') + '\nglobalThis.history = PhoneHistory;', context);
    return { history: context.history, state: context.STATE, get, views };
}

test('联系人全量展示，最近通话者置前；逐级进入后原文从顶部阅读', () => {
    const { history, state, get, views } = harness();
    const record = (id, time) => ({ id, startedAt: time, updatedAt: time + 9000, endedAt: time + 9000,
        messages: [{ role: 'assistant', content: '<script>原文</script>', heard: false }, { role: 'user', content: '回答' }] });
    state.contacts = [{ id: 'empty', name: '无记录' },
        { id: 'old', name: '旧联系人', phoneRecords: [record('old-call', 1000)] },
        { id: 'new', name: '<新联系人>', phoneRecords: [record('first', 2000), record('latest', 3000)] }];
    history.render('phone-history');
    const contacts = get('phone-history-contacts').children;
    assert.equal(contacts.length, 3);
    assert.match(contacts[0].innerHTML, /&lt;新联系人>/);
    assert.match(contacts[1].innerHTML, /旧联系人/);
    assert.match(contacts[2].innerHTML, /暂无通话记录/);
    assert.equal(state.contacts[0].id, 'empty');
    contacts[0].events.click();
    assert.equal(views.at(-1), 'phone-history-calls');
    history.render('phone-history-calls');
    const calls = get('phone-history-calls-list').children.filter(c => c.events.click);
    calls[0].events.click();
    assert.equal(history.recordId, 'latest');
    assert.equal(views.at(-1), 'phone-history-detail');
    history.render('phone-history-detail');
    const transcript = get('phone-history-transcript');
    assert.equal(transcript.scrollTop, 0);
    assert.equal(transcript.children.length, 2);
    assert.equal(transcript.children[0].textContent, '<script>原文</script>');
    assert.equal(transcript.children[0].children[0].textContent, '未完整播放');
    assert.equal(transcript.children[1].className, 'phone-bubble user');
    assert.equal(history.duration(state.contacts[2].phoneRecords[0]), '00:09');
});

test('空列表与被删除的联系人/记录可安全返回', () => {
    const { history, state, get, views } = harness();
    history.render('phone-history');
    assert.equal(get('phone-history-empty').hidden, false);
    history.contactId = 'missing';
    history.render('phone-history-calls');
    assert.equal(views.at(-1), 'phone-history');
    state.contacts.push({ id: 'missing', name: '角色', phoneRecords: [] });
    history.render('phone-history');
    assert.equal(get('phone-history-empty').hidden, true);
    get('phone-history-contacts').children[0].events.click();
    history.render('phone-history-calls');
    assert.equal(get('phone-history-calls-empty').hidden, false);
    history.render('phone-history-detail');
    assert.equal(views.at(-1), 'phone-history-calls');
});

test('全员无通话及同时间通话保持通讯录顺序，通话后只调整展示顺序', () => {
    const { history, state, get } = harness();
    state.contacts = [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }, { id: 'c', name: '丙' }];
    const order = () => get('phone-history-contacts').children.map(c => {
        c.events.click(); return history.contactId;
    });
    history.render('phone-history');
    assert.deepEqual(order(), ['a', 'b', 'c']);
    state.contacts[1].phoneRecords = [{ startedAt: 1000 }];
    state.contacts[2].phoneRecords = [{ startedAt: 1000 }];
    history.render('phone-history');
    assert.deepEqual(order(), ['b', 'c', 'a']);
    state.contacts[2].phoneRecords.push({ startedAt: 2000 });
    history.render('phone-history');
    assert.deepEqual(order(), ['c', 'b', 'a']);
    assert.deepEqual(state.contacts.map(c => c.id), ['a', 'b', 'c']);
});
