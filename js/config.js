// =========================================
// 本文件只放配置、默认设置和固定常量
// 这些内容会先于主 script.js 加载，供存储、云同步和主业务共同使用
// =========================================

// =========================================
// 1. CONFIG (配置与默认设置)
//   - STORAGE_KEY / SETTINGS_KEY / WORLD_INFO_KEY: 联系人、设置、世界书数据 key
//   - MOMENTS_KEY / MOMENTS_SETTINGS_KEY: 心迹列表和心迹设置 key
//   - TODO_PLANS_KEY: 探索页 TO DO 计划列表 key
//   - COUNTDOWN_DAYS_KEY: 探索页倒数日 / 正数日列表 key
//   - CHARACTER_SCHEDULES_KEY: 探索页角色日程 key
//   - CHARACTER_MEMORIES_KEY: 探索页角色记忆 key
//   - MOMENTS_INJECT_COUNT: 用户动态在聊天里提示可见角色的聊天轮次
//   - CHARACTER_MOMENT_INJECT_COUNT: 角色动态在聊天里提示作者本人的聊天轮次
//   - POMODORO_INJECT_COUNT / POMODORO_SPEECH_CONTEXT_COUNT: 番茄记录注入轮数与最多回注的陪伴发言条数
//   - DEFAULT: 所有设置项的默认值
//     - TODO_PLAN_INJECT_ENABLED: TO DO 计划是否注入 AI system prompt
//     - COUNTDOWN_INJECT_ENABLED: 倒数日 / 正数日是否注入 AI system prompt
//     - CHARACTER_SCHEDULE_API_PRESET_INDEX: 角色日程生成使用的 API 预设索引
//     - CHARACTER_MEMORY_API_PRESET_INDEX: 角色记忆生成使用的 API 预设索引
//     - AGENT_SKILL_ROUTER_ENABLED / AGENT_SKILL_ROUTER_API_PRESET_INDEX: Agent 工具路由器开关和模型预设
//     - MOMENTS_SETTINGS: 心迹页面默认设置
//   - SYSTEM_PROMPT: 默认系统提示词
// =========================================

