// =========================================
// 存储相关：IndexedDB 基础封装 + 本地数据读写
// 手动备份、云同步恢复，最终都会走这里的数据层函数
//
// 1.5. DB UTILS
//   - DB.open(): 打开 IndexedDB
//   - DB.get(key): 读取指定 key
//   - DB.set(key, value): 写入指定 key
//   - DB.remove(key): 删除指定 key
//   - DB.clear(): 清空当前 store
//   - DB.exportAll(): 导出 store 内全部 key-value
//
// 2. STORAGE SERVICE
//   - Storage.load(): 读取设置、联系人、世界书、心迹、TO DO、倒数日等数据
//   - Storage.saveContacts(): 保存联系人
//   - Storage.saveSettings(): 保存设置
//   - Storage.saveWorldInfo(): 保存世界书
//   - Storage.exportAllForBackup(): 导出备份
//   - Storage.importFromBackup(rawData): 导入备份
//   - Storage.saveMoments(): 保存心迹列表
//   - Storage.saveMomentsSettings(): 保存心迹设置
//   - Storage.saveTodoPlans(): 保存探索页 TO DO 计划列表
//   - Storage.saveCountdownDays(): 保存探索页倒数日 / 正数日列表
//   - Storage.saveCharacterSchedules(): 保存探索页角色日程
//   - Storage.saveCharacterMemories(): 保存探索页角色记忆
// =========================================

// =========================================
// 1.5. DB UTILS (IndexedDB 简易封装)
// =========================================
const DB = {
    dbName: 'TeleWindyDB',
    storeName: 'store',
    version: 1,
    
    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async get(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async set(key, value) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async remove(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    
    async clear() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    // 导出所有数据用于备份 (修复版：使用游标一次性读取)
    async exportAll() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            // 打开游标遍历所有数据
            const request = store.openCursor();
            
            const data = {};

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // cursor.key 是键名 (如 'contacts')
                    // cursor.value 是存的数据 (如 [...数组])
                    data[cursor.key] = cursor.value; 
                    cursor.continue(); // 继续读下一条
                } else {
                    // 游标为空说明读完了，此时 data 已经装满了
                    resolve(data); 
                }
            };
            
            request.onerror = (e) => reject(e.target.error);
        });
    }
    
};

