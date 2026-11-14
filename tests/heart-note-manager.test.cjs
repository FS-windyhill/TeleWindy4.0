// 心笺回归检查：验证 cancel 保留数据、兼容旧记录，并且永远不会注入聊天上下文。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const STATE = {
    characterHeartNotes: [{
        charId: 'friend',
        injectDays: 3,
        records: [
            { id: 'active', text: '正常心笺', dateKey: '2026-09-17', createdAt: 1, alwaysInject: false },
            { id: 'cancelled', text: '取消心笺', dateKey: '2026-09-17', createdAt: 2, alwaysInject: true, cancelled: true }
        ]
    }]
};
const context = vm.createContext({ STATE, console, Date });
vm.runInContext(fs.readFileSync('js/agent-heart-note-manager.js', 'utf8'), context, { filename: 'js/agent-heart-note-manager.js' });
const manager = vm.runInContext('AgentHeartNoteManager', context);

const notebook = manager.ensureNotebook('friend');
assert.equal(notebook.records[0].cancelled, false); // 旧版心笺自动迁移为未取消。
assert.equal(notebook.records[1].cancelled, true);

const injected = manager.getInjectRecords(notebook, new Date(2026, 8, 17, 12));
assert.deepEqual(Array.from(injected, record => record.id), ['active']);
const prompt = manager.buildChatPrompt('friend', new Date(2026, 8, 17, 12));
assert.match(prompt, /正常心笺/);
assert.doesNotMatch(prompt, /取消心笺/);

console.log('heart-note-manager tests passed');

// ★ 覆盖真实执行入口：新模型的 cancel 和旧版待执行 delete 都只能取消，撤销后恢复注入。
require('node:test')('角色删除心笺保留记录和星标，兼容旧建议并支持撤销', async () => {
    const source = fs.readFileSync('script.js', 'utf8');
    const start = source.indexOf('    async applyAgentHeartNoteSuggestions(');
    const end = source.indexOf('    // ★★★★★ Agent 心笺 END', start);
    assert.ok(start >= 0 && end > start);
    const app = vm.runInContext('({' + source.slice(start, end) + '})', context);
    context.Storage = { async saveCharacterHeartNotes() {} };
    let notice;
    Object.assign(app, {
        renderHeartNoteContacts() {},
        renderHeartNoteDetail() {},
        async setAgentExecutionState() {},
        showTopNotice(text, options) { notice = { text, ...options }; }
    });

    for (const action of ['delete', 'remove', 'cancel']) {
        const record = { id: 'target', text: '重要心笺', dateKey: '2026-09-17', createdAt: 3, alwaysInject: true, cancelled: false };
        notebook.records = [record];
        const parsed = manager.parseResult(JSON.stringify({ intent: 'MANAGE_HEART_NOTE', operations: [{ action, targetNoteId: record.id }] }));
        assert.equal(parsed.operations[0].action, 'cancel');
        // 直接传旧 action，确保恢复历史建议时即使跳过解析也不会物理删除。
        const applied = await app.applyAgentHeartNoteSuggestions({ id: 'friend' }, {}, [{ action, targetNoteId: record.id, targetText: record.text }]);
        assert.equal(applied[0].action, 'cancel');
        assert.equal(notebook.records.length, 1);
        assert.equal(notebook.records[0], record);
        assert.equal(record.cancelled, true);
        assert.equal(record.alwaysInject, true);
        assert.equal(record.text, '重要心笺');
        assert.equal(manager.getInjectRecords(notebook).length, 0);
        assert.match(notice.text, /已取消心笺/);
        await notice.onAction();
        assert.equal(notebook.records.length, 1);
        assert.equal(notebook.records[0].cancelled, false);
        assert.equal(notebook.records[0].alwaysInject, true);
        assert.equal(manager.getInjectRecords(notebook).length, 1);
    }
});
