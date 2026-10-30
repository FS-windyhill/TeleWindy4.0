// =========================================
// OFFLINE CHAT (线下见面模式)
// 线上/线下两种聊天模式的纯逻辑层：
//   - contact.chatMode: 'online'(默认) | 'offline'
//   - contact.offlineHistory: 线下见面消息数组，消息字段与线上 history 完全一致
//   - 线上→线下桥接：切到线下后的前 N 轮请求，固定附带线上聊天最后 6 条
//   - 线下→线上回顾：切回线上后的前 N 轮请求，附带线下最后一条消息
// DOM 渲染与 prompt 组装在 script.js；本模块只放可测试的数据变换。
// =========================================

const OfflineChat = {
    // 第一条 system：恒定的线下场景提示，无视用户的 System Prompt 预设。
    SYSTEM_PROMPT: '你们正在线下见面。你需要以流畅的文笔和生动的语言，描述你们所处的场景、环境，以及你的动作、语言。和常规的小说文本一样，你在剧情中“说出”的话请使用“”引号包裹，其余描述性内容可以不用任何符号包裹，直接输出。无论用户采用什么格式输出，哪怕只是随手一打，或者用他们自己习惯的格式（比如用括号包裹动作描写等），你的输出也请按照正常小说文本的格式生成。请主动推进剧情，使用户不必冥思苦想下一步剧情。输出的时候，请保证文本的质量，就像一段真正的小说文本一样',
    // 切到线下后，前几次请求附带线上最后 6 条（3 轮）聊天记录。
    BRIDGE_ROUNDS: 2,
    BRIDGE_MESSAGE_COUNT: 6,
    // 切回线上后，附带线下最后一条消息的轮数。
    // ★ 独立常量，不与朋友圈注入轮数(chatInjectionStatus)共用，方便单独调整。
    RECAP_ROUNDS: 2,

    // 加载/进入时补齐线下字段；旧备份缺字段也能安全落到默认值。
    ensureFields(contact) {
        if (!contact || typeof contact !== 'object') return false;
        let changed = false;
        if (contact.chatMode !== 'offline' && contact.chatMode !== 'online') {
            contact.chatMode = 'online';
            changed = true;
        }
        if (!Array.isArray(contact.offlineHistory)) {
            contact.offlineHistory = [];
            changed = true;
        }
        if (!Number.isInteger(contact.offlineBridgeRoundsLeft)) {
            contact.offlineBridgeRoundsLeft = 0;
            changed = true;
        }
        if (!Number.isInteger(contact.offlineRecapRoundsLeft)) {
            contact.offlineRecapRoundsLeft = 0;
            changed = true;
        }
        return changed;
    },

    isOffline(contact) {
        return contact?.chatMode === 'offline';
    },

    // ================ 线上 → 线下 桥接 ================

    // 每次真正切到线下（进入线下页面）时调用，重新开始计数。
    armBridge(contact) {
        contact.offlineBridgeRoundsLeft = this.BRIDGE_ROUNDS;
        contact.offlineBridgeConsumedRoundId = '';
    },

    shouldInjectBridge(contact) {
        return (Number(contact?.offlineBridgeRoundsLeft) || 0) > 0;
    },

    // 线上最后 6 条可见消息（倒序取、正序返回）。
    // 统一走 HistoryVisibility 清洗：隐藏消息被剔除，图片以描述文本进入上下文。
    buildBridgeMessages(history) {
        const source = Array.isArray(history) ? history : [];
        const visible = [];
        for (let i = source.length - 1; i >= 0 && visible.length < this.BRIDGE_MESSAGE_COUNT; i--) {
            const cleaned = HistoryVisibility.buildVisibleMessage(source[i], {
                preserveTimestamp: true,
                includeImageDescription: true
            });
            if (cleaned) visible.push(cleaned);
        }
        return visible.reverse();
    },

    // AI 回复成功后扣减桥接轮次；reroll 复用同一条用户消息的 messageId，不会重复扣。
    consumeBridgeRound(contact, roundId) {
        if (!this.shouldInjectBridge(contact)) return false;
        const dedupeKey = String(roundId || '');
        if (!dedupeKey || contact.offlineBridgeConsumedRoundId === dedupeKey) return false;
        contact.offlineBridgeConsumedRoundId = dedupeKey;
        contact.offlineBridgeRoundsLeft = (Number(contact.offlineBridgeRoundsLeft) || 0) - 1;
        return true;
    },

    // ================ 线下 → 线上 回顾 ================

    // 离开线下模式时调用：取线下最后一条可见消息作为待注入的见面回顾。
    // 一条可见消息都没有（全部被隐藏/空会话）就不注入。
    armRecap(contact) {
        if (!contact || typeof contact !== 'object') return;
        const source = Array.isArray(contact.offlineHistory) ? contact.offlineHistory : [];
        let recap = null;
        for (let i = source.length - 1; i >= 0; i--) {
            const cleaned = HistoryVisibility.buildVisibleMessage(source[i], {
                preserveTimestamp: false,
                includeImageDescription: true
            });
            if (cleaned) {
                recap = {
                    timestamp: String(source[i].timestamp || ''),
                    content: cleaned.content
                };
                break;
            }
        }
        contact.offlineRecap = recap;
        contact.offlineRecapRoundsLeft = recap ? this.RECAP_ROUNDS : 0;
        contact.offlineRecapConsumedRoundId = '';
    },

    shouldInjectRecap(contact) {
        return !!contact?.offlineRecap && (Number(contact.offlineRecapRoundsLeft) || 0) > 0;
    },

    // 回顾文本：前后打标记；时间戳直接读存储里的消息时间。
    buildRecapPrompt(contact) {
        if (!this.shouldInjectRecap(contact)) return '';
        const recap = contact.offlineRecap;
        return [
            `[你们${String(recap.timestamp || '').trim()}线下见面时的场景]`,
            recap.content,
            `[你们线下见面时的场景 END]`
        ].join('\n');
    },

    // 线上回复成功后扣减回顾轮次；reroll 复用同一轮 messageId，不会重复扣。
    consumeRecapRound(contact, roundId) {
        if (!this.shouldInjectRecap(contact)) return false;
        const dedupeKey = String(roundId || '');
        if (!dedupeKey || contact.offlineRecapConsumedRoundId === dedupeKey) return false;
        contact.offlineRecapConsumedRoundId = dedupeKey;
        contact.offlineRecapRoundsLeft = (Number(contact.offlineRecapRoundsLeft) || 0) - 1;
        return true;
    },

    // ================ 卡片展示辅助 ================

    // '2026-10-29 21:11' → '21:11'
    buildTimeLabel(timestamp) {
        const text = String(timestamp || '');
        return text.includes(' ') ? text.split(' ')[1] : text;
    },

    // '2026-10-29 21:11' → '2026年10月29日'
    buildDateLabel(timestamp) {
        const match = String(timestamp || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return '';
        return `${match[1]}年${parseInt(match[2], 10)}月${parseInt(match[3], 10)}日`;
    },

    // 楼层号：渲染时按当前数组位置取，删除一条后其余楼层自动补位。
    buildFloorLabel(index) {
        return `${index + 1}#`;
    }
};

if (typeof window !== 'undefined') window.OfflineChat = OfflineChat;
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = OfflineChat;
