const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ★ 只装入存储管理模块；用假的数据库和页面节点验证旧记录与清理结果。
function createManager({ contacts, failSave = false, confirmResult = true } = {}) {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, {
            textContent: '', disabled: false,
            classList: { add() {}, remove() {} },
            setAttribute() {}
        });
        return elements.get(id);
    };
    let saved = null;
    let confirmText = '';
    const selected = [{ value: 'a' }];
    const context = {
        Blob,
        window: { confirm(message) { confirmText = message; return confirmResult; } },
        document: {
            getElementById: element,
            querySelectorAll(selector) { return selector.includes('input:checked') ? selected : []; }
        },
        CONFIG: { STORAGE_KEY: 'contacts', SETTINGS_KEY: 'settings', MOMENTS_SETTINGS_KEY: 'moments-settings' },
        STATE: { contacts, currentContactId: 'a' },
        DB: {
            storeName: 'store',
            async set(key, value) {
                if (failSave) throw new Error('quota');
                saved = value;
            }
        },
        UI: { renderChatHistory() {} },
        Toast: { show() {} },
        console: { error() {}, warn() {} }
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage-space.js'), 'utf8')
        .replace(/StorageSpace\.bind\(\);\s*$/, 'globalThis.manager = StorageSpace;');
    vm.runInNewContext(source, context);
    context.manager.open = async () => {};
    return { manager: context.manager, context, getSaved: () => saved, getConfirmText: () => confirmText };
}

test('旧聊天图片能直接计入大小，远程图片地址不按本地原图计算', () => {
    const image = 'data:image/png;base64,YQ==';
    const { manager } = createManager({ contacts: [] });
    assert.equal(manager.imageBytes([image, 'https://example.com/photo.png']), manager.bytes(image));
    assert.equal(manager.contactImageBytes({ history: [{ images: [image] }, { images: null, isImageExpired: true }] }), manager.bytes(image));
});

test('首次扫描已有 IndexedDB 记录，饼图分类之和等于数据总估算值', async () => {
    const image = 'data:image/png;base64,YQ==';
    const contacts = [{ id: 'a', avatar: '🙂', history: [{ role: 'user', content: '旧消息', images: [image], image_description: '猫' }] }];
    const records = [['contacts', contacts], ['settings', { theme: 'dark' }]];
    const { manager, context } = createManager({ contacts });
    context.DB.open = async () => ({
        transaction() {
            const tx = { objectStore() { return {
                openCursor() {
                    const request = {};
                    let index = 0;
                    const emit = () => {
                        request.result = index < records.length ? {
                            key: records[index][0], value: records[index++][1], continue: () => queueMicrotask(emit)
                        } : null;
                        request.onsuccess();
                        if (!request.result) tx.oncomplete();
                    };
                    queueMicrotask(emit);
                    return request;
                }
            }; } };
            return tx;
        }
    });
    const totals = await manager.scan();
    assert.equal(totals[0], manager.bytes(image));
    assert.ok(totals[1] > 0);
    assert.equal(totals.reduce((sum, value) => sum + value, 0), records.reduce((sum, [, value]) => sum + manager.bytes(value), 0));
});

test('只清理选中角色原图，保留消息、描述和其他角色图片', async () => {
    const image = 'data:image/png;base64,YQ==';
    const first = { role: 'user', content: '你好', images: [image], image_description: '一只猫', bubbleIds: ['old'] };
    const other = { role: 'user', content: '其他角色', images: [image] };
    const contacts = [{ id: 'a', history: [first] }, { id: 'b', history: [other] }];
    const { manager, context, getSaved } = createManager({ contacts });
    await manager.cleanSelected();
    assert.equal(getSaved()[0].history[0].images, null);
    assert.equal(getSaved()[0].history[0].isImageExpired, true);
    assert.equal(getSaved()[0].history[0].image_description, '一只猫');
    assert.equal(getSaved()[0].history[0].content, '你好');
    assert.deepEqual(Array.from(getSaved()[0].history[0].bubbleIds), ['old']);
    assert.equal(getSaved()[1].history[0], other);
    assert.equal(context.STATE.contacts, getSaved());
});

test('数据库写入失败时，内存中的原图保持不变', async () => {
    const image = 'data:image/png;base64,YQ==';
    const contacts = [{ id: 'a', history: [{ images: [image], image_description: '一只猫' }] }];
    const { manager, context } = createManager({ contacts, failSave: true });
    await manager.cleanSelected();
    assert.equal(context.STATE.contacts, contacts);
    assert.equal(contacts[0].history[0].images[0], image);
});

test('二次确认取消后不写数据库，原图和选择弹窗保持不变', async () => {
    const image = 'data:image/png;base64,YQ==';
    const contacts = [{ id: 'a', history: [{ images: [image], image_description: '一只猫' }] }];
    const { manager, context, getSaved, getConfirmText } = createManager({ contacts, confirmResult: false });
    await manager.cleanSelected();
    assert.match(getConfirmText(), /1 位联系人/);
    assert.equal(getSaved(), null);
    assert.equal(context.STATE.contacts, contacts);
    assert.equal(contacts[0].history[0].images[0], image);
});
