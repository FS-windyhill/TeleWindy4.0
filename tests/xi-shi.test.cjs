// ★ 夕拾回归：执行真实存储/搜索/菜单代码，保证快照独立、收藏去重和失败不丢数据。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('script.js', 'utf8');
const method = name => {
    const start = source.indexOf(`    ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    },', start) + 7);
};

function harness() {
    let now = 1000, serial = 0, fail = false, accepted = true;
    const elements = new Map(), toasts = [], views = [], dialogs = [], data = new Map();
    class Element {
        constructor() { this.children = []; this.events = {}; this.dataset = {}; this.value = ''; this.style = {}; }
        append(...items) { this.children.push(...items); }
        replaceChildren() { this.children = []; }
        addEventListener(type, callback) { this.events[type] = callback; }
        querySelector(selector) { return this.parts?.[selector]; }
        focus() {}
    }
    const get = id => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
    };
    get('xi-shi-search').parts = { input: get('xi-shi-input'), button: get('xi-shi-clear') };
    const document = { getElementById: get, createElement: () => new Element(), addEventListener() {},
        querySelector: selector => get(selector) };
    const context = vm.createContext({ document, console: { warn() {}, log() {}, group() {}, groupEnd() {} },
        Date: class extends Date { static now() { return now; } }, setTimeout, clearTimeout,
        localStorage: { getItem: () => null }, btoa: value => value,
        STATE: { contacts: [], xiShiRecords: [], settings: {} },
        Toast: { show: (text, options) => toasts.push({ text, options }) },
        UI: { switchView: view => views.push(view) },
        confirm: text => { dialogs.push(text); return accepted; } });
    vm.runInContext(fs.readFileSync('js/config.js', 'utf8') + '\nglobalThis.CONFIG = CONFIG;', context);
    vm.runInContext(fs.readFileSync('js/chat-bubbles.js', 'utf8') + '\nglobalThis.ChatBubbles = ChatBubbles;', context);
    context.ChatBubbles.newKey = () => `key-${++serial}`;
    vm.runInContext(fs.readFileSync('js/storage.js', 'utf8') + '\nglobalThis.Storage = Storage; globalThis.DB = DB;', context);
    context.DB.get = async key => structuredClone(data.get(key));
    context.DB.set = async (key, value) => {
        if (fail) throw Error('模拟磁盘写入失败');
        data.set(key, structuredClone(value));
    };
    context.DB.exportAll = async () => Object.fromEntries(data);
    context.DB.clear = async () => data.clear();
    const methods = ['escapeHtml', 'getInlineSearch', 'setInlineSearchStatus', 'createSearchPattern', 'matchesSearch',
        'highlightSearchText', 'renderSearchableText', 'buildSearchResultPreview', 'handleMessageAction', 'handleOfflineMessageAction'];
    vm.runInContext(`globalThis.App = ({${methods.map(method).join('\n')}});`, context);
    context.App.renderHeartNoteAvatar = () => '<img>';
    // ★ Markdown 渲染器已有聊天侧覆盖；这里只隔离渲染依赖，验证夕拾的拆分和交互。
    context.parseCustomMarkdown = text => context.App.escapeHtml(text);
    context.window = { getSelection: () => ({ toString: () => '' }) };
    vm.runInContext(fs.readFileSync('js/xi-shi.js', 'utf8') + '\nglobalThis.XiShi = XiShi;', context);
    const contact = { id: 'a', name: '<角色>', history: [], offlineHistory: [] };
    context.STATE.contacts = [contact];
    context.STATE.currentContactId = 'a';
    context.XiShi.contactId = 'a';
    return { ...context, contact, get, data, toasts, views, dialogs,
        clock: value => { now = value; }, fail: value => { fail = value; }, accept: value => { accepted = value; } };
}

test('整组收藏为独立快照：编辑/删除原消息、修改图片数组都不影响收藏，连点不会重复', async () => {
    const h = harness();
    const msg = { messageId: 'm', role: 'assistant', content: '第一段\n\n第二段', timestamp: '2026-11-24 12:00', images: ['data:image/png;base64,a'] };
    h.contact.history.push(msg);
    const first = h.XiShi.collect(h.contact, msg);
    const duplicate = h.XiShi.collect(h.contact, msg);
    msg.content = '已改写'; msg.images[0] = '新图'; h.contact.history = [];
    assert.equal(await first, true);
    assert.equal(await duplicate, false);
    assert.equal(h.STATE.xiShiRecords.length, 1);
    assert.equal(h.STATE.xiShiRecords[0].text, '第一段\n\n第二段');
    assert.equal(h.STATE.xiShiRecords[0].images[0], 'data:image/png;base64,a');
    assert.equal(h.toasts[0].options?.icon || 'check', 'check');
    assert.equal(h.toasts.at(-1).options?.icon || 'check', 'check');
    assert.equal(h.toasts.at(-1).text, '已收藏到夕拾');
});

test('线上/线下菜单按消息身份收藏整组，不会因菜单打开后插入消息而收藏邻居', async () => {
    const h = harness();
    const msg = { messageId: 'shared', content: '线上整组' };
    h.contact.history.push({ messageId: 'new', content: '插入的邻居' }, msg);
    h.contact.offlineHistory.push({ messageId: 'shared', content: '线下整组' });
    h.STATE.selectedMessageId = 'shared'; h.STATE.selectedMessageIndex = 0;
    h.App.handleMessageAction('collect-xi-shi');
    h.STATE.offlineSelectedMessageId = 'shared';
    h.App.handleOfflineMessageAction('collect-xi-shi');
    await h.XiShi.pending;
    assert.deepEqual(Array.from(h.STATE.xiShiRecords, r => r.text), ['线上整组', '线下整组']);
    assert.equal(h.STATE.xiShiRecords.length, 2);
});

test('星标按操作时间置顶，取消星标恢复收藏时间顺序，搜索完整正文且不改变源列表', async () => {
    const h = harness();
    for (let n = 1; n <= 3; n++) {
        h.clock(n * 1000);
        const msg = { messageId: `m${n}`, content: `${'长正文'.repeat(50)} 纪念 A+B ${n}` };
        h.contact.history.push(msg); await h.XiShi.collect(h.contact, msg);
    }
    const [a, b, c] = h.STATE.xiShiRecords;
    h.clock(4000); await h.XiShi.update(b.id);
    h.clock(5000); await h.XiShi.update(a.id);
    assert.deepEqual(Array.from(h.XiShi.sorted(), r => r.id), [a.id, b.id, c.id]);
    assert.equal(h.XiShi.sorted('a+b').length, 3);
    assert.equal(h.XiShi.sorted('不存在').length, 0);
    await h.XiShi.update(a.id);
    assert.deepEqual(Array.from(h.XiShi.sorted(), r => r.id), [b.id, c.id, a.id]);
    assert.deepEqual(Array.from(h.STATE.xiShiRecords, r => r.id), [a.id, b.id, c.id]);
});

test('取消收藏需要确认，原聊天不变；取消后可以再次收藏', async () => {
    const h = harness(), msg = { messageId: 'm', content: '纪念' };
    h.contact.history.push(msg); await h.XiShi.collect(h.contact, msg);
    const id = h.STATE.xiShiRecords[0].id;
    h.accept(false); await h.XiShi.update(id, true);
    assert.equal(h.STATE.xiShiRecords.length, 1);
    h.accept(true); await h.XiShi.update(id, true);
    assert.equal(h.STATE.xiShiRecords.length, 0);
    assert.equal(h.contact.history[0], msg);
    assert.equal(h.dialogs[0], '确定取消收藏吗？不会删除聊天记录原文');
    assert.equal(await h.XiShi.collect(h.contact, msg), true);
});

test('保存失败不提交收藏/星标/取消操作，后续重试可恢复', async () => {
    const h = harness(), msg = { messageId: 'm', content: '纪念' };
    h.contact.history.push(msg);
    h.fail(true); assert.equal(await h.XiShi.collect(h.contact, msg), false);
    assert.equal(h.STATE.xiShiRecords.length, 0);
    h.fail(false); await h.XiShi.collect(h.contact, msg);
    const id = h.STATE.xiShiRecords[0].id;
    h.fail(true); await h.XiShi.update(id); await h.XiShi.update(id, true);
    assert.equal(h.STATE.xiShiRecords[0].starredAt, 0);
    assert.equal(h.STATE.xiShiRecords.length, 1);
    assert.equal(h.toasts.at(-1).text, '夕拾保存失败，请重试');
});

test('旧消息补存稳定 ID，重新加载/备份导入后快照和去重仍然有效，旧备份默认为空', async () => {
    const h = harness(), msg = { content: '旧纪念' };
    h.contact.history.push(msg); await h.XiShi.collect(h.contact, msg);
    assert.ok(msg.messageId);
    const backup = await h.Storage.exportAllForBackup();
    assert.ok(backup[h.CONFIG.XI_SHI_KEY]);
    h.STATE.xiShiRecords = [];
    await h.Storage.importFromBackup(backup);
    await h.Storage.load();
    assert.equal(h.STATE.xiShiRecords[0].text, '旧纪念');
    assert.equal(await h.XiShi.collect(h.STATE.contacts[0], h.STATE.contacts[0].history[0]), false);
    h.data.delete(h.CONFIG.XI_SHI_KEY);
    await h.Storage.load();
    assert.equal(h.STATE.xiShiRecords.length, 0);
});

test('角色全量显示统计和箭头；搜索安全高亮、清空与换角色重置，图片地址不执行脚本', async () => {
    const h = harness(), msg = { messageId: 'm', content: '纪念 <script> A+B', images: ['javascript:alert(1)'] };
    h.contact.history.push(msg); await h.XiShi.collect(h.contact, msg);
    h.STATE.contacts.push({ id: 'empty', name: '空角色' });
    h.XiShi.render('xi-shi');
    assert.equal(h.get('xi-shi-contacts').children.length, 2);
    assert.match(h.get('xi-shi-contacts').children[0].innerHTML, /共 1 条夕拾/);
    assert.match(h.get('xi-shi-contacts').children[1].innerHTML, /共 0 条夕拾/);
    h.XiShi.render('xi-shi-detail');
    h.get('xi-shi-input').value = 'a+b'; h.get('xi-shi-input').events.search();
    const card = h.get('xi-shi-list').children[0];
    assert.match(card.innerHTML, /<mark[^>]*>A\+B<\/mark>/);
    assert.doesNotMatch(card.innerHTML, /<script>/);
    assert.equal(card.children.length, 0);
    h.get('xi-shi-clear').events.click();
    assert.equal(h.get('xi-shi-input').value, '');
    h.get('xi-shi-input').value = '纪念'; h.get('xi-shi-input').events.search();
    h.XiShi.contactId = 'empty'; h.XiShi.render('xi-shi-detail');
    assert.equal(h.get('xi-shi-input').value, '');
    assert.equal(h.get('xi-shi-detail-empty').hidden, false);
    h.XiShi.contactId = 'deleted'; h.XiShi.render('xi-shi-detail');
    assert.equal(h.views.at(-1), 'xi-shi');
});

test('角色快照拆分三种思考标签并兼容未闭合块，用户原文和保存快照保持不变', () => {
    const h = harness();
    for (const tag of ['think', 'thinking', 'thought']) {
        const record = { role: 'assistant', text: `<${tag}>第一段思考</${tag}>\n纪念正文\n<${tag}>第二段思考`, images: [] };
        const original = record.text;
        const content = h.XiShi.content(record);
        assert.equal(content.thought, '第一段思考\n\n第二段思考');
        assert.equal(content.text, '纪念正文');
        assert.equal(record.text, original);
        assert.equal(h.XiShi.content({ ...record, role: 'user' }).text, original);
        assert.equal(h.XiShi.content({ ...record, role: 'user' }).thought, '');
    }
});

test('思考链默认折叠且从正文剥离，全文搜索仍命中折叠内容并安全高亮', async () => {
    const h = harness();
    const msg = { role: 'assistant', messageId: 'thought', content: '<think>隐秘纪念 <img onerror=alert(1)></think>\n可见正文' };
    h.contact.history.push(msg); await h.XiShi.collect(h.contact, msg);
    h.XiShi.render('xi-shi-detail');
    let html = h.get('xi-shi-list').children[0].innerHTML;
    assert.match(html, /<details class="xi-shi-thought">/);
    assert.doesNotMatch(html, /<details[^>]*\sopen[\s>]/);
    assert.match(html, /class="heart-note-text xi-shi-text">可见正文<\/div>/);
    assert.doesNotMatch(html, /<think>|<img onerror/);
    h.get('xi-shi-input').value = '隐秘纪念'; h.get('xi-shi-input').events.search();
    assert.equal(h.get('xi-shi-list').children.length, 1);
    html = h.get('xi-shi-list').children[0].innerHTML;
    assert.match(html, /<mark[^>]*>隐秘纪念<\/mark>/);
    assert.match(html, /&lt;img onerror/);
    assert.equal(h.XiShi.renderThought('', ''), '');
});

test('展开后点模块任意非标题区域收起，summary 保留原生行为，划选文字时不收起', () => {
    const h = harness();
    const details = { open: true, removeAttribute(name) { if (name === 'open') this.open = false; } };
    const event = summary => ({ target: { closest: selector => selector === '.xi-shi-thought' ? details : summary } });
    assert.equal(h.XiShi.handleThoughtClick(event(null)), true);
    assert.equal(details.open, false);
    details.open = true;
    h.XiShi.handleThoughtClick(event({}));
    assert.equal(details.open, true);
    h.window.getSelection = () => ({ toString: () => '准备复制的思考' });
    h.XiShi.handleThoughtClick(event(null));
    assert.equal(details.open, true);
    assert.equal(h.XiShi.handleThoughtClick({ target: { closest: () => null } }), false);
});
