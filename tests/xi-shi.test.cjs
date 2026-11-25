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
    const downloads = [], blobs = new Map();
    class Element {
        constructor() {
            this.children = []; this.events = {}; this.dataset = {}; this.value = ''; this.style = {};
            const classes = new Set(['hidden']);
            this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
        }
        append(...items) { this.children.push(...items); }
        appendChild(item) { this.append(item); }
        remove() { this.removed = true; }
        click() { downloads.push({ name: this.download, blob: blobs.get(this.href), anchor: this }); }
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
    const document = { body: new Element(), getElementById: get, createElement: () => new Element(), addEventListener() {},
        querySelector: selector => get(selector) };
    const context = vm.createContext({ document, console: { warn() {}, log() {}, group() {}, groupEnd() {} },
        Date: class extends Date { static now() { return now; } }, setTimeout, clearTimeout, Blob,
        URL: { createObjectURL: blob => { const url = `blob:${blobs.size}`; blobs.set(url, blob); return url; }, revokeObjectURL: url => blobs.delete(url) },
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
    // ★ 此处隔离浏览器 DOM；真实 Markdown、高亮节点和安全过滤由浏览器集成检查覆盖。
    context.XiShi.renderMarkdown = (text, keyword) => keyword
        ? context.App.highlightSearchText(text, keyword) : context.parseCustomMarkdown(text);
    const contact = { id: 'a', name: '<角色>', history: [], offlineHistory: [] };
    context.STATE.contacts = [contact];
    context.STATE.currentContactId = 'a';
    context.XiShi.contactId = 'a';
    return { ...context, contact, get, data, toasts, views, dialogs, downloads,
        clock: value => { now = value; }, fail: value => { fail = value; }, accept: value => { accepted = value; } };
}

test('整组收藏只保留文字快照，编辑/删除原消息不影响收藏，连点不会重复', async () => {
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
    assert.equal(Object.hasOwn(h.STATE.xiShiRecords[0], 'images'), false);
    assert.equal(h.toasts[0].options?.icon || 'check', 'xi-shi');
    assert.equal(h.toasts.at(-1).options?.icon || 'check', 'xi-shi');
    assert.equal(h.toasts.at(-1).text, '已收藏到夕拾');
});

// ★ 导出运行真实快照拆分和下载逻辑，覆盖跨角色隔离、面板排序、搜索不漏条及两种文件的实际字节内容。
test('夕拾导出只含当前角色全部快照，星标优先且时间倒序，JSON/TXT 保留正文、思考与图片描述', async () => {
    const h = harness();
    h.contact.name = '喜羊羊';
    h.STATE.xiShiRecords = [
        { id: 'late', contactId: 'a', role: 'assistant', text: '<think>珍惜这段相遇</think>我很开心能遇到你', imageDescription: '花园', messageTimeMs: 2000 },
        { id: 'other', contactId: 'b', role: 'user', text: '其他角色的收藏', messageTimeMs: 500 },
        { id: 'early', contactId: 'a', role: 'user', text: '[2026-11-25 12:00] 今天天气真好', messageTimeMs: 1000 },
        { id: 'pinned', contactId: 'a', role: 'user', text: '置顶收藏', messageTimeMs: 500, starredAt: 999 }
    ];
    const before = JSON.stringify(h.STATE.xiShiRecords);
    h.get('xi-shi-input').value = '不存在';
    h.XiShi.init();
    h.get('xi-shi-export-open').events.click();
    assert.equal(h.get('modal-xi-shi-export').classList.contains('hidden'), false);
    h.get('xi-shi-export-json').events.click();
    assert.equal(h.downloads.length, 1);
    const expected = [
        { role: 'user', context: '置顶收藏' },
        { role: 'assistant', context: '我很开心能遇到你\n\n【思考过程】\n珍惜这段相遇\n\n【图片描述】\n花园' },
        { role: 'user', context: '今天天气真好' }
    ];
    assert.deepEqual(JSON.parse(await h.downloads[0].blob.text()), expected);
    assert.match(h.downloads[0].name, /^喜羊羊的夕拾_\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(h.downloads[0].blob.type, 'application/json;charset=utf-8');
    assert.equal(h.downloads[0].anchor.removed, true);
    h.get('xi-shi-export-txt').events.click();
    assert.equal(await h.downloads[1].blob.text(), `我：\n${expected[0].context}\n\n喜羊羊：\n${expected[1].context}\n\n我：\n${expected[2].context}`);
    assert.equal(h.downloads[1].blob.type, 'text/plain;charset=utf-8');
    assert.equal(JSON.stringify(h.STATE.xiShiRecords), before);
    assert.equal(h.get('modal-xi-shi-export').classList.contains('hidden'), false);
    h.get('xi-shi-export-close').events.click();
    assert.equal(h.get('modal-xi-shi-export').classList.contains('hidden'), true);
});

test('夕拾空列表禁止下载，独立思考/图片快照保留标签，下载失败提示且清理临时节点', async () => {
    const h = harness();
    h.XiShi.openExport();
    assert.equal(h.get('xi-shi-export-json').disabled, true);
    assert.equal(h.get('xi-shi-export-txt').disabled, true);
    h.XiShi.downloadExport('txt');
    assert.equal(h.downloads.length, 0);
    h.contact.name = '喜/羊:羊';
    h.STATE.xiShiRecords = [
        { contactId: 'a', role: 'assistant', text: '独立思考', bubbleType: 'thought', messageTimeMs: 1 },
        { contactId: 'a', role: 'user', text: '', imageDescription: '图片描述', bubbleType: 'image', messageTimeMs: 2 }
    ];
    h.XiShi.downloadExport('json');
    assert.deepEqual(JSON.parse(await h.downloads[0].blob.text()), [
        { role: 'user', context: '【图片描述】\n图片描述' },
        { role: 'assistant', context: '【思考过程】\n独立思考' }
    ]);
    assert.match(h.downloads[0].name, /^喜_羊_羊的夕拾_/);
    h.document.createElement = () => ({ click() { throw Error('下载失败'); }, remove() { this.removed = true; } });
    h.XiShi.downloadExport('txt');
    assert.equal(h.toasts.at(-1).text, '夕拾导出失败，请重试');
    assert.equal(h.document.body.children.at(-1).removed, true);
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

test('星标优先且组内按消息时间倒序，取消星标恢复消息时间顺序，搜索完整正文且不改变源列表', async () => {
    const h = harness();
    for (let n = 1; n <= 3; n++) {
        h.clock(n * 1000);
        const msg = { messageId: `m${n}`, timestamp: `2026-11-24 12:0${n}`, content: `${'长正文'.repeat(50)} 纪念 A+B ${n}` };
        h.contact.history.push(msg); await h.XiShi.collect(h.contact, msg);
    }
    const [a, b, c] = h.STATE.xiShiRecords;
    h.clock(4000); await h.XiShi.update(b.id);
    h.clock(5000); await h.XiShi.update(a.id);
    assert.deepEqual(Array.from(h.XiShi.sorted(), r => r.id), [b.id, a.id, c.id]);
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

// ★ 收藏顺序故意与消息顺序相反，星标顺序也反过来，避免只靠列表插入顺序碰巧通过。
test('消息实际时间决定排序，置顶内部也按消息时间倒序，同条消息的气泡按原文倒序', async () => {
    const h = harness();
    const older = { messageId: 'older', role: 'assistant', timestamp: '2026-11-20 10:00', content: '旧消息' };
    const newer = { messageId: 'newer', role: 'assistant', timestamp: '2026-11-24 10:00', content: '新消息第一段\n\n新消息第二段' };
    h.contact.history.push(older, newer);
    const firstKey = h.ChatBubbles.keyAt(newer, 0), secondKey = h.ChatBubbles.keyAt(newer, 1);
    await h.XiShi.collectMany(h.contact, [{ message: newer, key: secondKey }, { message: newer, key: firstKey }]);
    h.clock(9000); await h.XiShi.collect(h.contact, older);
    const [second, first, old] = h.STATE.xiShiRecords;
    assert.deepEqual(Array.from(h.XiShi.sorted(), r => r.id), [second.id, first.id, old.id]);
    h.clock(10000); await h.XiShi.update(second.id);
    h.clock(11000); await h.XiShi.update(old.id);
    assert.deepEqual(Array.from(h.XiShi.sorted(), r => r.id), [second.id, old.id, first.id]);
    h.contact.history = [];
    assert.deepEqual(Array.from(h.XiShi.sorted(), r => r.id), [second.id, old.id, first.id]);
});

test('文字、图片描述和思考气泡分别快照，单气泡去重不排斥整组收藏，原图不进入快照', async () => {
    const h = harness();
    const message = { messageId: 'all', role: 'assistant', content: '<think>思考内容</think>第一段\n\n第二段',
        timestamp: '2026-11-24 10:00', images: ['data:image/png;base64,aaa'], image_description: '图片内容' };
    h.contact.history.push(message);
    h.ChatBubbles.ensure(message);
    const keys = [message.bubbleIds[0], message.imageBubbleKey, message.thoughtBubbleKey];
    await h.XiShi.collectMany(h.contact, keys.map(key => ({ message, key })));
    const [text, image, thought] = h.STATE.xiShiRecords;
    assert.equal(text.text, '第一段'); assert.equal(Object.hasOwn(text, 'images'), false); assert.equal(text.imageDescription, '');
    assert.equal(image.text, ''); assert.equal(Object.hasOwn(image, 'images'), false); assert.equal(image.imageDescription, '图片内容');
    assert.equal(thought.text, '思考内容'); assert.equal(Object.hasOwn(thought, 'images'), false);
    assert.equal(h.XiShi.content(thought).thought, '思考内容');
    assert.equal(await h.XiShi.collectMany(h.contact, keys.map(key => ({ message, key }))), false);
    assert.equal(h.STATE.xiShiRecords.length, 3);
    await h.XiShi.collect(h.contact, message);
    assert.equal(h.STATE.xiShiRecords.length, 4);
    h.ChatBubbles.edit(message, '改写'); message.images[0] = '改图';
    assert.equal(text.text, '第一段'); assert.equal(Object.hasOwn(image, 'images'), false);
    assert.equal(thought.text, '思考内容');
});

test('批量收藏失败全部不提交，重试不丢条目；已删除气泡和消息不收藏邻居', async () => {
    const h = harness(), message = { messageId: 'batch', role: 'user', content: '第一段\n\n第二段' };
    h.contact.history.push(message);
    const key = h.ChatBubbles.keyAt(message, 0), other = h.ChatBubbles.keyAt(message, 1);
    const targets = [key, other].map(key => ({ message, key }));
    h.fail(true);
    assert.equal(await h.XiShi.collectMany(h.contact, targets), false);
    assert.equal(h.STATE.xiShiRecords.length, 0);
    h.fail(false); assert.equal(await h.XiShi.collectMany(h.contact, targets), true);
    assert.equal(h.STATE.xiShiRecords.length, 2);
    h.ChatBubbles.deleteParts(message, [key]);
    assert.equal(await h.XiShi.collectMany(h.contact, [{ message, key }]), false);
    h.contact.history = [{ messageId: 'neighbor', content: '邻居' }];
    assert.equal(await h.XiShi.collectMany(h.contact, [{ message, key: other }]), false);
    assert.equal(h.STATE.xiShiRecords.length, 2);
});

test('旧收藏按原消息时间排序，原文已删除时仍可按快照时间排序，不猜旧日期的年份', () => {
    const h = harness();
    h.contact.history = [{ messageId: 'old', eventAt: 1000 }, { messageId: 'new', eventAt: 2000 }];
    const record = (id, extra) => ({ id, contactId: 'a', source: 'history', sourceMessageId: id, text: id, ...extra });
    h.STATE.xiShiRecords = [record('old', { collectedAt: 9000 }), record('new', { collectedAt: 3000 })];
    assert.deepEqual(Array.from(h.XiShi.sorted(), r => r.id), ['new', 'old']);
    h.STATE.xiShiRecords.push(record('deleted', { messageTime: '2026-11-24 10:00', collectedAt: 1 }));
    assert.equal(h.XiShi.sorted()[0].id, 'deleted');
    assert.equal(h.XiShi.parseTime('Nov.24 10:00'), 0);
});

test('图片描述默认折叠、与正文分开，搜索折叠内容仍能命中并安全高亮', async () => {
    const h = harness();
    const message = { messageId: 'description', role: 'user', content: '[2026-11-25 12:00] 看这张图',
        images: ['data:image/png;base64,original'], image_description: '夕阳下的海边 <script> A+B' };
    h.contact.history.push(message);
    await h.XiShi.collect(h.contact, message);
    const record = h.STATE.xiShiRecords[0];
    assert.equal(Object.hasOwn(record, 'images'), false);
    assert.equal(Object.hasOwn(record, 'imageExpired'), false);
    assert.equal(h.XiShi.content(record).text, '看这张图');
    assert.equal(h.XiShi.content(record).imageDescription, '夕阳下的海边 <script> A+B');
    assert.equal(h.XiShi.sorted('a+b').length, 1);
    h.XiShi.render('xi-shi-detail');
    let html = h.get('xi-shi-list').children[0].innerHTML;
    assert.match(html, /<details class="xi-shi-thought xi-shi-image-description">/);
    assert.match(html, /aria-label="图片描述"/);
    assert.doesNotMatch(html, /<details[^>]*\sopen[\s>]|<img|<script>/);
    h.get('xi-shi-input').value = 'a+b'; h.get('xi-shi-input').events.search();
    html = h.get('xi-shi-list').children[0].innerHTML;
    assert.match(html, /<mark[^>]*>A\+B<\/mark>/);
    assert.equal(h.XiShi.renderImageDescription('', ''), '');
});

test('无描述的纯图片不产生空白收藏，整组有文字时只收藏文字，混合批量只保存可用内容', async () => {
    const h = harness();
    const image = { messageId: 'only-image', role: 'user', content: '[2026-11-25 12:00] ', images: ['original'] };
    const text = { messageId: 'with-text', role: 'user', content: '保留文字', images: ['original'] };
    h.contact.history.push(image, text);
    const key = h.ChatBubbles.keyAt(image, 0);
    assert.equal(await h.XiShi.collect(h.contact, image), false);
    assert.equal(await h.XiShi.collectMany(h.contact, [{ message: image, key }]), false);
    assert.equal(h.STATE.xiShiRecords.length, 0);
    assert.equal(h.toasts.at(-1).text, '没有可收藏的文字或图片描述');
    assert.equal(await h.XiShi.collectMany(h.contact, [{ message: image, key }, { message: text }]), true);
    assert.equal(h.STATE.xiShiRecords.length, 1);
    assert.equal(h.STATE.xiShiRecords[0].text, '保留文字');
    assert.equal(Object.hasOwn(h.STATE.xiShiRecords[0], 'images'), false);
});

test('旧收藏和导入备份移除原图，正文、图片描述及置顶保留，聊天原图不变', async () => {
    const h = harness();
    const contact = { ...h.contact, history: [{ messageId: 'old-image', role: 'user', content: '聊天正文', images: ['chat-original'] }] };
    const old = { id: 'legacy', contactId: 'a', source: 'history', sourceMessageId: 'old-image', role: 'user',
        text: '收藏正文', images: ['snapshot-original'], imageExpired: true, imageDescription: '旧识图描述', starredAt: 50 };
    await h.Storage.saveXiShi([old]);
    assert.equal(Object.hasOwn(h.data.get(h.CONFIG.XI_SHI_KEY)[0], 'images'), false);
    assert.equal(old.images[0], 'snapshot-original');
    const backup = { [h.CONFIG.STORAGE_KEY]: [contact], [h.CONFIG.XI_SHI_KEY]: [old] };
    await h.Storage.importFromBackup(backup);
    await h.Storage.load();
    const record = h.STATE.xiShiRecords[0];
    assert.equal(record.text, '收藏正文');
    assert.equal(record.imageDescription, '旧识图描述');
    assert.equal(record.starredAt, 50);
    assert.equal(Object.hasOwn(record, 'images'), false);
    assert.equal(Object.hasOwn(record, 'imageExpired'), false);
    assert.equal(h.STATE.contacts[0].history[0].images[0], 'chat-original');
    assert.equal(Object.hasOwn(h.data.get(h.CONFIG.XI_SHI_KEY)[0], 'images'), false);
});
