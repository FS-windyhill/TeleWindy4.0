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
