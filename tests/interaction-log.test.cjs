// 互动日志回归检查：只验证计数口径与四类排除项，不发出真实 API 请求。
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('script.js', 'utf8');
const pomodoroSource = fs.readFileSync('js/pomodoro.js', 'utf8');
const htmlSource = fs.readFileSync('index.html', 'utf8');

const sliceFunction = (start, end) => {
    const startIndex = appSource.indexOf(start);
    const endIndex = appSource.indexOf(end, startIndex + start.length);
    assert.ok(startIndex >= 0 && endIndex > startIndex, `找不到代码区段：${start}`);
    return appSource.slice(startIndex, endIndex);
};

// ★ API 默认计入互动，只有调用方显式传 false 时才跳过，朋友圈评论和聊天无需逐个补标记。
const apiChat = sliceFunction('    async chat(messages, settings) {', '    // 在 chat(messages, settings) 函数后面添加：');
assert.match(apiChat, /settings\.COUNT_AS_INTERACTION !== false/);
assert.match(apiChat, /recordDesktopInteractionCount\(\)/);

const memorySettings = sliceFunction('    buildMemoryRequestSettings(contact) {', '    async generateCharacterMemory(');
const scheduleSettings = sliceFunction('    buildScheduleRequestSettings(contact) {', '    async generateCharacterSchedule(');
const autoMoment = sliceFunction('    async maybeGenerateCharacterMoment(', '    // ★★★★★ 角色自动动态 END ★★★★★');
assert.match(memorySettings, /COUNT_AS_INTERACTION:\s*false/);
assert.match(scheduleSettings, /COUNT_AS_INTERACTION:\s*false/);
assert.match(autoMoment, /apiConfig\.COUNT_AS_INTERACTION\s*=\s*false/);
assert.match(pomodoroSource, /COUNT_AS_INTERACTION:\s*false/);

// ★ 用户发布动态后的评论及评论区回复都属于互动，必须继续使用默认计数。
const momentComments = sliceFunction('    async triggerAIComments(targetMoment) {', '    // ★★★★★ 角色自动动态 START ★★★★★');
const commentReply = sliceFunction('    async executeCommentReply() {', '    getMomentsContextForChat(');
assert.doesNotMatch(momentComments, /COUNT_AS_INTERACTION:\s*false/);
assert.doesNotMatch(commentReply, /COUNT_AS_INTERACTION:\s*false/);
assert.match(htmlSource, />互动日志<\/span>/);
assert.doesNotMatch(htmlSource, />活跃日志<\/span>/);

console.log('interaction-log tests passed');