const CONFIG = {
    STORAGE_KEY: 'teleWindy_char_data_v1',
    SETTINGS_KEY: 'teleWindy_settings_v1',
    WORLD_INFO_KEY: 'teleWindy_world_info_v2',
    
    // ★★★ 这里的 KEY 必须定义在第一层！ ★★★
    MOMENTS_KEY: 'teleWindy_moments_v1', 
    MOMENTS_SETTINGS_KEY: 'teleWindy_moments_settings_v1',
    TODO_PLANS_KEY: 'teleWindy_todo_plans_v1',
    COUNTDOWN_DAYS_KEY: 'teleWindy_countdown_days_v1',
    CHARACTER_SCHEDULES_KEY: 'teleWindy_character_schedules_v1',
    CHARACTER_MEMORIES_KEY: 'teleWindy_character_memories_v1',
    CHARACTER_HEART_NOTES_KEY: 'teleWindy_character_heart_notes_v1',
    MAIN_CONTEXT_LOG_KEY: 'teleWindy_main_context_log_v1',
    AGENT_CONTEXT_LOG_KEY: 'teleWindy_agent_context_log_v1',
    // ★ 主动消息只保存最近一次实际发往模型的请求，和普通聊天日志分开。
    PROACTIVE_CONTEXT_LOG_KEY: 'teleWindy_proactive_context_log_v1',

    // ★ 番茄钟：共享原有 store，分别配置正式聊天轮数、陪伴上下文和回注发言条数。
    POMODORO_KEY: 'teleWindy_pomodoro_v1',
    POMODORO_INJECT_COUNT: 3,
    POMODORO_CHAT_CONTEXT_COUNT: 6,
    // ★ 每个角色本地只保留最近 10 条番茄钟发言；这里即使改成 100，实际也最多只能注入 10 条。
    POMODORO_SPEECH_CONTEXT_COUNT: 3,

    CHAT_PAGE_SIZE: 15,
    MOMENTS_PAGE_SIZE: 15, // 心迹分页数
    GIST_ID_KEY: 'telewindy-gist-id',
    // ★ 与 backend/worker.js 的公开版本对应；Worker 发布新功能时两处一起递增。
    WORKER_VERSION: '2026.09.27.1',

    MOMENTS_INJECT_COUNT: 2, // 用户动态对可见角色的聊天注入轮次
    CHARACTER_MOMENT_INJECT_COUNT: 2, // 角色自己的动态对作者本人的聊天注入轮次

    DEFAULT: {
        API_URL: 'https://api.deepseek.com/v1/chat/completions',
        MODEL: 'deepseek-v4-flash',
        API_KEY: '', 
        ASYNC_BACKEND_ENABLED: false,
        ASYNC_BACKEND_URL: '',
        ASYNC_BACKEND_TOKEN: '',
        ASYNC_BACKEND_KEY_MODE: 'client_key',
        ASYNC_BACKEND_TTL_HOURS: 6,
        // ★ 主动消息既能交给 Worker 真后台唤醒，也能在纯前端模式下于下次打开 PWA 时补发。
        PROACTIVE_MESSAGES: {
            enabled: false,
            characterIds: [],
            // ★ 新版按执行位置区分模式；旧 followFrontendApiKey 字段继续保留一段时间供备份降级兼容。
            executionMode: 'frontend',
            privateWorkerCredentialConsent: false,
            followFrontendApiKey: true,
            // ★ 只缓存无敏感信息的能力检测结果；URL、Token 指纹或模式变化后自动失效。
            workerProbeCache: null,
            // ★ __character__ 保留旧版“跟随角色聊天预设”；另一个内置值 __global__ 表示全局默认。
            apiPresetName: '__character__',
            activeStart: '09:00',
            activeEnd: '23:00',
            minCooldownMinutes: 180,
            recentChatQuietMinutes: 45,
            dailyLimit: 3,
            unansweredLimit: 2,
            heartbeatHours: 12,
            catchupEnabled: true,
            catchupMaxHours: 24,
            lastLocalCheckAtByChar: {},
            nextLocalWakeAtByChar: {},
            localRuntimeByChar: {},
            workerStatusByChar: {},
            // ★ 所有角色共用最近 40 条浏览器诊断日志；Worker 只暂存每个角色的离线事件。
            diagnosticEvents: [],
            lastDecisionSummary: null,
            developerMode: false
        },
        WORLD_SENSE_ENABLED: false,
        WORLD_SENSE_WEATHER_ENABLED: false,
        WORLD_SENSE_WEATHER_CITY: '',
        WORLD_SENSE_WEATHER_LOCATION: null,
        WORLD_SENSE_WEATHER_API_HOST: '',
        WORLD_SENSE_WEATHER_API_KEY: '',
        WORLD_SENSE_WEATHER_CACHE: null,
        WORLD_SENSE_FESTIVAL_ENABLED: false,
        DESKTOP_SIGNATURE: '',
        DESKTOP_ACTIVITY: { days: {}, lastRenderDate: '' },
        TODO_PLAN_INJECT_ENABLED: false,
        COUNTDOWN_INJECT_ENABLED: false,
        CHARACTER_SCHEDULE_API_PRESET_INDEX: -1,
        CHARACTER_MEMORY_API_PRESET_INDEX: -1,
        AGENT_SKILL_ROUTER_ENABLED: false,
        AGENT_TODO_MANAGER_ENABLED: false,
        AGENT_HEART_NOTE_MANAGER_ENABLED: false,
        AGENT_SKILL_ROUTER_API_PRESET_INDEX: -1,
        WALLPAPER: 'assets/images/wallpaper.jpg',
        USER_AVATAR: 'assets/images/user.jpg',
        GIST_TOKEN: '',
        THEME: 'light',
        CUSTOM_BASE_THEME: 'dark',
        THEME_COLOR_H: 250,
        THEME_COLOR_S: 100,
        THEME_COLOR_L: 72,
        FONT_SIZE: 16,
        HIDE_THOUGHT_PROCESS: false,
        API_PRESETS: [],
        VISION_PRESETS: [],
        SYSTEM_PROMPT_PRESETS: [],
        
        // ★★★ 默认心迹设置也必须定义在 DEFAULT 里 ★★★
        MOMENTS_SETTINGS: {
            bgImage: '', 
            avatar: '', 
            username: '你的名字', // <-- 新增这一行
            signature: '写下你的此刻心情...',
            apiPresetIndex: -1, 
            allowedChars: [],
            // ★ 可见名单与原评论名单一样，空数组代表全部角色；真正停用由总开关负责。
            visibleCharacterAuthors: [],
            autoCharacterMomentsEnabled: true,
            autoCharacterMomentProbability: 50,
            autoCharacterLikeProbability: 25,
            lastAutoMomentCheckAt: 0,
            // ★ 记录最后看过的角色动态创建时间，刷新页面后未读红点也不会反复出现。
            lastSeenCharacterMomentAt: 0,
            // ★ 单独记录未读回复条数；进入心迹页后清零，新动态提示仍由上面的时间戳负责。
            unreadMomentReplyCount: 0,
            autoMomentStatsByChar: {},
            characterMomentCoverIndexes: {}
        },

        MAX_TOKENS: 32700, 
        TEMPERATURE: 1.1,
        CONTEXT_LIMIT: 5,
        HISTORY_WINDOW_STRATEGY: 'cache_friendly',
        HISTORY_WINDOW_MAX_CONTEXT: 25,
        DYNAMIC_CONTEXT_INSERT_MODE: 'auto',

        CUSTOM_REQUEST_BODY_JSON: '',
        REQUEST_BODY_PRESETS: [],

        CUSTOM_CSS: '', 
        CSS_PRESETS: [],
        // ★ 图片处理方式：老用户默认沿用“视觉 API 转文字”，避免升级后误把图片发给纯文字模型。
        IMAGE_API_MODE: 'separate',
        VISION_URL: 'https://api.siliconflow.cn/v1/chat/completions',
        VISION_KEY: '',
        VISION_MODEL: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        VISION_PROMPT: '请详细地描述这张图片的内容。不要发表评论，只需客观描述。',
    },

    SYSTEM_PROMPT: `- 这里是线上聊天，请完全成为该角色，鼓励自由回答、同理心和真实的情感。
- 好的回复：语言风格简短、生活化，类似人类的微信消息。
- 坏的回复：啰嗦、凑字数。
- 好的回复：深入理解当前对话情境，推敲角色的性格、动机和说话风格，使用符合角色性格和语言习惯的发言。
- 坏的回复：不符合角色的发言、不符合场景的发言、AI八股、敷衍搪塞。
- 你的输出需要符合角色性格和当前情境。
- 每次输出3~10句。输出时一句话一行，段落间空一行。
- 无需输出时间戳。
`
}

// 默认 system prompt 仍然只维护 CONFIG.SYSTEM_PROMPT 这一份；
// 放进 DEFAULT 后，用户保存的全局设置就可以覆盖它。
CONFIG.DEFAULT.SYSTEM_PROMPT = CONFIG.SYSTEM_PROMPT;




// 运行时状态
