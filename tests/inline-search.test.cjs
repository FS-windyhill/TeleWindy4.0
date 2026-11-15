// ★ 列表搜索回归：覆盖真实渲染方法，防止筛选影响源数据、原始 id 和注入视图。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');
const method = name => {
    const start = source.indexOf(`    ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    },', start) + 7);
};

// 只模拟本功能使用的 DOM 接口，执行工程内的方法而非复制搜索实现。
class Element {
    constructor() {
        this.value = '';
        this.innerHTML = '';
        this.dataset = {};
        this.style = {};
        this.children = [];
        this.listeners = {};
        this.classList = { add() {}, toggle() {} };
    }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    emit(type) { this.listeners[type]?.(); }
    appendChild(child) { this.children.push(child); }
    setAttribute() {}
    focus() { this.focused = true; }
    querySelector(selector) { return this.parts?.[selector] || null; }
}

function setup() {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
    };
    for (const scope of ['memory', 'heart-note', 'wi']) {
        element(`${scope}-search`).parts = {
            input: element(`${scope}-search-input`), button: element(`${scope}-clear`)
        };
    }
    const document = {
        getElementById: element,
        querySelector: selector => selector.endsWith('.inline-search-status') ? element(selector) : null,
        querySelectorAll: () => [],
        createElement: () => new Element()
    };
    const STATE = {
        currentBookId: 'book', currentMemoryContactId: 'friend', currentHeartNoteContactId: 'friend',
        contacts: [{ id: 'friend', name: '朋友' }], worldInfoBooks: []
    };
    const memory = { injectDays: 3, records: [
        { dateKey: '2026-11-15', memories: [{ id: 'first', text: '英语考试' }, { id: 'second', text: '数学考试' }] },
        { dateKey: '2026-11-14', memories: [{ id: 'third', text: '数学作业' }] }
    ] };
    const notebook = { injectDays: 3, records: [
        { id: 'note-a', text: '数学考试', createdAt: 2 }, { id: 'note-b', text: '英语考试', createdAt: 1 }
    ] };
    const context = vm.createContext({ document, STATE, console: { trace() {} }, Date, setTimeout, clearTimeout,
        CharacterMemory: { ensureMemory: () => memory, getInjectRecords: () => [memory.records[0]] },
        AgentHeartNoteManager: { ensureNotebook: () => notebook, getInjectRecords: () => [notebook.records[1]] }
    });
    const methods = ['escapeHtml', 'getInlineSearch', 'setInlineSearchStatus', 'createSearchPattern', 'matchesSearch',
        'highlightSearchText', 'renderSearchableText', 'buildSearchResultPreview', 'getCharacterMemoryDetailRecords',
        'createCharacterMemoryCard', 'renderCharacterMemoryDetail', 'renderHeartNoteDetail'];
    const app = vm.runInContext(`globalThis.App = ({${methods.map(method).join('\n')}})`, context);
    app.getCharacterMemoryStatusText = () => '';
    app.formatHeartNoteTime = () => '11-15';
    app.loadWorldInfoEntry = id => { app.selectedId = id; };
    const ui = vm.runInContext(`({${method('renderWorldInfoList')}})`, context);
    ui.els = { wiList: element('wi-list-container') };
    const query = (scope, text, render) => {
        app.getInlineSearch(scope, scope === 'wi' ? 'book' : 'friend', render);
        element(`${scope}-search-input`).value = text;
        element(`${scope}-search-input`).emit('search');
    };
    return { app, ui, STATE, memory, notebook, element, query };
}

test('世界书匹配名称和触发词，不匹配详细正文，点击仍使用条目 uid', () => {
    const { app, ui, STATE, element, query } = setup();
    STATE.worldInfoBooks = [{ id: 'book', entries: [
        { uid: 'grass', comment: '青青草原', keys: ['喜羊羊', '懒羊羊'], content: '森林' },
        { uid: 'other', comment: '其他', keys: [], content: '喜羊羊' }
    ] }];
    const render = () => { element('wi-list-container').children = []; ui.renderWorldInfoList(); };
    query('wi', '喜羊羊', render);
    const items = element('wi-list-container').children;
    assert.equal(items.length, 1);
    assert.match(items[0].innerHTML, /青青草原/);
    assert.match(items[0].innerHTML, /<mark[^>]*>喜羊羊<\/mark>/);
    items[0].onclick();
    assert.equal(app.selectedId, 'grass');
    query('wi', '青青草原', render);
    assert.equal(element('wi-list-container').children.length, 1);
    assert.equal(element('wi-edit-uid').value, '');
});

test('记忆按单条筛选，日期分组和原始 id 保留，源数据不变', () => {
    const { app, memory, element, query } = setup();
    const before = JSON.stringify(memory);
    query('memory', '数学', () => app.renderCharacterMemoryDetail());
    const cards = element('character-memory-detail-list').children;
    assert.equal(cards.length, 2);
    assert.match(cards[0].innerHTML, /data-id="second"/);
    assert.doesNotMatch(cards[0].innerHTML, /data-id="first"/);
    assert.equal(cards[0].dataset.dateKey, '2026-11-15');
    assert.equal(JSON.stringify(memory), before);
});

test('搜索与注入标签叠加，清空恢复当前标签，换角色清空关键词', () => {
    const { app, STATE, element, query } = setup();
    const render = () => { element('heart-note-detail-list').children = []; app.renderHeartNoteDetail(); };
    query('heart-note', '数学', render);
    assert.equal(element('heart-note-detail-list').children.length, 1);
    STATE.heartNoteViewMode = 'injected';
    render();
    assert.equal(element('heart-note-detail-list').children.length, 0);
    assert.match(element('#heart-note-search .inline-search-status').textContent, /没有找到/);
    element('heart-note-clear').emit('click');
    assert.equal(element('heart-note-detail-list').children.length, 1);
    assert.equal(element('heart-note-detail-list').children[0].dataset.id, 'note-b');
    query('heart-note', '英语', render);
    STATE.currentHeartNoteContactId = 'other';
    render();
    assert.equal(element('heart-note-search-input').value, '');
});

test('中文输入期间不筛选，确认后可搜索，清空取消待执行筛选', () => {
    const { app, element } = setup();
    let count = 0;
    const render = () => count++;
    app.getInlineSearch('memory', 'friend', render);
    const input = element('memory-search-input');
    input.emit('compositionstart');
    input.value = 'kao';
    input.emit('input');
    assert.equal(app.inlineSearchStates.memory.timer, null);
    assert.equal(count, 0);
    input.value = '考试';
    input.emit('compositionend');
    input.emit('search');
    assert.equal(app.inlineSearchStates.memory.keyword, '考试');
    element('memory-clear').emit('click');
    assert.equal(app.inlineSearchStates.memory.keyword, '');
});

test('摘要 35 字、最多三段，展开全文仍安全高亮，符号按字面搜索', () => {
    const { app } = setup();
    const preview = app.buildSearchResultPreview('甲'.repeat(60) + '考试' + '乙'.repeat(60), '考试');
    assert.equal(Array.from(preview.replace(/<[^>]*>/g, '').replace(/…/g, '')).length, 35);
    const long = ('考试' + '😀'.repeat(40)).repeat(5);
    const html = app.renderSearchableText(long, '考试');
    assert.match(html, /<details/);
    assert.match(html, /本条共命中 5 处/);
    assert.equal((app.buildSearchResultPreview(long, '考试').match(/search-result-snippet/g) || []).length, 3);
    assert.doesNotMatch(app.renderSearchableText('考试<b>', '考试'), /<b>/);
    assert.match(app.highlightSearchText('A+B <img>', 'a+b'), /<mark[^>]*>A\+B<\/mark> &lt;img&gt;/);
    assert.equal(app.matchesSearch('aaaa', 'a+b'), false);
    assert.doesNotMatch(app.renderSearchableText('数学考试', '考试'), /<details/);
});
