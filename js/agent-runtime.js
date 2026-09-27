// =========================================
// AGENT RUNTIME (Agent 通用调度层)
// 这里只做很薄的一层编排：统一跑已启用的 Agent，并收集要回注给主模型的摘要。
// 具体能力仍然留在各自模块里，比如 TODO 管理在 agent-todo-manager.js。
//
// 函数目录：
//   - runBeforeMainModel(context): 旧 pre-agent 入口；默认关闭，保留给以后显式恢复
//   - runTodoManager(context): 旧 TODO pre-agent 调度入口
//   - runHeartNoteManager(context): 心笺 post-agent 调度入口
// =========================================

// ★★★★★ Agent Runtime START：通用调度层 ★★★★★
const AgentRuntime = {
    async runBeforeMainModel(context = {}) {
        const results = [];

        // ★ 新协议由角色回复里的『动作意图』触发 Agent；旧 pre-agent 必须显式放行才会执行。
        if (context.allowLegacyPreAgent !== true) {
            return {
                results,
                prompts: []
            };
        }

        const todoResult = await this.runTodoManager(context);
        if (todoResult && todoResult.prompt) results.push(todoResult);

        return {
            results,
            prompts: results.map(item => item.prompt).filter(Boolean)
        };
    },

    async runTodoManager(context = {}) {
        const app = context.app;
        const contact = context.contact;
        const userText = context.userText;
        const userMessage = context.userMessage || null;

        // ★ 旧 TODO pre-agent 暂时仍由 App 串 API 和前端写入；Runtime 只负责预留入口。
        if (!app || typeof app.runAgentTodoManager !== 'function') return null;
        if (typeof AgentTodoManager === 'undefined') return null;
        return app.runAgentTodoManager(contact, userText, userMessage, {
            allowLegacyPreAgent: context.allowLegacyPreAgent === true
        });
    },

    async runHeartNoteManager(context = {}) {
        const app = context.app;
        if (!app || typeof app.runAgentHeartNoteIntentOperations !== 'function') return null;
        if (typeof AgentHeartNoteManager === 'undefined') return null;
        return app.runAgentHeartNoteIntentOperations(
            context.contact,
            context.intentTexts || [],
            context.assistantMessage || null
        );
    }
};
// ★★★★★ Agent Runtime END：通用调度层 ★★★★★
