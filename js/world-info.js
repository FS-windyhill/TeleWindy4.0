// =========================================
// 世界书独立引擎：导入、导出、触发扫描
// 聊天生成前需要扫描世界书时，会调用这里的 WorldInfoEngine
//   - importFromST(jsonString, fileName): 导入 SillyTavern 世界书，并兼容数组/对象 entries
//   - exportToST(book): 导出为 SillyTavern 兼容 JSON
//   - scanByType(userText, history, currentContactId, currentContactName): 分开返回常驻/触发内容，并附带条目元信息供缓存日志定位
//   - scan(userText, history, currentContactId, currentContactName): 旧接口，返回常驻 + 触发合并文本
// =========================================

// =========================================
// 3. WORLD INFO ENGINE (已修正)
// =========================================
const WorldInfoEngine = {
    // 1. 导入逻辑：增加对 ST 各种怪异格式的兼容
    importFromST(jsonString, fileName) {
        try {
            const data = JSON.parse(jsonString);
            const entriesObj = data.entries || {}; 
            const newEntries = [];

            // 既支持数组格式，也支持对象格式 {"0":{}, "1":{}}
            const entriesList = Array.isArray(entriesObj) ? entriesObj : Object.values(entriesObj);

            entriesList.forEach(entry => {
                // 修正：ST 的 key 可能是 "a,b,c" 字符串，也可能是 ["a","b"] 数组
                let safeKeys = [];
                if (Array.isArray(entry.key)) {
                    safeKeys = entry.key;
                } else if (typeof entry.key === 'string') {
                    safeKeys = entry.key.split(',').map(k => k.trim()).filter(k => k);
                }

                // 修正：如果导入时没有 comment，尝试用第一个关键词代替，还没有就叫“未命名”
                let safeComment = entry.comment || '';
                if (!safeComment && safeKeys.length > 0) safeComment = safeKeys[0];
                if (!safeComment) safeComment = '未命名条目';

                newEntries.push({
                    uid: Date.now() + Math.random().toString(36).substr(2, 9),
                    keys: safeKeys, 
                    content: entry.content || '',
                    constant: !!entry.constant, 
                    // ★★★ 核心：确保这里读到了名字
                    comment: safeComment 
                });
            });
            
            const bookName = fileName ? fileName.replace(/\.[^/.]+$/, "") : ('导入书 ' + new Date().toLocaleTimeString());
            
            return {
                id: 'book_' + Date.now() + Math.random().toString(36).substr(2, 5),
                name: bookName,
                characterId: '', 
                characterIds: [],
                entries: newEntries
            };

        } catch (e) {
            console.error("Import Failed:", e);
            alert("导入失败：请确认是有效的 JSON 文件");
            throw e;
        }
    },

    // 2. 导出逻辑：确保 comment 被写回 JSON
    exportToST(book) {
        if (!book) return "{}";
        
        const exportObj = { entries: {} };
        book.entries.forEach((entry, index) => {
            // 使用 index 作为 key，符合 ST 标准
            exportObj.entries[index] = {
                uid: index, 
                key: entry.keys,
                // ★★★ 核心：导出时要把名字写回去
                comment: entry.comment || entry.keys[0] || "未命名",
                content: entry.content,
                constant: entry.constant,
                selective: true,
                order: 100,
                position: 0,
                disable: false,
                excludeRecursion: false,
                probability: 100,
                useProbability: true
            };
        });
        
        return JSON.stringify(exportObj, null, 2);
    },

    // ★★★★★ 世界书分层扫描 START ★★★★★
    // 聊天主链路为了缓存命中，需要把常驻条目放在稳定区，把关键词触发条目放在本轮背景区。
    // constantEntries / triggeredEntries 只记录 book、comment、uid、keys，用来定位缓存波动，不重复保存正文。
    // 旧的 scan() 仍保留合并文本返回，供心迹等其它链路沿用原来的简单接口。
    scanByType(userText, history, currentContactId, currentContactName) {
        if (!STATE.worldInfoBooks || STATE.worldInfoBooks.length === 0) {
            return { constant: null, triggered: null, constantEntries: [], triggeredEntries: [] };
        }
        const relevantHistory = history.slice(-1); 
        const contextText = (userText + '\n' + relevantHistory.map(m => m.content).join('\n')).toLowerCase();
        const constantContent = [];
        const triggeredContent = [];
        const constantEntries = [];
        const triggeredEntries = [];

        STATE.worldInfoBooks.forEach(book => {
            // 新版世界书允许一本书绑定多个角色；旧数据只有 characterId，这里继续兼容。
            const scopeIds = Array.isArray(book.characterIds)
                ? book.characterIds.filter(Boolean)
                : (book.characterId ? [book.characterId] : []);
            const isGlobalBook = scopeIds.length === 0;
            const isBoundBook = scopeIds.includes(currentContactId);
            if (!isGlobalBook && !isBoundBook) return;

            book.entries.forEach(entry => {
                const isConstant = entry.constant === true;
                let keywordTriggered = false;

                if (!isConstant && entry.keys && Array.isArray(entry.keys)) {
                    keywordTriggered = entry.keys.some(k => {
                        const keyLower = k.toLowerCase().trim();
                        return keyLower && contextText.includes(keyLower);
                    });
                }

                if ((isConstant || keywordTriggered) && entry.content) {
                    let finalContent = entry.content
                        .replace(/\{\{user\}\}/gi, '用户') 
                        .replace(/\{\{char\}\}/gi, currentContactName || '角色');
                    // 缓存调试日志只记录条目身份，不重复塞正文，方便定位是哪条世界书让本轮背景变化。
                    const entryMeta = {
                        book: book.name || '未命名世界书',
                        comment: entry.comment || entry.keys?.[0] || '未命名条目',
                        uid: entry.uid || '',
                        keys: Array.isArray(entry.keys) ? entry.keys : []
                    };
                    if (isConstant) {
                        constantContent.push(finalContent);
                        constantEntries.push(entryMeta);
                    } else {
                        triggeredContent.push(finalContent);
                        triggeredEntries.push(entryMeta);
                    }
                }
            });
        });

        return {
            constant: constantContent.length ? constantContent.join('\n\n') : null,
            triggered: triggeredContent.length ? triggeredContent.join('\n\n') : null,
            constantEntries,
            triggeredEntries
        };
    },

    // 3. 扫描逻辑 (保持旧接口：常驻 + 关键词触发合并返回)
    scan(userText, history, currentContactId, currentContactName) {
        const result = this.scanByType(userText, history, currentContactId, currentContactName);
        const sections = [result.constant, result.triggered].filter(Boolean);
        return sections.length ? sections.join('\n\n') : null;
    }
    // ★★★★★ 世界书分层扫描 END ★★★★★
};