// =========================================
// 2. STORAGE SERVICE (本地持久化 - IndexedDB 版)
// =========================================
const Storage = {
    // 初始化/加载数据
    async load() {
        // ------------------------------------------------
        // 1. 加载设置 (Settings)
        // ------------------------------------------------
        // 优先从 IDB 读取
        let loadedSettings = await DB.get(CONFIG.SETTINGS_KEY);

        // [数据迁移]: 如果 IDB 为空，尝试从 LocalStorage 读取旧数据
        if (!loadedSettings) {
            const lsSettings = localStorage.getItem(CONFIG.SETTINGS_KEY);
            if (lsSettings) {
                try { loadedSettings = JSON.parse(lsSettings); } catch (e) {}
            }
        }
        loadedSettings = loadedSettings || {};

        // 兼容旧版 Theme (检查 LocalStorage，因为这是历史遗留位置)
        const legacyTheme = localStorage.getItem('appTheme');
        if (legacyTheme) {
            loadedSettings.THEME = legacyTheme;
            localStorage.removeItem('appTheme');
        }

        STATE.settings = { ...CONFIG.DEFAULT, ...loadedSettings };
        // ★ 主动消息设置是嵌套对象；老备份只有部分字段时也要逐项补默认值，不能被浅合并整块覆盖。
        STATE.settings.PROACTIVE_MESSAGES = {
            ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.PROACTIVE_MESSAGES)),
            ...(loadedSettings.PROACTIVE_MESSAGES && typeof loadedSettings.PROACTIVE_MESSAGES === 'object'
                ? loadedSettings.PROACTIVE_MESSAGES
                : {})
        };
        // ★ 旧版主动消息直接借用后台回复的 Key 模式；只在字段缺失时迁移一次，之后两项功能各自管理。
        if (loadedSettings.PROACTIVE_MESSAGES?.followFrontendApiKey === undefined) {
            STATE.settings.PROACTIVE_MESSAGES.followFrontendApiKey = loadedSettings.ASYNC_BACKEND_KEY_MODE !== 'server_secret';
        }
        // ★ 主动消息 v3 把“浏览器运行 / 私人 Worker / Worker Secret”拆开；旧布尔值按原语义无损迁移。
        if (loadedSettings.PROACTIVE_MESSAGES?.executionMode === undefined) {
            STATE.settings.PROACTIVE_MESSAGES.executionMode = STATE.settings.PROACTIVE_MESSAGES.followFrontendApiKey
                ? 'frontend'
                : 'server_secret';
        }
        // ★ 旧版只有一个 Agent 总开关；升级后它只迁移给 TODO，心笺保持默认关闭。
        if (loadedSettings.AGENT_TODO_MANAGER_ENABLED === undefined) {
            STATE.settings.AGENT_TODO_MANAGER_ENABLED = loadedSettings.AGENT_SKILL_ROUTER_ENABLED === true;
        }
        if (!Array.isArray(STATE.settings.API_PRESETS)) {
            STATE.settings.API_PRESETS = [];
        }
        if (!Array.isArray(STATE.settings.SYSTEM_PROMPT_PRESETS)) {
            STATE.settings.SYSTEM_PROMPT_PRESETS = [];
        }
        // 空字符串是合法设置，代表不发送全局 system prompt；只有旧数据缺字段时才补默认值。
        if (STATE.settings.SYSTEM_PROMPT === undefined) {
            STATE.settings.SYSTEM_PROMPT = CONFIG.SYSTEM_PROMPT;
        }

        // 兼容旧头像壁纸 (同样检查 LocalStorage)
        // 注意：一旦保存过一次新版，这些旧数据其实就不需要了，但为了安全保留检查
        if (Object.keys(loadedSettings).length === 0) {
            const oldUserAvatar = localStorage.getItem('fs_user_avatar');
            const oldWallpaper = localStorage.getItem('fs_wallpaper');
            if (oldUserAvatar) STATE.settings.USER_AVATAR = oldUserAvatar;
            if (oldWallpaper) STATE.settings.WALLPAPER = oldWallpaper;
        }

        // ------------------------------------------------
        // 2. 加载联系人 (Contacts)
        // ------------------------------------------------
        let contactsData = await DB.get(CONFIG.STORAGE_KEY);
        
        // [数据迁移]: IDB 无数据，尝试读取 LS
        if (!contactsData) {
            const lsContacts = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (lsContacts) {
                try { contactsData = JSON.parse(lsContacts); } catch (e) {}
            }
        }

        if (Array.isArray(contactsData)) {
            STATE.contacts = contactsData;
        } else {
            STATE.contacts = [];
        }

        // 兜底默认联系人
        if (STATE.contacts.length === 0) {
            STATE.contacts.push({
                id: Date.now().toString(),
                name: '小真蛸',
                avatar: '😊',
                prompt: '你是一个温柔可爱的助手小真蛸，说话请带上颜文字。',
                history: [],
                presenceLastActiveAt: Date.now()
            });
        }

        // ------------------------------------------------
        // 3. ★★★ 加载世界书 (World Info)
        // ------------------------------------------------
        let wiData = await DB.get(CONFIG.WORLD_INFO_KEY);

        // [数据迁移]: IDB 无数据，尝试读取 LS 的 V2 数据
        if (!wiData) {
            const lsWiV2 = localStorage.getItem(CONFIG.WORLD_INFO_KEY);
            if (lsWiV2) {
                try { wiData = JSON.parse(lsWiV2); } catch (e) {}
            }
        }

        if (wiData) {
            STATE.worldInfoBooks = wiData;
        } else {
            // [旧版迁移]: 检查 LS 中的 V1 数据 (散乱条目)
            const wiRawV1 = localStorage.getItem('teleWindy_world_info_v1');
            STATE.worldInfoBooks = [];
            
            if (wiRawV1) {
                try {
                    const oldEntries = JSON.parse(wiRawV1);
                    if (Array.isArray(oldEntries) && oldEntries.length > 0) {
                        console.log("Detecting old WI format in LS, migrating to DB...");
                        const defaultBook = {
                            id: 'book_default_' + Date.now(),
                            name: '默认世界书 (旧数据迁移)',
                            characterId: '', 
                            characterIds: [],
                            entries: oldEntries
                        };
                        STATE.worldInfoBooks.push(defaultBook);
                        // 立即保存到 IDB 以完成迁移
                        await this.saveWorldInfo();
                    }
                } catch (e) {
                    console.error("Migration failed", e);
                }
            }
        }

        // 确保至少有一本书
        if (STATE.worldInfoBooks.length === 0) {
            STATE.worldInfoBooks.push({
                id: 'book_' + Date.now(),
                name: '新建世界书',
                characterId: '',
                characterIds: [],
                entries: []
            });
        }
        
        // 默认选中第一本
        STATE.currentBookId = STATE.worldInfoBooks[0].id;


        // ★★★ 新增：加载心迹数据 ★★★
        try {
            const moments = await DB.get(CONFIG.MOMENTS_KEY);
            if (moments) STATE.moments = moments;

            const mSettings = await DB.get(CONFIG.MOMENTS_SETTINGS_KEY);
            if (mSettings) {
                // ★ 心迹设置允许平滑加字段：老备份没有角色动态开关/概率时，补默认值而不是整份覆盖。
                STATE.momentsSettings = {
                    ...JSON.parse(JSON.stringify(CONFIG.DEFAULT.MOMENTS_SETTINGS)),
                    ...mSettings
                };
            } else {
                // 【修复点 1】：必须从 CONFIG.DEFAULT.MOMENTS_SETTINGS 获取
                // 并且建议深拷贝，防止引用污染
                STATE.momentsSettings = JSON.parse(JSON.stringify(CONFIG.DEFAULT.MOMENTS_SETTINGS));
            }
        } catch (e) {
            console.warn("读取心迹数据失败 (可能是第一次运行):", e);
            // 【修复点 2】：Catch 块里也要修复
            STATE.momentsSettings = JSON.parse(JSON.stringify(CONFIG.DEFAULT.MOMENTS_SETTINGS));
        }

        // ★★★★★ 探索 TO DO / 倒数日 / 角色日程 / 角色记忆 START ★★★★★
        // 这几块是用户自己的静态前端内容，单独放 IndexedDB。
        // 开关仍跟内容一起保存，关闭功能也不丢已生成/编辑过的内容。
        try {
            const todoPlans = await DB.get(CONFIG.TODO_PLANS_KEY);
            STATE.todoPlans = Array.isArray(todoPlans) ? todoPlans : [];

            const countdownDays = await DB.get(CONFIG.COUNTDOWN_DAYS_KEY);
            STATE.countdownDays = Array.isArray(countdownDays) ? countdownDays : [];

            const characterSchedules = await DB.get(CONFIG.CHARACTER_SCHEDULES_KEY);
            STATE.characterSchedules = Array.isArray(characterSchedules) ? characterSchedules : [];
            // 生成中只是前端运行态；刷新/重开后应回到“待生成”，避免旧状态卡住。
            STATE.characterSchedules.forEach(item => {
                if (item) item.isGenerating = false;
            });

            const characterMemories = await DB.get(CONFIG.CHARACTER_MEMORIES_KEY);
            STATE.characterMemories = Array.isArray(characterMemories) ? characterMemories : [];
            // 生成中只是前端运行态；刷新/重开后应回到可重试状态。
            STATE.characterMemories.forEach(memory => {
                if (!memory) return;
                memory.isGenerating = false;
                if (Array.isArray(memory.records)) {
                    memory.records.forEach(record => {
                        if (record) record.isGenerating = false;
                    });
                }
            });

            const characterHeartNotes = await DB.get(CONFIG.CHARACTER_HEART_NOTES_KEY);
            STATE.characterHeartNotes = Array.isArray(characterHeartNotes) ? characterHeartNotes : [];
        } catch (e) {
            console.warn("读取 TO DO / 倒数日 / 角色日程 / 角色记忆数据失败 (可能是第一次运行):", e);
            STATE.todoPlans = [];
            STATE.countdownDays = [];
            STATE.characterSchedules = [];
            STATE.characterMemories = [];
            STATE.characterHeartNotes = [];
        }
        // ★★★★★ 探索 TO DO / 倒数日 / 角色日程 / 角色记忆 END ★★★★★



        
        console.log('Storage loaded via IndexedDB.');
    },

    // 保存联系人
    async saveContacts() {
        // IndexedDB 可以直接存对象，不需要 JSON.stringify
        await DB.set(CONFIG.STORAGE_KEY, STATE.contacts);
    },

    // 保存设置
    async saveSettings() {
        await DB.set(CONFIG.SETTINGS_KEY, STATE.settings);
    },

    // 保存世界书
    async saveWorldInfo() {
        await DB.set(CONFIG.WORLD_INFO_KEY, STATE.worldInfoBooks);
    },
    
    // 导出备份逻辑 (改为从 DB 获取)
    async exportAllForBackup() {
        // 1. 获取 DB 中所有数据
        const data = await DB.exportAll(); // 使用 1.5 中定义的 exportAll

        // 2. 特殊处理：Token 加密 (为了安全)
        if (data[CONFIG.SETTINGS_KEY]) {
            // 注意：从 DB 拿出来的是对象，不是字符串
            let settings = data[CONFIG.SETTINGS_KEY]; 
            
            // 为了不修改原始对象引用，我们浅拷贝一份
            const safeSettings = { ...settings };

            if (safeSettings.GIST_TOKEN && !safeSettings.GIST_TOKEN.startsWith('ENC_')) {
                safeSettings.GIST_TOKEN = 'ENC_' + btoa(safeSettings.GIST_TOKEN);
                // 替换掉原数据中的设置对象
                data[CONFIG.SETTINGS_KEY] = safeSettings;
            }
        }
        
        // 3. (可选) 导出时将对象转为 JSON 字符串，方便保存为文件
        // 如果你的 import 逻辑 期望的是 value 为字符串，这里需要 stringify
        // 通常为了保持原来的行为一致性，我们在这里把对象转回字符串给下载文件用
        const exportData = {};
        for (const [key, val] of Object.entries(data)) {
            exportData[key] = (typeof val === 'object') ? JSON.stringify(val) : val;
        }

        return exportData;
    },

    // 导入备份逻辑
    // 导入备份逻辑
    async importFromBackup(rawData) {

        
        // 0. 兼容两种格式：
        // A. 手动导出格式：{ 真正的数据 }
        // B. 云同步格式：{ backup_at, app, data: { 真正的数据 } }
        let data = rawData;


        console.group('🧪 Storage.importFromBackup 调试');
        console.log('收到 rawData:', rawData);
        console.log('rawData 顶层 keys:', rawData && typeof rawData === 'object' ? Object.keys(rawData) : null);
        console.log('是否云同步外壳:', rawData?.app === 'TeleWindy' && !!rawData?.data);
        console.log('rawData.data keys:', rawData?.data && typeof rawData.data === 'object' ? Object.keys(rawData.data) : null);



        if (
            data &&
            typeof data === 'object' &&
            data.app === 'TeleWindy' &&
            data.data &&
            typeof data.data === 'object'
        ) {
            console.log('检测到云同步备份外壳，自动提取 data 字段');
            data = data.data;
        }


        console.log('剥壳后的 data keys:', data && typeof data === 'object' ? Object.keys(data) : null);
        console.log('剥壳后的 data:', data);


        // 0.5 重要防护：确认数据不是空的，确认完再清库
        if (!data || typeof data !== 'object') {
            throw new Error('导入失败：备份格式不正确');
        }

        const keys = Object.keys(data);

        if (keys.length === 0) {
            throw new Error('导入失败：备份内容为空，已取消导入');
        }

        const text = JSON.stringify(data);

        if (text === '{}' || text === '[]' || text.length < 50) {
            throw new Error('导入失败：备份疑似为空，已取消导入');
        }

        console.warn('⚠️ 准备清空 DB，导入 keys:', keys);

        // 1. 到这里才允许清空当前数据库
        await DB.clear();

        // 2. 遍历导入
        const promises = keys.map(async (key) => {
            let value = data[key];

            console.log(
                '准备处理 key:',
                key,
                '原始 value 类型:',
                typeof value,
                '是否数组:',
                Array.isArray(value)
            );

            // 尝试解析 JSON 字符串回对象，因为 export 时把对象转成了字符串
            try {
                if (typeof value === 'string') {
                    console.log('尝试 JSON.parse key:', key);
                    value = JSON.parse(value);
                    console.log(
                        'JSON.parse 成功 key:',
                        key,
                        '解析后类型:',
                        typeof value,
                        '是否数组:',
                        Array.isArray(value)
                    );
                }
            } catch (e) {
                console.warn('JSON.parse 失败，保持原样 key:', key, e);
            }

            // 解密 Token
            if (key === CONFIG.SETTINGS_KEY && value && typeof value === 'object') {
                if (value.GIST_TOKEN && value.GIST_TOKEN.startsWith('ENC_')) {
                    try {
                        value.GIST_TOKEN = atob(value.GIST_TOKEN.replace('ENC_', ''));
                        console.log('Token 解密成功');
                    } catch (e) {
                        console.error('Token decrypt failed', e);
                    }
                }
            }

            console.log('准备写入 DB key:', key);

            // 写入 DB
            await DB.set(key, value);

            console.log('✅ 已写入 DB key:', key);
        });

        await Promise.all(promises);


        console.log('✅ Import finished.');
        console.groupEnd(); 
    },

    /* ===================== 心迹 ===================== */

    // 1. 保存心迹列表
    async saveMoments() {
        // ★★★ 关键：显式传入 CONFIG.MOMENTS_KEY ★★★
        // 如果 CONFIG.MOMENTS_KEY 是 undefined，就会报刚才那个 DataError 错
        if (!CONFIG.MOMENTS_KEY) {
            console.error("CONFIG.MOMENTS_KEY 未定义！请检查配置。");
            return;
        }
        await DB.set(CONFIG.MOMENTS_KEY, STATE.moments);
    },

    // 2. 保存心迹设置
    async saveMomentsSettings() {
        // ★★★ 关键：显式传入 CONFIG.MOMENTS_SETTINGS_KEY ★★★
        if (!CONFIG.MOMENTS_SETTINGS_KEY) {
            console.error("CONFIG.MOMENTS_SETTINGS_KEY 未定义！请检查配置。");
            return;
        }
        await DB.set(CONFIG.MOMENTS_SETTINGS_KEY, STATE.momentsSettings);
    },

    /* ===================== 探索 TO DO / 倒数日 ===================== */

    // 保存计划表列表
    async saveTodoPlans() {
        if (!CONFIG.TODO_PLANS_KEY) {
            console.error("CONFIG.TODO_PLANS_KEY 未定义！请检查配置。");
            return;
        }
        await DB.set(CONFIG.TODO_PLANS_KEY, STATE.todoPlans);
    },

    // 保存倒数日/正数日列表
    async saveCountdownDays() {
        if (!CONFIG.COUNTDOWN_DAYS_KEY) {
            console.error("CONFIG.COUNTDOWN_DAYS_KEY 未定义！请检查配置。");
            return;
        }
        await DB.set(CONFIG.COUNTDOWN_DAYS_KEY, STATE.countdownDays);
    },

    // 保存角色日程列表
    async saveCharacterSchedules() {
        if (!CONFIG.CHARACTER_SCHEDULES_KEY) {
            console.error("CONFIG.CHARACTER_SCHEDULES_KEY 未定义！请检查配置。");
            return;
        }
        await DB.set(CONFIG.CHARACTER_SCHEDULES_KEY, STATE.characterSchedules);
    },

    // 保存角色记忆列表
    async saveCharacterMemories() {
        if (!CONFIG.CHARACTER_MEMORIES_KEY) {
            console.error("CONFIG.CHARACTER_MEMORIES_KEY 未定义！请检查配置。");
            return;
        }
        await DB.set(CONFIG.CHARACTER_MEMORIES_KEY, STATE.characterMemories);
    },

    // 保存角色心笺列表
    async saveCharacterHeartNotes() {
        if (!CONFIG.CHARACTER_HEART_NOTES_KEY) {
            console.error("CONFIG.CHARACTER_HEART_NOTES_KEY 未定义！请检查配置。");
            return;
        }
        await DB.set(CONFIG.CHARACTER_HEART_NOTES_KEY, STATE.characterHeartNotes);
    },




};

