// =========================================
// 项目分区总览（部分独立服务已拆到 js/ 目录）
//
// 3.5. WORLD SENSE (世界感知)
//   - WorldSense: 世界感知独立工具层
//     - cloneDraftFromSettings(): 从已保存设置复制一份编辑草稿
//     - searchLocationCandidates(city, options): 优先和风、失败回退 Open-Meteo 搜索地点候选
//     - fetchWeather(city, options): 优先和风、失败回退 Open-Meteo 获取天气
//     - isWeatherCacheValid(cache, city, now): 判断天气缓存是否属于当前 0/12 点时段
//     - buildWeekText(date): 生成星期文案，例如“周五”
//     - buildFestivalText(date): 生成节日文案
//     - buildPromptFromSettings(settings, now): 生成第 4 段 system prompt
//
// 3.6. TODO CONTEXT (探索 TO DO / 倒数日)
//   - TodoContext: TO DO 计划和倒数日的独立工具层
//     - toDateKey(date) / fromDateKey(dateKey): Date 和 YYYY-MM-DD 的互转
//     - addDays(date, days): 基于本地日期加减天数
//     - getTodayKey(now): 获取今天的 YYYY-MM-DD
//     - diffDays(dateKey, now): 计算目标日期距离今天的天数，可为负数
//     - formatMonthRangeLabel(startDate): 生成 7 天日期条的月份范围胶囊文案
//     - formatDateLabel(dateKey): 生成 `2026 - 05 - 24` 这种日期文案
//     - formatWeekLabel(dateKey): 生成星期文案
//     - limitForPrompt(items): 预留的 prompt 数量限制入口，第一版先不限制
//     - buildPrompt(now): 生成 `# 用户计划` system prompt
//     - buildTodoPromptLines(now): 生成每日计划 prompt 行，包含逾期未完成
//     - buildCountdownPromptLines(now): 生成倒数日 prompt 行
//     - buildCountupPromptLines(now): 生成正数日 prompt 行
//
// 3.7. CHARACTER SCHEDULE (探索角色日程)
//   - CharacterSchedule: 角色日程独立工具层
//     - getTodayKey(now): 获取今天的 YYYY-MM-DD
//     - getSchedule(contactId): 查找某个角色已保存的日程
//     - ensureSchedule(contactId): 确保某个角色有一份日程壳数据
//     - isFresh(schedule, now): 判断日程是不是今天可用
//     - timeToMinutes(value) / minutesToTime(minutes): HH:mm 和分钟数互转
//     - extractJson(rawText): 从 AI 返回内容里提取 JSON
//     - normalizeEntries(rawEntries): 把 AI 返回条目整理成统一字段
//     - validateEntries(entries): 校验日程必须连续覆盖 00:00-24:00
//     - parseAiSchedule(rawText): 提取、整理并校验 AI 日程
//     - getRecentHistoryText(contact, count): 提取最近聊天作为轻微参考
//     - buildGenerationMessages(contact, now): 生成请求 AI 产生日程的 messages
//     - findEntryIndex(entries, now): 找到当前时间所在日程条目
//     - buildChatPrompt(contactId, now): 生成聊天注入的当前/上一段/下一段日程
//
// 3.8. CHARACTER MEMORY (探索角色记忆)
//   - CharacterMemory: 角色每日记忆独立工具层
//     - getTodayKey(now) / getYesterdayKey(now): 获取本地日期 key
//     - ensureMemory(contactId): 确保某个角色有一份记忆壳数据
//     - getRecord(memory, dateKey): 查找某天的记忆记录
//     - collectMessagesForDate(contact, dateKey): 从聊天历史提取某天消息
//     - buildGenerationMessages(contact, dateKey): 生成请求 AI 总结记忆的 messages
//     - parseAiMemory(rawText): 提取、整理并校验 AI 记忆
//     - buildChatPrompt(contactId, now): 生成最近 N 天角色长期记忆注入文案
//
// 7. APP CONTROLLER (业务逻辑)
//   - 世界感知页面逻辑
//     - syncWorldSenseToggle(): 同步探索页世界感知总开关
//     - loadWorldSenseSettings(): 打开页面时把设置加载到草稿和 UI
//     - persistWorldSenseDraft(): 把世界感知草稿写入 IndexedDB
//     - testWorldSenseWeather(): 测试天气，并把成功结果直接写入 IndexedDB
//     - saveWorldSenseSettings(): 点击总保存时兜底写入 IndexedDB
//     - ensureWorldSenseWeatherReady(): 聊天真正发 prompt 前，按每天 0 点 / 12 点两个时段自动补天气
//   - TO DO / 倒数日页面逻辑
//     - syncTodoContextToggles(): 同步探索页 TO DO / 倒数日注入开关
//     - toggleTodoPlanInjectEnabled(enabled): 保存 TO DO 计划是否注入 AI
//     - toggleCountdownInjectEnabled(enabled): 保存倒数日是否注入 AI
//     - renderTodoDatePicker(scope): 渲染 7 天日期条
//     - renderTodoMonthPanel(scope): 渲染年月快选面板
//     - chooseTodoMonth(scope, month): 年月快选后跳到对应月份 1 号
//     - renderTodoPlans(): 渲染 TO DO 计划，包含逾期未完成、未来日期、历史已完成
//     - appendTodoGroup(list, title, items, options): 渲染 TO DO 外层分组和日期胶囊小组
//     - openTodoPlanModal(id) / saveTodoPlanFromModal(): 新建或编辑 TO DO
//     - openTodoTimeModal(id) / saveTodoTimeFromModal(): 打开和保存 TO DO 时间段弹窗
//     - normalizeTodoTimeValue(value): 把手机端手写时间统一整理成 HH:mm
//     - handleTodoPlanAction(action, id, groupEl): 完成、编辑、删除、折叠 TO DO
//     - renderCountdownDays(): 渲染倒数日 / 正数日列表
//     - openCountdownModal(id) / saveCountdownFromModal(): 新建或编辑倒数日 / 正数日
//     - handleCountdownAction(action, id): 完成、编辑、删除倒数日 / 正数日
//   - 角色日程页面逻辑
//     - renderScheduleAvatar(contact): 渲染角色日程列表里的头像 HTML
//     - getCharacterScheduleStatusText(schedule): 生成“未开启/生成中/今日 N 段”等状态文案
//     - openCharacterScheduleSettings(): 打开角色日程 API 设置弹窗
//     - saveCharacterScheduleSettings(): 保存角色日程生成使用的 API 预设
//     - renderCharacterScheduleList(): 渲染探索页角色日程总控列表
//     - openCharacterScheduleDetail(contactId): 打开某个角色的日程详情页
//     - renderCharacterScheduleDetail(): 渲染单角色当天日程详情
//     - buildScheduleRequestSettings(contact): 生成日程请求使用的 API 配置
//     - generateCharacterSchedule(contactId, options): 调用 AI 生成/重生成某个角色当天日程
//     - toggleCharacterScheduleEnabled(contactId, enabled): 开启或关闭某个角色日程
//     - ensureCharacterScheduleReady(contactId, options): 按“今天一次”策略补生成某个角色日程
//     - ensureEnabledCharacterSchedules(options): 按队列补生成所有已开启角色日程
//     - startCharacterScheduleDateWatcher(): 前端开着跨 0 点时触发新一天补生成
//     - openScheduleEntryModal(entryId): 打开单条日程内容编辑弹窗
//     - closeScheduleEntryModal(): 关闭单条日程编辑弹窗
//     - saveScheduleEntryFromModal(): 保存单条日程文本内容
//   - 桌面页面逻辑
//     - renderDesktop(): 统一刷新桌面所有小组件
//     - updateDesktopClock(): 刷新时间、日期、星期、农历和天气
//     - renderDesktopCountdown(): 渲染最近 1 个倒数日 / 正数日
//     - renderDesktopTodo(): 渲染桌面前 2 条 TO DO
//     - renderDesktopRecentContacts(): 渲染最近 3 个联系人快捷头像
//     - renderDesktopSwitches(): 同步桌面 2*2 快捷开关
//     - renderDesktopCloudSyncStatus(): 同步桌面云端同步快捷卡片状态
//     - renderDesktopActivity(force = false): 渲染请求次数活跃度方格日历
//     - showDesktopActivityTip(cell) / hideDesktopActivityTip(): 手机端点击热力图方块时显示/收起小浮窗
//     - renderDesktopAsyncStatus(): 渲染后台回复接收状态
//     - escapeHtml(text): 渲染 innerHTML 前统一转义可控文本，防止备份/AI内容触发 XSS
//     - sanitizeImageSrc(src): 过滤朋友圈图片地址，只允许 http/https/blob 和常见图片 data URL
//     - rememberReturnView(pageName, fallback): 记录二级页面从哪个主入口进入
//     - getReturnView(pageName, fallback): 获取二级页面返回时应该回到的主入口
//     - getTopNoticeTargetHandler(options): 生成顶部通知点击后的跳转/执行处理
//     - showTodoTopNotice(message, options): 弹出默认跳转到 TO DO 的顶部通知
//     - isViewingContactChat(contactId): 判断用户是否真的正在查看某个角色聊天窗口
//     - markContactIncomingMessage(contact, options): 统一处理非当前窗口 AI 新消息的红点和顶部通知
//     - showMomentReplyNotice(charId, options): 朋友圈收到新 AI 回复时累计未读并弹顶部通知，当前就在朋友圈页则静默
//     - markMomentReplyUnread(): 累计并保存探索页朋友圈入口的未读回复条数
//     - showMomentLikeNotice(charId, options): 角色延迟点赞后弹顶部通知，当前就在朋友圈页则静默
//     - showTopNotice(message, options): 通用顶部通知栈，支持多条并发、按钮和上划关闭
//     - isDynamicContextSystemRoleError(error): 判断错误是否像多 system / system role 兼容问题
//     - getDynamicContextWarnKey(contact, requestSettings): 生成兼容提示的会话内去重 key
//     - maybePromptDynamicContextCompatMode(error, requestSettings, contact): system/auto 模式报错时提示切换到 user 兼容模式
//     - ensureHistoryCacheMetadata(contact): 给历史消息补稳定 cacheId/cacheSeq，供缓存友好分块使用
//     - selectHistoryWindowRecords(contact, requestSettings): 根据严格最近/缓存友好策略选择要发送的历史窗口
//     - syncHistoryWindowStrategyUI(): 根据历史窗口策略显示或隐藏缓存友好参数
//     - hashForCacheDebug(value): 生成缓存调试用短 hash，方便比较两次请求哪一段变了
//     - summarizeMessagesForCacheDebug(messages): 汇总每条 messages 的 role/长度/hash
//     - buildRequestCacheDebugLog(options): 生成本轮请求的缓存定位日志，记录稳定前缀/动态背景/触发世界书 hash
//
// 发送消息主链路
//   - handleSend() 会先拼稳定 system / 角色 prompt，再追加历史消息
//   - handleSend() 会把世界感知、用户计划、角色日程、世界书和朋友圈收集成本轮背景
//   - handleSend() 会在 auto 模式下拆分日级稳定背景和本轮触发世界书：前者前置为 system，后者并入当前 user
//   - DYNAMIC_CONTEXT_INSERT_MODE 控制本轮触发背景作为前置 system、全部合并到当前 user，或自动把触发世界书并入 user
// =========================================

// 世界感知工具层已拆到 js/world-sense.js。
// TO DO / 倒数日工具层已拆到 js/todo-countdown-context.js。
// 角色日程工具层已拆到 js/character-schedule.js。
// 角色记忆工具层已拆到 js/character-memory.js。


// =========================================

// CONFIG: 应用程序的静态配置常量和默认值对象
//   - 已拆到 js/config.js，主业务和独立服务都会先读取它

//   - STORAGE_KEY: IndexedDB/localStorage 中存储角色/联系人数据的键名
//   - SETTINGS_KEY: 存储用户设置的键名
//   - WORLD_INFO_KEY: 存储世界书数据的键名
//   - MOMENTS_KEY: 存储朋友圈列表数据的键名
//   - MOMENTS_SETTINGS_KEY: 存储朋友圈设置的键名
//   - TODO_PLANS_KEY: 存储探索页 TO DO 计划列表的键名
//   - COUNTDOWN_DAYS_KEY: 存储探索页倒数日 / 正数日列表的键名
//   - CHARACTER_SCHEDULES_KEY: 存储探索页角色日程的键名
//   - CHARACTER_MEMORIES_KEY: 存储探索页角色记忆的键名
//   - CHAT_PAGE_SIZE: 聊天记录分页加载数量
//   - MOMENTS_PAGE_SIZE: 朋友圈分页加载数量
//   - GIST_ID_KEY: localStorage 中保存 Gist ID 的键名
//   - MOMENTS_INJECT_COUNT: AI 在聊天中感知新朋友圈的聊天轮次
//   - DEFAULT: 应用默认设置
//     - API_URL: 默认文本模型 API 地址
//     - MODEL: 默认文本模型名称
//     - API_KEY: 默认文本模型 API Key
//     - ASYNC_BACKEND_ENABLED: 是否启用后台回复接收
//     - ASYNC_BACKEND_URL: 可选后台回复接收服务地址
//     - ASYNC_BACKEND_TOKEN: 可选后台回复接收访问口令
//     - ASYNC_BACKEND_TTL_HOURS: 后台回复结果临时保留小时数
//     - TODO_PLAN_INJECT_ENABLED: 是否把 TO DO 计划注入 AI system prompt
//     - COUNTDOWN_INJECT_ENABLED: 是否把倒数日 / 正数日注入 AI system prompt
//     - CHARACTER_SCHEDULE_API_PRESET_INDEX: 角色日程生成使用的 API 预设索引，-1 表示跟随全局默认
//     - CHARACTER_MEMORY_API_PRESET_INDEX: 角色记忆生成使用的 API 预设索引，-1 表示跟随全局默认
//     - WALLPAPER: 默认壁纸
//     - USER_AVATAR: 默认用户头像
//     - GIST_TOKEN: 默认云同步 Token/密码
//     - THEME: 默认主题
//     - FONT_SIZE: 默认字体大小
//     - API_PRESETS: API 预设列表
//     - VISION_PRESETS: 视觉模型预设列表
//     - MOMENTS_SETTINGS: 朋友圈页面默认设置
//       - bgImage: 朋友圈背景图
//       - avatar: 朋友圈头像
//       - username: 朋友圈用户名
//       - signature: 朋友圈签名
//       - apiPresetIndex: 朋友圈使用的 API 预设索引
//       - allowedChars: 允许参与朋友圈的角色列表
//     - MAX_TOKENS: 默认最大输出 token
//     - TEMPERATURE: 默认温度参数
//     - CONTEXT_LIMIT: 缓存友好模式的最短上下文；严格模式下就是最近 N 条
//     - HISTORY_WINDOW_STRATEGY: 历史窗口策略，cache_friendly 为最短/最长窗口，strict_recent 为严格最近 N 条
//     - HISTORY_WINDOW_MAX_CONTEXT: 缓存友好模式下窗口增长到的最长上下文
//     - DYNAMIC_CONTEXT_INSERT_MODE: 本轮动态背景插入方式，auto 为缓存优化，system 为独立消息，user 为兼容模式
//     - CUSTOM_REQUEST_BODY_JSON: 自定义请求体附加 JSON
//     - REQUEST_BODY_PRESETS: 请求体参数预设列表
//     - SYSTEM_PROMPT: 用户可编辑的全局 System Prompt，允许空白表示不发送总 system prompt
//     - SYSTEM_PROMPT_PRESETS: System Prompt 预设列表，供全局和角色专属选择使用
//     - CUSTOM_CSS: 用户自定义 CSS
//     - CSS_PRESETS: CSS 预设列表
//     - VISION_URL: 默认视觉 API 地址
//     - VISION_KEY: 默认视觉 API Key
//     - VISION_MODEL: 默认视觉模型名称
//     - VISION_PROMPT: 默认图片识别提示词
//   - SYSTEM_PROMPT: 默认系统提示词

// STATE: 应用运行时状态对象
//   - contacts: 联系人/角色列表
//   - worldInfoBooks: 世界书列表
//   - currentContactId: 当前聊天联系人 ID
//   - currentBookId: 当前编辑的世界书 ID
//   - settings: 当前用户设置
//   - typingContactId: 当前正在输入的联系人 ID
//   - visibleMsgCount: 当前聊天窗口可见消息数量
//   - isSelectMode: 当前是否处于多选模式
//   - selectedBubbles: 已选中的消息气泡集合
//   - pendingImage: 用户待发送图片的 Base64 暂存
//   - moments: 朋友圈列表
//   - momentsSettings: 朋友圈页面设置
//   - visibleMomentsCount: 当前可见朋友圈数量
//   - todoPlans: 探索页 TO DO 计划列表
//   - countdownDays: 探索页倒数日 / 正数日列表
//   - characterSchedules: 探索页角色日程列表，每个角色一份开关和当天 entries
//   - characterMemories: 探索页角色记忆列表，每个角色一份开关、注入天数和每日 records
//   - todoPlanDraftDateOffset: TO DO 弹窗 7 天日期条相对今天的起点偏移
//   - countdownDraftDateOffset: 倒数日弹窗 7 天日期条相对今天的起点偏移
//   - editingTodoPlanId: 当前正在编辑的 TO DO 计划 ID
//   - editingTodoTimeId: 当前正在编辑时间段的 TO DO 计划 ID
//   - editingCountdownDayId: 当前正在编辑的倒数日 / 正数日 ID
//   - currentScheduleContactId: 当前正在查看日程详情的角色 ID
//   - editingScheduleEntryId: 当前正在编辑的单条日程 ID
//   - scheduleQueueRunning: 角色日程补生成队列是否正在运行，防止重复请求
//   - scheduleLastDateKey: 上次检查到的日期 key，用来发现前端开着跨 0 点
//   - scheduleDateTimer: 角色日程跨天检查定时器
//   - currentMemoryContactId: 当前正在查看记忆详情的角色 ID
//   - editingMemoryItem: 当前正在编辑的单条记忆定位信息
//   - memoryQueueRunning: 角色记忆补生成队列是否正在运行
//   - memoryLastDateKey: 上次检查到的日期 key，用来发现前端开着跨 0 点
//   - memoryDateTimer: 角色记忆跨天检查定时器
//   - countdownMode: 倒数日页面当前查看 down 或 up
//   - todoPlanMonthPicker / countdownMonthPicker: 年月快选面板的临时年份月份
//   - desktopClockTimer: 桌面时间小组件的分钟级刷新定时器
//   - desktopLastDateKey: 桌面上次渲染日期，用于跨 24 点后刷新天气和热力图
//   - desktopActivity: 桌面请求次数热力图运行时缓存
//   - currentMainView: 当前所在主入口，取 desktop / contact-list / explore
//   - returnViewByPage: 二级页面返回来源映射，避免返回按钮写死目标页
//   - chatMode: 聊天显示模式，normal 或 jump
//   - jumpStartIndex: 跳转模式起始消息索引
//   - jumpEndIndex: 跳转模式结束消息索引
//   - targetHighlightIndex: 需要高亮闪烁的目标消息索引


// =========================================
// 1.5. DB UTILS (IndexedDB 简易封装)
// =========================================

// DB: IndexedDB 的基础读写封装
//   - open(): 打开 IndexedDB 数据库，并在首次创建或升级时创建 objectStore
//   - get(key): 根据 key 从 IndexedDB 读取数据
//   - set(key, value): 将 value 写入 IndexedDB 指定 key
//   - remove(key): 删除 IndexedDB 中指定 key 的数据
//   - clear(): 清空 IndexedDB 当前 store 的全部数据
//   - exportAll(): 使用游标遍历并导出 IndexedDB 中所有 key-value 数据，用于备份


// =========================================
// 2. STORAGE SERVICE (本地持久化 - IndexedDB 版)
// =========================================

// Storage: 负责应用数据加载、保存、导入和导出
//   - load(): 初始化加载设置、联系人、世界书和朋友圈数据，并处理旧版 localStorage 数据迁移
//   - saveContacts(): 保存 STATE.contacts 联系人列表
//   - saveSettings(): 保存 STATE.settings 用户设置
//   - saveWorldInfo(): 保存 STATE.worldInfoBooks 世界书数据
//   - exportAllForBackup(): 从 IndexedDB 导出完整备份数据，并对 GIST_TOKEN 做安全处理
//   - importFromBackup(rawData): 导入手动备份或云同步备份，清库后写入新数据，并兼容 JSON 字符串格式
//   - saveMoments(): 保存 STATE.moments 朋友圈列表
//   - saveMomentsSettings(): 保存 STATE.momentsSettings 朋友圈设置
//   - saveTodoPlans(): 保存 STATE.todoPlans TO DO 计划列表
//   - saveCountdownDays(): 保存 STATE.countdownDays 倒数日 / 正数日列表
//   - saveCharacterSchedules(): 保存 STATE.characterSchedules 角色日程列表
//   - saveCharacterMemories(): 保存 STATE.characterMemories 角色记忆列表


// =========================================
// 3.6. TODO CONTEXT (探索 TO DO / 倒数日)
// =========================================

// TodoContext: 负责 TO DO / 倒数日的日期计算、排序辅助和 prompt 生成
//   - pad(num): 数字补零
//   - toDateKey(date): Date 转 YYYY-MM-DD
//   - fromDateKey(dateKey): YYYY-MM-DD 转本地 Date
//   - addDays(date, days): 日期加减天数
//   - getTodayKey(now): 获取今天的日期 key
//   - diffDays(dateKey, now): 计算目标日期距离今天几天，可返回负数
//   - formatMonthRangeLabel(startDate): 生成 7 天日期条的月份范围胶囊
//   - formatMonthLabel(dateKey): 生成单月胶囊文案
//   - formatDateLabel(dateKey): 生成完整日期文案
//   - formatWeekLabel(dateKey): 生成星期文案
//   - limitForPrompt(items): 预留 prompt 数量限制入口
//   - buildPrompt(now): 生成 `# 用户计划` system prompt
//   - buildTodoPromptLines(now): 生成 TO DO prompt 行，包含逾期未完成和未来计划
//   - buildCountdownPromptLines(now): 生成倒数日 prompt 行
//   - buildCountupPromptLines(now): 生成正数日 prompt 行


// =========================================
// 3.7. CHARACTER SCHEDULE (探索角色日程)
// =========================================

// CharacterSchedule: 负责角色日程的日期、AI JSON 解析、24 小时校验和聊天注入文案
//   - pad(num): 数字补零
//   - getTodayKey(now): 获取今天的日期 key
//   - getSchedule(contactId): 查找指定角色的日程数据
//   - ensureSchedule(contactId): 没有日程时创建一份默认壳数据
//   - isFresh(schedule, now): 判断日程是不是今天的可用缓存
//   - timeToMinutes(value): 把 HH:mm 转成当天分钟数，24:00 视为 1440
//   - minutesToTime(minutes): 把当天分钟数转回 HH:mm
//   - extractJson(rawText): 从纯 JSON、代码块或混杂文本中提取 JSON
//   - normalizeEntries(rawEntries): 兼容 start/end/text/activity/title 等字段并统一排序
//   - validateEntries(entries): 校验时间连续、无空档、无重叠，并覆盖 00:00-24:00
//   - parseAiSchedule(rawText): 解析 AI 返回并得到可保存的 entries
//   - getRecentHistoryText(contact, count): 提取最近聊天给 AI 做轻微参考
//   - buildGenerationMessages(contact, now): 组装生成日程时发给 AI 的 messages
//   - findEntryIndex(entries, now): 查找当前时间命中的日程项
//   - buildChatPrompt(contactId, now): 生成聊天时注入的“当前/上一段/下一段”

// =========================================
// 3.8. CHARACTER MEMORY (探索角色记忆)
// =========================================

// CharacterMemory: 负责角色记忆的日期、聊天提取、AI JSON 解析和聊天注入文案
//   - getTodayKey(now): 获取今天的日期 key
//   - getYesterdayKey(now): 获取昨天的日期 key
//   - ensureMemory(contactId): 没有记忆时创建一份默认壳数据
//   - getRecord(memory, dateKey): 查找指定日期的记忆记录
//   - collectMessagesForDate(contact, dateKey): 按 timestamp / 内容前缀提取当天聊天
//   - buildGenerationMessages(contact, dateKey): 组装生成每日记忆时发给 AI 的 messages
//   - parseAiMemory(rawText): 解析 AI 返回并得到可保存的 memories/comment
//   - buildChatPrompt(contactId, now): 生成聊天时注入的最近 N 天长期记忆


// =========================================
// 3. WORLD INFO ENGINE (世界书引擎)
// =========================================

// WorldInfoEngine: 负责世界书导入、导出和触发扫描
//   - importFromST(jsonString, fileName): 导入 SillyTavern/ST 世界书 JSON，并转换成本应用的 book 格式
//   - exportToST(book): 将当前世界书导出为 ST 兼容 JSON 字符串
//   - scanByType(userText, history, currentContactId, currentContactName): 分开返回常驻条目和关键词触发条目
//   - scan(userText, history, currentContactId, currentContactName): 根据用户输入、最近历史和当前角色扫描触发世界书条目，并返回注入内容


// =========================================
// 4. API SERVICE (LLM 通信)
// =========================================

// API: 负责模型服务商识别、模型拉取、连接测试和聊天请求
//   - getProvider(url): 根据 API URL 判断服务商类型，返回 claude、gemini 或 openai
//   - fetchModels(url, key): 拉取模型列表，兼容原生 Gemini 和 OpenAI/Claude 风格接口
//   - estimateTokens(text): 粗略估算文本 token 数，用于 API 未返回 usage 时兜底
//   - extractPromptCacheUsage(usage, promptTokens): 统一提取 DeepSeek/OpenAI 兼容接口的 prompt 缓存命中字段
//   - testConnection(url, key, model): 发送极简 Ping 请求测试 API 是否可用
//   - shouldUseAsyncBackend(settings): 判断当前聊天是否启用后台回复接收
//   - asyncJobLogId(jobId): 调试日志里只显示 jobId 前几位，避免控制台太乱
//   - asyncBackendDiagnosticStorageKey(): 返回后台接收诊断日志的 localStorage key
//   - loadAsyncBackendDiagnostics(): 读取手机端可见的后台接收诊断日志
//   - saveAsyncBackendDiagnostics(logs): 保存后台接收诊断日志，并只保留最近记录
//   - clearAsyncBackendDiagnostics(): 清空本地后台接收诊断日志
//   - logAsyncBackendEvent(event): 记录单条后台接收事件码和人话排查信息
//   - mergeAsyncBackendJobEvents(jobId, events): 合并 Worker 返回的 job 事件链
//   - parseAsyncBackendErrorPayload(text): 解析 Worker 错误响应里的 JSON 错误码
//   - getAsyncBackendErrorEventCode(status, payload): 把 HTTP 状态和错误响应转换成诊断事件码
//   - describeAsyncBackendEvent(code, detail): 把诊断事件码转换成手机端可读说明
//   - chatViaAsyncBackend(messages, settings): 通过后台 job 创建、轮询并取回 AI 回复
//   - createChatJob(backendUrl, messages, settings): 创建后台生成任务并返回 jobId
//   - waitForChatJob(backendUrl, jobId, token): 轮询后台任务直到完成、失败或超时
//   - getChatJob(backendUrl, jobId, token): 查询单个后台任务状态
//   - deleteChatJob(backendUrl, jobId, token): 前端取回结果后删除后台临时任务
//   - isAsyncBackendRecoverablePollError(error): 判断后台 job 创建后，轮询阶段是否只是被手机切后台打断
//   - explainAsyncBackendError(error): 把后台/上游错误转换成前端可读说明，并保留关键原文
//   - testAsyncBackendConnection(settings): 用极简 ping job 测试后台回复接收是否可用
//   - pendingJobStorageKey(): 返回本地 pending job 列表的 localStorage key
//   - loadPendingJobs(): 读取本地 pending job 列表
//   - savePendingJobs(jobs): 保存本地 pending job 列表
//   - rememberPendingJob(jobId, settings): 创建任务后记录待恢复 job
//   - forgetPendingJob(jobId): 任务完成后移除本地 pending job
//   - rememberResumedAsyncJobResult(jobId, job): 缓存恢复链路刚取回的结果，化解前台轮询 404 竞态
//   - getResumedAsyncJobResult(jobId): 前台轮询遇到 404 时复用恢复链路结果
//   - markPendingJobFailed(jobId, error): 标记本地 pending job 失败原因
//   - updateAsyncBackendLogWithVision(result, settings): 后台识图完成后，把 image_description 补写进 API 日志
//   - recordDesktopInteractionCount(): 桌面互动日志计数，人在桌面时只刷新今天方块
//   - chat(messages, settings): 根据当前服务商组装请求体，发送聊天请求，处理 token 日志，并返回最终回复文本
//   - analyzeImage(base64Image, visionSettings): 独立的视觉分析函数，调用配置的视觉模型描述图片内容


// =========================================
// 5. CLOUD SYNC (云同步)
// =========================================

// CloudSync: 负责自定义服务器/GitHub Gist 的备份、恢复和同步
//   - init(): 初始化云同步 UI，恢复上次同步模式、URL 和 Gist ID
//   - toggleMode(): 切换 custom/gist 同步模式，并调整表单显示和认证字段说明
//   - showStatus(msg, isError = false): 在同步设置区域显示状态信息或错误信息
//   - getAuth(): 获取当前输入框或设置中保存的同步密码/Token，并兼容 ENC_ 加密格式
//   - _unwrapBackup(json): 兼容云同步外壳格式和手动导出格式，提取真正的数据对象
//   - _validateBackupBeforeUpload(payload): 上传前校验备份内容，防止空备份覆盖云端数据
//   - _maskToken(token): 对 Token 做简单反转 + Base64 混淆，降低明文泄露风险
//   - _unmaskToken(maskedToken): 将混淆后的 Token 还原，并兼容未混淆的 GitHub Token
//   - _preparePayload(): 从 Storage 导出备份并包装成 TeleWindy 云同步 payload
//   - updateBackup(): 根据当前同步模式选择上传到自定义服务器或 Gist
//   - findBackup(): 使用 GitHub Token 搜索描述为 “TeleWindy Backup” 的 Gist，并自动填入 ID
//   - restoreBackup(): 从当前同步源拉取备份，确认后恢复到本地数据库
//   - _safeRestore(data): 安全恢复备份数据，保留同步配置并处理空间不足错误
//   - _uploadToCustom(): 将备份上传到自定义服务器
//   - _fetchFromCustom(password): 从自定义服务器拉取备份 JSON
//   - _uploadToGist(): 将备份创建或更新到 GitHub Gist
//   - _fetchFromGist(token): 根据 Gist ID 从 GitHub Gist 拉取备份内容


// =========================================
// 6. UI RENDERER (DOM 操作)
// =========================================

// UI: 负责界面渲染、主题外观、聊天窗口、消息气泡和预设菜单
//   - init(): 初始化 UI，渲染联系人、初始化云同步、绑定字体滑块和聊天滚动监听，并应用外观
//   - getThemeColorSettings(settings): 读取并校正主题色 HSL 设置，旧数据缺失时回落到原来的紫色
//   - applyThemeColor(color): 把主题色 HSL 写入 CSS 变量，让 --primary-btn-text 跟着更新
//   - syncThemeColorControls(color): 同步外观页主题色滑条、数值文字和预览色块
//   - applyAppearance(): 应用壁纸、主题、字体大小、主题色和自定义 CSS，并同步主题控件状态
//   - renderCssPresetMenu(): 渲染 CSS 样式预设下拉菜单
//   - toggleTheme(newTheme): 切换主题并保存设置
//   - switchView(viewName): 在桌面、联系人列表、聊天页、探索页、朋友圈页等视图之间切换，并记录二级页返回来源
//   - renderVisionPresetMenu(): 渲染视觉模型预设下拉菜单
//   - renderContacts(): 渲染联系人列表，包括头像、消息预览、未读红点、置顶金边和排序箭头
//   - renderBookSelect(): 渲染世界书大分类下拉框，并同步当前选中的世界书
//   - updateCurrentBookSettingsUI(): 根据当前世界书更新角色绑定下拉框状态
//   - renderWorldInfoList(): 渲染当前世界书的条目列表，并高亮正在编辑的条目
//   - initWorldInfoTab(): 初始化世界书编辑 Tab，包括角色下拉框、书列表和条目列表
//   - buildAgentMessageParts(text): 按原文位置生成正文、分割线和 Agent 调用渲染项
//   - createAgentCallPanel(markedIntents, contactName, shouldAnimate = false): 创建脱离头像布局的 Agent 调用折叠面板
//   - createSingleBubble(text, sender, aiAvatarUrl, timestampRaw, historyIndex, shouldAnimate = true, partIndex = 0, imageUrl = null, isThought = false): 创建单个聊天气泡，支持文本、图片、时间、头像、思考内容和动画
//   - openImageLightbox(src): 打开图片大图预览遮罩，点击后关闭
//   - showEditModal(oldText, onConfirmCallback): 显示消息编辑弹窗，确认后通过回调返回新文本
//   - removeLatestAiBubbles(): 删除聊天窗口中最后一组 AI 消息气泡，用于重生成前清理旧回复
//   - renderChatHistory(contact, isLoadMore = false, keepScrollPosition = false): 渲染当前联系人的聊天历史，支持分页加载、跳转模式、高亮、隐藏内容，并隐藏 Agent『动作意图』
//   - appendMessageBubble(text, sender, aiAvatarUrl, timestampRaw, historyIndex = null): 向聊天窗口追加一条消息气泡
//   - appendSeparator(shouldAnimate = false): 在聊天窗口追加分隔线/时间分隔元素
//   - scrollToBottom(): 将聊天滚动容器滚动到底部
//   - setLoading(isLoading, contactId): 设置发送按钮/加载状态，并记录哪个联系人正在输入
//   - updateRerollState(contact): 根据当前联系人和聊天历史更新“重新生成”按钮状态
//   - playWaterfall(fullText, avatar, timestamp, historyIndex, contactName): 将 AI 完整回复按段落瀑布式逐条显示，并处理思考内容和 Agent 调用面板
//   - initStatusBar(): 初始化顶部状态栏时间、电池信息和相关监听
//   - renderPresetMenu(): 渲染 API 预设菜单，并绑定保存、删除、加载预设事件
//   - renderRequestBodyPresetMenu(): 渲染请求体参数预设菜单，并绑定保存、删除、加载预设事件
//   - renderSystemPromptPresetMenu(): 渲染 System Prompt 预设菜单，并绑定保存、删除、加载预设事件

// UI 内部具名局部函数
//   - closeModal(): showEditModal 内部的关闭弹窗函数，用于隐藏编辑弹窗并清理按钮事件
//   - updateTime(): initStatusBar 内部的时间刷新函数，用于更新顶部状态栏时间
//   - updateBatteryUI(level, isCharging): initStatusBar 内部的电池刷新函数，用于显示电量和充电状态


// =========================================
// 7. APP CONTROLLER (业务逻辑)
// =========================================

//   - App: 应用程序的核心业务逻辑控制器，负责协调数据、界面和用户交互
//     - els: UI元素的引用快捷方式，指向UI.els
//     - init(): 异步初始化应用程序入口，加载存储数据、初始化UI、绑定事件、渲染联系人列表和状态栏
//     - enterChat(id): 进入与指定ID联系人的聊天界面，清理搜索模式状态、重置滚动条、更新顶部状态、清除新消息标记并渲染聊天历史和联系人列表
//     - handleSend(isReroll): 异步处理消息发送或重新生成（Reroll），包括API配置准备、内容处理、识图、上下文构建、AI请求和UI更新
//     - openSettings(): 打开设置弹窗，加载并回显所有设置项的值（API配置、视觉配置、壁纸、主题、CSS等）
//     - switchWorldInfoBook(bookId): 切换当前编辑的世界书，更新UI和列表
//     - bindCurrentBookToChars(charIds): 将当前选中的世界书绑定到指定角色范围，空数组代表全局
//     - loadWorldInfoEntry(uid): 根据唯一标识符(uid)加载世界书条目数据到编辑表单中
//     - saveWorldInfoEntry(): 异步保存当前编辑的世界书条目（新建或更新），处理键词、内容和常量标志
//     - deleteWorldInfoEntry(): 异步删除当前编辑的世界书条目
//     - clearWorldInfoEditor(): 清空世界书编辑器表单中的所有字段
//     - createNewBook(): 异步创建一本新的世界书，并切换到该书
//     - renameCurrentBook(): 异步重命名当前选中的世界书
//     - deleteCurrentBook(): 异步删除当前选中的世界书（至少保留一本）
//     - exportCurrentBook(): 将当前世界书导出为SillyTavern格式的JSON文件
//     - handleImportWorldInfo(file): 异步处理从SillyTavern格式JSON文件导入世界书
//     - handleSavePreset(): 异步保存当前的API配置（URL、密钥、模型、参数）为一个预设
//     - handleLoadPreset(index): 根据索引加载指定的API预设配置到设置表单中
//     - handleDeletePreset(): 异步删除选中的API预设
//     - handleSaveSystemPromptPreset(): 异步保存当前 System Prompt 为一个命名预设，允许空白预设并支持同名覆盖
//     - handleLoadSystemPromptPreset(index): 根据索引加载指定的 System Prompt 预设到全局提示词编辑框
//     - handleDeleteSystemPromptPreset(): 异步删除选中的 System Prompt 预设
//     - saveSettingsFromUI(): 异步从设置表单中读取所有值并保存到STATE和存储中
//     - handleMessageAction(action): 处理消息右键菜单的动作（编辑、删除、隐藏/显示、复制、多选模式）
//     - enterSelectMode(): 进入消息多选模式，显示底部操作栏并绑定相关事件
//     - exitSelectMode(): 退出消息多选模式，清除所有选中状态并隐藏操作栏
//     - toggleBubbleSelection(bubbleEl): 切换单个消息气泡的选中状态
//     - updateSelectCount(): 更新多选模式下已选中的消息数量显示
//     - bindSelectBarEvents(): 绑定多选模式底部操作栏按钮（退出、批量复制、批量删除、批量隐藏）的事件
//     - handleBatchCopy(): 处理批量复制选中的消息内容，从数据源按序提取文本和图片描述
//     - handleBatchToggleHidden(): 处理批量隐藏或显示选中的消息段落（包括文本和图片）
//     - handleBatchDelete(): 处理批量删除选中的消息段落，支持删除文本段落、图片和思考过程
//     - hideContactActionMenu(): 隐藏联系人长按菜单，并清空当前选中的联系人 ID
//     - showContactActionMenu(contactId): 显示联系人长按菜单，按当前置顶状态切换“置顶/取消置顶”文案
//     - handleContactListAction(action): 执行联系人菜单动作，包括置顶切换和进入排序模式
//     - normalizeContactOrder(): 把置顶联系人稳定挪到普通联系人前面，保留组内原顺序
//     - moveContactInList(contactId, direction): 在置顶组或普通组内部把联系人上移/下移一格并保存
//     - hideMessageContextMenu(): 隐藏消息的右键上下文菜单
//     - showMessageContextMenu(msgIndex, rect): 在指定位置显示消息的右键上下文菜单，并设置防误触锁
//     - resumePendingChatJobs(): 启动或回前台时检查未完成的后台生成任务，并把结果写回聊天/朋友圈
//     - isAsyncBackendJobStale(pending): 判断本地 pending job 是否超过 30 分钟，避免无限轮询
//     - markAsyncBackendJobStale(pending): 把卡住的后台任务标记为停止，并在聊天/朋友圈里做善后
//     - scheduleAsyncBackendResumeCheck(delayMs): 手机切回前台后，轻量补查后台 pending job
//     - applyAsyncMomentJob(context, job, jobId): 将朋友圈后台任务结果写回对应动态或评论
//     - markAsyncMomentJobFailed(context): 朋友圈后台任务失败时恢复“重新生成中”的旧评论
//     - buildMomentsAsyncContext(type, data): 为朋友圈后台任务生成回填定位信息
//     - applyAsyncBackendToMomentConfig(config, context): 给朋友圈 API 配置补上后台接收参数
//     - loadAsyncBackendSettings(): 打开后台运行服务时填充共享 URL、Token 和能力开关
//     - loadAsyncReplySettings(): 打开切屏回复接收时填充调用模式、保留时间和任务状态
//     - saveAsyncBackendSettings(): 保存共享的后台服务连接配置
//     - saveAsyncReplySettings(): 保存切屏回复接收的调用模式和保留时间
//     - syncAsyncBackendToggle(): 同步探索页胶囊开关状态
//     - toggleAsyncBackendEnabled(enabled): 切换后台回复接收启用状态
//     - clearAsyncBackendPendingJobs(): 手动清理本地 pending job，并尝试删除 Worker 临时任务
//     - renderAsyncBackendPendingJobs(): 在切屏回复接收页面显示待接收/已停止/可能卡住的任务
//     - renderAsyncBackendDiagnosticList(diagnostics): 渲染手机端可见的后台接收诊断日志
//     - formatAsyncBackendDiagnosticTime(ts): 把诊断日志时间戳格式化成 HH:mm:ss
//     - formatAsyncBackendPendingAge(ageMs): 把 pending job 等待时间格式化成“几分钟/几小时”
//     - testAsyncBackendSettings(): 测试后台服务 URL/Token/模型链路是否可用
//     - syncTodoContextToggles(): 同步 TO DO / 倒数日注入开关
//     - toggleTodoPlanInjectEnabled(enabled): 保存 TO DO 注入开关
//     - toggleCountdownInjectEnabled(enabled): 保存倒数日注入开关
//     - buildAgentCapabilityPrompt(): 根据已开启 skill 生成注入角色描述末尾的 `# 能力` 模块，没开 skill 时返回空
//     - syncAgentHeartNoteToggles(): 同步探索页和 Agent 页的心笺管理开关
//     - buildAgentSkillRouterRequestSettings(baseSettings): 生成 Agent 轻量模型参数，压小输出预算
//     - buildAgentTodoManagerRequestSettings(): 生成 TODO 管理 Agent 使用的 API 配置
//     - runAgentPostAgents(contact, assistantText, assistantMessage): 只在角色回复含『动作意图』时触发 Agent，不再每轮跑总路由
//     - runAgentTodoIntentOperations(contact, intentTexts, assistantMessage): 把『』内自然语言意图交给 TODO Agent 翻译成待确认建议
//     - executeAgentTodoSkill(routerResult, contact): 旧 pre-agent 直接落地入口，根据 TODO Agent 输出的操作包新增/完成/取消/改期
//     - escapeHtml(text): 渲染 innerHTML 前做 HTML 转义，TO DO、朋友圈、搜索结果等都会复用
//     - sanitizeImageSrc(src): 过滤朋友圈图片地址，拦截 javascript: / SVG data 等危险来源
//     - renderTodoDatePicker(scope): 渲染 TO DO / 倒数日弹窗的 7 天日期条
//     - getTodoMonthPickerState(scope): 获取年月快选面板临时状态
//     - renderTodoMonthPanel(scope): 渲染年月快选面板
//     - toggleTodoMonthPanel(scope): 打开或关闭年月快选面板
//     - shiftTodoMonthPanelYear(scope, delta): 年月面板年份加减
//     - chooseTodoMonth(scope, month): 选择月份并跳到该月 1 号
//     - openTodoPlanModal(id): 打开新增 / 编辑 TO DO 弹窗
//     - closeTodoPlanModal(): 关闭 TO DO 弹窗
//     - saveTodoPlanFromModal(): 保存新增 / 编辑后的 TO DO
//     - openTodoTimeModal(id): 打开 TO DO 时间段弹窗，并同步手写输入和系统时间控件
//     - saveTodoTimeFromModal(): 保存 TO DO 时间段，校验 HH:mm 和开始/结束顺序
//     - normalizeTodoTimeValue(value): 兼容 930 / 09:30 / 9:5 等手写输入并转成 HH:mm
//     - renderTodoPlans(): 渲染 TO DO 列表，含逾期未完成、日期计划、历史已完成
//     - appendTodoGroup(list, title, items, options): 渲染 TO DO 分组和组内日期胶囊
//     - createTodoItemElement(item): 创建单条 TO DO DOM
//     - handleTodoPlanAction(action, id, groupEl): 处理 TO DO 完成、编辑、删除、折叠
//     - openCountdownModal(id): 打开新增 / 编辑倒数日弹窗
//     - closeCountdownModal(): 关闭倒数日弹窗
//     - setCountdownMode(mode): 切换倒数日页面的倒数 / 正数 Tab
//     - setCountdownModalMode(mode): 切换倒数日弹窗的倒数 / 正数 Tab
//     - getCountdownModalMode(): 读取倒数日弹窗当前模式
//     - saveCountdownFromModal(): 保存新增 / 编辑后的倒数日 / 正数日
//     - renderCountdownDays(): 渲染倒数日 / 正数日列表
//     - createCountdownElement(item): 创建单条倒数日 DOM
//     - handleCountdownAction(action, id): 处理倒数日完成、编辑、删除
//     - renderScheduleAvatar(contact): 生成角色日程列表头像 HTML，兼容图片头像和文字头像
//     - getCharacterScheduleStatusText(schedule): 生成角色日程状态文案
//     - openCharacterScheduleSettings(): 打开角色日程设置弹窗，并填充 API 预设下拉框
//     - saveCharacterScheduleSettings(): 保存角色日程专属 API 预设索引
//     - renderCharacterScheduleList(): 渲染角色日程总控列表，每个角色有头像、名字、状态和开关
//     - openCharacterScheduleDetail(contactId): 进入指定角色的日程详情页，并按需补生成
//     - renderCharacterScheduleDetail(): 渲染当前角色的当天日程条目列表
//     - buildScheduleRequestSettings(contact): 生成日程请求用的 API 配置，支持角色专属 API 预设
//     - generateCharacterSchedule(contactId, options): 请求 AI 生成当天日程，解析失败时静默重试
//     - toggleCharacterScheduleEnabled(contactId, enabled): 保存角色日程开关，并在开启时补生成
//     - ensureCharacterScheduleReady(contactId, options): 当前角色没有今日日程时自动补一份
//     - ensureEnabledCharacterSchedules(options): 页面启动或跨天时，排队补生成所有开启角色
//     - startCharacterScheduleDateWatcher(): 启动每分钟一次的跨天检查
//     - openScheduleEntryModal(entryId): 打开单条日程内容编辑弹窗
//     - closeScheduleEntryModal(): 关闭单条日程内容编辑弹窗
//     - saveScheduleEntryFromModal(): 保存单条日程内容，只改 text 不改时间
//     - getDesktopDateKey(date): 获取桌面按本地时间使用的日期 key
//     - startDesktopClock(): 启动桌面时间小组件的分钟级刷新
//     - renderDesktop(): 统一刷新桌面所有小组件
//     - updateDesktopClock(): 刷新桌面时间、日期、农历和天气
//     - renderDesktopSignature(): 渲染独立的桌面个性签名
//     - renderDesktopCountdown(): 渲染最近 1 个倒数日 / 正数日
//     - formatDesktopCountdownText(item): 生成桌面倒数日 / 正数日文案
//     - renderDesktopTodo(): 渲染桌面前 2 条未完成 TO DO
//     - renderDesktopRecentContacts(): 渲染最近 3 个联系人快捷入口
//     - getDesktopContactLastTime(contact): 计算联系人最近会话时间，用于桌面排序
//     - renderDesktopSwitches(): 同步桌面 2*2 快捷开关状态
//     - renderDesktopCloudSyncStatus(): 同步桌面云端同步快捷卡片状态
//     - renderDesktopActivity(force = false): 渲染请求次数活跃度方格日历
//     - showDesktopActivityTip(cell) / hideDesktopActivityTip(): 手机端点击热力图方块时显示/收起小浮窗
//     - renderDesktopActivityToday(): 只刷新今天方块和“今天 X 次”文字
//     - getDesktopActivityLevel(count): 按当天请求次数计算热力图深浅等级
//     - renderDesktopAsyncStatus(): 渲染桌面后台回复接收状态
//     - saveDesktopSignature(text): 保存桌面独立个性签名
//     - toggleDesktopTodo(id, checked): 在桌面直接勾选 TO DO 完成状态
//     - clearDesktopAsyncStatus(): 清理桌面显示的后台接收状态
//     - escapeHtml(text): 渲染 innerHTML 前统一转义可控文本，防止备份/AI内容触发 XSS
//     - sanitizeImageSrc(src): 过滤朋友圈图片地址，只允许 http/https/blob 和常见图片 data URL
//     - rememberReturnView(pageName, fallback): 记录二级页面从哪个主入口进入
//     - getReturnView(pageName, fallback): 获取二级页面返回时应该回到的主入口
//     - switchMainTab(tab): 切换底部导航栏的主视图（聊天、探索、朋友圈）
//     - renderMomentsUI() / openMomentProfile() / showMomentsFeed(): 渲染公开动态流与用户/角色个人主页
//     - maybeGenerateCharacterMoment(): 按可见名单与用户概率设置生成角色动态
//     - toggleMomentLike() / openMomentCommentComposer(): 处理动态点赞和用户主动评论
//     - loadMoreMoments(): 加载更多朋友圈动态，增加可见数量并重新渲染
//     - openMomentsSettings(): 打开朋友圈设置弹窗，填充API预设下拉框和允许评论的联系人复选框列表
//     - saveMomentsSettings(): 保存朋友圈设置（API预设索引、允许评论的角色列表）到STATE和存储
//     - publishMoment(): 异步发布新的朋友圈动态，处理文本和图片，并触发AI评论
//     - triggerAIComments(targetMoment): 异步为新建的朋友圈动态触发所有允许角色的AI评论生成
//     - handleMomentAction(action): 处理朋友圈动态的右键菜单动作（复制、编辑、删除）
//     - saveAndRenderMoments(): 辅助函数，保存朋友圈数据到存储并刷新朋友圈列表视图
//     - handleCommentAction(action): 处理朋友圈评论的右键菜单动作（复制、编辑、重新生成、删除）
//     - openReplyModal(): 打开回复评论的输入弹窗
//     - executeCommentReply(): 异步执行对特定评论的回复，保存用户回复并触发AI的进一步回复
//     - getMomentsContextForChat(contactId): 为聊天生成关于未读朋友圈动态的上下文Prompt，用于注入到AI对话中
//     - bindEvents(): 绑定应用程序中所有的用户交互事件（点击、输入、长按、文件上传等），是事件监听器的核心注册中心
//     - readFile(file): 读取文件并返回Promise，结果为文件的Base64编码字符串
//     - handleTestConnection(): 异步测试API连接，根据设置的URL、密钥和模型发送测试请求
//     - fetchModelsForUI(): 异步从配置的API端点拉取可用模型列表，并打开文字模型选择弹窗
//     - handleVisionTestConnection(): 异步测试视觉API的连接性，支持复用主API密钥
//     - fetchVisionModelsForUI(): 异步拉取视觉API的可用模型列表，并打开视觉模型选择弹窗
//     - bindImageUpload(inputId, imgId, inputUrlId, callback): 绑定图片上传输入框的事件，将图片转为Base64并更新预览和可选的回调函数
//     - handleSaveVisionPreset(): 保存当前的视觉API配置（URL、密钥、模型、提示词）为一个预设
//     - handleLoadVisionPreset(): 加载选中的视觉API预设配置到设置表单中
//     - handleDeleteVisionPreset(): 删除选中的视觉API预设
//     - openEditModal(id): 打开角色编辑/新建弹窗，根据是否有id区分编辑或新建模式，并填充相应数据
//     - saveContactFromModal(): 异步从角色编辑弹窗保存数据，用于新建或更新角色信息，包括 API/System Prompt 预设绑定
//     - handleSaveRequestBodyPreset(): 异步保存当前的请求体附加参数（JSON字符串）为一个预设
//     - handleLoadRequestBodyPreset(value): 根据预设值加载请求体附加参数预设到输入框
//     - handleDeleteRequestBodyPreset(): 异步删除选中的请求体附加参数预设
//     - handleSaveCssPreset(): 保存用户自定义CSS为一个命名预设
//     - handleLoadCssPreset(index): 根据索引加载指定的CSS预设内容到编辑框并应用
//     - handleDeleteCssPreset(): 删除选中的CSS预设
//     - prefixUserCss(rawCss): 为用户自定义的CSS规则自动添加'body.custom-mode '前缀以提高样式权重


// =========================================
// 8. UTILS & EXPORTS (工具与启动)
// =========================================


//   - formatTimestamp(): 为聊天消息生成标准时间戳，格式为 YYYY-MM-DD HH:MM
//   - formatTimeForMoments(ts): 为朋友圈（朋友圈）动态生成友好的时间显示格式，如 "1月20日 14:30"
//   - window.exportData(): 全局函数，异步导出所有应用程序数据（联系人、设置、世界书、朋友圈等）为JSON备份文件并触发下载
//   - window.importData(input): 全局函数，从用户选择的JSON备份文件中导入并恢复所有数据，包含数据完整性检查和容量警告
//   - parseCustomMarkdown(text): 终极Markdown解析器，支持数学公式（KaTeX）、表格容器化包装、引用处理，并通过DOMPurify进行安全过滤
//   - cleanMarkdownForCopy(text): 纯文本清洗函数，用于复制操作时移除Markdown格式符号、引用标记和数学公式定界符
//   - window.onload: 页面加载完成后的启动入口，调用 App.init() 初始化整个应用程序








// =========================================
// 1. STATE (运行时状态)
// =========================================

// CONFIG 已拆到 js/config.js，这里继续保留运行中会频繁变化的 STATE
const STATE = {
    contacts: [],

    // ★★★ 联系人列表长按 / 置顶 / 排序 START ★★★
    // selectedContactActionId：菜单打开时记住“正在操作哪一个联系人”
    // isContactSortMode：是否进入上下箭头排序模式
    // contactClickLocked：长按后浏览器可能再补一个 click，这里用来防止误进聊天
    selectedContactActionId: null, // 联系人长按菜单当前选中的角色
    isContactSortMode: false,      // 联系人列表是否正在显示上下排序按钮
    contactClickLocked: false,     // 长按弹菜单后，拦住紧跟着冒出来的 click
    // ★★★ 联系人列表长按 / 置顶 / 排序 END ★★★

    worldInfoBooks: [], // ★★★ 改名：这里存放“书”的数组
    currentContactId: null,
    currentBookId: null, // ★★★ 新增：当前正在编辑哪本书
    settings: {}, 
    typingContactId: null, // ★★★ 新增：用于追踪哪个联系人正在输入，null表示无人输入
    visibleMsgCount: 15, // ★★★ 新增：当前聊天窗口显示的条数，默认为15
    isSelectMode: false,      // 当前是否处于多选模式
    selectedBubbles: new Set(),  // 存储选中的气泡DOM元素
    pendingImage: null, // ★★★ 新增：暂存用户选择的图片 (Base64)

    // 朋友圈
    // ★★★ 这里必须初始化为空数组和默认对象 ★★★
    moments: [], 
    // 直接引用 CONFIG 里的默认值，防止 undefined
    momentsSettings: JSON.parse(JSON.stringify(CONFIG.DEFAULT.MOMENTS_SETTINGS)), 
    
    visibleMomentsCount: 15,
    momentsViewMode: 'feed',
    momentsProfileAuthorId: null,
    composingMomentCommentId: null,

    // 探索 TO DO / 倒数日
    // ★★★ 内容单独存在 IndexedDB；是否注入 AI 由 settings 里的开关控制 ★★★
    todoPlans: [],
    countdownDays: [],
    characterSchedules: [],
    characterMemories: [],
    characterHeartNotes: [],
    todoPlanDraftDateOffset: 0,
    countdownDraftDateOffset: 0,
    editingTodoPlanId: null,
    editingTodoTimeId: null,
    editingCountdownDayId: null,
    currentScheduleContactId: null,
    editingScheduleEntryId: null,
    scheduleQueueRunning: false,
    scheduleLastDateKey: '',
    scheduleDateTimer: null,
    currentMemoryContactId: null,
    characterMemoryViewMode: 'all',
    editingMemoryItem: null,
    currentHeartNoteContactId: null,
    heartNoteViewMode: 'all',
    editingHeartNoteId: null,
    memoryQueueRunning: false,
    memoryLastDateKey: '',
    memoryDateTimer: null,
    countdownMode: 'down',

    // ★★★★★ 桌面 START：桌面小组件运行态 ★★★★★
    // 这些只是前端运行时状态；真正要持久化的桌面签名和请求日历放在 settings 里。
    desktopClockTimer: null,
    desktopLastDateKey: '',
    desktopActivity: { days: {}, lastRenderDate: '' },
    currentMainView: 'desktop',
    returnViewByPage: {},
    // ★★★★★ 桌面 END：桌面小组件运行态 ★★★★★

    // 聊天记录搜索：
    chatMode: 'normal',    // 'normal' 为正常从底往上，'jump' 为跳转模式
    jumpStartIndex: 0,     // 跳转模式下的起始索引
    jumpEndIndex: 0,       // 跳转模式下的结束索引
    targetHighlightIndex: -1, // 需要高亮闪烁的消息索引
    asyncBackendTestStatus: null,
    worldSenseDraft: null,
    worldSenseTestStatus: null,
    worldSenseLocationCandidates: [],
    worldSenseWeatherRefreshPromise: null,
    worldSenseWeatherRetryAt: 0,


};

// =========================================
// =========================================
// 4. API SERVICE (LLM通信)
// =========================================
const API = {
    getProvider(url) {
        if (url.includes('anthropic')) return 'claude';
        // ★ 核心修复：如果是 Google 的域名，且 URL 里【不包含】 openai，才当做原生 gemini
        if (url.includes('googleapis') && !url.includes('openai')) return 'gemini';
        // 只要包含 openai (包括 Google 的兼容接口)，统统走 openai 标准逻辑！
        return 'openai'; 
    },

    async fetchModels(url, key) {
        let modelsUrl = url.replace(/\/chat\/completions$/, '/models');
        let options = {
            method: 'GET',
            headers: {}
        };

        // 如果是原生 Gemini
        if (url.includes('googleapis') && !url.includes('openai')) {
            // 原生 Gemini 不支持 Bearer，必须把 Key 放在 URL 后面
            // 把原 URL (例如 ../v1beta/models) 加上 key 参数
            modelsUrl = url.includes('?') ? `${url}&key=${key}` : `${url}?key=${key}`;
        } else {
            // OpenAI, Claude 等标准格式，使用 Bearer
            options.headers['Authorization'] = `Bearer ${key}`;
        }

        const res = await fetch(modelsUrl, options);
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        return await res.json();
    },

    // 在 API 类内部添加一个估算 Token 的辅助函数
    // 1. 新增：放在 API 类里面的辅助函数，用来估算 Token
    estimateTokens(text) {
        if (!text) return 0;
        // 简单粗暴的估算公式：
        // 中文/日文/韩文 (CJK) 算 1.8 个 Token
        // 英文/数字/符号 算 0.35 个 Token (约3个字母=1Token)
        const cjkCount = (text.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
        const otherCount = text.length - cjkCount;
        return Math.ceil(cjkCount * 1.8 + otherCount * 0.35);
    },

    // ★★★★★ Prompt 缓存命中日志 START ★★★★★
    extractPromptCacheUsage(usage, promptTokens = 0) {
        // OpenAI 兼容接口没有统一缓存字段名：
        // DeepSeek 用 prompt_cache_hit_tokens / prompt_cache_miss_tokens；
        // OpenAI 常见用 prompt_tokens_details.cached_tokens，所以这里统一抹平成日志字段。
        if (!usage || typeof usage !== 'object') {
            return {
                hitTokens: 0,
                missTokens: 0,
                totalTokens: 0,
                hitRate: null,
                hasUsage: false
            };
        }

        const toValidNumber = (value) => {
            const number = Number(value);
            return Number.isFinite(number) && number >= 0 ? number : null;
        };

        const promptDetails = usage.prompt_tokens_details || usage.input_tokens_details || {};
        const hitTokens = toValidNumber(usage.prompt_cache_hit_tokens)
            ?? toValidNumber(promptDetails.cached_tokens)
            ?? toValidNumber(usage.cache_read_input_tokens)
            ?? toValidNumber(usage.cache_read_tokens);
        let missTokens = toValidNumber(usage.prompt_cache_miss_tokens)
            ?? toValidNumber(usage.cache_creation_input_tokens)
            ?? toValidNumber(usage.cache_creation_tokens);

        // OpenAI 只给 cached_tokens 时，用 prompt_tokens 反推未命中部分，方便日志直接看命中率。
        if (missTokens === null && hitTokens !== null && promptTokens > 0) {
            missTokens = Math.max(promptTokens - hitTokens, 0);
        }

        if (hitTokens === null && missTokens === null) {
            return {
                hitTokens: 0,
                missTokens: 0,
                totalTokens: 0,
                hitRate: null,
                hasUsage: false
            };
        }

        const safeHitTokens = hitTokens ?? 0;
        const safeMissTokens = missTokens ?? 0;
        const totalTokens = safeHitTokens + safeMissTokens;

        return {
            hitTokens: safeHitTokens,
            missTokens: safeMissTokens,
            totalTokens,
            hitRate: totalTokens > 0 ? safeHitTokens / totalTokens : null,
            hasUsage: true
        };
    },
    // ★★★★★ Prompt 缓存命中日志 END ★★★★★

    // ============================================
    // ★ 新增：测试 API 连接专用函数
    // ============================================
    // ★ 新增：测试连接专用函数
    // 新增：测试连接函数
    async testConnection(url, key, model) {
        const provider = this.getProvider(url);
        let fetchUrl = url;
        let options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        // 构造一个极简的消息体，只为了测试通断
        const testMessage = "Ping"; 

        if (provider === 'claude') {
            options.headers['x-api-key'] = key;
            options.headers['anthropic-version'] = '2023-06-01';
            options.body = JSON.stringify({
                model: model,
                messages: [{ role: "user", content: testMessage }],
                max_tokens: 1 // 省流
            });
        } else if (provider === 'gemini') {
            fetchUrl = url.endsWith(':generateContent') ? url : `${url}/${model}:generateContent?key=${key}`;
            options.body = JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: testMessage }] }],
                generationConfig: { maxOutputTokens: 1 }
            });
        } else {
            // OpenAI / DeepSeek / SiliconFlow 等
            options.headers['Authorization'] = `Bearer ${key}`;
            options.body = JSON.stringify({
                model: model,
                messages: [{ role: "user", content: testMessage }],
                max_tokens: 1 // 省流
            });
        }

        try {
            const response = await fetch(fetchUrl, options);
            
            if (!response.ok) {
                // 尝试读取错误信息
                const errText = await response.text();
                // 抛出带状态码的错误
                throw new Error(`${response.status} ${errText.slice(0, 50)}...`); 
            }
            
            // 如果成功，不需要返回内容，只要不报错就是成功
            return true;
        } catch (error) {
            throw error;
        }
    },


    // ============================================================
    // ★★★★★ 后台回复接收 START：API 层 ★★★★★
    // 这一组函数只负责和 Cloudflare Worker 通信：
    // 1. 发送 /jobs 创建任务；
    // 2. 定时查询 /jobs/:id；
    // 3. 拿到结果后删除后端临时任务；
    // 4. 在 localStorage 里记一下 pending job，方便页面刷新后恢复。
    // 留空 ASYNC_BACKEND_URL / ASYNC_BACKEND_TOKEN 时，不会走这里。
    // ============================================================
    shouldUseAsyncBackend(settings) {
        return !!(settings && settings.ASYNC_BACKEND_ENABLED !== false && settings.ASYNC_BACKEND_URL && settings.ASYNC_BACKEND_TOKEN);
    },

    asyncJobLogId(jobId) {
        return String(jobId || '').slice(0, 8);
    },

    asyncBackendDiagnosticStorageKey() {
        return 'telewindy_async_backend_diagnostics_v1';
    },

    loadAsyncBackendDiagnostics() {
        try {
            const logs = JSON.parse(localStorage.getItem(this.asyncBackendDiagnosticStorageKey()) || '[]');
            if (!Array.isArray(logs)) return [];
            // ★ 旧版本可能已留存 80 条；读取时就缩到新上限，避免必须等下一次事件才清理。
            if (logs.length > 40) {
                const recentLogs = logs.slice(-40);
                this.saveAsyncBackendDiagnostics(recentLogs);
                return recentLogs;
            }
            return logs;
        } catch (error) {
            return [];
        }
    },

    saveAsyncBackendDiagnostics(logs) {
        const safeLogs = Array.isArray(logs) ? logs.slice(-40) : [];
        localStorage.setItem(this.asyncBackendDiagnosticStorageKey(), JSON.stringify(safeLogs));
    },

    clearAsyncBackendDiagnostics() {
        localStorage.removeItem(this.asyncBackendDiagnosticStorageKey());
    },

    logAsyncBackendEvent(event) {
        if (!event || !event.code) return;

        const normalized = {
            code: String(event.code),
            ts: Number(event.ts || Date.now()),
            jobId: event.jobId || null,
            detail: event.detail && typeof event.detail === 'object' ? event.detail : {}
        };
        const logs = this.loadAsyncBackendDiagnostics();
        const eventKey = `${normalized.jobId || ''}:${normalized.code}:${normalized.ts}`;
        const exists = logs.some(item => `${item.jobId || ''}:${item.code}:${item.ts}` === eventKey);
        if (!exists) logs.push(normalized);

        // ★ 手机端没有 F12，这里只存“事件码 + 安全小字段”：
        // 不写 prompt、图片、API Key，避免诊断日志变成另一份聊天记录。
        this.saveAsyncBackendDiagnostics(logs);
        if (typeof App !== 'undefined' && App.renderAsyncBackendPendingJobs) {
            App.renderAsyncBackendPendingJobs();
        }
    },

    mergeAsyncBackendJobEvents(jobId, events) {
        if (!Array.isArray(events)) return;
        events.forEach(event => {
            this.logAsyncBackendEvent({
                code: event.code,
                ts: event.ts,
                jobId,
                detail: {
                    ...(event.detail || {}),
                    source: 'worker'
                }
            });
        });
    },

    parseAsyncBackendErrorPayload(text) {
        try {
            const parsed = JSON.parse(text || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    },

    getAsyncBackendErrorEventCode(status, payload) {
        const errorCode = String(payload?.error || '');
        if (status === 401) return 'unauthorized_request';
        if (status === 403 || errorCode === 'forbidden_origin') return 'forbidden_origin';
        if (errorCode) return errorCode;
        return `http_${status}`;
    },

    describeAsyncBackendEvent(code, detail = {}) {
        const status = detail.status ? `：${detail.status}` : '';
        const map = {
            job_create: '已创建后台任务',
            job_run_start: 'Worker 已开始请求模型',
            job_get: `正在查询后台任务${status}`,
            job_get_not_found: '后台任务不存在，可能已过期或已被删除',
            job_run_done: '模型回复已生成完成',
            job_run_error: 'Worker 执行任务时出错',
            job_upstream_failed: `上游模型服务返回失败${status}`,
            job_payload_store: '已临时保存后台任务请求体',
            job_enqueue: '后台任务已进入 Cloudflare Queue',
            job_queue_send_error: '后台任务入队失败，请检查 Queue 绑定',
            job_consume_start: 'Queue consumer 已开始执行后台任务',
            job_payload_missing: '后台任务请求体已过期或丢失',
            job_payload_delete: '已删除临时任务请求体',
            job_consume_done: `Queue consumer 已处理完后台任务${status}`,
            job_consume_error: 'Queue consumer 执行时出错',
            job_state_read: '已从 Durable Object 读取实时任务状态',
            job_state_delete: '已删除 Durable Object 任务状态',
            job_delete: '已删除 Worker 临时任务',
            unauthorized_request: '后台密钥校验失败，请检查页面 Token 和 Worker APP_TOKEN',
            forbidden_origin: '访问来源被 Worker 拦截，请检查 ALLOWED_ORIGIN',
            async_backend_fetch_failed: '浏览器没有连上 Worker，可能是网络、域名或 CORS 被拦截',
            vision_analyze_failed: '后台识图失败，已改用兜底图片描述',
            agent_todo_start: '后台 TODO 管理已开始判断',
            agent_todo_done: '后台 TODO 管理已完成',
            agent_todo_failed: '后台 TODO 管理执行失败，已跳过',
            agent_todo_stage_start: '后台 TODO 管理已开始判断',
            agent_todo_stage_done: '后台 TODO 管理结果已提前同步',
            agent_todo_stage_failed: '后台 TODO 管理提前同步失败，已跳过'
        };
        return map[code] || `后台事件：${code}`;
    },

    async chatViaAsyncBackend(messages, settings) {
        this.lastAsyncBackendResult = null;
        const backendUrl = settings.ASYNC_BACKEND_URL.replace(/\/+$/, '');
        console.info('[AsyncBackend] creating job', {
            backendUrl,
            model: settings.MODEL,
            messageCount: Array.isArray(messages) ? messages.length : 0,
            ttlHours: settings.ASYNC_BACKEND_TTL_HOURS
        });

        try {
            let requestBodyExtraForLog = null;
            const rawExtraBodyForLog = settings.CUSTOM_REQUEST_BODY_JSON || '';
            if (rawExtraBodyForLog.trim()) {
                requestBodyExtraForLog = JSON.parse(rawExtraBodyForLog);
                if (requestBodyExtraForLog && typeof requestBodyExtraForLog === 'object' && !Array.isArray(requestBodyExtraForLog)) {
                    requestBodyExtraForLog = { ...requestBodyExtraForLog, stream: false };
                }
            }

            const asyncLogPayload = {
                api_url: settings.API_URL,
                auth_mode: settings.ASYNC_BACKEND_KEY_MODE || 'client_key',
                model: settings.MODEL,
                messages,
                temperature: settings.TEMPERATURE,
                max_tokens: settings.MAX_TOKENS,
                stream: false,
                ...(requestBodyExtraForLog || {}),
                async_backend: {
                    url: backendUrl,
                    ttl_hours: settings.ASYNC_BACKEND_TTL_HOURS,
                    // ★ has_image 回答“本轮有没有图”；image_mode 再说明图片走独立视觉 API 还是主模型多模态。
                    has_image: !!settings.ASYNC_BACKEND_VISION || !!settings.MULTIMODAL_IMAGE,
                    image_mode: settings.ASYNC_BACKEND_VISION
                        ? 'separate'
                        : (settings.MULTIMODAL_IMAGE ? 'multimodal' : 'none'),
                    uses_vision_api: !!settings.ASYNC_BACKEND_VISION,
                    has_agent: !!settings.ASYNC_BACKEND_AGENT
                }
            };

            this.setLatestMainContextLog({
                content: JSON.stringify(asyncLogPayload, null, 2),
                tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                prompt_cache_hit_tokens: 0,
                prompt_cache_miss_tokens: 0,
                prompt_cache_total_tokens: 0,
                prompt_cache_hit_rate: null,
                has_prompt_cache_usage: false,
                isEstimated: true,
                source: 'async-backend',
                history_window: settings.HISTORY_WINDOW_LOG || null,
                request_cache_debug: settings.REQUEST_CACHE_DEBUG_LOG || null
            });
        } catch (error) {
            console.error('[AsyncBackend] log record failed:', error);
        }

        let job;
        try {
            job = await this.createChatJob(backendUrl, messages, settings);
        } catch (error) {
            throw new Error(this.explainAsyncBackendError(error));
        }
        console.info('[AsyncBackend] job created', {
            jobId: this.asyncJobLogId(job.jobId),
            status: job.status,
            ttlSeconds: job.ttlSeconds
        });
        this.rememberPendingJob(job.jobId, settings);

        try {
            const result = await this.waitForChatJob(backendUrl, job.jobId, settings.ASYNC_BACKEND_TOKEN, {
                onJobUpdate: settings.ASYNC_BACKEND_ON_JOB_UPDATE
            });
            if (result.status !== 'done') {
                const jobFailedError = new Error(result.error || 'Async job failed');
                jobFailedError.isAsyncBackendJobFailed = true; // Worker 明确说失败，不能当成手机切后台轮询中断
                throw jobFailedError;
            }

            if (window.LAST_API_LOG) {
                this.updateAsyncBackendLogWithVision(result, settings);

                const usage = result.usage || null;
                const promptTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0;
                const completionTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0;
                const totalTokens = usage?.total_tokens ?? (promptTokens + completionTokens);
                const promptCacheUsage = this.extractPromptCacheUsage(usage, promptTokens);

                if (promptTokens || completionTokens || totalTokens) {
                    window.LAST_API_LOG.tokens = promptTokens;
                    window.LAST_API_LOG.prompt_tokens = promptTokens;
                    window.LAST_API_LOG.completion_tokens = completionTokens;
                    window.LAST_API_LOG.total_tokens = totalTokens;
                    window.LAST_API_LOG.prompt_cache_hit_tokens = promptCacheUsage.hitTokens;
                    window.LAST_API_LOG.prompt_cache_miss_tokens = promptCacheUsage.missTokens;
                    window.LAST_API_LOG.prompt_cache_total_tokens = promptCacheUsage.totalTokens;
                    window.LAST_API_LOG.prompt_cache_hit_rate = promptCacheUsage.hitRate;
                    window.LAST_API_LOG.has_prompt_cache_usage = promptCacheUsage.hasUsage;
                    window.LAST_API_LOG.isEstimated = false;
                } else {
                    const estimatedPromptTokens = this.estimateTokens(window.LAST_API_LOG.content || '');
                    const estimatedCompletionTokens = this.estimateTokens(result.result || '');
                    window.LAST_API_LOG.tokens = estimatedPromptTokens;
                    window.LAST_API_LOG.prompt_tokens = estimatedPromptTokens;
                    window.LAST_API_LOG.completion_tokens = estimatedCompletionTokens;
                    window.LAST_API_LOG.total_tokens = estimatedPromptTokens + estimatedCompletionTokens;
                    window.LAST_API_LOG.prompt_cache_hit_tokens = 0;
                    window.LAST_API_LOG.prompt_cache_miss_tokens = 0;
                    window.LAST_API_LOG.prompt_cache_total_tokens = 0;
                    window.LAST_API_LOG.prompt_cache_hit_rate = null;
                    window.LAST_API_LOG.has_prompt_cache_usage = false;
                    window.LAST_API_LOG.isEstimated = true;
                }
                this.persistContextLog('main', window.LAST_API_LOG);
            }

            await this.deleteChatJob(backendUrl, job.jobId, settings.ASYNC_BACKEND_TOKEN);
            this.forgetPendingJob(job.jobId);
            console.info('[AsyncBackend] job finished and deleted', {
                jobId: this.asyncJobLogId(job.jobId),
                resultLength: (result.result || '').length
            });
            // ★ 前台等待链路也把 jobId 带回 App 层，避免和“回前台补查”链路重复入库。
            this.lastAsyncBackendResult = {
                jobId: job.jobId,
                result: (result.result || '').trim(),
                image_description: result.image_description || null,
                agent_actions: Array.isArray(result.agent_actions) ? result.agent_actions : [],
                agent_prompt: result.agent_prompt || '',
                agent_status: result.agent_status || '',
                agent_error: result.agent_error || '',
                post_agent: result.post_agent || null,
                multimodal_fallback: result.multimodal_fallback === true,
                userMessageIndex: settings.ASYNC_BACKEND_USER_MESSAGE_INDEX ?? null,
                // ★ 主动消息会按真实发送时间插入历史，中途数组下标可能变化；回填优先使用稳定消息 ID。
                userMessageId: settings.ASYNC_BACKEND_USER_MESSAGE_ID || null
            };
            if (result.multimodal_fallback === true) this.notifyMultimodalFallback(job.jobId);
            return (result.result || '').trim();
        } catch (error) {
            console.warn('[AsyncBackend] job failed or interrupted', {
                jobId: this.asyncJobLogId(job.jobId),
                error: error.message
            });

            // ★★★★★ 手机切后台兼容 START ★★★★★
            // job 已经创建成功以后，AI 其实是在 Worker 里继续跑的；
            // 这时手机浏览器把前台页面挂起，常会把“查询 job 状态”的 fetch 砍掉，
            // Safari/部分 WebView 会报 Load failed。这里不要把 pending job 标失败，
            // 否则回到聊天页就会看到假的“发送失败”，而真正的回复还在后台等着取回。
            if (!error.isAsyncBackendJobFailed && this.isAsyncBackendRecoverablePollError(error)) {
                const pendingError = new Error('后台任务已提交，页面切回前台后会继续接收。');
                pendingError.isAsyncBackendPending = true;
                pendingError.jobId = job.jobId;
                pendingError.contactId = settings.CONTACT_ID || null;
                throw pendingError;
            }
            // ★★★★★ 手机切后台兼容 END ★★★★★

            const friendlyError = this.explainAsyncBackendError(error);
            this.markPendingJobFailed(job.jobId, friendlyError);
            throw new Error(friendlyError);
        }
    },

    async createChatJob(backendUrl, messages, settings) {
        let requestBodyExtra = null;
        const rawExtraBody = settings.CUSTOM_REQUEST_BODY_JSON || '';
        if (rawExtraBody.trim()) {
            try {
                requestBodyExtra = JSON.parse(rawExtraBody);
                if (!requestBodyExtra || typeof requestBodyExtra !== 'object' || Array.isArray(requestBodyExtra)) {
                    throw new Error('请求体附加参数必须是一个 JSON 对象，例如 { "stream": false }');
                }

                // 后台接收不支持流式返回；Worker 也会再兜底强制 stream=false。
                if (requestBodyExtra.stream === true) {
                    console.warn('[AsyncBackend] 后台接收暂不支持 stream=true，已自动改为 false。');
                    requestBodyExtra = { ...requestBodyExtra, stream: false };
                }
            } catch (error) {
                console.error('[AsyncBackend] 请求体附加参数 JSON 解析失败:', error);
                throw new Error(`请求体附加参数 JSON 格式错误：${error.message}`);
            }
        }

        let visionPayload = null;
        if (settings.ASYNC_BACKEND_VISION && settings.ASYNC_BACKEND_VISION.image) {
            const visionSettings = settings.ASYNC_BACKEND_VISION;

            // ★ 后台识图任务：
            // 这里只把本次待识别图片和视觉配置交给私人 Worker。
            // Worker 用完即丢，不会把原图或视觉 Key 写进 KV。
            visionPayload = {
                image: visionSettings.image,
                url: visionSettings.url || '',
                auth_mode: visionSettings.auth_mode || settings.ASYNC_BACKEND_KEY_MODE || 'client_key',
                key: visionSettings.auth_mode === 'server_secret' ? '' : (visionSettings.key || ''),
                model: visionSettings.model || '',
                prompt: visionSettings.prompt || '描述这张图片'
            };
        }

        // ★ 后台多模态同样只把本轮图片挂到指定 user 消息；历史消息始终保持纯文字。
        let messagesForJob = messages.map(message => ({ ...message }));
        const multimodalImage = settings.IMAGE_API_MODE === 'multimodal' ? String(settings.MULTIMODAL_IMAGE || '') : '';
        const multimodalIndex = Number.isInteger(settings.MULTIMODAL_MESSAGE_INDEX)
            ? settings.MULTIMODAL_MESSAGE_INDEX
            : -1;
        if (multimodalImage && messagesForJob[multimodalIndex]?.role === 'user') {
            const targetMessage = messagesForJob[multimodalIndex];
            messagesForJob[multimodalIndex] = {
                ...targetMessage,
                content: [
                    { type: 'text', text: String(targetMessage.content || '') || '请查看这张图片。' },
                    { type: 'image_url', image_url: { url: multimodalImage } }
                ]
            };
        }

        const payload = {
            // ★ 后台 Key 模式：
            // client_key 会跟随当前前端 API 预设，把模型 Key 临时交给私人 Worker 使用；
            // server_secret 则只把 API URL 当作匹配线索，模型 Key 由 Worker secret 提供。
            api_url: settings.API_URL,
            auth_mode: settings.ASYNC_BACKEND_KEY_MODE || 'client_key',
            api_key: settings.ASYNC_BACKEND_KEY_MODE === 'server_secret' ? '' : settings.API_KEY,
            model: settings.MODEL,
            messages: messagesForJob,
            temperature: settings.TEMPERATURE,
            max_tokens: settings.MAX_TOKENS,
            ttl_hours: settings.ASYNC_BACKEND_TTL_HOURS,
            request_user_message_index: settings.ASYNC_BACKEND_REQUEST_USER_MESSAGE_INDEX ?? -1,
            dynamic_context_insert_mode: settings.DYNAMIC_CONTEXT_INSERT_MODE || 'auto',
            request_body_extra: requestBodyExtra,
            vision: visionPayload,
            agent: settings.ASYNC_BACKEND_AGENT || null
        };
        // ★ 后台回复完成后由同一 Worker 补入主动判断上下文，页面关闭时也不会丢失角色刚说的话。
        if (settings.CONTACT_ID && typeof ProactiveMessages !== 'undefined'
            && ProactiveMessages.settings().enabled && ProactiveMessages.workerConfigured()
            && ProactiveMessages.settings().characterIds.map(String).includes(String(settings.CONTACT_ID))) {
            payload.proactive_object_name = `${ProactiveMessages.installationId()}:${String(settings.CONTACT_ID)}`;
        }
        const payloadText = JSON.stringify(payload);
        const payloadBytes = new Blob([payloadText]).size;
        console.info('[AsyncBackend] job payload', {
            backendUrl,
            apiUrl: payload.api_url,
            authMode: payload.auth_mode,
            model: payload.model,
            messageCount: Array.isArray(messagesForJob) ? messagesForJob.length : 0,
            messageChars: Array.isArray(messagesForJob)
                ? messagesForJob.map(message => String(message?.content || '').length)
                : [],
            totalMessageChars: Array.isArray(messagesForJob)
                ? messagesForJob.reduce((sum, message) => sum + String(message?.content || '').length, 0)
                : 0,
            payloadBytes,
            maxTokens: payload.max_tokens,
            ttlHours: payload.ttl_hours,
            hasImage: !!visionPayload || !!multimodalImage,
            imageMode: visionPayload ? 'separate' : (multimodalImage ? 'multimodal' : 'none'),
            usesVisionApi: !!visionPayload,
            hasAgent: !!payload.agent,
            visionModel: visionPayload?.model || '',
            hasRequestBodyExtra: !!requestBodyExtra,
            requestBodyExtraKeys: requestBodyExtra ? Object.keys(requestBodyExtra) : []
        });

        let response;
        try {
            response = await fetch(`${backendUrl}/jobs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.ASYNC_BACKEND_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: payloadText
            });
        } catch (error) {
            this.logAsyncBackendEvent({
                code: 'async_backend_fetch_failed',
                detail: {
                    error: String(error?.message || error || '').slice(0, 160)
                }
            });
            throw error;
        }

        if (!response.ok) {
            const errorText = await response.text();
            const errorPayload = this.parseAsyncBackendErrorPayload(errorText);
            const eventCode = this.getAsyncBackendErrorEventCode(response.status, errorPayload);
            this.logAsyncBackendEvent({
                code: eventCode,
                detail: {
                    status: response.status,
                    error: errorPayload.error || errorText.slice(0, 160)
                }
            });
            const createError = new Error(`Async backend error ${response.status}: ${errorText}`);
            createError.status = response.status;
            createError.asyncBackendEventCode = eventCode;
            throw createError;
        }

        const job = await response.json();
        this.mergeAsyncBackendJobEvents(job.jobId, job.events);
        return job;
    },

    async waitForChatJob(backendUrl, jobId, token, options = {}) {
        const startedAt = Date.now();
        const timeoutMs = 55 * 60 * 1000;
        let pollCount = 0;

        while (Date.now() - startedAt < timeoutMs) {
            pollCount += 1;
            let job;
            try {
                job = await this.getChatJob(backendUrl, jobId, token);
            } catch (error) {
                const resumedJob = this.getResumedAsyncJobResult(jobId);
                if (error.status === 404 && resumedJob) {
                    // ★ 双链路竞态兜底：
                    // 回前台恢复链路可能已经取到结果并删除 Worker 临时任务；
                    // 前台轮询这时再查会看到 404，但这不是发送失败，直接复用恢复链路缓存的结果。
                    console.info('[AsyncBackend] poll reused resumed result', {
                        jobId: this.asyncJobLogId(jobId),
                        pollCount
                    });
                    return resumedJob;
                }
                throw error;
            }
            console.info('[AsyncBackend] poll result', {
                jobId: this.asyncJobLogId(jobId),
                pollCount,
                status: job.status,
                hidden: document.hidden
            });
            this.logAsyncBackendEvent({
                code: 'job_get',
                jobId,
                detail: {
                    status: job.status,
                    pollCount,
                    hidden: document.hidden
                }
            });
            this.mergeAsyncBackendJobEvents(jobId, job.events);
            job.jobId = job.jobId || jobId;
            if (typeof options.onJobUpdate === 'function') {
                try {
                    // ★ 分段后台结果：
                    // Worker 会先写入 agent_status/agent_actions，再继续等主模型。
                    // 这里让 App 层有机会提前应用 TODO 操作，真正的聊天回复仍按原流程等待 done。
                    await options.onJobUpdate(job);
                } catch (error) {
                    console.warn('[AsyncBackend] job update hook failed:', error);
                }
            }
            if (job.status === 'done' || job.status === 'failed') {
                return job;
            }
            await new Promise(resolve => setTimeout(resolve, document.hidden ? 8000 : 2500));
        }

        throw new Error('Async job timed out');
    },

    async getChatJob(backendUrl, jobId, token) {
        const response = await fetch(`${backendUrl}/jobs/${jobId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorText = await response.text();
            const errorPayload = this.parseAsyncBackendErrorPayload(errorText);
            const eventCode = response.status === 404
                ? 'job_get_not_found'
                : this.getAsyncBackendErrorEventCode(response.status, errorPayload);
            console.warn('[AsyncBackend] lookup failed', {
                jobId: this.asyncJobLogId(jobId),
                status: response.status
            });
            this.logAsyncBackendEvent({
                code: eventCode,
                jobId,
                detail: {
                    status: response.status,
                    error: errorPayload.error || errorText.slice(0, 160)
                }
            });
            const lookupError = new Error(`Async job lookup failed ${response.status}`);
            lookupError.status = response.status;
            throw lookupError;
        }

        const job = await response.json();
        job.jobId = job.jobId || jobId;
        this.mergeAsyncBackendJobEvents(jobId, job.events);
        return job;
    },

    async deleteChatJob(backendUrl, jobId, token) {
        try {
            const response = await fetch(`${backendUrl}/jobs/${jobId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const eventCode = response.ok
                ? 'job_delete'
                : this.getAsyncBackendErrorEventCode(response.status, {});
            this.logAsyncBackendEvent({
                code: eventCode,
                jobId,
                detail: {
                    status: response.status
                }
            });
        } catch (error) {
            console.warn('Failed to delete async job:', error);
        }
    },

    isAsyncBackendRecoverablePollError(error) {
        const message = String(error?.message || error || '').toLowerCase();
        const name = String(error?.name || '').toLowerCase();

        // ★ 后台 job 已经拿到 jobId 以后，下面这些更像是“前台轮询断了”，不是 AI 回复失败。
        return name === 'aborterror'
            || message.includes('load failed')
            || message.includes('failed to fetch')
            || message.includes('networkerror')
            || message.includes('network error');
    },

    explainAsyncBackendError(error) {
        const message = String(error?.message || error || '');
        const cleanMessage = message
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('load failed')) {
            return '网络连接失败：浏览器没有连上后台。常见原因是后台域名无法访问、被网络阻断、CORS 被拦截，或手机/当前网络到 Worker 不通。可以换网络/开梯子，或把 workers.dev 换成自定义域名。';
        }

        if (lowerMessage.includes('timed out') || lowerMessage.includes('timeout')) {
            return '连接超时：后台域名没有及时响应。常见原因是当前网络访问 Worker 不稳定、workers.dev 在本网络不可达，或 Worker/上游请求耗时过长。';
        }

        if (lowerMessage.includes('app_token_not_configured')) {
            return 'Worker 仍使用示例口令或尚未设置 APP_TOKEN。请在 Cloudflare 的 Variables and Secrets 中设置自己的口令。';
        }

        const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
        const status = statusMatch ? Number(statusMatch[1]) : null;
        const isUpstreamError = /\bupstream_\d{3}\b/i.test(message);

        // ★ upstream_xxx 已经说明 /jobs 创建和轮询成功；这时错误来自模型接口，不能再提示 Worker 路由错误。
        if (isUpstreamError) {
            if (status === 400) return `${cleanMessage}（上游模型拒绝了请求参数：请检查模型名、自定义请求体和消息格式。）`;
            if (status === 401 || status === 403) return `${cleanMessage}（上游模型鉴权失败：请检查当前 API 预设的 Key 和调用权限。）`;
            if (status === 404) return `${cleanMessage}（上游模型接口不存在：请检查 API URL 是否为完整的聊天补全地址。）`;
            if (status === 405) return `${cleanMessage}（上游模型接口不接受当前方法：请检查 API URL，并在 Cloudflare 实时日志中查看 chat_upstream_response 的 finalUrl、location 和 allow。）`;
            if (status === 413) return `${cleanMessage}（上游模型认为请求太大：请压缩图片或减少聊天上下文。）`;
            if (status === 429) return `${cleanMessage}（上游模型限流：请稍后重试或检查服务商额度。）`;
            if (status && status >= 500) return `${cleanMessage}（上游模型服务出错：请查看 Cloudflare Worker 实时日志。）`;
        }

        if (status === 400) return `${cleanMessage}（请求格式不对：前端和后台版本可能不匹配，或请求内容缺少必要字段。）`;
        if (status === 401 || status === 403) return `${cleanMessage}（鉴权失败：请检查后台密钥/Worker APP_TOKEN 是否一致。）`;
        if (status === 404) return `${cleanMessage}（接口不存在：后台URL可能填错，或 Worker 没有部署 /jobs 路由。）`;
        if (status === 405) return `${cleanMessage}（接口方法不允许：后台URL可能不是聊天任务 Worker，或 /jobs 路由不支持 POST。请检查 Worker 绑定的域名和部署版本。）`;
        if (status === 413) return `${cleanMessage}（请求太大：图片、聊天历史、世界书或角色设定可能太长。图片走 Worker 时会以 base64 形式放进本次后台任务，请压缩图片或减少上下文后重试。）`;
        if (status === 429) return `${cleanMessage}（请求过于频繁或上游限流：稍等后重试。）`;
        if (status && status >= 500) return `${cleanMessage}（后台或上游模型服务出错：请看 Cloudflare Worker 实时日志。）`;

        return cleanMessage || '未知错误：请打开浏览器控制台和 Cloudflare Worker 实时日志查看详情。';
    },

    async testAsyncBackendConnection(settings) {
        const backendUrl = settings.ASYNC_BACKEND_URL.replace(/\/+$/, '');
        const job = await this.createChatJob(backendUrl, [
            { role: 'user', content: 'ping' }
        ], {
            ...settings,
            TEMPERATURE: 0,
            MAX_TOKENS: 16,
            ASYNC_BACKEND_TTL_HOURS: 0.25
        });

        const startedAt = Date.now();
        const timeoutMs = 45 * 1000;
        try {
            while (Date.now() - startedAt < timeoutMs) {
                const result = await this.getChatJob(backendUrl, job.jobId, settings.ASYNC_BACKEND_TOKEN);
                if (result.status === 'done') return result;
                if (result.status === 'failed') {
                    throw new Error(result.error || 'Async backend test failed');
                }
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            throw new Error('Async backend test timed out');
        } finally {
            await this.deleteChatJob(backendUrl, job.jobId, settings.ASYNC_BACKEND_TOKEN);
        }
    },

    // ★ 版本探测不创建 job，也不请求模型；沿用后台口令保护部署信息。
    async getAsyncBackendMetadata(backendUrl, token) {
        const response = await fetch(`${backendUrl.replace(/\/+$/, '')}/meta`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
        });
        if (response.status === 404) return null;
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(`${errorBody.error || 'Worker metadata'} ${response.status}`);
        }
        return response.json();
    },

    pendingJobStorageKey() {
        return 'telewindy_pending_async_jobs_v1';
    },

    loadPendingJobs() {
        try {
            return JSON.parse(localStorage.getItem(this.pendingJobStorageKey()) || '[]');
        } catch (error) {
            return [];
        }
    },

    savePendingJobs(jobs) {
        localStorage.setItem(this.pendingJobStorageKey(), JSON.stringify(jobs));
    },

    rememberPendingJob(jobId, settings) {
        const jobs = this.loadPendingJobs().filter(job => job.jobId !== jobId);
        jobs.push({
            jobId,
            contactId: settings.CONTACT_ID || null,
            userMessageIndex: settings.ASYNC_BACKEND_USER_MESSAGE_INDEX ?? null,
            userMessageId: settings.ASYNC_BACKEND_USER_MESSAGE_ID || null,
            context: settings.ASYNC_BACKEND_CONTEXT || null,
            // ★ 番茄钟请求快照随 job 保存，避免恢复时聊天索引因删除/重生成发生偏移。
            pomodoroInjection: settings.POMODORO_INJECTION || null,
            backendUrl: settings.ASYNC_BACKEND_URL.replace(/\/+$/, ''),
            token: settings.ASYNC_BACKEND_TOKEN,
            createdAt: Date.now(),
            status: 'running'
        });
        this.savePendingJobs(jobs);
        console.info('[AsyncBackend] remembered pending job', {
            jobId: this.asyncJobLogId(jobId),
            contactId: settings.CONTACT_ID || null,
            pendingCount: jobs.length
        });
    },

    forgetPendingJob(jobId) {
        const jobs = this.loadPendingJobs().filter(job => job.jobId !== jobId);
        this.savePendingJobs(jobs);
        console.info('[AsyncBackend] forgot pending job', {
            jobId: this.asyncJobLogId(jobId),
            pendingCount: jobs.length
        });
    },

    rememberResumedAsyncJobResult(jobId, job) {
        if (!jobId || !job || job.status !== 'done') return;
        if (!this._resumedAsyncJobResults) this._resumedAsyncJobResults = {};

        const now = Date.now();
        // ★ 只缓存同页面内的短时间竞态结果：
        // 它不是持久存储，刷新后仍然以 localStorage pending job 为准，避免旧 job 长期占内存。
        Object.keys(this._resumedAsyncJobResults).forEach(id => {
            if (now - (this._resumedAsyncJobResults[id].cachedAt || 0) > 10 * 60 * 1000) {
                delete this._resumedAsyncJobResults[id];
            }
        });

        this._resumedAsyncJobResults[jobId] = {
            ...job,
            cachedAt: now
        };
    },

    getResumedAsyncJobResult(jobId) {
        const cached = this._resumedAsyncJobResults?.[jobId];
        if (!cached) return null;
        if (Date.now() - (cached.cachedAt || 0) > 10 * 60 * 1000) {
            delete this._resumedAsyncJobResults[jobId];
            return null;
        }
        return cached;
    },

    markPendingJobFailed(jobId, error) {
        const jobs = this.loadPendingJobs();
        const job = jobs.find(item => item.jobId === jobId);
        if (job) {
            job.status = 'failed';
            job.error = error;
            job.updatedAt = Date.now();
            this.savePendingJobs(jobs);
        }
    },

    updateAsyncBackendLogWithVision(result, settings) {
        if (!window.LAST_API_LOG || window.LAST_API_LOG.source !== 'async-backend') return;
        const description = String(result?.image_description || '').trim();
        if (!description) return;

        try {
            const payload = JSON.parse(window.LAST_API_LOG.content || '{}');
            if (!payload || typeof payload !== 'object') return;

            // ★ 后台识图完成后才拿得到 image_description：
            // 创建 job 前的日志只是快照，所以这里在完成时补写一次，方便 API 日志看到真实识图结果。
            if (!payload.async_backend || typeof payload.async_backend !== 'object') {
                payload.async_backend = {};
            }
            payload.async_backend.has_image = true;
            payload.async_backend.image_mode = 'separate';
            payload.async_backend.uses_vision_api = true;
            payload.async_backend.image_description = description;

            if (Array.isArray(payload.messages)) {
                const userIndex = Number.isInteger(settings?.ASYNC_BACKEND_REQUEST_USER_MESSAGE_INDEX)
                    ? settings.ASYNC_BACKEND_REQUEST_USER_MESSAGE_INDEX
                    : -1;
                const targetMessage = userIndex >= 0
                    ? payload.messages[userIndex]
                    : [...payload.messages].reverse().find(message => message?.role === 'user');

                if (targetMessage && targetMessage.role === 'user') {
                    const marker = '[System Info: 对方发送了一张图片，图片内容描述:';
                    if (!String(targetMessage.content || '').includes(marker)) {
                        targetMessage.content = `${targetMessage.content || ''}\n\n${marker} ${description}]`;
                    }
                }
            }

            window.LAST_API_LOG.content = JSON.stringify(payload, null, 2);
        } catch (error) {
            console.warn('[AsyncBackend] update vision log failed:', error);
        }
    },
    // ============================================================
    // ★★★★★ 后台回复接收 END：API 层 ★★★★★
    // ============================================================

    // ★★★★★ 桌面 START：互动日志统计 ★★★★★
    // 这里只记录用户与 AI 的互动请求；番茄钟、自动发朋友圈、角色日程和角色记忆由调用方明确跳过。
    recordDesktopInteractionCount() {
        const settings = STATE.settings || {};
        const activity = settings.DESKTOP_ACTIVITY && typeof settings.DESKTOP_ACTIVITY === 'object'
            ? settings.DESKTOP_ACTIVITY
            : { days: {}, lastRenderDate: '' };
        if (!activity.days || typeof activity.days !== 'object') activity.days = {};

        const dateKey = (typeof TodoContext !== 'undefined' && TodoContext.getTodayKey)
            ? TodoContext.getTodayKey()
            : new Date().toISOString().slice(0, 10);

        activity.days[dateKey] = Number(activity.days[dateKey] || 0) + 1;
        settings.DESKTOP_ACTIVITY = activity;
        STATE.desktopActivity = activity;

        if (STATE.currentMainView === 'desktop'
            && typeof App !== 'undefined'
            && typeof App.renderDesktopActivityToday === 'function') {
            App.renderDesktopActivityToday(activity, dateKey);
        }

        // 统计数据轻量写入 settings；不触发桌面重绘，保持发送链路安静。
        if (typeof Storage !== 'undefined' && Storage.saveSettings) {
            Storage.saveSettings().catch(error => console.warn('[Desktop] interaction activity save failed:', error));
        }
    },
    // ★★★★★ 桌面 END：互动日志统计 ★★★★★

    
    // ============================================
    // ============================================
    persistContextLog(kind, log) {
        const key = kind === 'agent' ? CONFIG.AGENT_CONTEXT_LOG_KEY : CONFIG.MAIN_CONTEXT_LOG_KEY;
        if (!key || typeof DB === 'undefined' || !log) return;
        // ★ 上下文日志只保留最新一条，直接覆盖 IndexedDB；失败不影响聊天主流程。
        DB.set(key, log).catch(error => console.warn('[ContextLog] save failed:', error));
    },

    setLatestMainContextLog(log) {
        window.LAST_API_LOG = log || null;
        if (log) this.persistContextLog('main', log);
        return window.LAST_API_LOG;
    },

    async getLatestMainContextLog() {
        if (window.LAST_API_LOG) return window.LAST_API_LOG;
        if (typeof DB === 'undefined' || !CONFIG.MAIN_CONTEXT_LOG_KEY) return null;
        const log = await DB.get(CONFIG.MAIN_CONTEXT_LOG_KEY);
        if (log) window.LAST_API_LOG = log;
        return log || null;
    },

    ensureAgentContextLogs() {
        if (!window.AGENT_CONTEXT_LOGS || typeof window.AGENT_CONTEXT_LOGS !== 'object') {
            window.AGENT_CONTEXT_LOGS = { latest: null, pre: [], post: [] };
        }
        if (!Array.isArray(window.AGENT_CONTEXT_LOGS.pre)) window.AGENT_CONTEXT_LOGS.pre = [];
        if (!Array.isArray(window.AGENT_CONTEXT_LOGS.post)) window.AGENT_CONTEXT_LOGS.post = [];
        if (!('latest' in window.AGENT_CONTEXT_LOGS)) window.AGENT_CONTEXT_LOGS.latest = null;
        return window.AGENT_CONTEXT_LOGS;
    },

    recordAgentContextLog(phase, entry = {}) {
        const logs = this.ensureAgentContextLogs();
        const key = phase === 'pre' ? 'pre' : 'post';
        const log = {
            id: `agent_log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            phase: key,
            ...entry
        };
        // ★ Agent 日志不再维护 Pre/Post 列表，只保留最新一次模型调用；pre/post 数组只给旧引用兜底。
        logs.latest = log;
        logs.pre = key === 'pre' ? [log] : [];
        logs.post = key === 'post' ? [log] : [];
        this.persistContextLog('agent', log);
        return log;
    },

    getLatestAgentContextLog(phase) {
        const logs = this.ensureAgentContextLogs();
        if (!phase || !logs.latest || logs.latest.phase === phase) return logs.latest || null;
        return null;
    },

    setLatestProactiveContextLog(log) {
        if (!log) return null;
        window.LAST_PROACTIVE_API_LOG = log;
        // ★ 主动消息日志只保留最新一次；独立于普通聊天和 Agent 的上下文日志。
        if (typeof DB !== 'undefined' && CONFIG.PROACTIVE_CONTEXT_LOG_KEY) {
            DB.set(CONFIG.PROACTIVE_CONTEXT_LOG_KEY, log).catch(error => console.warn('[主动消息] 上下文日志保存失败:', error));
        }
        return log;
    },

    async getLatestProactiveContextLog() {
        if (window.LAST_PROACTIVE_API_LOG) return window.LAST_PROACTIVE_API_LOG;
        if (typeof DB === 'undefined' || !CONFIG.PROACTIVE_CONTEXT_LOG_KEY) return null;
        const log = await DB.get(CONFIG.PROACTIVE_CONTEXT_LOG_KEY);
        if (log) window.LAST_PROACTIVE_API_LOG = log;
        return log || null;
    },

    async getLatestAgentContextLogPersisted() {
        const logs = this.ensureAgentContextLogs();
        if (logs.latest) return logs.latest;
        if (typeof DB === 'undefined' || !CONFIG.AGENT_CONTEXT_LOG_KEY) return null;
        const log = await DB.get(CONFIG.AGENT_CONTEXT_LOG_KEY);
        if (log) {
            logs.latest = log;
            logs.pre = log.phase === 'pre' ? [log] : [];
            logs.post = log.phase === 'post' ? [log] : [];
        }
        return log || null;
    },

    getAgentContextLogs() {
        return this.ensureAgentContextLogs();
    },

    // ★★★★★ 主模型多模态消息 START ★★★★★
    notifyMultimodalFallback(jobId = '') {
        if (!this._multimodalFallbackNoticeJobs) this._multimodalFallbackNoticeJobs = new Set();
        const noticeKey = String(jobId || 'direct');
        if (this._multimodalFallbackNoticeJobs.has(noticeKey)) return;
        this._multimodalFallbackNoticeJobs.add(noticeKey);

        if (typeof App !== 'undefined' && typeof App.showTopNotice === 'function') {
            App.showTopNotice('当前模型或 API 拒绝了图片输入，已移除图片并按纯文字重新请求。', {
                type: 'pending',
                timeout: 6500
            });
        }
    },

    parseImageDataUrl(image) {
        const match = String(image || '').match(/^data:(image\/[^;,]+);base64,(.+)$/s);
        if (!match) return null;
        return {
            mimeType: match[1].toLowerCase(),
            data: match[2]
        };
    },

    isMultimodalUnsupportedError(status, errorText) {
        if (![400, 415, 422].includes(Number(status))) return false;
        const text = String(errorText || '').toLowerCase();
        return [
            'image', 'vision', 'multimodal', 'image_url', 'inline_data', 'inlinedata',
            'unsupported content', 'content must be', 'content type', 'expected a string', 'valid string'
        ].some(keyword => text.includes(keyword));
    },

    redactMultimodalImagesForLog(value) {
        if (Array.isArray(value)) return value.map(item => this.redactMultimodalImagesForLog(item));
        if (!value || typeof value !== 'object') return value;

        const next = {};
        Object.entries(value).forEach(([key, child]) => {
            if (key === 'url' && typeof child === 'string' && child.startsWith('data:image/')) {
                next[key] = `[图片 data URL 已省略，共 ${child.length} 字符]`;
                return;
            }
            if (key === 'data' && typeof child === 'string' && child.length > 256
                && (value.mimeType || value.media_type)) {
                next[key] = `[图片 base64 已省略，共 ${child.length} 字符]`;
                return;
            }
            next[key] = this.redactMultimodalImagesForLog(child);
        });
        return next;
    },

    buildMultimodalFallbackMessages(messages, targetIndex) {
        const fallbackText = '（系统提示：用户发送了一张图片，但当前主模型或 API 不支持读取图片，无法提供图片内容。请根据用户的文字上下文回复；如有需要，可以询问用户图片内容。）';
        return messages.map((message, index) => {
            if (index !== targetIndex) return { ...message };
            const text = String(message?.content || '').trim();
            return {
                ...message,
                content: text ? `${text}\n\n${fallbackText}` : fallbackText
            };
        });
    },
    // ★★★★★ 主模型多模态消息 END ★★★★★

    async chat(messages, settings) {
        // ★ 后台任务去重标记只属于“本次 API.chat 调用”，每次开始前先清空旧结果。
        this.lastAsyncBackendResult = null;
        // ★ 默认仍计入互动；只有明确标记的系统型生成请求才跳过，避免漏掉正常聊天和朋友圈互动。
        if (settings.COUNT_AS_INTERACTION !== false) this.recordDesktopInteractionCount();
        const agentLogPhase = ['pre', 'post'].includes(settings.AGENT_LOG_PHASE) ? settings.AGENT_LOG_PHASE : '';
        const isAgentContextLog = !!agentLogPhase;
        const isProactiveContextLog = settings.PROACTIVE_CONTEXT_LOG === true;
        let proactiveLogEntry = null;

        // ★ 后台回复接收入口：如果用户在探索页填写了 Worker URL + Token，
        //   这里就不直接请求模型 API，而是交给后端创建 job 并轮询结果。
        //   如果没填写，就继续走下面原来的纯前端直连 API 流程。
        if (this.shouldUseAsyncBackend(settings)) {
            return await this.chatViaAsyncBackend(messages, settings);
        }

        const { API_URL, API_KEY, MODEL } = settings;
        
        const MAX_TOKENS = settings.MAX_TOKENS || 32700;
        const TEMPERATURE = settings.TEMPERATURE !== undefined ? settings.TEMPERATURE : 1.1;

        const provider = this.getProvider(API_URL);
        
        let fetchUrl = API_URL;
        let options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const sysPrompts = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
        const requestedMessageIndex = Number.isInteger(settings.MULTIMODAL_MESSAGE_INDEX)
            ? settings.MULTIMODAL_MESSAGE_INDEX
            : -1;
        const multimodalImage = settings.IMAGE_API_MODE === 'multimodal'
            ? this.parseImageDataUrl(settings.MULTIMODAL_IMAGE)
            : null;
        const targetMessageIndex = multimodalImage && messages[requestedMessageIndex]?.role === 'user'
            ? requestedMessageIndex
            : -1;

        // ★ 同一份内部消息在最后一刻才转成服务商格式；历史图片不会进入这里，只有本轮图片会被附加。
        const buildProviderRequestBody = (sourceMessages, includeImage) => {
            const lastUserText = sourceMessages.filter(m => m.role === 'user').pop()?.content || '';
            const targetText = targetMessageIndex >= 0
                ? String(sourceMessages[targetMessageIndex]?.content || '')
                : String(lastUserText || '');

            if (provider === 'claude') {
                const content = includeImage && multimodalImage
                    ? [
                        { type: 'text', text: targetText || '请查看这张图片。' },
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: multimodalImage.mimeType,
                                data: multimodalImage.data
                            }
                        }
                    ]
                    : String(lastUserText || '');
                return {
                    model: MODEL,
                    system: sysPrompts,
                    messages: [{ role: 'user', content }],
                    max_tokens: MAX_TOKENS,
                    temperature: TEMPERATURE
                };
            }

            if (provider === 'gemini') {
                const parts = [{ text: includeImage ? (targetText || '请查看这张图片。') : String(lastUserText || '') }];
                if (includeImage && multimodalImage) {
                    parts.push({
                        inlineData: {
                            mimeType: multimodalImage.mimeType,
                            data: multimodalImage.data
                        }
                    });
                }
                return {
                    contents: [{ role: 'user', parts }],
                    systemInstruction: { parts: [{ text: sysPrompts }] },
                    generationConfig: {
                        temperature: TEMPERATURE,
                        maxOutputTokens: MAX_TOKENS
                    }
                };
            }

            // OpenAI Standard，包括 SiliconFlow、DeepSeek、Gemini OpenAI 兼容接口等。
            const openAiMessages = sourceMessages.map((message, index) => {
                if (!includeImage || !multimodalImage || index !== targetMessageIndex) return { ...message };
                return {
                    ...message,
                    content: [
                        { type: 'text', text: String(message.content || '') || '请查看这张图片。' },
                        { type: 'image_url', image_url: { url: settings.MULTIMODAL_IMAGE } }
                    ]
                };
            });
            return {
                model: MODEL,
                messages: openAiMessages,
                temperature: TEMPERATURE,
                max_tokens: MAX_TOKENS
            };
        };

        if (provider === 'claude') {
            options.headers['x-api-key'] = API_KEY;
            options.headers['anthropic-version'] = '2023-06-01';
        } else if (provider === 'gemini') {
            fetchUrl = API_URL.endsWith(':generateContent') ? API_URL : `${API_URL}/${MODEL}:generateContent?key=${API_KEY}`;
        } else {
            options.headers['Authorization'] = `Bearer ${API_KEY}`;
        }

        let requestBody = buildProviderRequestBody(messages, targetMessageIndex >= 0);
        let requestBodyExtra = {};

        // ==========================================
        // ★★★ 新增：合并请求体附加参数 JSON ★★★
        // ==========================================
        try {
            const rawExtraBody = settings.CUSTOM_REQUEST_BODY_JSON || '';

            if (rawExtraBody.trim()) {
                const extraBody = JSON.parse(rawExtraBody);

                if (!extraBody || typeof extraBody !== 'object' || Array.isArray(extraBody)) {
                    throw new Error("请求体附加参数必须是一个 JSON 对象，例如 { \"stream\": false }");
                }

                // 当前版本不支持 stream: true，避免 response.json() 崩掉
                if (extraBody.stream === true) {
                    console.warn("当前版本暂不支持 stream: true，已自动改为 false。");
                    extraBody.stream = false;
                }

                // 浅合并：额外参数覆盖原本参数
                requestBody = {
                    ...requestBody,
                    ...extraBody
                };
                requestBodyExtra = extraBody;

                // ★ 附加参数可以覆盖温度等高级配置，但不能把程序刚生成的图文 messages/contents 整体抹掉。
                const protectedBody = buildProviderRequestBody(messages, targetMessageIndex >= 0);
                if (provider === 'gemini') requestBody.contents = protectedBody.contents;
                else requestBody.messages = protectedBody.messages;

                console.log("[API] 已合并请求体附加参数:", extraBody);
            }
        } catch (error) {
            console.error("请求体附加参数 JSON 解析失败:", error);
            throw new Error(`请求体附加参数 JSON 格式错误：${error.message}`);
        }

        options.body = JSON.stringify(requestBody);

        // ==========================================
        // 1. 发送前日志记录
        // ==========================================
        try {
            let requestBodyObject = options.body;

            if (typeof options.body === 'string') {
                requestBodyObject = JSON.parse(options.body);
            }

            // ★ API 日志和控制台只保留图片体积占位，不把整段 base64 再复制一份进内存和 IndexedDB。
            requestBodyObject = this.redactMultimodalImagesForLog(requestBodyObject);
            
            console.log(`[${provider}] Sending...`, requestBodyObject);

            const apiLogEntry = {
                content: JSON.stringify(requestBodyObject, null, 2),

                // 保留你原来的 tokens 字段，避免旧代码报错
                tokens: 0,

                // 新增：完整 token 信息
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                prompt_cache_hit_tokens: 0,
                prompt_cache_miss_tokens: 0,
                prompt_cache_total_tokens: 0,
                prompt_cache_hit_rate: null,
                has_prompt_cache_usage: false,
                history_window: settings.HISTORY_WINDOW_LOG || null,
                request_cache_debug: settings.REQUEST_CACHE_DEBUG_LOG || null,

                isEstimated: true 
            };
            if (isAgentContextLog) {
                this.recordAgentContextLog(agentLogPhase, {
                    label: settings.AGENT_LOG_LABEL || 'Agent 调用',
                    request: apiLogEntry.content,
                    response: '',
                    provider,
                    model: MODEL,
                    createdAt: Date.now(),
                    ...apiLogEntry
                });
            } else if (isProactiveContextLog) {
                // ★ 记录 provider 转换和附加请求参数之后的最终请求体；不让主动判断覆盖正常聊天日志。
                const logUrl = new URL(fetchUrl, window.location.href);
                logUrl.search = '';
                logUrl.hash = '';
                proactiveLogEntry = this.setLatestProactiveContextLog({
                    ...apiLogEntry,
                    content: JSON.stringify({
                        api_url: logUrl.toString(),
                        auth_mode: 'client_key',
                        ...requestBodyObject
                    }, (key, value) => /^(?:api[_-]?key|authorization|access[_-]?token|secret|password)$/i.test(key) ? '[已隐藏]' : value, 2),
                    source: '浏览器',
                    characterId: String(settings.PROACTIVE_CHARACTER_ID || ''),
                    characterName: settings.PROACTIVE_CHARACTER_NAME || '角色',
                    createdAt: Date.now()
                });
            } else {
                this.setLatestMainContextLog(apiLogEntry);
            }

        } catch (error) {
            console.error("【API日志记录失败】", error);
        }

        let response = await fetch(fetchUrl, options);

        if (!response.ok) {
            let finalErrorText = await response.text();

            // ★ 只在 API 明确表示“不支持图片/多模态结构”时去图重试一次。
            // Key、限流、服务故障和网络问题保持原错误，避免把真正问题伪装成识图失败。
            if (targetMessageIndex >= 0 && this.isMultimodalUnsupportedError(response.status, finalErrorText)) {
                const fallbackMessages = this.buildMultimodalFallbackMessages(messages, targetMessageIndex);
                requestBody = {
                    ...buildProviderRequestBody(fallbackMessages, false),
                    ...requestBodyExtra
                };
                const protectedFallbackBody = buildProviderRequestBody(fallbackMessages, false);
                if (provider === 'gemini') requestBody.contents = protectedFallbackBody.contents;
                else requestBody.messages = protectedFallbackBody.messages;
                requestBody.stream = false;
                options.body = JSON.stringify(requestBody);

                response = await fetch(fetchUrl, options);
                if (!response.ok) finalErrorText = await response.text();
                if (response.ok) this.notifyMultimodalFallback(`direct_${Date.now()}`);
            }

            if (!response.ok) {
                throw new Error(`API Error ${response.status}: ${finalErrorText}`);
            }
        }
        
        const data = await response.json();

        // ==========================================
        // 2. 发送后：拿到真实 Token
        // ==========================================
        console.log(`[${provider}] Raw Response:`, data);
        if (isAgentContextLog) {
            const latestAgentLog = this.getLatestAgentContextLog(agentLogPhase);
            if (latestAgentLog) {
                latestAgentLog.response = JSON.stringify(data, null, 2);
                this.persistContextLog('agent', latestAgentLog);
            }
        }

        try {
            let promptTokens = 0;
            let completionTokens = 0;
            let totalTokens = 0;
            let promptCacheUsage = this.extractPromptCacheUsage(null, 0);

            // OpenAI / DeepSeek / SiliconFlow 等兼容格式
            if (data.usage) {
                promptTokens = data.usage.prompt_tokens ?? data.usage.input_tokens ?? 0;
                completionTokens = data.usage.completion_tokens ?? data.usage.output_tokens ?? 0;
                totalTokens = data.usage.total_tokens ?? (promptTokens + completionTokens);
                promptCacheUsage = this.extractPromptCacheUsage(data.usage, promptTokens);
            }

            // Claude 格式兜底：usage.input_tokens / usage.output_tokens
            if (provider === 'claude' && data.usage) {
                promptTokens = data.usage.input_tokens ?? promptTokens;
                completionTokens = data.usage.output_tokens ?? completionTokens;
                totalTokens = promptTokens + completionTokens;
            }

            // Gemini 格式兜底：usageMetadata
            if (provider === 'gemini' && data.usageMetadata) {
                promptTokens = data.usageMetadata.promptTokenCount ?? promptTokens;
                completionTokens = data.usageMetadata.candidatesTokenCount ?? completionTokens;
                totalTokens = data.usageMetadata.totalTokenCount ?? (promptTokens + completionTokens);
            }

            const updateLogTarget = isAgentContextLog
                ? this.getLatestAgentContextLog(agentLogPhase)
                : (isProactiveContextLog ? proactiveLogEntry : window.LAST_API_LOG);

            if (updateLogTarget) {
                if (promptTokens || completionTokens || totalTokens) {
                    updateLogTarget.tokens = promptTokens; // 兼容旧字段
                    updateLogTarget.prompt_tokens = promptTokens;
                    updateLogTarget.completion_tokens = completionTokens;
                    updateLogTarget.total_tokens = totalTokens;
                    updateLogTarget.prompt_cache_hit_tokens = promptCacheUsage.hitTokens;
                    updateLogTarget.prompt_cache_miss_tokens = promptCacheUsage.missTokens;
                    updateLogTarget.prompt_cache_total_tokens = promptCacheUsage.totalTokens;
                    updateLogTarget.prompt_cache_hit_rate = promptCacheUsage.hitRate;
                    updateLogTarget.has_prompt_cache_usage = promptCacheUsage.hasUsage;
                    updateLogTarget.isEstimated = false;

                    console.log("API返回真实Token消耗:", {
                        prompt_tokens: promptTokens,
                        completion_tokens: completionTokens,
                        total_tokens: totalTokens,
                        prompt_cache_hit_tokens: promptCacheUsage.hitTokens,
                        prompt_cache_miss_tokens: promptCacheUsage.missTokens,
                        prompt_cache_hit_rate: promptCacheUsage.hitRate
                    });
                } else if (updateLogTarget.content) {
                    // API 没返回 usage 时，用旧的估算逻辑兜底
                    const estimatedTokens = this.estimateTokens(updateLogTarget.content);

                    updateLogTarget.tokens = estimatedTokens;
                    updateLogTarget.prompt_tokens = estimatedTokens;
                    updateLogTarget.completion_tokens = 0;
                    updateLogTarget.total_tokens = estimatedTokens;
                    updateLogTarget.prompt_cache_hit_tokens = 0;
                    updateLogTarget.prompt_cache_miss_tokens = 0;
                    updateLogTarget.prompt_cache_total_tokens = 0;
                    updateLogTarget.prompt_cache_hit_rate = null;
                    updateLogTarget.has_prompt_cache_usage = false;
                    updateLogTarget.isEstimated = true;

                    console.log("API未返回真实Token，已使用估算Token:", estimatedTokens);
                }
                if (isProactiveContextLog) this.setLatestProactiveContextLog(updateLogTarget);
                else this.persistContextLog(isAgentContextLog ? 'agent' : 'main', updateLogTarget);
            }
        } catch (error) {
            console.error("【Token日志处理失败】", error);
        }
                
        if (provider === 'claude') {
            return data.content[0].text.trim();
        }
        
        if (provider === 'gemini') {
            const candidate = data?.candidates?.[0];

            if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'BLOCKLIST') {
                throw new Error("❌ 回复失败：内容触发了 Google Gemini 的安全审查过滤。");
            }

            return candidate?.content?.parts?.[0]?.text?.trim() || "【API未返回有效文本】";
        }
        
        // ==========================================
        // 统一推理模型的输出格式 把某些推理模型单独返回的 reasoning_content，整理成 <think>...</think> 格式，方便前端统一显示
        // ==========================================
        const messageObj = data.choices[0].message;
        let finalContent = messageObj.content || "";
        
        // DeepSeek-R1 / OpenAI o1 等推理字段
        if (messageObj.reasoning_content) {
            finalContent = `<think>\n${messageObj.reasoning_content.trim()}\n</think>\n\n${finalContent}`;
        }
        
        return finalContent.trim();
    },

    
    // 在 chat(messages, settings) 函数后面添加：

    // ★★★ 新增：视觉分析专用函数 ★★★
    // 这是一个独立的请求，不使用 chat 函数的配置，而是使用视觉专属配置
    async analyzeImage(base64Image, visionSettings) {
        const { url, key, model, prompt } = visionSettings;
        
        console.log("正在请求视觉模型...", model);

        // 构建 OpenAI 兼容格式的 Vision Payload
        const payload = {
            model: model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]
                }
            ],
            max_tokens: 8190
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Vision API Error: ${response.status} ${await response.text()}`);
            }

            const data = await response.json();
            const description = data.choices[0].message.content;
            console.log("视觉描述结果:", description);
            return description;

        } catch (error) {
            console.error("识图失败:", error);
            throw error; // 抛出错误让 handleSend 捕获
        }
    },




};

// =========================================
// 轻量 Toast：同时显示 3 条，额外保留 3 条短队列，避免连续操作把屏幕占满。
// =========================================
const Toast = {
    maxVisible: 3,
    maxQueued: 3,
    visibleCount: 0,
    queue: [],

    show(message, options = {}) {
        const item = {
            message: String(message || ''),
            duration: Number.isFinite(options.duration) ? Math.max(0, options.duration) : 1500,
            icon: ['check', 'settings', 'warning'].includes(options.icon) ? options.icon : 'check'
        };

        if (!item.message) return;

        if (this.visibleCount >= this.maxVisible) {
            // 队列已满时优先保留最新反馈，避免过时提示排很久才出现。
            if (this.queue.length >= this.maxQueued) this.queue.shift();
            this.queue.push(item);
            return;
        }

        this._mount(item);
    },

    _mount(item) {
        const stack = document.getElementById('toast-stack');
        if (!stack) return;

        const toast = document.createElement('div');
        toast.className = 'toast-item';

        // SVG 使用固定模板，不接收外部内容；主动消息可复用同一 Toast，并按结果切换图标。
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '2');
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');
        icon.setAttribute('aria-hidden', 'true');

        if (item.icon === 'settings') {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '12');
            circle.setAttribute('r', '3');
            const gear = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            gear.setAttribute('d', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.12.6.6 1.04 1.21 1H21a2 2 0 0 1 0 4h-.09c-.61-.04-1.09.4-1.51 1z');
            icon.append(circle, gear);
        } else {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', item.icon === 'warning' ? 'M12 9v4m0 4h.01M10.3 3.6 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z' : 'M20 6 9 17l-5-5');
            icon.appendChild(path);
        }

        const text = document.createElement('span');
        text.textContent = item.message;
        toast.append(icon, text);
        stack.appendChild(toast);
        this.visibleCount += 1;

        // 分气泡复制后会在同一轮任务里退出多选模式；先强制落地初始样式，
        // 避免浏览器把“插入元素”和“进入 show 状态”合并，导致进场动画被跳过。
        void toast.offsetHeight;
        requestAnimationFrame(() => toast.classList.add('show'));

        const close = () => {
            if (toast.classList.contains('leaving')) return;
            toast.classList.add('leaving');

            setTimeout(() => {
                toast.remove();
                this.visibleCount = Math.max(0, this.visibleCount - 1);

                // 当前 Toast 完全移除后再补位，堆叠移动不会互相覆盖。
                const nextItem = this.queue.shift();
                if (nextItem) this._mount(nextItem);
            }, 300);
        };

        setTimeout(close, item.duration);
    }
};

// =========================================
// =========================================
// 6. UI RENDERER (DOM 操作)
// =========================================
const UI = {
    els: {
        viewList: document.getElementById('view-contact-list'),
        viewChat: document.getElementById('view-chat'),
        contactContainer: document.getElementById('contact-list-container'),
        chatMsgs: document.getElementById('chat-messages'),
        chatTitle: document.getElementById('chat-title'),
        chatAvatar: document.getElementById('chat-header-avatar'),
        status: document.getElementById('typing-status'),
        input: document.getElementById('task-input'),
        sendBtn: document.getElementById('send-button'),
        rerollBtn: document.getElementById('reroll-footer-btn'),
        modalOverlay: document.getElementById('modal-overlay'),
        mainModal: document.getElementById('main-modal'), 
        
        // World Info Elements
        wiModal: document.getElementById('world-info-modal'),
        wiList: document.getElementById('wi-list-container'),
        wiBookSelect: document.getElementById('wi-book-select'), // ★★★ 新增：大分类选择
        wiBookScopeBtn: document.getElementById('wi-book-scope-btn'), // 世界书生效范围按钮
        wiBookScopeSummary: document.getElementById('wi-book-scope-summary'), // 世界书生效范围摘要
        
        settingUrl: document.getElementById('custom-api-url'),
        settingKey: document.getElementById('custom-api-key'),
        settingAsyncBackendUrl: document.getElementById('async-backend-url'),
        settingAsyncBackendToken: document.getElementById('async-backend-token'),
        settingAsyncBackendTtlHours: document.getElementById('async-backend-ttl-hours'),
        settingModel: document.getElementById('custom-model-select'),
        settingSystemPrompt: document.getElementById('global-system-prompt'),
        fetchBtn: document.getElementById('fetch-models-btn'),
        themeLight: document.getElementById('theme-light'),
        themeDark: document.getElementById('theme-dark'),


        // ★★★ 新增：视觉设置 DOM ★★★
        settingVisionUrl: document.getElementById('vision-api-url'),
        settingVisionKey: document.getElementById('vision-api-key'),
        settingVisionModel: document.getElementById('vision-model-name'),
        settingVisionPrompt: document.getElementById('vision-prompt'),


        //  ★★★ 新增按钮和状态栏 ★★★
        fetchVisionBtn: document.getElementById('fetch-vision-models-btn'), // 拉取按钮
        testVisionBtn: document.getElementById('test-vision-api-btn'),     // 测试按钮
        visionStatus: document.getElementById('test-vision-api-status'),   // 测试结果文字

        // ★★★ 新增：发图 DOM ★★★
        uploadBtn: document.getElementById('upload-image-btn'),
        uploadInput: document.getElementById('image-upload-input'),
        previewContainer: document.getElementById('image-preview-container'),
        previewImg: document.getElementById('image-preview-img'),
        clearImgBtn: document.getElementById('clear-image-btn'),

        // ★★★ 新增发图、视觉预设相关 DOM ★★★
        visionPresetSelect: document.getElementById('vision-preset-select'),
        saveVisionPresetBtn: document.getElementById('save-vision-preset-btn'),
        delVisionPresetBtn: document.getElementById('del-vision-preset-btn'),


    },

    // ★★★ 新增：用于标记是否允许自动滚动的状态 ★★★
    autoScrollEnabled: true, 

    // ★★★ 聊天 Header 在线状态：先写成常量，后面要做成设置项也只改这里 ★★★
    presenceTicker: null,
    presenceAwayAfterMs: 30 * 60 * 1000,
    presenceOfflineAfterMs: 6 * 60 * 60 * 1000,

    init() {
        this.renderContacts(); // 先渲染联系人
        CloudSync.init();      // 云同步初始化

        // 代码块按钮使用事件委托，历史消息和新消息无需分别绑定复制事件
        this.els.chatMsgs.addEventListener('click', async (event) => {
            const copyButton = event.target.closest('.code-copy-btn');
            if (!copyButton) return;

            event.preventDefault();
            event.stopPropagation();

            const codeElement = copyButton.closest('.code-block')?.querySelector('pre code');
            if (!codeElement || copyButton.disabled) return;

            copyButton.disabled = true;

            try {
                // 必须读取 textContent，避免把 Markdown 或将来的高亮标签复制进去
                await copyPlainText(codeElement.textContent || '');
                setCodeCopyButtonIcon(copyButton, true);
                copyButton.classList.add('is-copied');
            } catch (error) {
                console.error('代码复制失败:', error);
                copyButton.textContent = '复制失败';
                copyButton.setAttribute('aria-label', '复制失败');
            }

            setTimeout(() => {
                setCodeCopyButtonIcon(copyButton, false);
                copyButton.classList.remove('is-copied');
                copyButton.disabled = false;
            }, 1600);
        });
        
        // ★★★ 新增：字体滑块的实时监听（拖动时直接预览，不需要点保存）
        const slider = document.getElementById('font-size-slider');
        const label = document.getElementById('font-size-value');
        if (slider) {
            slider.addEventListener('input', (e) => {
                const newSize = e.target.value;
                // 更新旁边的数字显示
                if(label) label.textContent = newSize + 'px';
                // 核心：直接修改 CSS 变量，让页面立刻变大变小
                document.documentElement.style.setProperty('--app-font-size', newSize + 'px');
            });
        }


        // 找到真正的滚动容器（根据你的 scrollToBottom 函数，它就是 parentElement）
        const scrollContainer = this.els.chatMsgs.parentElement;
        if (scrollContainer) {
            // ★★★ 核心修复：监听这个容器的 scroll 事件 ★★★
            scrollContainer.addEventListener('scroll', () => {
                // 计算在这个容器内的距离
                const distance = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
                
                // 调试用：现在你应该能看到数字变化了
                // console.log('容器距离底部:', distance); 

                // 逻辑：
                // 1. 如果距离 > 50px，说明用户往上拉了，或者内容太长超出了底部 -> 暂停自动滚
                // 2. 如果距离 <= 50px，说明用户即使手动滚，也滚到了最下面 -> 恢复自动滚
                if (distance > 50) {
                    this.autoScrollEnabled = false;
                } else {
                    this.autoScrollEnabled = true;
                }
            });
        }

        // 初始化默认开启
        this.autoScrollEnabled = true;

        // 最后应用所有外观（包括刚才读出来的字体、主题、壁纸）
        this.applyAppearance();
        this.startPresenceTicker();
    },

    // 主题色默认值：对应原来的 rgb(135, 110, 255)，避免老用户第一次打开时颜色突变。
    getThemeColorSettings(settings = STATE.settings) {
        const defaults = CONFIG.DEFAULT || {};
        const clamp = (value, fallback, min, max) => {
            const num = Number(value);
            if (!Number.isFinite(num)) return fallback;
            return Math.min(Math.max(num, min), max);
        };

        return {
            h: clamp(settings.THEME_COLOR_H, defaults.THEME_COLOR_H ?? 250, 0, 360),
            s: clamp(settings.THEME_COLOR_S, defaults.THEME_COLOR_S ?? 100, 0, 100),
            l: clamp(settings.THEME_COLOR_L, defaults.THEME_COLOR_L ?? 72, 20, 90)
        };
    },

    // 把 HSL 写回 CSS 变量；所有 var(--primary-btn-text) 会跟着一起换色。
    applyThemeColor(color = this.getThemeColorSettings()) {
        const root = document.documentElement;
        root.style.setProperty('--theme-color-h', color.h);
        root.style.setProperty('--theme-color-s', color.s + '%');
        root.style.setProperty('--theme-color-l', color.l + '%');

        const preview = document.getElementById('theme-color-preview');
        if (preview) preview.style.background = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    },

    // 同步外观页滑条和数值文字；openSettings/applyAppearance 都会调用一次。
    syncThemeColorControls(color = this.getThemeColorSettings()) {
        const pairs = [
            ['h', 'theme-color-h', 'theme-color-h-value', ''],
            ['s', 'theme-color-s', 'theme-color-s-value', '%'],
            ['l', 'theme-color-l', 'theme-color-l-value', '%']
        ];

        pairs.forEach(([key, inputId, labelId, unit]) => {
            const input = document.getElementById(inputId);
            const label = document.getElementById(labelId);
            if (input) input.value = color[key];
            if (label) label.textContent = color[key] + unit;
        });

        this.applyThemeColor(color);
    },

    // 1. 替换原有的 applyAppearance
    applyAppearance() {
        const settings = STATE.settings;
        
        // --- 读取设置 (注意保持大写 Key) ---
        const WALLPAPER = settings.WALLPAPER || CONFIG.DEFAULT.WALLPAPER;
        const THEME = settings.THEME || CONFIG.DEFAULT.THEME; 
        const FONT_SIZE = settings.FONT_SIZE || CONFIG.DEFAULT.FONT_SIZE;
        const CUSTOM_CSS = settings.CUSTOM_CSS || CONFIG.DEFAULT.CUSTOM_CSS; // 新增
        const CUSTOM_BASE_THEME = settings.CUSTOM_BASE_THEME || CONFIG.DEFAULT.CUSTOM_BASE_THEME || 'dark';
        const THEME_COLOR = this.getThemeColorSettings(settings);

        // --- 1. 处理壁纸 ---
        document.body.style.backgroundImage = `url('${WALLPAPER}')`;
        // ★ 聊天页自己也要铺同一张壁纸，避免透明时透出下面残留的记忆/探索页面。
        document.documentElement.style.setProperty('--app-wallpaper-image', document.body.style.backgroundImage);
        // 如果是默认壁纸且不是夜间/自定义模式，给个浅灰背景
        if (WALLPAPER === CONFIG.DEFAULT.WALLPAPER && (THEME === 'light' || (THEME === 'custom' && CUSTOM_BASE_THEME === 'light'))) {
            document.body.style.backgroundColor = '#f2f2f2';
        } else {
            document.body.style.backgroundColor = ''; 
        }

        // --- 2. 处理字体 ---
        document.documentElement.style.setProperty('--app-font-size', FONT_SIZE + 'px');
        const slider = document.getElementById('font-size-slider');
        const label = document.getElementById('font-size-value');
        if (slider) slider.value = FONT_SIZE;
        if (label) label.textContent = FONT_SIZE + 'px';
        this.syncThemeColorControls(THEME_COLOR);

        // --- 3. 处理主题 (核心修改) ---
        const body = document.body;
        
        // 清理旧类名
        body.classList.remove('light-mode', 'dark-mode', 'custom-mode');

        // 获取或创建用于注入 CSS 的 style 标签
        let customStyleTag = document.getElementById('user-custom-css');
        if (!customStyleTag) {
            customStyleTag = document.createElement('style');
            customStyleTag.id = 'user-custom-css';
            document.head.appendChild(customStyleTag);
        }

        // 获取 CSS 面板 DOM (用于显示/隐藏)
        const cssPanel = document.getElementById('custom-css-panel');

        // 判断主题逻辑
        if (THEME === 'custom') {
            body.classList.add('custom-mode');
            // 自定义模式只负责启用用户 CSS；亮暗底座直接复用普通主题，避免维护重复样式。
            body.classList.add(CUSTOM_BASE_THEME === 'light' ? 'light-mode' : 'dark-mode');
            customStyleTag.textContent = App.prefixUserCss(CUSTOM_CSS);// 注入用户 CSS
            if (cssPanel) cssPanel.classList.remove('hidden'); // 显示面板
            
            // 同步输入框的值 (防止刷新后输入框是空的)
            const cssInput = document.getElementById('custom-css-input');
            if (cssInput && cssInput.value !== CUSTOM_CSS) {
                cssInput.value = CUSTOM_CSS;
            }

        } else {
            // 非自定义模式
            customStyleTag.textContent = ''; // 清空自定义样式
            if (cssPanel) cssPanel.classList.add('hidden'); // 隐藏面板
            
            if (THEME === 'dark') {
                body.classList.add('dark-mode');
            } else {
                body.classList.add('light-mode');
            }
        }

        // --- 4. 同步 Radio 按钮状态 ---
        if(this.els.themeLight) this.els.themeLight.checked = (THEME === 'light');
        if(this.els.themeDark) this.els.themeDark.checked = (THEME === 'dark');
        const themeCustomBtn = document.getElementById('theme-custom');
        if(themeCustomBtn) themeCustomBtn.checked = (THEME === 'custom');
        const customBaseDark = document.getElementById('custom-base-dark');
        const customBaseLight = document.getElementById('custom-base-light');
        if(customBaseDark) customBaseDark.checked = (CUSTOM_BASE_THEME !== 'light');
        if(customBaseLight) customBaseLight.checked = (CUSTOM_BASE_THEME === 'light');
    },

    // 2. 新增：渲染预设下拉框
    renderCssPresetMenu() {
        const select = document.getElementById('css-preset-select');
        if (!select) return;
        
        // 清空现有选项，保留第一项提示
        select.innerHTML = '<option value="">-- 选择样式预设 --</option>';
        
        const presets = STATE.settings.CSS_PRESETS || [];
        presets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index; 
            option.textContent = preset.name;
            select.appendChild(option);
        });
    },

    // 保持 toggleTheme 不变，或者用你刚才发的那个
    async toggleTheme(newTheme) {
        STATE.settings.THEME = newTheme;
        await Storage.saveSettings();
        this.applyAppearance();
    },


    // 切换窗口+朋友圈版
    switchView(viewName) {
        const appContainer = document.getElementById('app-container');
        
        // 安全获取其他三个主要视图和底栏（找不到也不会报错）
        const viewDesktop = document.getElementById('view-desktop');
        const viewContact = document.getElementById('view-contact-list');
        const viewExplore = document.getElementById('view-explore');
        const viewTodoPlan = document.getElementById('view-todo-plan');
        const viewCountdown = document.getElementById('view-countdown');
        const viewCharacterSchedule = document.getElementById('view-character-schedule');
        const viewCharacterScheduleDetail = document.getElementById('view-character-schedule-detail');
        const viewCharacterMemory = document.getElementById('view-character-memory');
        const viewCharacterMemoryDetail = document.getElementById('view-character-memory-detail');
        const viewHeartNote = document.getElementById('view-heart-note');
        const viewHeartNoteDetail = document.getElementById('view-heart-note-detail');
        const viewProactiveMessages = document.getElementById('view-proactive-messages');
        const viewAgent = document.getElementById('view-agent');
        const viewAsyncBackend = document.getElementById('view-async-backend');
        const viewAsyncReply = document.getElementById('view-async-reply');
        const viewWorldbook = document.getElementById('view-worldbook');
        const viewWorldSense = document.getElementById('view-world-sense');
        const viewMoments = document.getElementById('view-moments');
        const bottomTabBar = document.getElementById('bottom-tab-bar');

        // ★ Agent 是后加的探索子页：旧分支里没有逐个隐藏它，这里先统一收口。
        if (viewAgent && viewName !== 'agent') viewAgent.style.display = 'none';
        // ★ 角色记忆也是探索子页，先统一隐藏，再在对应分支打开。
        if (viewCharacterMemory && viewName !== 'character-memory') viewCharacterMemory.style.display = 'none';
        if (viewCharacterMemoryDetail && viewName !== 'character-memory-detail') viewCharacterMemoryDetail.style.display = 'none';
        // ★ 心笺也是探索子页，与角色记忆保持相同的显隐收口。
        if (viewHeartNote && viewName !== 'heart-note') viewHeartNote.style.display = 'none';
        if (viewHeartNoteDetail && viewName !== 'heart-note-detail') viewHeartNoteDetail.style.display = 'none';
        if (viewProactiveMessages && viewName !== 'proactive-messages') viewProactiveMessages.style.display = 'none';
        if (viewAsyncReply && viewName !== 'async-reply') viewAsyncReply.style.display = 'none';

        // ★ 番茄钟独立页统一收口，切去其它页面不会停止计时。
        const viewPomodoro = document.getElementById('view-pomodoro');
        if (viewPomodoro && viewName !== 'pomodoro') viewPomodoro.style.display = 'none';

        // 先清除底栏的全部高亮状态
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        if (viewName === 'pomodoro') {
            App.rememberReturnView('pomodoro', STATE.currentMainView || 'explore');
            appContainer.classList.remove('in-chat-mode');
            document.querySelectorAll('.page-view').forEach(view => { view.style.display = 'none'; });
            viewPomodoro.style.display = 'flex';
            if (bottomTabBar) bottomTabBar.style.display = 'none';
            Pomodoro.render();
            // ★ 无论从探索入口还是顶部通知进入，真正打开番茄钟页才清除完成红点。
            Pomodoro.markRead().catch(error => Pomodoro.report(error));
        } else if (viewName === 'desktop') {
            // ===========================
            // 0. 进入桌面：首页小组件集中刷新
            // ===========================
            STATE.currentMainView = 'desktop';
            appContainer.classList.remove('in-chat-mode');
            STATE.currentContactId = null; // 离开聊天页后清掉当前对象，否则后台回复会被误判成“仍在聊天窗口”

            if (viewDesktop) viewDesktop.style.display = 'flex';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'flex';
            const tabDesktop = document.getElementById('tab-desktop');
            if (tabDesktop) tabDesktop.classList.add('active');
            if (typeof App !== 'undefined' && typeof App.renderDesktop === 'function') {
                App.renderDesktop();
            }

        } else if (viewName === 'chat') {
            // ===========================
            // 1. 进入聊天页面 (保留你原有的精美动画逻辑)
            // ===========================
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('chat', STATE.currentMainView || 'contact-list');
            }
            
            // 触发动画
            requestAnimationFrame(() => {
                appContainer.classList.add('in-chat-mode');
            });
            
            // 进入聊天时，隐藏底栏
            if (bottomTabBar) bottomTabBar.style.display = 'none'; 
            if (viewDesktop) viewDesktop.style.display = 'none';
            // ★ 聊天页平时靠 transform 待在屏幕外，但节点本身必须保持 flex。
            // 心笺等二级页如果曾写入 display:none，只加 in-chat-mode 也无法让它重新出现。
            if (this.els.viewChat) this.els.viewChat.style.display = 'flex';
            
            // 注意：因为你的聊天界面是靠 CSS 控制盖在上面的，所以这里不需要去改其他界面的 display
            
        } else if (viewName === 'contact-list') {
            // ===========================
            // 2. 返回/进入联系人列表
            // ===========================
            STATE.currentMainView = 'contact-list';
            
            appContainer.classList.remove('in-chat-mode'); // 撤销聊天动画，淡出回去
            STATE.currentContactId = null; // 清除当前聊天对象
            
            // 控制其他页面隐藏，显示联系人列表
            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'flex';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';
            
            // 显示底栏，并高亮“聊天”按钮
            if (bottomTabBar) bottomTabBar.style.display = 'flex';
            const tabChat = document.getElementById('tab-chat');
            if (tabChat) tabChat.classList.add('active');

            // 保留你的延迟刷新逻辑，避免返回时的动画卡顿
            setTimeout(() => {
                this.renderContacts(); 
            }, 200);

        } else if (viewName === 'explore') {
            // ===========================
            // 3. 进入探索页面
            // ===========================
            STATE.currentMainView = 'explore';
            
            appContainer.classList.remove('in-chat-mode'); // 确保不在聊天界面
            
            // 控制其他页面隐藏，显示探索页
            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'flex';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';
            
            // 显示底栏，并高亮“探索”按钮
            if (bottomTabBar) bottomTabBar.style.display = 'flex';
            const tabExplore = document.getElementById('tab-explore');
            if (tabExplore) tabExplore.classList.add('active');

        } else if (viewName === 'agent') {
            // ===========================
            // Agent：工具路由器配置页
            // ===========================
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('agent', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAgent) viewAgent.style.display = 'flex';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.renderAgentList === 'function') {
                App.renderAgentList();
            }

        } else if (viewName === 'async-reply') {
            // ★ 切屏回复接收复用后台服务的卡片样式，打开时单独恢复保留时间与任务列表。
            App.rememberReturnView('async-reply', STATE.currentMainView || 'explore');
            appContainer.classList.remove('in-chat-mode');
            document.querySelectorAll('.page-view').forEach(view => {
                if (view !== this.els.viewChat) view.style.display = 'none';
            });
            if (viewAsyncReply) viewAsyncReply.style.display = 'flex';
            if (bottomTabBar) bottomTabBar.style.display = 'none';
            App.loadAsyncReplySettings();

        } else if (viewName === 'async-backend') {
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('async-backend', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'flex';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.loadAsyncBackendSettings === 'function') {
                App.loadAsyncBackendSettings();
            }

        } else if (viewName === 'world-sense') {
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('world-sense', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'flex';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.loadWorldSenseSettings === 'function') {
                App.loadWorldSenseSettings();
            }

        } else if (viewName === 'worldbook') {
            // ===========================
            // 世界书：现在是探索页下的独立功能，不再挂在设置中心里。
            // ===========================
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('worldbook', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'flex';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            UI.initWorldInfoTab();

        } else if (viewName === 'todo-plan') {
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('todo-plan', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'flex';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.renderTodoPlans === 'function') {
                App.renderTodoPlans();
            }

        } else if (viewName === 'countdown') {
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('countdown', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'flex';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.renderCountdownDays === 'function') {
                App.renderCountdownDays();
            }

        } else if (viewName === 'character-schedule') {
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('character-schedule', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'flex';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.renderCharacterScheduleList === 'function') {
                App.renderCharacterScheduleList();
            }

        } else if (viewName === 'character-schedule-detail') {
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'flex';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.renderCharacterScheduleDetail === 'function') {
                App.renderCharacterScheduleDetail();
            }

        } else if (viewName === 'character-memory') {
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('character-memory', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewCharacterMemory) viewCharacterMemory.style.display = 'flex';
            if (viewCharacterMemoryDetail) viewCharacterMemoryDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.renderCharacterMemoryList === 'function') {
                App.renderCharacterMemoryList();
            }

        } else if (viewName === 'character-memory-detail') {
            appContainer.classList.remove('in-chat-mode');

            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewCharacterMemory) viewCharacterMemory.style.display = 'none';
            if (viewCharacterMemoryDetail) viewCharacterMemoryDetail.style.display = 'flex';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'none';

            if (bottomTabBar) bottomTabBar.style.display = 'none';
            if (typeof App !== 'undefined' && typeof App.renderCharacterMemoryDetail === 'function') {
                App.renderCharacterMemoryDetail();
            }

        } else if (viewName === 'heart-note') {
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('heart-note', STATE.currentMainView || 'explore');
            }
            appContainer.classList.remove('in-chat-mode');
            // ★ 聊天页靠位移动画常驻，不能给它写入 display:none，否则之后只恢复动画类会得到空白页。
            document.querySelectorAll('.page-view').forEach(view => {
                if (view !== this.els.viewChat) view.style.display = 'none';
            });
            if (viewHeartNote) viewHeartNote.style.display = 'flex';
            if (bottomTabBar) bottomTabBar.style.display = 'none';
            App?.renderHeartNoteContacts?.();

        } else if (viewName === 'heart-note-detail') {
            appContainer.classList.remove('in-chat-mode');
            // ★ 与心笺列表保持同一显隐规则，不破坏聊天页的常驻布局。
            document.querySelectorAll('.page-view').forEach(view => {
                if (view !== this.els.viewChat) view.style.display = 'none';
            });
            if (viewHeartNoteDetail) viewHeartNoteDetail.style.display = 'flex';
            if (bottomTabBar) bottomTabBar.style.display = 'none';
            App?.renderHeartNoteDetail?.();

        } else if (viewName === 'proactive-messages') {
            // ★ 主动消息是探索二级页；统一隐藏其它 page-view，避免后加页面遗漏显隐分支。
            App.rememberReturnView('proactive-messages', STATE.currentMainView || 'explore');
            appContainer.classList.remove('in-chat-mode');
            document.querySelectorAll('.page-view').forEach(view => {
                if (view !== this.els.viewChat) view.style.display = 'none';
            });
            if (viewProactiveMessages) viewProactiveMessages.style.display = 'flex';
            if (bottomTabBar) bottomTabBar.style.display = 'none';
            ProactiveMessages?.render?.();

        } else if (viewName === 'moments') {
            // ===========================
            // 4. 进入朋友圈页面 (朋友圈)
            // ===========================
            if (typeof App !== 'undefined' && typeof App.rememberReturnView === 'function') {
                App.rememberReturnView('moments', STATE.currentMainView || 'explore');
            }
            
            appContainer.classList.remove('in-chat-mode'); // 确保不在聊天界面
            
            // 控制其他页面隐藏，显示朋友圈页
            if (viewDesktop) viewDesktop.style.display = 'none';
            if (viewContact) viewContact.style.display = 'none';
            if (viewExplore) viewExplore.style.display = 'none';
            if (viewTodoPlan) viewTodoPlan.style.display = 'none';
            if (viewCountdown) viewCountdown.style.display = 'none';
            if (viewCharacterSchedule) viewCharacterSchedule.style.display = 'none';
            if (viewCharacterScheduleDetail) viewCharacterScheduleDetail.style.display = 'none';
            if (viewAsyncBackend) viewAsyncBackend.style.display = 'none';
            if (viewWorldbook) viewWorldbook.style.display = 'none';
            if (viewWorldSense) viewWorldSense.style.display = 'none';
            if (viewMoments) viewMoments.style.display = 'flex';
            
            // 隐藏底栏 (因为朋友圈页顶部有自己的返回按钮)
            if (bottomTabBar) bottomTabBar.style.display = 'none';

            // ★ 从探索页进入时永远先看公共动态流；个人主页只由头像点击进入。
            STATE.momentsViewMode = 'feed';
            STATE.momentsProfileAuthorId = null;
            STATE.visibleMomentsCount = CONFIG.MOMENTS_PAGE_SIZE;
            
            // 触发朋友圈数据的渲染
            if (typeof this.renderMomentsUI === 'function') {
                this.renderMomentsUI();
            } else if (typeof App.renderMomentsUI === 'function') {
                App.renderMomentsUI();
            }
            // ★ 只有真正进入朋友圈页才算已读；停留在探索页不会提前消掉提示。
            if (typeof App !== 'undefined' && typeof App.markCharacterMomentsSeen === 'function') {
                App.markCharacterMomentsSeen();
            }
        }
    },

    // ... 前一个函数的结束大括号 }, 

    // ============================================
    // ★ 新增函数：渲染视觉预设菜单
    // ============================================
    renderVisionPresetMenu() {
        const presets = STATE.settings.VISION_PRESETS || [];
        const select = this.els.visionPresetSelect;
        
        if (!select) return; // 防止报错

        // 重置下拉框
        select.innerHTML = '<option value="">-- 选择视觉预设 --</option>';
        
        presets.forEach((p, index) => {
            const option = document.createElement('option');
            option.value = index; 
            option.textContent = p.name;
            select.appendChild(option);
        });
    },

    // ... 下一个函数的开始

    // 【6. UI RENDERER】
    renderContacts() {
        if(!this.els.contactContainer) return;
        this.els.contactContainer.innerHTML = ''; // 清空列表

        // 1. 获取 HTML 里的模板
        const template = document.getElementById('tpl-contact-item');
        if (!template) {
            console.error("未找到模板: tpl-contact-item");
            return;
        }

        // ★★★ 联系人排序模式顶部提示 START ★★★
        // 进入排序后先插一个小条，告诉用户当前不是普通点击聊天模式。
        // “完成”按钮也放在这里，避免用户找不到退出排序的地方。
        if (STATE.isContactSortMode) {
            const sortBar = document.createElement('div');
            sortBar.className = 'contact-sort-bar';
            sortBar.innerHTML = '<span>排序模式</span><button type="button" class="contact-sort-done-btn">完成</button>';
            this.els.contactContainer.appendChild(sortBar);
        }
        // ★★★ 联系人排序模式顶部提示 END ★★★

        // ★★★ 联系人置顶显示顺序 START ★★★
        // 置顶联系人排在最前面；每组内部继续尊重 STATE.contacts 里的手动顺序
        const visibleContacts = [
            ...STATE.contacts.filter(c => c.isPinned),
            ...STATE.contacts.filter(c => !c.isPinned)
        ];
        // ★★★ 联系人置顶显示顺序 END ★★★

        visibleContacts.forEach(c => {
            // 2. 克隆模板 (cloneNode(true) 表示深拷贝)
            const clone = template.content.cloneNode(true);

            // 3. 填充数据
            
            // --- A. 填充名字 ---
            clone.querySelector('.contact-name').textContent = c.name;

            // --- B. 处理头像 ---
            const avatarWrapper = clone.querySelector('.avatar-wrapper');
            // 简单判断：如果是 base64 或 http 开头，就是图片，否则是 emoji/文字
            if (c.avatar && (c.avatar.startsWith('data:') || c.avatar.startsWith('http'))) {
                const img = document.createElement('img');
                img.src = c.avatar;
                img.className = 'contact-avatar';
                img.onerror = function() { this.style.display = 'none'; }; // 图片坏了就隐藏
                avatarWrapper.appendChild(img);
            } else {
                const div = document.createElement('div');
                div.className = 'contact-avatar';
                div.textContent = c.avatar || '🌼'; // 默认头像
                avatarWrapper.appendChild(div);
            }

            // --- C. 处理消息预览和红点逻辑 (原逻辑保持不变) ---
            let previewText = "暂无消息";
            let msgCount = 0;
            let showRedDot = false;
            
            const validMsgs = c.history.filter(m => {
                const isTransientError = m.isTransientError === true
                    || (m.asyncJobId && String(m.content || '').startsWith('(发送失败:'));
                return m.role !== 'system' && !isTransientError;
            });
            if (validMsgs.length > 0) {
                const lastMsgObj = validMsgs[validMsgs.length - 1];
                let content = lastMsgObj.content || '';
                
                // 正则去时间戳
                content = content.replace(/^\[(?:[A-Z][a-z]{2}\.\d{1,2}|\d{4}-\d{2}-\d{2})\s\d{2}:\d{2}\]\s/, '');

                // 联系人列表只统计正文气泡，think/thinking/thought 思考块会在聊天页单独渲染，不计入未读红点
                content = content.replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, '').trim();
                if (lastMsgObj.role === 'assistant' && typeof AgentIntentMarkup !== 'undefined') {
                    content = AgentIntentMarkup.strip(content);
                }

                // ==========================================================
                // ★ 新增代码：在这里添加一行，用正则去除Markdown符号 ★
                // 这个表达式会移除星号、井号、下划线、反引号等常见Markdown标记
                content = content.replace(/(\*\*|__|\*|_|#|`|>{1,}\s|- |\d+\.\s|\[(.*?)\]\((.*?)\)|!\[(.*?)\]\((.*?)\))/g, '');
                // ==========================================================

                // 拆分段落
                const chunks = splitMessageIntoBubbleParts(content);

                if (chunks.length > 0) {
                    let lastChunk = chunks[chunks.length - 1];
                    previewText = lastChunk.length > 30 ? lastChunk.slice(0, 30) + '…' : lastChunk;
                    msgCount = chunks.length;
                    
                    // ★ 修改逻辑：
                    // 必须同时满足两个条件：
                    // 1. 最后一条是 AI 发的
                    // 2. 角色身上有 "hasNewMsg" 标记
                    if (lastMsgObj.role === 'assistant' && c.hasNewMsg === true) {
                        showRedDot = true;
                    }
                }
            }

            // 填入预览文字
            clone.querySelector('.contact-preview').textContent = previewText;

            // --- D. 处理红点显示 ---
            const badge = clone.querySelector('.badge-count');
            if (showRedDot && msgCount > 0) {
                badge.textContent = msgCount;
                badge.style.display = 'block'; // 显示
            } else {
                badge.style.display = 'none'; // 隐藏
            }

            // --- E. 绑定点击事件 ---
            // 注意：clone 是一个 DocumentFragment，不能直接加 onclick
            // 我们需要给里面的 .contact-item 元素加事件
            const itemDiv = clone.querySelector('.contact-item');
            itemDiv.dataset.id = c.id;

            // 置顶项只加样式，不改模板结构；金边样式在 style.css 里控制
            if (c.isPinned) itemDiv.classList.add('contact-item-pinned');

            // ★★★ 联系人上下箭头排序 START ★★★
            // 排序模式下给每个联系人露出上下箭头；只允许在置顶/普通各自的小组里移动
            if (STATE.isContactSortMode) {
                const sortControls = document.createElement('div');
                sortControls.className = 'contact-sort-controls';

                // 当前联系人所在的小组：置顶联系人只和置顶联系人排，普通联系人只和普通联系人排
                const groupContacts = visibleContacts.filter(item => !!item.isPinned === !!c.isPinned);
                const groupIndex = groupContacts.findIndex(item => item.id === c.id);

                const upBtn = document.createElement('button');
                upBtn.type = 'button';
                upBtn.className = 'contact-sort-btn';
                upBtn.dataset.action = 'move-up';
                upBtn.dataset.id = c.id;
                upBtn.textContent = '↑';
                upBtn.disabled = groupIndex <= 0;
                upBtn.title = '上移';

                const downBtn = document.createElement('button');
                downBtn.type = 'button';
                downBtn.className = 'contact-sort-btn';
                downBtn.dataset.action = 'move-down';
                downBtn.dataset.id = c.id;
                downBtn.textContent = '↓';
                downBtn.disabled = groupIndex >= groupContacts.length - 1;
                downBtn.title = '下移';

                sortControls.appendChild(upBtn);
                sortControls.appendChild(downBtn);
                itemDiv.appendChild(sortControls);
            }
            // ★★★ 联系人上下箭头排序 END ★★★

            itemDiv.onclick = () => {
                // 长按弹出菜单后，移动端有时会补触发一次 click，这里吃掉它
                if (STATE.contactClickLocked) {
                    STATE.contactClickLocked = false;
                    return;
                }
                // 排序模式下点击联系人不进入聊天，只响应右侧上下箭头
                if (STATE.isContactSortMode) return;
                App.enterChat(c.id);
            };

            // 4. 将填好数据的克隆体加入页面
            this.els.contactContainer.appendChild(clone);
        });
    },

    // ★★★ 渲染世界书：大分类下拉框 ★★★
    renderBookSelect() {
        if (!this.els.wiBookSelect) return;
        this.els.wiBookSelect.innerHTML = '';
        STATE.worldInfoBooks.forEach(book => {
            const opt = document.createElement('option');
            opt.value = book.id;
            opt.innerText = book.name;
            this.els.wiBookSelect.appendChild(opt);
        });
        this.els.wiBookSelect.value = STATE.currentBookId;
        
        // 更新当前书的全局绑定状态
        this.updateCurrentBookSettingsUI();
    },

    updateCurrentBookSettingsUI() {
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!book || !this.els.wiBookScopeSummary) return;

        const scopeIds = App.getWorldInfoBookScopeIds(book);
        if (scopeIds.length === 0) {
            this.els.wiBookScopeSummary.textContent = '全局生效';
            return;
        }

        const names = scopeIds
            .map(id => STATE.contacts.find(c => c.id === id)?.name)
            .filter(Boolean);
        this.els.wiBookScopeSummary.textContent = names.length
            ? names.join('、')
            : `已选 ${scopeIds.length} 个角色`;
    },

    // ★★★ 渲染世界书：条目列表（纯逻辑版）★★★
    renderWorldInfoList() {
        console.trace('🔥 renderWorldInfoList 被调用');  // ← 加这行
        const container = this.els.wiList;
        if (!container) return;
        container.innerHTML = '';

        const currentBook = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!currentBook) return;

        const currentEditingUid = document.getElementById('wi-edit-uid') 
            ? document.getElementById('wi-edit-uid').value 
            : null;

        currentBook.entries.forEach((entry) => {
            const item = document.createElement('div');
            item.classList.add('wi-list-item');

            // 高亮当前编辑中的条目
            if (entry.uid === currentEditingUid) {
                item.classList.add('wi-list-item-active');
            }

            // ★★★ 核心显示逻辑 ★★★
            let displayName = entry.comment || 
                (Array.isArray(entry.keys) && entry.keys.length > 0 ? entry.keys[0] : '未命名条目');

            const typeEmoji = entry.constant ? '📌' : '🔎';
            item.textContent = `${typeEmoji} ${displayName}`;

            item.onclick = () => App.loadWorldInfoEntry(entry.uid);
            container.appendChild(item);
        });
    },



    // ★★★ 初始化世界书 Tab 的数据 ★★★
    initWorldInfoTab() {
        // 1. 渲染大分类，并触发一次列表渲染
        this.renderBookSelect();
        this.renderWorldInfoList();
        App.clearWorldInfoEditor(); 
    },

    
    buildAgentMessageParts(text) {
        const rawParts = splitMessageIntoBubbleParts(text);
        const displayParts = [];

        const pushDisplayPart = part => {
            const previous = displayParts[displayParts.length - 1];
            // ★ 相邻 Agent 调用之间没有正文或分割线时合并展示，实际意图仍逐条保留和执行。
            if (part.type === 'agent' && previous?.type === 'agent') {
                previous.markedIntents.push(...part.markedIntents);
                return;
            }
            displayParts.push(part);
        };

        rawParts.forEach((rawPart, sourcePartIndex) => {
            // ★ 发布后浏览器可能混用新旧脚本；旧版没有 extractMarked 时按同一协议提取，避免聊天页整体中断。
            const markedIntents = typeof AgentIntentMarkup !== 'undefined' && typeof AgentIntentMarkup.extractMarked === 'function'
                ? AgentIntentMarkup.extractMarked(rawPart)
                : (rawPart.match(/『[\s\S]*?』/g) || []);
            const visibleText = typeof AgentIntentMarkup !== 'undefined'
                ? AgentIntentMarkup.strip(rawPart)
                : rawPart.trim();

            if (!markedIntents.length) {
                pushDisplayPart({
                    type: visibleText === '---' ? 'separator' : 'text',
                    text: visibleText,
                    partIndex: sourcePartIndex
                });
                return;
            }

            if (!visibleText) {
                // ★ 独立成段的『』和 --- 一样直接占据原文位置，不生成空白聊天气泡。
                pushDisplayPart({ type: 'agent', markedIntents });
                return;
            }

            // ★ 极少数正文与『』写在同一段时，根据标记位于段首或段尾，放到最接近的气泡边缘。
            const firstMarkerIndex = rawPart.indexOf(markedIntents[0]);
            const leadingText = rawPart.slice(0, Math.max(0, firstMarkerIndex)).trim();
            if (!leadingText) pushDisplayPart({ type: 'agent', markedIntents });
            pushDisplayPart({ type: 'text', text: visibleText, partIndex: sourcePartIndex });
            if (leadingText) pushDisplayPart({ type: 'agent', markedIntents });
        });

        // ★ Agent 面板虽然不可选，仍然占据原文段落索引；后续气泡必须保存真实源索引，避免删除/隐藏错位。
        return { displayParts, sourcePartCount: rawParts.length };
    },

    createAgentCallPanel(markedIntents, contactName, shouldAnimate = false) {
        const intents = (markedIntents || []).filter(Boolean);
        if (!intents.length) return null;

        // ★ Agent 面板与 --- 分割线同为 message-group 的直属子元素，因此可以脱离头像和普通气泡独立居中。
        const details = document.createElement('details');
        details.className = 'agent-call-panel';
        if (shouldAnimate) details.classList.add('agent-call-panel-enter');

        const summary = document.createElement('summary');
        summary.className = 'agent-call-summary';
        const label = document.createElement('span');
        label.className = 'agent-call-label';
        label.textContent = `[${contactName || '角色'}调用了Agent]`;
        summary.appendChild(label);

        const content = document.createElement('div');
        content.className = 'agent-call-content';
        intents.forEach(intent => {
            const item = document.createElement('div');
            item.className = 'agent-call-item';
            item.textContent = intent;
            content.appendChild(item);
        });

        // ★ 点击文本框即可收起；用户正在划选调用内容时保持展开，方便复制。
        content.addEventListener('click', () => {
            if (window.getSelection().toString().length > 0) return;
            details.removeAttribute('open');
        });

        details.append(summary, content);
        return details;
    },

    createSingleBubble(text, sender, aiAvatarUrl, timestampRaw, historyIndex, shouldAnimate = true, partIndex = 0, imageUrl = null, isThought = false) {
        const template = document.getElementById('msg-template');
        const clone = template.content.cloneNode(true);
        
        const wrapper = clone.querySelector('.message-wrapper');
        const bubble = clone.querySelector('.message-bubble');
        const timeSpan = clone.querySelector('.msg-time');
        const avatarImg = clone.querySelector('.avatar-img');
        const avatarText = clone.querySelector('.avatar-text');

        wrapper.classList.add(sender);

        // 1. 设置文本
        // 1. 设置文本 (★★★ 新增：判断是否为思考过程 ★★★)
        if (isThought) {
            bubble.innerHTML = `
                <details class="thought-process">
                    <summary></summary>
                    <div class="thought-content">${text}</div>
                </details>
            `;
            // 给它一个特殊类名，方便以后做额外处理（比如过滤复制等）
            bubble.classList.add('is-thought-bubble');

            // ★★★ 新增：点击内容区关闭气泡（同时兼容防误触复制） ★★★
            const detailsEl = bubble.querySelector('details');
            const contentEl = bubble.querySelector('.thought-content');
            
            contentEl.addEventListener('click', (e) => {
                // 如果用户当前划选了文字准备复制，不要关闭气泡
                if (window.getSelection().toString().length > 0) {
                    return;
                }
                // 否则，移除 open 属性，实现关闭
                detailsEl.removeAttribute('open');
            });
            // ★★★ 结束：点击内容区关闭气泡（同时兼容防误触复制）结束 ★★★



        } else {
            bubble.innerHTML = text; 
        }

        // 含代码窗口的消息需要占用稳定宽度，避免长代码参与气泡的固有宽度计算
        if (bubble.querySelector('.code-block')) {
            wrapper.classList.add('has-code-block');
        }



        
        // 2. ★★★ 插入图片 ★★★
        // 2. ★★★ 插入图片 (含过期处理) ★★★
        if (imageUrl) {
            // ★ 分支 A：图片已过期
            if (imageUrl === 'expired') {
                const placeholder = document.createElement('div');
                placeholder.className = 'expired-image-placeholder';
                // 这里你可以自定义显示的文字和 Emoji
                placeholder.innerHTML = '🍂 图片已清理'; 
                
                // 只有文本不为空时，才加 margin-top
                if (text) placeholder.style.marginTop = '8px';
                
                bubble.appendChild(placeholder);
            } 
            // ★ 分支 B：正常图片
            else {
                const imgEl = document.createElement('img');
                imgEl.src = imageUrl;
                imgEl.className = 'chat-message-image'; // 使用之前 CSS 定义的类
                
                // 判断：如果有文本，图片上面要留点空隙
                const marginTop = text ? '8px' : '0';
                imgEl.style.marginTop = marginTop;

                // ★★★ 核心修改：点击事件加判断 ★★★
                imgEl.onclick = (e) => {
                    // 如果处于多选模式，什么都不做，让事件冒泡给 chatMsgs 的处理器去处理选中
                    if (STATE.isSelectMode) return; 

                    // 否则，阻止冒泡并打开灯箱
                    e.stopPropagation();
                    this.openImageLightbox(imageUrl);
                };


                bubble.appendChild(imgEl);
            }
        }
        
        // 3. 动效
        if (shouldAnimate) wrapper.classList.add('bubble-enter'); 

        // 4. 绑定索引
        bubble.dataset.msgIndex = historyIndex;
        bubble.dataset.partIndex = partIndex; 
        bubble.className += ' selectable-message';

        // 5. 时间
        let timeStr = "";
        if (timestampRaw && timestampRaw.includes(' ')) {
            timeStr = timestampRaw.split(' ')[1]; 
        } else {
            const n = new Date();
            timeStr = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
        }
        timeSpan.innerText = timeStr;

        // 6. 头像
        let currentAvatar = sender === 'user' ? (STATE.settings.USER_AVATAR || CONFIG.DEFAULT.USER_AVATAR) : (aiAvatarUrl || '🌸');
        const isImage = currentAvatar.startsWith('http') || currentAvatar.startsWith('data:');
        if (isImage) {
            avatarImg.src = currentAvatar;
            avatarImg.onerror = () => { avatarImg.style.display='none'; avatarText.style.display='flex'; avatarText.innerText='?'; };
            avatarText.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarText.style.display = 'flex'; 
            avatarText.innerText = currentAvatar;
        }

        return clone;
    },

    // ★★★ 新增：简单的图片灯箱 (Lightbox) ★★★
    openImageLightbox(src) {
        // 创建遮罩
        const overlay = document.createElement('div');
        overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: zoom-out; opacity: 0; transition: opacity 0.2s;";
        
        // 创建图片
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = "max-width: 95%; max-height: 95%; object-fit: contain; transition: transform 0.2s;";
        
        overlay.appendChild(img);
        document.body.appendChild(overlay);

        // 动画显示
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });

        // 点击关闭
        overlay.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        };
    },




    // 【6. UI RENDERER】
    showEditModal(oldText, onConfirmCallback) {
        const modal = document.getElementById('msg-edit-modal');
        const textarea = document.getElementById('edit-msg-textarea');
        const btnCancel = document.getElementById('btn-edit-cancel');
        const btnConfirm = document.getElementById('btn-edit-confirm');

        // 1. 填入旧内容
        textarea.value = oldText;

        // 2. 显示弹窗
        modal.style.display = 'flex';
        textarea.focus(); // 自动聚焦

        // 3. 定义关闭函数
        const closeModal = () => {
            modal.style.display = 'none';
            // 清理事件，防止多次绑定导致重复触发
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
        };

        // 4. 绑定按钮事件
        btnCancel.onclick = () => {
            closeModal();
        };

        btnConfirm.onclick = () => {
            const newText = textarea.value;
            // 调用回调函数，把新文本传回去
            if (onConfirmCallback) onConfirmCallback(newText);
            closeModal();
        };
    },

    // 【6. UI RENDERER】
    removeLatestAiBubbles() {
        const container = this.els.chatMsgs;
        
        // 获取最后一个元素
        const lastEl = container.lastElementChild;
        if (!lastEl) return;

        // 判断身份
        const isAiGroup = lastEl.dataset.sender === 'ai'; 
        const isAiBubble = lastEl.classList.contains('ai'); // 兼容旧代码

        // 只要最后一个是 AI 发的，就删掉这一个（因为这一个里面包含了整组切分后的句子）
        if (isAiGroup || isAiBubble) {
            lastEl.remove();
            // 关键：不要用 while 循环，删一次就够了！
        }
    },


    // 渲染历史记录
// 渲染历史记录
    renderChatHistory(contact, isLoadMore = false, keepScrollPosition = false) {
        const chatMsgs = this.els.chatMsgs;
        const scrollContainer = chatMsgs.parentElement; 

        // ★★★ 1. 只有在“首次完全加载”且“不是跳转模式”时，才隐藏界面，防止闪烁 ★★★
        if (!isLoadMore && !keepScrollPosition && STATE.chatMode !== 'jump') {
            chatMsgs.style.opacity = '0'; 
        }

        let previousScrollHeight = 0;
        let previousScrollTop = 0;
        if (isLoadMore) {
            previousScrollHeight = scrollContainer.scrollHeight;
            previousScrollTop = scrollContainer.scrollTop;
        }

        chatMsgs.innerHTML = '';
        this.updateChatHeader(contact);

        const totalMsgs = contact.history.length;
        
        // ============================================
        // ★★★ 新增：根据当前模式计算渲染范围 ★★★
        // ============================================
        let startIndex, endIndex;
        if (STATE.chatMode === 'jump') {
            startIndex = STATE.jumpStartIndex;
            endIndex = STATE.jumpEndIndex;
        } else {
            endIndex = totalMsgs;
            startIndex = totalMsgs - STATE.visibleMsgCount;
            if (startIndex < 0) startIndex = 0;
        }

        // ============================================
        // ★★★ 修改：渲染顶部的“加载更早/更多消息”按钮 ★★★
        // ============================================
        if (startIndex > 0) {
            const loadPrevBtn = document.createElement('div');
            loadPrevBtn.className = 'load-more-btn';
            loadPrevBtn.innerText = STATE.chatMode === 'jump' ? '点击加载更早消息' : '点击加载更多消息';
            loadPrevBtn.onclick = () => {
                if (STATE.chatMode === 'jump') {
                    STATE.jumpStartIndex = Math.max(0, STATE.jumpStartIndex - CONFIG.CHAT_PAGE_SIZE);
                } else {
                    STATE.visibleMsgCount += CONFIG.CHAT_PAGE_SIZE;
                }
                this.renderChatHistory(contact, true);
            };
            chatMsgs.appendChild(loadPrevBtn);
        }

        // 遍历并渲染消息 (基于计算好的范围)
        for (let i = startIndex; i < endIndex; i++) {
            const msg = contact.history[i];
            const historyIndex = i; 

            if (msg.role === 'system') continue;
            
            const sender = msg.role === 'assistant' ? 'ai' : 'user';
            let cleanText = typeof msg === 'string' ? msg : msg.content || '';

            // ★ 主动消息的正文时间戳只给角色上下文和编辑功能使用；气泡本身继续使用 timestamp 字段展示时间。
            if (typeof msg !== 'string' && msg.proactiveSource && typeof ProactiveMessages !== 'undefined') {
                cleanText = ProactiveMessages.displayContent(msg, cleanText);
            }
            
            // 处理 User 时间戳
            if (sender === 'user') {
                cleanText = cleanText.replace(/^\[(?:[A-Z][a-z]{2}\.\d{1,2}|\d{4}-\d{2}-\d{2})\s\d{2}:\d{2}\]\s/, '');
            }

            // 处理 AI 引用格式
            if (sender === 'ai') {
                 cleanText = normalizeChatQuoteBreaks(cleanText);
            }

            const msgTime = typeof msg === 'string' ? null : msg.timestamp;

            // 提取历史消息中的思考过程
            let thoughtContent = null;
            if (sender === 'ai') {
                cleanText = cleanText.replace(/<(?:think|thinking|thought)>([\s\S]*?)<\/(?:think|thinking|thought)>/gi, (match, inner) => {
                    thoughtContent = inner.trim();
                    return '';
                });
            }

            let displayImage = null; 
            if (msg.images && msg.images.length > 0) {
                displayImage = msg.images[0];
            } else if (msg.isImageExpired) {
                displayImage = 'expired'; 
            }

            const plainParts = sender === 'ai' ? [] : splitMessageIntoBubbleParts(cleanText);
            const messageLayout = sender === 'ai'
                ? this.buildAgentMessageParts(cleanText)
                : {
                    displayParts: plainParts.map((text, partIndex) => ({
                        type: text.trim() === '---' ? 'separator' : 'text',
                        text,
                        partIndex
                    })),
                    sourcePartCount: plainParts.length
                };
            const group = document.createElement('div');
            group.className = 'message-group';

            if (msg.isHidden) group.classList.add('is-hidden'); 
            group.dataset.msgIndex = historyIndex;
            group.dataset.sender = sender;
            const hiddenIndices = msg.hiddenIndices || [];

            // ===============================================
            // ★★★ 新增：如果是跳转查找到的目标，给最外层容器加 ID ★★★
            // ===============================================
            if (STATE.chatMode === 'jump' && historyIndex === STATE.targetHighlightIndex) {
                group.id = `msg-bubble-${historyIndex}`;
            }

            // 优先渲染思考气泡；外观开关只控制 UI，不改历史里的 <think> 原文
            if (thoughtContent && STATE.settings.HIDE_THOUGHT_PROCESS !== true) {
                 const formattedThought = parseCustomMarkdown(thoughtContent);
                 const thoughtBubble = this.createSingleBubble(
                     formattedThought, sender, contact.avatar, msgTime, historyIndex, false, 'thought', null, true
                 );
                 if (msg.isHidden || hiddenIndices.includes('thought')) {
                     thoughtBubble.querySelector('.message-bubble').classList.add('is-hidden-bubble');
                 }
                 group.appendChild(thoughtBubble);
            }
            
            // 第一步：按原文顺序渲染【文字气泡 / 分割线 / Agent 调用面板】
            if (messageLayout.displayParts.length > 0) {
                messageLayout.displayParts.forEach(part => {
                    if (part.type === 'separator') {
                        const separator = document.createElement('div');
                        separator.className = 'chat-separator'; 
                        group.appendChild(separator);
                    } else if (part.type === 'agent') {
                        const agentCallPanel = this.createAgentCallPanel(part.markedIntents, contact.name, false);
                        if (agentCallPanel) group.appendChild(agentCallPanel);
                    } else {
                        const formattedContent = parseCustomMarkdown(part.text.trim());
                        const bubbleClone = this.createSingleBubble(
                            formattedContent, sender, contact.avatar, msgTime, historyIndex, false, part.partIndex, null
                        );

                        if (hiddenIndices.includes(part.partIndex)) {
                            bubbleClone.querySelector('.message-bubble').classList.add('is-hidden-bubble');
                        }
                        group.appendChild(bubbleClone);
                    }
                });
            } else if (!displayImage) {
                const formattedContent = parseCustomMarkdown(cleanText.trim());
                const bubbleClone = this.createSingleBubble(formattedContent, sender, contact.avatar, msgTime, historyIndex, false, 0, null);
                group.appendChild(bubbleClone);
            }

            // 第二步：如果有图，在最后单独追加一个【图片气泡】
            if (displayImage) {
                const imgPartIndex = messageLayout.sourcePartCount;
                const imgBubble = this.createSingleBubble(
                    "", sender, contact.avatar, msgTime, historyIndex, false, imgPartIndex, displayImage
                );
                if (hiddenIndices.includes(imgPartIndex) || msg.isHidden) {
                    imgBubble.querySelector('.message-bubble').classList.add('is-hidden-bubble');
                }
                group.appendChild(imgBubble);
            }

            chatMsgs.appendChild(group);
        }

        // ============================================
        // ★★★ 新增：渲染底部的“加载更新消息”按钮 (仅跳转模式) ★★★
        // ============================================
        if (STATE.chatMode === 'jump') {
            if (endIndex < totalMsgs) {
                const loadNextBtn = document.createElement('div');
                loadNextBtn.className = 'load-next-btn';
                loadNextBtn.innerText = '点击加载更新消息';
                loadNextBtn.onclick = () => {
                    STATE.jumpEndIndex = Math.min(totalMsgs, STATE.jumpEndIndex + CONFIG.CHAT_PAGE_SIZE);
                    // 向下加载不保持视口，直接加在末尾让用户可以往下滚
                    this.renderChatHistory(contact, false, true); 
                };
                chatMsgs.appendChild(loadNextBtn);
            } else {
                const backToNormalBtn = document.createElement('div');
                backToNormalBtn.className = 'back-to-normal-btn';
                backToNormalBtn.innerText = '✅ 已到达最新消息 (点击恢复自动滚动)';
                backToNormalBtn.onclick = () => {
                    STATE.chatMode = 'normal';
                    STATE.visibleMsgCount = totalMsgs - startIndex;
                    this.renderChatHistory(contact);
                    this.scrollToBottom();
                };
                chatMsgs.appendChild(backToNormalBtn);
            }
        }


        // ★★★ 2. 滚动与显形处理 ★★★
        if (isLoadMore) {
            // 加载上方更早历史：保持视口当前看到的元素位置不变
            const newScrollHeight = scrollContainer.scrollHeight;
            scrollContainer.scrollTop = newScrollHeight - previousScrollHeight + previousScrollTop;
        } else if (keepScrollPosition) {
            // 保持不动，给加载下方消息用
        } else {
            // 首次加载
            if (STATE.chatMode === 'jump') {
                // 【跳转模式】
                chatMsgs.style.opacity = '1';
                requestAnimationFrame(() => {
                    const targetBubble = document.getElementById(`msg-bubble-${STATE.targetHighlightIndex}`);
                    if (targetBubble) {
                        targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            } else {
                // 【正常模式：恢复丝滑版 🚀】
                
                // 1. 终极武器：强制浏览器在当前帧立刻计算刚刚插入的气泡的真实高度！
                void scrollContainer.offsetHeight; 
                
                // 2. 瞬间触底
                this.scrollToBottom();
                
                // 3. 在下一帧画面真正绘制前，再次确认底部位置，并恢复透明度（触发 CSS 的平滑淡入）
                requestAnimationFrame(() => {
                    this.scrollToBottom(); 
                    chatMsgs.style.opacity = '1'; 
                });
            }
        }

        this.updateRerollState(contact);
    },


/* 1212 - Fixed */
    appendMessageBubble(text, sender, aiAvatarUrl, timestampRaw, historyIndex = null) {
        if (historyIndex === null || historyIndex === undefined) {
            const contact = STATE.contacts.find(c => c.id === STATE.currentContactId);
            if (contact && contact.history.length > 0) {
                historyIndex = contact.history.length - 1; 
            } else {
                historyIndex = 0;
            }
        }

        // ★★★ 修改：最后一个参数传 true，表示新消息需要动画 ★★★
        const clone = this.createSingleBubble(text, sender, aiAvatarUrl, timestampRaw, historyIndex, true, 0);

        const existingGroup = Array.from(this.els.chatMsgs.children)
            .reverse()
            .find(group => group.classList.contains('message-group') && 
                        parseInt(group.dataset.msgIndex) === historyIndex);

        if (existingGroup) {
            existingGroup.appendChild(clone);
        } else {
            const group = document.createElement('div');
            group.className = 'message-group';
            group.dataset.msgIndex = historyIndex; 
            group.dataset.sender = sender;
            group.appendChild(clone);
            this.els.chatMsgs.appendChild(group);
        }

        this.scrollToBottom();
    },

    // 【修改后】插入分割线，支持动效参数
    appendSeparator(shouldAnimate = false) {
        const separator = document.createElement('div');
        separator.className = 'chat-separator';
        
        // 如果需要动画，就加上这个类
        if (shouldAnimate) {
            separator.classList.add('animate');
        }
        
        this.els.chatMsgs.appendChild(separator);
        this.scrollToBottom();
    },

    // ★★★ 修复：增加 forceDelay 参数，解决瞬间获取 scrollHeight 不准确的问题 ★★★
    scrollToBottom() {
        const container = this.els.chatMsgs.parentElement;
        if (!container) return;
        // 不需要任何延迟，瞬间到底
        container.scrollTop = container.scrollHeight;
    },

    // ★★★ 聊天 Header 在线状态：统一管理头像、绿点和“离开/离线”文案 ★★★
    getChatHeaderAvatarSrc(contact) {
        const avatar = String(contact?.avatar || '').trim();
        if (/^(data:image\/|https?:\/\/|blob:|\.\/assets\/|assets\/)/i.test(avatar)) return avatar;
        return './assets/images/char.jpg';
    },

    parseChatTimestampMs(value) {
        if (Number.isFinite(value)) return value;
        const raw = String(value || '').trim();
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        if (!match) return 0;
        const [, yyyy, MM, dd, HH, mm] = match;
        const time = new Date(Number(yyyy), Number(MM) - 1, Number(dd), Number(HH), Number(mm)).getTime();
        return Number.isFinite(time) ? time : 0;
    },

    getContactLastInteractionMs(contact) {
        const saved = Number(contact?.presenceLastActiveAt || 0);
        if (Number.isFinite(saved) && saved > 0) return saved;

        const history = Array.isArray(contact?.history) ? contact.history : [];
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            const time = this.parseChatTimestampMs(msg?.timestamp || msg?.createdAt || msg?.updatedAt);
            if (time) return time;
        }
        return 0;
    },

    touchContactPresence(contact) {
        if (!contact) return;
        contact.presenceLastActiveAt = Date.now();
        this.refreshChatPresence(contact.id);
    },

    getContactPresence(contact, isTyping = false) {
        if (isTyping) return { key: 'typing', text: '对方正在输入' };

        const lastActiveAt = this.getContactLastInteractionMs(contact);
        if (!lastActiveAt) return { key: 'offline', text: '离线' };

        const inactiveMs = Math.max(0, Date.now() - lastActiveAt);
        if (inactiveMs >= this.presenceOfflineAfterMs) return { key: 'offline', text: '离线' };
        if (inactiveMs >= this.presenceAwayAfterMs) return { key: 'away', text: '离开' };
        return { key: 'online', text: '在线' };
    },

    renderContactPresence(contact, isTyping = false) {
        if (!this.els.status) return;
        const presence = this.getContactPresence(contact, isTyping);
        const textEl = this.els.status.querySelector('.presence-text');

        this.els.status.className = `presence-status presence-${presence.key}${presence.key === 'typing' ? ' typing' : ''}`;
        if (textEl) {
            textEl.innerText = presence.text;
        } else {
            this.els.status.innerText = presence.text;
        }
    },

    updateChatHeader(contact) {
        if (!contact) return;
        if (this.els.chatTitle) this.els.chatTitle.innerText = contact.name || '角色名';
        if (this.els.chatAvatar) {
            const fallback = './assets/images/char.jpg';
            const avatarSrc = this.getChatHeaderAvatarSrc(contact);
            this.els.chatAvatar.onerror = () => {
                if (this.els.chatAvatar && !this.els.chatAvatar.src.endsWith('/assets/images/char.jpg')) {
                    this.els.chatAvatar.src = fallback;
                }
            };
            if (this.els.chatAvatar.getAttribute('src') !== avatarSrc) {
                this.els.chatAvatar.src = avatarSrc;
            }
        }
        this.renderContactPresence(contact, STATE.typingContactId === contact.id);
    },

    refreshChatPresence(contactId = STATE.currentContactId) {
        if (!contactId || contactId !== STATE.currentContactId) return;
        const contact = STATE.contacts.find(c => c.id === contactId);
        if (contact) this.renderContactPresence(contact, STATE.typingContactId === contact.id);
    },

    startPresenceTicker() {
        if (this.presenceTicker) return;
        // 每分钟轻量刷新一次，打开聊天页不操作时也能从“在线”自然变成“离开/离线”。
        this.presenceTicker = setInterval(() => this.refreshChatPresence(), 60 * 1000);
    },
    // UI渲染：对方正在输入
    setLoading(isLoading, contactId) { // ★★★ 参数 contactId 依然是必需的
        // 1. 更新全局状态，让程序知道“谁”在输入
        STATE.typingContactId = isLoading ? contactId : null;
        
        // 2. 关键检查：只有当这个状态更新是针对“当前打开的”聊天窗口时，才刷新UI
        if (contactId === STATE.currentContactId) {
            this.els.sendBtn.disabled = isLoading;
            const contact = STATE.contacts.find(c => c.id === contactId);
            this.renderContactPresence(contact, isLoading);
        }
    },

    updateRerollState(contact) {
        const hasHistory = contact.history.some(m => {
            const isTransientError = m.isTransientError === true
                || (m.asyncJobId && String(m.content || '').startsWith('(发送失败:'));
            return m.role === 'assistant' && !isTransientError;
        });
        this.els.rerollBtn.style.opacity = hasHistory ? '1' : '0.5';
        this.els.rerollBtn.disabled = !hasHistory;
    },


    // 在 UI 对象中
    async playWaterfall(fullText, avatar, timestamp, historyIndex, contactName = '') {
        // ★★★ 1. 强制重置滚动状态（新消息开始时默认跟随，除非你不想） ★★★
        this.autoScrollEnabled = true;
        this.scrollToBottom(); // 初始先滚到底一次

        // ============================================
        // ★★★ 新增：前置提取思考过程 (防止被换行符切碎) ★★★
        // ============================================
        let thoughtContent = null;
        let processedText = fullText.replace(/<(?:think|thinking|thought)>([\s\S]*?)<\/(?:think|thinking|thought)>/gi, (match, innerText) => {
            thoughtContent = innerText.trim();
            return ''; // 将思考内容从正文中抹除
        });

        // 1. Pre-process text
        processedText = normalizeChatQuoteBreaks(processedText);
        const messageLayout = this.buildAgentMessageParts(processedText);
        
        // 2. Create the container group
        const group = document.createElement('div');
        group.className = 'message-group';
        group.dataset.sender = 'ai';
        group.dataset.msgIndex = historyIndex;

        this.els.chatMsgs.appendChild(group);
        


        // ============================================
        // ★★★ 新增：优先渲染“思考折叠面板”气泡 ★★★
        // ============================================
        if (thoughtContent && STATE.settings.HIDE_THOUGHT_PROCESS !== true) {
            // 解析里面可能的 Markdown，传入 isThought = true 参数
            const htmlContent = parseCustomMarkdown(thoughtContent);
            const thoughtBubble = this.createSingleBubble(
                htmlContent, 'ai', avatar, timestamp, historyIndex, true, 'thought', null, true
            );
            group.appendChild(thoughtBubble);
            
            if (this.autoScrollEnabled) this.scrollToBottom();
            // 给个小延迟，让动画自然点
            await new Promise(r => setTimeout(r, 400)); 
        }



        // 3. 按原文顺序播放正文、分割线和 Agent 调用面板
        for (let i = 0; i < messageLayout.displayParts.length; i++) {
            const part = messageLayout.displayParts[i];
            if (i > 0) {
                // 第一条立即显示；后续气泡按自身可见文字长度模拟输入时间，并加入轻微随机浮动。
                const bubbleDelayMs = getWaterfallBubbleDelayMs(part.text || '');
                await new Promise(r => setTimeout(r, bubbleDelayMs));
            }

            if (part.type === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'chat-separator animate';
                group.appendChild(separator);
            } else if (part.type === 'agent') {
                const agentCallPanel = this.createAgentCallPanel(part.markedIntents, contactName, true);
                if (agentCallPanel) group.appendChild(agentCallPanel);
            } else {
                const htmlContent = parseCustomMarkdown(part.text.trim());
                // 这里 isThought 默认为 false，正常渲染文本
                const bubbleClone = this.createSingleBubble(htmlContent, 'ai', avatar, timestamp, historyIndex, true, part.partIndex);
                group.appendChild(bubbleClone);
            }
            
            // ★★★ 核心修改：只有在允许滚动时才滚到底部 ★★★
            if (this.autoScrollEnabled) {
                this.scrollToBottom();
            }
        }

    },

    // ================顶栏状态栏-------------------
    initStatusBar() { 
        // 1. 时间显示逻辑
        const timeEl = document.getElementById('sb-time');
        const updateTime = () => {
            const now = new Date();
            // 获取 HH:mm 格式
            const timeStr = now.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            });
            // ★ 秒级检查只为及时跨分钟，显示内容没变时不重复写 DOM。
            if (timeEl && timeEl.textContent !== timeStr) timeEl.textContent = timeStr;
        };
        updateTime(); 
        setInterval(updateTime, 1000); 

        // 2. 电量显示逻辑
        const batTextEl = document.getElementById('sb-battery-text');
        const batLevelEl = document.getElementById('sb-battery-level');
        
        const updateBatteryUI = (level, isCharging) => {
            const percentage = Math.round(level * 100);
            if(batTextEl) batTextEl.textContent = `${percentage}%`;
            if(batLevelEl) {
                batLevelEl.style.width = `${percentage}%`;
                if (isCharging) {
                    batLevelEl.style.backgroundColor = '#a8d94c85';
                } else if (level < 0.2) {
                    batLevelEl.style.backgroundColor = '#ff3b3085';
                } else {
                    batLevelEl.style.backgroundColor = '#4cd96485'; 
                }
            }
        };

        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                updateBatteryUI(battery.level, battery.charging);
                battery.addEventListener('levelchange', () => {
                    updateBatteryUI(battery.level, battery.charging);
                });
                battery.addEventListener('chargingchange', () => {
                    updateBatteryUI(battery.level, battery.charging);
                });
            }).catch(err => {
                console.log('Battery API failed:', err);
            });
        } else {
            console.log('Battery API not supported.');
        }
    }, // <--- 别忘了这里的逗号，因为下面还有 renderPresetMenu

    // ================顶栏状态栏结束-------------------

    // ★★★ API 预设菜单 UI (逻辑修正版) ★★★
    renderPresetMenu() {
        const containerId = 'api-preset-container';
        let container = document.getElementById(containerId);

        if (container) {
            const saveBtn = document.getElementById('save-preset-btn');
            const delBtn = document.getElementById('del-preset-btn');
            const select = document.getElementById('preset-select');

            if(saveBtn) saveBtn.onclick = () => App.handleSavePreset();
            if(delBtn) delBtn.onclick = () => App.handleDeletePreset();
            if(select) select.onchange = (e) => App.handleLoadPreset(e.target.value);

            select.innerHTML = '<option value="">-- 选择 API 预设 --</option>';
            if (STATE.settings.API_PRESETS && Array.isArray(STATE.settings.API_PRESETS)) {
                STATE.settings.API_PRESETS.forEach((p, index) => {
                    const opt = document.createElement('option');
                    opt.value = index;
                    opt.innerText = p.name;
                    select.appendChild(opt);
                });
            }
        }
    },


    // ==================== 请求体参数预设请求头预设请求体预设 ================================
    renderRequestBodyPresetMenu() {
        const select = document.getElementById('request-body-preset-select');
        const saveBtn = document.getElementById('save-request-body-preset-btn');
        const delBtn = document.getElementById('del-request-body-preset-btn');

        if (!select) return;

        if (saveBtn) {
            saveBtn.onclick = () => App.handleSaveRequestBodyPreset();
        }

        if (delBtn) {
            delBtn.onclick = () => App.handleDeleteRequestBodyPreset();
        }

        select.onchange = (e) => App.handleLoadRequestBodyPreset(e.target.value);

        select.innerHTML = '<option value="">-- 选择请求体参数预设 --</option>';

        const presets = STATE.settings.REQUEST_BODY_PRESETS || [];

        presets.forEach((p, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.innerText = p.name;
            select.appendChild(opt);
        });
    },
    // ==================== 请求体参数预设请求头预设请求体预结束 ================================

    // ==================== System Prompt 预设 ================================
    renderSystemPromptPresetMenu() {
        const select = document.getElementById('system-prompt-preset-select');
        const saveBtn = document.getElementById('save-system-prompt-preset-btn');
        const delBtn = document.getElementById('del-system-prompt-preset-btn');
        const restoreBtn = document.getElementById('restore-default-system-prompt-btn');

        if (!select) return;

        if (saveBtn) {
            saveBtn.onclick = () => App.handleSaveSystemPromptPreset();
        }

        if (delBtn) {
            delBtn.onclick = () => App.handleDeleteSystemPromptPreset();
        }

        select.onchange = (e) => App.handleLoadSystemPromptPreset(e.target.value);

        if (restoreBtn) {
            restoreBtn.onclick = () => App.handleRestoreDefaultSystemPrompt();
        }

        select.innerHTML = '<option value="">-- 选择 System Prompt 预设 --</option>';

        const presets = STATE.settings.SYSTEM_PROMPT_PRESETS || [];
        presets.forEach((p, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.innerText = p.name;
            select.appendChild(opt);
        });
    },
    // ==================== System Prompt 预设结束 ================================



    
};















// =========================================
// 7. APP CONTROLLER (业务逻辑)
// =========================================
const App = {
    els: UI.els,
    generateTodoPlanId(prefix = 'todo') {
        const randomText = (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
            .replace(/-/g, '')
            .slice(0, 12);
        return `${prefix}_${Date.now()}_${randomText}`;
    },

    normalizeTodoPlanIds() {
        if (!Array.isArray(STATE.todoPlans)) {
            STATE.todoPlans = [];
            return false;
        }

        let changed = false;
        const seenIds = new Set();

        STATE.todoPlans.forEach((item, index) => {
            if (!item || typeof item !== 'object') return;

            const rawId = typeof item.id === 'string' ? item.id.trim() : '';
            // ★ 旧数据/同毫秒新增可能留下空 id 或重复 id；
            // 点击完成、取消、删除都靠 id 定位，所以首次打开时先把每条计划拆成唯一身份。
            if (!rawId || seenIds.has(rawId)) {
                item.id = this.generateTodoPlanId(`todo_fix_${index}`);
                item.updatedAt = item.updatedAt || Date.now();
                changed = true;
            } else {
                if (item.id !== rawId) changed = true;
                item.id = rawId;
            }

            seenIds.add(item.id);
        });

        return changed;
    },

    // 1. 初始化入口
    async init() {
        // [关键点 1] 加上 await，程序会在这里暂停，直到数据库加载完毕
        await Storage.load();
        // ★ 番茄钟在联系人加载后恢复，旧备份缺少数据时自动使用默认值。
        await Pomodoro.init();
        if (this.normalizeMomentsData()) {
            await Storage.saveMoments();
        }
        if (this.normalizeCharacterMomentStats()) {
            await Storage.saveMomentsSettings();
        }
        if (this.normalizeTodoPlanIds()) {
            await Storage.saveTodoPlans();
        }
        
        // [关键点 2] 初始化界面元素（绑定 DOM 节点）
        UI.init();

        // ★ 建议加这一句，确保 App.els 拿到的是初始化后的最新 DOM 元素
        this.els = UI.els; 
        
        // [关键点 3] 绑定点击事件
        this.bindEvents();
        // ★ 主动消息在联系人和设置加载完成后接管自己的页面事件、Worker 同步与纯前端补发检查。
        await ProactiveMessages.init();
        this.syncAsyncBackendToggle();
        this.syncWorldSenseToggle();
        this.syncTodoContextToggles();
        this.syncAgentHeartNoteToggles();
        this.updateCharacterMomentUnreadDot();
        await this.renderDesktop();
        // ★ 角色日程按“当天一次”补生成：打开页面后排队处理，当前聊天角色会在发送前优先补。
        setTimeout(() => this.ensureEnabledCharacterSchedules({ silent: true }), 0);
        this.startCharacterScheduleDateWatcher();
        // ★ 角色记忆按“昨天一次”补生成：打开页面后串行处理所有已开启角色。
        setTimeout(() => this.ensureEnabledCharacterMemories({ silent: true }), 0);
        this.startCharacterMemoryDateWatcher();
        
        // [关键点 4] ★★★ 新增：数据加载好了，必须手动让 UI 渲染出联系人列表
        // 假设你的 UI 对象里有一个叫 renderContacts 或 renderSidebar 的方法用来画列表
        // 如果你的 UI.init() 里已经包含渲染逻辑，这行也可以省略，但显式调用更保险
        if (typeof UI.renderContacts === 'function') {
            UI.renderContacts();
        }

        // ★ 后台回复接收：启动时检查本地有没有未完成的 job。
        //   如果页面曾经刷新/切回来，这里会尝试把后端已完成的回复写回聊天记录。
        this.resumePendingChatJobs();
        // ★ 角色动态只在数据和事件都准备好后检查；延后一拍，不阻塞首页首次绘制。
        setTimeout(() => this.maybeGenerateCharacterMoment('startup'), 1200);
        
        UI.initStatusBar();
        
        console.log("App initialized, contacts loaded:", STATE.contacts.length);
    },

    // ============================================================
    // ★★★★★ 后台回复接收 START：App 层 ★★★★★
    // 这一组函数负责“页面逻辑”：
    // 1. App 启动后恢复未完成任务；
    // 2. 打开后台回复接收页面时，把设置填进输入框；
    // 3. 点击保存时，把 URL/Token 写入 STATE.settings 和 IndexedDB。
    // ============================================================
    async resumePendingChatJobs() {
        if (this._asyncBackendResuming) {
            // ★ 防止 visibilitychange、pageshow、前台轮询同时触发，重复查询同一个 pending job。
            return API.loadPendingJobs().some(job => job.status !== 'failed');
        }

        this._asyncBackendResuming = true;
        const jobs = API.loadPendingJobs().filter(job => job.status !== 'failed');
        if (!jobs.length) {
            this._asyncBackendResuming = false;
            return false;
        }

        try {
            console.info('[AsyncBackend] resume pending jobs', { pendingCount: jobs.length });
            let hasRunningJob = false;

            for (const pending of jobs) {
                try {
                    if (this.isAsyncBackendJobStale(pending)) {
                        await this.markAsyncBackendJobStale(pending);
                        continue;
                    }

                    console.info('[AsyncBackend] resume lookup', {
                        jobId: API.asyncJobLogId(pending.jobId),
                        contactId: pending.contactId || null
                    });
                    const job = await API.getChatJob(pending.backendUrl, pending.jobId, pending.token);
                    console.info('[AsyncBackend] resume status', {
                        jobId: API.asyncJobLogId(pending.jobId),
                        status: job.status
                    });
                    if (job.status === 'running') {
                        const contact = pending.context && pending.context.scope === 'moments'
                            ? null
                            : STATE.contacts.find(c => c.id === pending.contactId);
                        if (contact) {
                            await this.applyAsyncBackendAgentStage(job, contact);
                        }
                        hasRunningJob = true;
                        continue;
                    }

                    // ★★★★★ 朋友圈后台任务恢复 START ★★★★★
                    // 聊天 pending job 用 contactId 回填；朋友圈没有 contactId，
                    // 所以这里改用创建 job 时保存的 context，知道结果该写回哪条动态/评论。
                    if (pending.context && pending.context.scope === 'moments') {
                        if (job.status === 'done') {
                            const applied = await this.applyAsyncMomentJob(pending.context, job, pending.jobId);
                            await API.deleteChatJob(pending.backendUrl, pending.jobId, pending.token);
                            API.forgetPendingJob(pending.jobId);
                            if (applied) await Storage.saveMoments();
                            this.renderMomentsUI();
                            if (applied && !['regenerate_comment', 'generate_character_moment'].includes(pending.context.type)) {
                                this.showMomentReplyNotice(pending.context.charId);
                            }
                            console.info('[AsyncBackend] resume saved moment result', {
                                jobId: API.asyncJobLogId(pending.jobId),
                                type: pending.context.type || '',
                                applied
                            });
                        } else if (job.status === 'failed') {
                            await this.markAsyncMomentJobFailed(pending.context);
                            API.markPendingJobFailed(pending.jobId, job.error || 'Async moment job failed');
                            this.renderMomentsUI();
                        }
                        continue;
                    }
                    // ★★★★★ 朋友圈后台任务恢复 END ★★★★★

                    const contact = STATE.contacts.find(c => c.id === pending.contactId);
                    if (!contact) {
                        console.warn('[AsyncBackend] resume contact missing, removing pending job', {
                            jobId: API.asyncJobLogId(pending.jobId),
                            contactId: pending.contactId || null
                        });
                        API.forgetPendingJob(pending.jobId);
                        continue;
                    }

                    if (job.status === 'done') {
                        API.updateAsyncBackendLogWithVision(job, pending);
                        API.rememberResumedAsyncJobResult(pending.jobId, job);

                        // ★ 后台任务可能已经完成“去图重试”；恢复链路也要告诉用户，不能只在前台轮询时提示。
                        if (job.multimodal_fallback === true) {
                            API.notifyMultimodalFallback(pending.jobId);
                        }

                        // ★ 后台识图回填：
                        // Worker 完成识图后只返回文字描述，不保存原图。
                        // 这里把描述补回当初那条用户图片消息，保持现有 image_description 字段不变。
                        if (job.image_description && (pending.userMessageId || Number.isInteger(pending.userMessageIndex))) {
                            const imageMsg = pending.userMessageId
                                ? contact.history.find(item => item?.messageId === pending.userMessageId)
                                : contact.history[pending.userMessageIndex];
                            if (imageMsg && imageMsg.role === 'user' && imageMsg.images && !imageMsg.image_description) {
                                imageMsg.image_description = job.image_description;
                            }
                        }

                        if (Array.isArray(job.agent_actions) && job.agent_actions.length) {
                            await this.applyAsyncAgentActions(job.agent_actions, contact);
                        }

                        const alreadySaved = contact.history.some(msg => msg.asyncJobId === pending.jobId);
                        let assistantMessage = null;
                        if (!alreadySaved) {
                            assistantMessage = {
                                role: 'assistant',
                                content: (job.result || '').trim(),
                                timestamp: formatTimestamp(),
                                messageId: ProactiveMessages.makeId('assistant'),
                                eventAt: Date.now(),
                                recordedAt: Date.now(),
                                replyToMessageId: pending.userMessageId || '',
                                asyncJobId: pending.jobId
                            };
                            contact.history.push(assistantMessage);
                        } else {
                            assistantMessage = contact.history.find(msg => msg.asyncJobId === pending.jobId) || null;
                        }

                        // ★ 番茄钟后台恢复沿用请求时保存的快照，不消费后来才完成的新番茄。
                        const pomodoroSource = pending.userMessageId
                            ? contact.history.find(item => item?.messageId === pending.userMessageId)
                            : contact.history[pending.userMessageIndex];
                        await Pomodoro.consume(pending.pomodoroInjection || (pomodoroSource?.role === 'user' ? pomodoroSource.pomodoroInjection : null));

                        // ★★★★★ Post Agent：后台恢复后补跑 START ★★★★★
                        // 轻量方案：Worker 恢复接收只负责保存 assistant 回复；保存后由前端补跑 post-agent。
                        // 预留方案：以后 Worker 如果返回 job.post_agent，则优先消费 Worker 结果，不再前端重跑。
                        if (assistantMessage && assistantMessage.role === 'assistant') {
                            const consumedWorkerPostAgent = await this.consumeWorkerPostAgentResult(contact, assistantMessage, job.post_agent);
                            if (!consumedWorkerPostAgent) {
                                this.runAgentPostAgents(contact, assistantMessage.content || '', assistantMessage).catch(error => {
                                    console.warn('[PostAgent][后台恢复] async failed:', error);
                                });
                            }
                        }
                        // ★★★★★ Post Agent：后台恢复后补跑 END ★★★★★

                        // ★★★ Presence：后台补回来的回复也刷新最后互动时间 ★★★
                        UI.touchContactPresence(contact);

                        if (this.isViewingContactChat(contact.id)) {
                            UI.renderChatHistory(contact);
                            UI.setLoading(false, contact.id);
                        } else {
                            this.markContactIncomingMessage(contact, { notice: !alreadySaved });
                        }

                        await API.deleteChatJob(pending.backendUrl, pending.jobId, pending.token);
                        API.forgetPendingJob(pending.jobId);
                        await Storage.saveContacts();
                        if (!alreadySaved && assistantMessage) {
                            ProactiveMessages.onAssistantMessage(contact).catch(error => console.warn('[主动消息] 后台恢复回复同步失败:', error));
                        }
                        console.info('[AsyncBackend] resume saved result', {
                            jobId: API.asyncJobLogId(pending.jobId),
                            contactId: contact.id,
                            alreadySaved,
                            resultLength: (job.result || '').length
                        });
                    } else if (job.status === 'failed') {
                        API.markPendingJobFailed(pending.jobId, job.error || 'Async job failed');
                        console.warn('[AsyncBackend] resume found failed job', {
                            jobId: API.asyncJobLogId(pending.jobId),
                            error: job.error || 'Async job failed'
                        });
                        if (this.isViewingContactChat(contact.id)) {
                            UI.setLoading(false, contact.id);
                        }
                    }
                } catch (error) {
                    console.warn('[AsyncBackend] resume lookup failed', {
                        jobId: API.asyncJobLogId(pending.jobId),
                        error: error.message
                    });
                    if (error.status === 404) {
                        // ★ Worker 说 job 不存在：通常是 TTL 过期、手动删除、或旧任务残留。
                        // 手机端看不到控制台，所以这里直接清本地 pending，并把当前聊天 loading 停掉，
                        // 避免页面一直显示“接收中”却没有任何可见错误。
                        const contact = pending.contactId
                            ? STATE.contacts.find(c => c.id === pending.contactId)
                            : null;
                        const alreadySaved = contact
                            ? contact.history.some(msg => msg.asyncJobId === pending.jobId)
                            : false;

                        if (contact && this.isViewingContactChat(contact.id)) {
                            UI.setLoading(false, contact.id);
                            if (!alreadySaved) {
                                const errorIndex = contact.history.length > 0 ? contact.history.length - 1 : 0;
                                UI.appendMessageBubble('(后台任务已失效：可能已过期、被清理，或后台地址不是当前 Worker。请重新发送一次。)', 'ai', contact.avatar, null, errorIndex);
                            }
                        } else if (contact && !alreadySaved) {
                            contact.hasNewMsg = true;
                        }

                        API.forgetPendingJob(pending.jobId);
                        if (contact) await Storage.saveContacts();
                        this.renderAsyncBackendPendingJobs();
                        continue;
                    }
                    // 手机刚切回来时，网络栈可能还没完全恢复；这类查询失败先保留 pending，稍后再查。
                    if (API.isAsyncBackendRecoverablePollError(error)) {
                        hasRunningJob = true;
                    }
                }
            }

            UI.renderContacts();
            this.renderAsyncBackendPendingJobs();
            return hasRunningJob;
        } finally {
            this._asyncBackendResuming = false;
        }
    },

    isAsyncBackendJobStale(pending) {
        const createdAt = Number(pending?.createdAt || 0);
        if (!createdAt) return false;
        return Date.now() - createdAt > 30 * 60 * 1000;
    },

    async markAsyncBackendJobStale(pending) {
        // ★ 30 分钟还停在 running，通常说明 Worker 或上游模型请求已经卡死。
        // 前端停止继续轮询，避免用户切回页面后一直刷“running”。
        const message = '后台任务超过 30 分钟仍未完成，可能已经卡住。请重新发送，或换模型/减少上下文后再试。';
        console.warn('[AsyncBackend] pending job stale', {
            jobId: API.asyncJobLogId(pending.jobId),
            contactId: pending.contactId || null
        });

        if (pending.context && pending.context.scope === 'moments') {
            await this.markAsyncMomentJobFailed(pending.context);
            API.markPendingJobFailed(pending.jobId, message);
            this.renderMomentsUI();
            this.renderAsyncBackendPendingJobs();
            return;
        }

        const contact = STATE.contacts.find(c => c.id === pending.contactId);
        if (contact && !contact.history.some(msg => msg.asyncJobId === pending.jobId)) {
            contact.history.push({
                role: 'assistant',
                content: `(发送失败: ${message})`,
                timestamp: formatTimestamp(),
                asyncJobId: pending.jobId,
                isTransientError: true
            });
            if (this.isViewingContactChat(contact.id)) {
                UI.setLoading(false, contact.id);
                UI.renderChatHistory(contact);
            } else {
                this.markContactIncomingMessage(contact, { notice: false });
            }
            await Storage.saveContacts();
        }

        API.markPendingJobFailed(pending.jobId, message);
        this.renderAsyncBackendPendingJobs();
    },

    scheduleAsyncBackendResumeCheck(delayMs = 2500) {
        clearTimeout(this._asyncBackendResumeTimer);

        // ★★★★★ 后台回复接收：回前台补轮询 START ★★★★★
        // 如果手机切后台时轮询被浏览器杀掉，handleSend 会先停止前台 loading，
        // 但 pending job 仍然记在 localStorage。这里用很轻的定时检查接上后半程：
        // 只查 Worker 里的 job 状态，不重新发送用户消息，也不会重复写入同一个 asyncJobId。
        this._asyncBackendResumeTimer = setTimeout(async () => {
            try {
                const hasRunningJob = await this.resumePendingChatJobs();
                if (hasRunningJob) {
                    this.scheduleAsyncBackendResumeCheck(document.hidden ? 10000 : 3000);
                }
            } catch (error) {
                console.warn('[AsyncBackend] scheduled resume failed:', error);
                this.scheduleAsyncBackendResumeCheck(document.hidden ? 10000 : 5000);
            }
        }, delayMs);
        // ★★★★★ 后台回复接收：回前台补轮询 END ★★★★★
    },

    // ★★★★★ 朋友圈后台回复接收 START ★★★★★
    // 朋友圈没有聊天页的 contactId + history，所以必须在 pending context 里记录回填位置。
    // Worker 只负责生成文本；回到前端后，这里根据 context 写回对应动态或评论。
    async applyAsyncMomentJob(context, job, jobId) {
        // ★ 角色发动态没有预先存在的 momentId，要先解析 JSON 并创建动态，再走其它评论回填分支。
        if (context?.type === 'generate_character_moment') {
            try {
                return await this.saveCharacterMomentFromResponse(
                    context.charId,
                    job.result || '',
                    context.windowStart,
                    context.windowEnd || Date.now(),
                    jobId
                );
            } catch (error) {
                // ★ 后台返回了非法 JSON 时直接丢弃本次结果，避免同一个完成任务每次启动都重复解析失败。
                console.warn('[朋友圈] 后台角色动态校验失败:', error);
                return false;
            }
        }

        const moment = STATE.moments.find(item => item.id === context.momentId);
        if (!moment) return false;

        const text = String(job.result || '').replace(/<(?:think|thinking|thought)>[\s\S]*?<\/(?:think|thinking|thought)>/gi, '').trim();
        if (!text) return false;

        if (context.type === 'regenerate_comment') {
            const comment = (moment.comments || []).find(item => item.id === context.commentId);
            if (!comment) return false;
            if (comment.asyncJobId === jobId && comment.text !== '...重新生成中...') return false;
            comment.text = text;
            comment.asyncJobId = jobId;
            comment.updatedAt = Date.now();
            return true;
        }

        const alreadySaved = (moment.comments || []).some(item => item.asyncJobId === jobId);
        if (alreadySaved) return false;

        if (!Array.isArray(moment.comments)) moment.comments = [];
        const newComment = {
            id: context.commentId || ('c_' + Date.now() + Math.random().toString(36).substr(2, 5)),
            senderId: context.charId,
            text,
            timestamp: Date.now(),
            asyncJobId: jobId
        };
        if (context.replyToId) newComment.replyToId = context.replyToId;
        if (context.replyToName) newComment.replyToName = context.replyToName;
        moment.comments.push(newComment);
        return true;
    },

    async markAsyncMomentJobFailed(context) {
        if (!context || context.type !== 'regenerate_comment') return false;
        const moment = STATE.moments.find(item => item.id === context.momentId);
        const comment = moment?.comments?.find(item => item.id === context.commentId);
        if (comment && context.originalText) {
            comment.text = context.originalText;
            await Storage.saveMoments();
            return true;
        }
        return false;
    },

    buildMomentsAsyncContext(type, data) {
        return {
            scope: 'moments',
            type,
            ...data
        };
    },

    applyAsyncBackendToMomentConfig(config, context) {
        return {
            ...config,
            ASYNC_BACKEND_ENABLED: STATE.settings.ASYNC_BACKEND_ENABLED !== false,
            ASYNC_BACKEND_URL: STATE.settings.ASYNC_BACKEND_URL || '',
            ASYNC_BACKEND_TOKEN: STATE.settings.ASYNC_BACKEND_TOKEN || '',
            ASYNC_BACKEND_KEY_MODE: STATE.settings.ASYNC_BACKEND_KEY_MODE || CONFIG.DEFAULT.ASYNC_BACKEND_KEY_MODE || 'client_key',
            ASYNC_BACKEND_TTL_HOURS: STATE.settings.ASYNC_BACKEND_TTL_HOURS || CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS,
            ASYNC_BACKEND_CONTEXT: context
        };
    },
    // ★★★★★ 朋友圈后台回复接收 END ★★★★★

    // ★★★★★ 桌面 START：页面渲染与小组件交互 ★★★★★
    // 桌面只做“看一眼今天”的聚合展示；
    // 具体编辑入口仍然回到 TODO、倒数日、世界感知、后台接收这些原页面里。
    getDesktopDateKey(date = new Date()) {
        return (typeof TodoContext !== 'undefined' && TodoContext.toDateKey)
            ? TodoContext.toDateKey(date)
            : date.toISOString().slice(0, 10);
    },

    startDesktopClock() {
        if (STATE.desktopClockTimer) return;
        STATE.desktopClockTimer = setInterval(() => {
            // ★ 每分钟只做一次轻量缓存检查：
            // 平时不会发请求，跨过 0 点或 12 点后才会补刷新时段的天气。
            Promise.resolve(this.ensureWorldSenseWeatherReady())
                .catch(error => console.warn('[Desktop] weather slot check failed:', error))
                .finally(() => this.updateDesktopClock());
        }, 60 * 1000);
    },

    async renderDesktop() {
        this.startDesktopClock();
        STATE.desktopLastDateKey = this.getDesktopDateKey();

        // 天气按每天 0 点 / 12 点两个时段缓存；错过整点时，打开网页后补刷当前时段。
        if (typeof this.ensureWorldSenseWeatherReady === 'function') {
            await this.ensureWorldSenseWeatherReady();
        }

        this.updateDesktopClock();
        this.renderDesktopSignature();
        this.renderDesktopCountdown();
        this.renderDesktopTodo();
        this.renderDesktopRecentContacts();
        this.renderDesktopSwitches();
        this.renderDesktopCloudSyncStatus();
        this.renderDesktopActivity();
        this.renderDesktopAsyncStatus();
    },

    updateDesktopClock() {
        const now = new Date();
        const timeEl = document.getElementById('desktop-time');
        const dateEl = document.getElementById('desktop-date-line');
        const lunarEl = document.getElementById('desktop-lunar-line');
        const weatherEl = document.getElementById('desktop-weather-line');
        const weatherTempEl = document.getElementById('desktop-weather-temp-line');

        if (timeEl) {
            timeEl.textContent = `${TodoContext.pad(now.getHours())}:${TodoContext.pad(now.getMinutes())}`;
        }

        if (dateEl) {
            const dateText = `${now.getFullYear()}-${TodoContext.pad(now.getMonth() + 1)}-${TodoContext.pad(now.getDate())}`;
            const weekText = WorldSense.weekNameMap[now.getDay()] || '';
            dateEl.textContent = `${dateText} ${weekText}`;
        }

        if (lunarEl) {
            lunarEl.textContent = `农历 ${WorldSense.formatLunarText(now)}`;
        }

        if (weatherEl) {
            const settings = STATE.settings || {};
            const cache = settings.WORLD_SENSE_WEATHER_CACHE;
            if (settings.WORLD_SENSE_ENABLED === true && settings.WORLD_SENSE_WEATHER_ENABLED === true && cache) {
                const cityText = cache.cityName || cache.cityQuery || '';
                const weatherText = cache.weatherText || '';
                weatherEl.textContent = [cityText, weatherText].filter(Boolean).join('，');
                if (weatherTempEl) weatherTempEl.textContent = `${cache.tempMin}~${cache.tempMax}℃`;
            } else {
                weatherEl.textContent = '天气未开启';
                if (weatherTempEl) weatherTempEl.textContent = '--℃';
            }
        }
    },

    refreshDesktopWorldSenseWidgets() {
        // ★ 世界感知设置可能在详情页里即时保存：
        // 桌面不一定正在显示，但这里顺手刷新 DOM，避免回到桌面后还停在旧的“天气未开启”。
        this.updateDesktopClock();
        this.renderDesktopSwitches();
    },

    renderDesktopSignature() {
        const textEl = document.getElementById('desktop-signature-text');
        if (!textEl) return;
        const text = (STATE.settings.DESKTOP_SIGNATURE || '').trim() || '写一句只放在桌面的签名...';
        textEl.textContent = `- ${text} -`;
    },

    renderDesktopCountdown() {
        const downEl = document.getElementById('desktop-countdown-down');
        const upEl = document.getElementById('desktop-countdown-up');
        if (!downEl || !upEl) return;

        const items = (STATE.countdownDays || []).filter(item => item && item.text && item.done !== true);
        const down = items
            .filter(item => item.mode === 'down')
            .sort((a, b) => Math.abs(TodoContext.diffDays(a.dateKey)) - Math.abs(TodoContext.diffDays(b.dateKey)))[0];
        const up = items
            .filter(item => item.mode === 'up')
            .sort((a, b) => Math.abs(TodoContext.diffDays(a.dateKey)) - Math.abs(TodoContext.diffDays(b.dateKey)))[0];

        downEl.textContent = down ? this.formatDesktopCountdownText(down) : '暂无倒数日';
        upEl.textContent = up ? this.formatDesktopCountdownText(up) : '暂无正数日';
    },

    formatDesktopCountdownText(item) {
        const diff = TodoContext.diffDays(item.dateKey);
        if (item.mode === 'up') {
            return `${item.text} 已经 ${Math.max(0, -diff)} 天`;
        }
        return diff >= 0
            ? `${item.text} 还有 ${diff} 天`
            : `${item.text} 已过 ${Math.abs(diff)} 天`;
    },

    renderDesktopTodo() {
        const list = document.getElementById('desktop-todo-list');
        const countEl = document.getElementById('desktop-todo-count');
        if (!list) return;

        const activePlans = (STATE.todoPlans || [])
            .filter(item => item && item.text && item.cancelled !== true && item.done !== true)
            .sort((a, b) => {
                if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
                return TodoContext.compareTodoPlans(a, b);
            });

        const visible = activePlans.slice(0, 2);
        if (countEl) countEl.textContent = `${activePlans.length} 项待办`;
        list.innerHTML = '';

        if (!visible.length) {
            list.innerHTML = '<div class="desktop-todo-empty">今天先空着也很好。</div>';
            return;
        }

        visible.forEach(item => {
            const row = document.createElement('label');
            row.className = 'desktop-todo-item';
            row.innerHTML = `
                <input type="checkbox" data-id="${this.escapeHtml(item.id)}">
                <span class="desktop-todo-text">${this.escapeHtml(item.text)}</span>
            `;
            list.appendChild(row);
        });
    },

    renderDesktopRecentContacts() {
        const container = document.getElementById('desktop-recent-contacts');
        if (!container) return;

        // ★ 最近联系人：优先按最后一条非 system 消息排序；
        // 没有聊天记录的角色排在后面，但仍然可以作为快捷入口显示。
        const contacts = (STATE.contacts || [])
            .map((contact, index) => ({
                contact,
                index,
                lastTime: this.getDesktopContactLastTime(contact)
            }))
            .sort((a, b) => {
                if (a.lastTime !== b.lastTime) return b.lastTime - a.lastTime;
                return a.index - b.index;
            })
            .slice(0, 3)
            .map(item => item.contact);

        container.innerHTML = '';
        if (!contacts.length) {
            container.innerHTML = '<span class="desktop-recent-empty">还没有联系人</span>';
            return;
        }

        contacts.forEach(contact => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'desktop-recent-avatar';
            btn.dataset.id = contact.id;
            btn.title = contact.name || '联系人';

            if (contact.avatar && (contact.avatar.startsWith('data:') || contact.avatar.startsWith('http'))) {
                const img = document.createElement('img');
                img.src = contact.avatar;
                img.alt = contact.name || '联系人';
                img.onerror = () => {
                    btn.textContent = (contact.name || '?').slice(0, 1);
                };
                btn.appendChild(img);
            } else {
                btn.textContent = contact.avatar || (contact.name || '?').slice(0, 1);
            }

            if (this.shouldShowDesktopUnreadDot(contact)) {
                // 桌面头像只给一个小信号，计数仍然留给联系人列表自己展示。
                const dot = document.createElement('span');
                dot.className = 'desktop-recent-unread-dot';
                btn.appendChild(dot);
            }

            container.appendChild(btn);
        });
    },

    shouldShowDesktopUnreadDot(contact) {
        if (!contact || contact.hasNewMsg !== true) return false;
        const validMsgs = Array.isArray(contact.history)
            ? contact.history.filter(msg => msg && msg.role !== 'system')
            : [];
        const lastMsg = validMsgs[validMsgs.length - 1];
        return lastMsg?.role === 'assistant';
    },

    refreshDesktopUnreadDotsIfNeeded() {
        // 联系人页和桌面各有自己的红点容器；人在桌面时，只刷新最近联系人头像即可。
        if (STATE.currentMainView === 'desktop') {
            this.renderDesktopRecentContacts();
        }
    },

    getDesktopContactLastTime(contact) {
        const history = Array.isArray(contact?.history) ? contact.history : [];
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            if (!msg || msg.role === 'system') continue;
            const raw = msg.timestamp || msg.createdAt || msg.updatedAt || 0;
            const time = typeof raw === 'number' ? raw : Date.parse(raw);
            return Number.isFinite(time) ? time : i + 1;
        }
        return 0;
    },

    renderDesktopSwitches() {
        const map = [
            ['desktop-switch-world-sense', STATE.settings.WORLD_SENSE_ENABLED === true],
            ['desktop-switch-todo', STATE.settings.TODO_PLAN_INJECT_ENABLED === true],
            ['desktop-switch-countdown', STATE.settings.COUNTDOWN_INJECT_ENABLED === true],
            ['desktop-switch-async', STATE.settings.ASYNC_BACKEND_ENABLED !== false]
        ];
        map.forEach(([id, checked]) => {
            const el = document.getElementById(id);
            if (el) el.checked = checked;
        });
    },

    renderDesktopCloudSyncStatus() {
        const textEl = document.getElementById('desktop-sync-text');
        const sourceEl = document.getElementById('gist-status');
        if (!textEl) return;

        const text = (sourceEl?.textContent || '').trim();
        const isReadyText = text === '准备就绪';
        textEl.textContent = text || 'SYNC - 云端同步';
        textEl.className = 'desktop-sync-text';

        // 云同步原状态目前主要写 inline color；桌面这里复用文字和颜色，图标保持不动。
        if (isReadyText) {
            textEl.textContent = 'SYNC - 云端同步';
            textEl.style.color = '';
            return;
        }

        textEl.style.color = sourceEl?.style?.color || '';
        if (!textEl.style.color && sourceEl) {
            const cls = Array.from(sourceEl.classList).find(name => name !== 'gist-status');
            if (cls) textEl.classList.add(cls === 'error' ? 'status-failure' : `status-${cls}`);
        }
    },

    async handleDesktopCloudSync() {
        const textEl = document.getElementById('desktop-sync-text');
        if (textEl) {
            textEl.textContent = '正在同步...';
            textEl.className = 'desktop-sync-text status-pending';
            textEl.style.color = '';
        }

        if (typeof CloudSync === 'undefined' || typeof CloudSync.updateBackup !== 'function') {
            if (textEl) {
                textEl.textContent = '云端同步未就绪';
                textEl.className = 'desktop-sync-text status-failure';
            }
            return;
        }

        await CloudSync.updateBackup();
        this.renderDesktopCloudSyncStatus();
    },

    renderDesktopActivity(force = false) {
        const grid = document.getElementById('desktop-activity-grid');
        const todayEl = document.getElementById('desktop-activity-today');
        if (!grid) return;

        const activity = STATE.settings.DESKTOP_ACTIVITY && typeof STATE.settings.DESKTOP_ACTIVITY === 'object'
            ? STATE.settings.DESKTOP_ACTIVITY
            : { days: {}, lastRenderDate: '' };
        if (!activity.days || typeof activity.days !== 'object') activity.days = {};

        const todayKey = TodoContext.getTodayKey();
        if (!force && activity.lastRenderDate === todayKey && grid.children.length > 0) {
            this.renderDesktopActivityToday(activity, todayKey);
            return;
        }

        activity.lastRenderDate = todayKey;
        STATE.settings.DESKTOP_ACTIVITY = activity;
        STATE.desktopActivity = activity;
        Storage.saveSettings().catch(error => console.warn('[Desktop] activity render date save failed:', error));

        if (todayEl) todayEl.textContent = `今天 ${Number(activity.days[todayKey] || 0)} 次`;
        grid.innerHTML = '';

        const today = TodoContext.fromDateKey(todayKey);
        const mondayOffset = (today.getDay() + 6) % 7;
        const thisMonday = TodoContext.addDays(today, -mondayOffset);
        const firstMonday = TodoContext.addDays(thisMonday, -12 * 7);

        // 按“列 = 周、行 = 周一到周日”生成，本周自然落在最后一列。
        for (let week = 0; week < 13; week++) {
            for (let day = 0; day < 7; day++) {
                const date = TodoContext.addDays(firstMonday, week * 7 + day);
                const dateKey = TodoContext.toDateKey(date);
                const isFuture = date > today;
                const count = isFuture ? 0 : Number(activity.days[dateKey] || 0);
                const cell = document.createElement('span');
                cell.dataset.dateKey = dateKey;
                cell.className = `desktop-activity-cell level-${this.getDesktopActivityLevel(count)}`;
                cell.dataset.tooltip = `${dateKey}：${isFuture ? '还没到这一天' : `${count} 次互动`}`;
                cell.title = cell.dataset.tooltip;
                grid.appendChild(cell);
            }
        }
    },

    // ★★★★★ 桌面 START：互动日志点击浮窗 ★★★★★
    showDesktopActivityTip(cell) {
        const card = cell?.closest('.desktop-activity-card');
        const text = cell?.dataset?.tooltip || cell?.title || '';
        if (!card || !text) return;

        let tip = card.querySelector('.desktop-activity-tip');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'desktop-activity-tip';
            tip.setAttribute('aria-live', 'polite');
            card.appendChild(tip);
        }

        tip.textContent = text;
        tip.classList.add('show');

        // 先显示再测量宽高，才能把浮窗准确钉在当前方块正上方。
        const cardRect = card.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        const centerLeft = cellRect.left - cardRect.left + cellRect.width / 2;
        const minLeft = tipRect.width / 2 + 8;
        const maxLeft = cardRect.width - tipRect.width / 2 - 8;
        const left = Math.min(Math.max(centerLeft, minLeft), Math.max(minLeft, maxLeft));

        tip.style.left = `${left}px`;
        tip.style.top = `${cellRect.top - cardRect.top - tipRect.height - 7}px`;
    },

    hideDesktopActivityTip() {
        document.querySelector('.desktop-activity-tip.show')?.classList.remove('show');
    },
    // ★★★★★ 桌面 END：互动日志点击浮窗 ★★★★★

    renderDesktopActivityToday(activity = null, todayKey = TodoContext.getTodayKey()) {
        const grid = document.getElementById('desktop-activity-grid');
        const todayEl = document.getElementById('desktop-activity-today');
        const source = activity || (
            STATE.settings.DESKTOP_ACTIVITY && typeof STATE.settings.DESKTOP_ACTIVITY === 'object'
                ? STATE.settings.DESKTOP_ACTIVITY
                : { days: {}, lastRenderDate: '' }
        );
        if (!source.days || typeof source.days !== 'object') source.days = {};

        const count = Number(source.days[todayKey] || 0);
        if (todayEl) todayEl.textContent = `今天 ${count} 次`;

        const todayCell = grid?.querySelector(`[data-date-key="${todayKey}"]`);
        if (!todayCell) return;
        todayCell.className = `desktop-activity-cell level-${this.getDesktopActivityLevel(count)}`;
        todayCell.dataset.tooltip = `${todayKey}：${count} 次互动`;
        todayCell.title = todayCell.dataset.tooltip;
    },

    getDesktopActivityLevel(count) {
        if (count <= 0) return 0;
        if (count <= 20) return 1;
        if (count <= 40) return 2;
        if (count <= 50) return 3;
        if (count <= 60) return 4;
        if (count < 70) return 5;
        return 6;
    },

    renderDesktopAsyncStatus() {
        const statusEl = document.getElementById('desktop-async-status');
        const detailEl = document.getElementById('desktop-async-detail');
        if (!statusEl || !detailEl) return;

        const jobs = API.loadPendingJobs();
        const enabled = STATE.settings.ASYNC_BACKEND_ENABLED !== false;
        const configured = !!(STATE.settings.ASYNC_BACKEND_URL && STATE.settings.ASYNC_BACKEND_TOKEN);
        const latestCreatedAt = jobs.reduce((max, job) => Math.max(max, Number(job.createdAt || 0)), 0);

        if (!enabled) {
            statusEl.textContent = '后台接收已关闭';
        } else if (!configured) {
            statusEl.textContent = '后台接收未配置';
        } else if (jobs.length) {
            statusEl.textContent = `有 ${jobs.length} 条待取回`;
        } else {
            statusEl.textContent = '后台接收开启';
        }

        detailEl.textContent = latestCreatedAt
            ? `最近任务 ${WorldSense.formatShortDateTime(latestCreatedAt)}`
            : `最近检查 ${TodoContext.pad(new Date().getHours())}:${TodoContext.pad(new Date().getMinutes())}`;
    },

    async saveDesktopSignature() {
        const current = STATE.settings.DESKTOP_SIGNATURE || '';
        const next = prompt('请输入桌面个性签名：', current);
        if (next === null) return;
        STATE.settings.DESKTOP_SIGNATURE = next.trim();
        await Storage.saveSettings();
        this.renderDesktopSignature();
    },

    async toggleDesktopTodo(id) {
        const item = (STATE.todoPlans || []).find(plan => plan.id === id);
        if (!item) return;
        item.done = !item.done;
        item.updatedAt = Date.now();
        await Storage.saveTodoPlans();
        this.renderDesktopTodo();
    },

    clearDesktopAsyncStatus() {
        const jobs = API.loadPendingJobs();
        if (jobs.length && !confirm(`确定清除 ${jobs.length} 条本地后台状态吗？正在生成的回复可能不会自动回填。`)) return;
        API.savePendingJobs([]);
        this.renderDesktopAsyncStatus();
        this.renderAsyncBackendPendingJobs();
    },

    rememberReturnView(pageName, fallback = 'desktop') {
        // ★ 桌面加入后，二级页面不能再写死返回探索/联系人。
        // 这里记录“从哪个主入口进来的”，返回按钮统一读这张表。
        const mainViews = ['desktop', 'contact-list', 'explore'];
        const current = mainViews.includes(fallback) ? fallback : 'desktop';
        STATE.returnViewByPage = STATE.returnViewByPage || {};
        STATE.returnViewByPage[pageName] = current;
    },

    getReturnView(pageName, fallback = 'desktop') {
        return (STATE.returnViewByPage && STATE.returnViewByPage[pageName]) || fallback;
    },
    getActiveSwipeBackView() {
        const appContainer = document.getElementById('app-container');
        if (appContainer?.classList.contains('in-chat-mode')) return 'chat';

        const viewMap = [
            ['explore', 'view-explore'],
            ['pomodoro', 'view-pomodoro'],
            ['todo-plan', 'view-todo-plan'],
            ['countdown', 'view-countdown'],
            ['character-schedule', 'view-character-schedule'],
            ['character-schedule-detail', 'view-character-schedule-detail'],
            ['character-memory', 'view-character-memory'],
            ['character-memory-detail', 'view-character-memory-detail'],
            ['heart-note', 'view-heart-note'],
            ['heart-note-detail', 'view-heart-note-detail'],
            ['proactive-messages', 'view-proactive-messages'],
            ['async-reply', 'view-async-reply'],
            ['agent', 'view-agent'],
            ['async-backend', 'view-async-backend'],
            ['worldbook', 'view-worldbook'],
            ['world-sense', 'view-world-sense'],
            ['moments', 'view-moments']
        ];

        const activePair = viewMap.find(([, id]) => {
            const view = document.getElementById(id);
            return view && getComputedStyle(view).display !== 'none';
        });
        return activePair ? activePair[0] : null;
    },

    isEdgeSwipeBackIgnoredTarget(target) {
        // ★ 边缘滑返回只做页面级操作：输入、按钮、弹窗、横向滚动区先全部让路，避免误触。
        if (!target || target === document) return true;
        if (target.closest('input, textarea, select, button, a, label, [contenteditable="true"], [role="button"]')) return true;
        if (target.closest('.modal:not(.hidden), .proactive-api-modal:not(.hidden), .menu, .contact-menu, .message-actions-menu')) return true;
        const hasVisibleModal = Array.from(document.querySelectorAll('.modal:not(.hidden), .proactive-api-modal:not(.hidden), #modal-overlay:not(.hidden)')).some(el => {
            const style = getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
        });
        if (hasVisibleModal) return true;

        let node = target;
        while (node && node !== document.body) {
            const style = getComputedStyle(node);
            const canScrollX = /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2;
            if (canScrollX) return true;
            node = node.parentElement;
        }
        return false;
    },

    handleEdgeSwipeBack() {
        const activeView = this.getActiveSwipeBackView();
        const backButtonMap = {
            chat: 'back-btn',
            explore: 'explore-back-btn',
            pomodoro: 'pomodoro-back-btn',
            'todo-plan': 'todo-plan-back-btn',
            countdown: 'countdown-back-btn',
            'character-schedule': 'character-schedule-back-btn',
            'character-schedule-detail': 'character-schedule-detail-back-btn',
            'character-memory': 'character-memory-back-btn',
            'character-memory-detail': 'character-memory-detail-back-btn',
            'heart-note': 'heart-note-back-btn',
            'heart-note-detail': 'heart-note-detail-back-btn',
            'proactive-messages': 'proactive-messages-back-btn',
            'async-reply': 'async-reply-back-btn',
            agent: 'agent-back-btn',
            'async-backend': 'async-backend-back-btn',
            worldbook: 'worldbook-back-btn',
            'world-sense': 'world-sense-back-btn',
            moments: 'moments-back-btn'
        };
        const backBtn = document.getElementById(backButtonMap[activeView]);
        if (!backBtn) return false;

        backBtn.click();
        return true;
    },

    bindEdgeSwipeBack() {
        if (this.edgeSwipeBackBound) return;
        this.edgeSwipeBackBound = true;

        let startX = 0;
        let startY = 0;
        let swipeDirection = null;
        const EDGE_START = 56;
        const MIN_DISTANCE = 85;
        const MAX_VERTICAL = 65;

        // ★ 手机式边缘滑返回 START
        // 第一版先不做跟手动效，只在手势成立时触发现有左上角返回按钮。
        // 左边缘向右滑、右边缘向左滑都走同一个返回入口，方便先验证手感。
        document.addEventListener('touchstart', (event) => {
            if (event.touches.length !== 1) {
                swipeDirection = null;
                return;
            }

            const touch = event.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;

            if (this.isEdgeSwipeBackIgnoredTarget(event.target)) {
                swipeDirection = null;
                return;
            }

            const screenWidth = window.innerWidth || document.documentElement.clientWidth || 0;
            if (startX <= EDGE_START) {
                swipeDirection = 'right';
            } else if (screenWidth && startX >= screenWidth - EDGE_START) {
                swipeDirection = 'left';
            } else {
                swipeDirection = null;
            }
        }, { passive: true });

        document.addEventListener('touchend', (event) => {
            if (!swipeDirection) return;
            const direction = swipeDirection;
            swipeDirection = null;

            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            const isRightSwipe = direction === 'right' && deltaX >= MIN_DISTANCE;
            const isLeftSwipe = direction === 'left' && deltaX <= -MIN_DISTANCE;
            if ((!isRightSwipe && !isLeftSwipe) || Math.abs(deltaY) > MAX_VERTICAL) return;

            this.handleEdgeSwipeBack();
        }, { passive: true });
        // ★ 手机式边缘滑返回 END
    },
    // ★★★★★ 桌面 END：页面渲染与小组件交互 ★★★★★

    // ★★★★★ 世界感知 START：页面设置层 ★★★★★
    // 这里是“世界感知页面”的控制逻辑：
    // 1. 负责把已保存配置加载到页面
    // 2. 负责天气测试，测试成功后直接入库
    // 3. 负责开关即时生效，不再强制用户多点一次保存
    // 4. 负责聊天前按需自动补当前 0/12 点时段的天气缓存
    // 这一层会同时碰到 DOM、STATE.settings 和草稿态 STATE.worldSenseDraft。
    // =========================================
    syncWorldSenseToggle() {
        const toggle = document.getElementById('world-sense-enable-toggle');
        if (toggle) toggle.checked = STATE.settings.WORLD_SENSE_ENABLED === true;
    },

    async toggleWorldSenseEnabled(enabled) {
        STATE.settings.WORLD_SENSE_ENABLED = !!enabled;
        await Storage.saveSettings();
        this.syncWorldSenseToggle();
        await this.ensureWorldSenseWeatherReady();
        this.refreshDesktopWorldSenseWidgets();
    },

    loadWorldSenseSettings() {
        STATE.worldSenseDraft = WorldSense.cloneDraftFromSettings();
        STATE.worldSenseTestStatus = null;
        this.syncWorldSenseToggle();
        this.renderWorldSenseSettings();
    },

    setWorldSenseStatus(text, className) {
        STATE.worldSenseTestStatus = { text, className };
        const status = document.getElementById('world-sense-weather-status');
        if (!status) return;
        status.textContent = text;
        status.className = className;
    },

    buildWorldSenseWeatherCacheHtml(cache) {
        if (!cache) {
            return '<div class="world-sense-cache-empty">暂时还没有已保存的天气缓存</div>';
        }

        const lines = [
            `<div class="world-sense-cache-line"><span class="world-sense-cache-label">已保存城市</span>${this.escapeHtml(cache.cityName || cache.cityQuery || '-')}</div>`,
            `<div class="world-sense-cache-line"><span class="world-sense-cache-label">当前缓存</span>${this.escapeHtml(WorldSense.formatWeatherSummary(cache))}</div>`,
            `<div class="world-sense-cache-line"><span class="world-sense-cache-label">当前来源</span>${this.escapeHtml(cache.sourceLabel || 'Open-Meteo')}${cache.fallbackReason ? '（和风天气连接失败后自动回退）' : ''}</div>`
        ];
        const updatedAt = WorldSense.formatShortDateTime(cache.updatedAt);
        if (updatedAt) {
            lines.push(`<div class="world-sense-cache-line"><span class="world-sense-cache-label">上次更新于</span>${this.escapeHtml(updatedAt)}</div>`);
        }
        return lines.join('');
    },

    renderWorldSenseSettings() {
        const draft = STATE.worldSenseDraft || WorldSense.cloneDraftFromSettings();
        const weatherToggle = document.getElementById('world-sense-weather-toggle');
        const weatherCity = document.getElementById('world-sense-weather-city');
        const weatherLocationHint = document.getElementById('world-sense-weather-location-hint');
        const qweatherHost = document.getElementById('world-sense-qweather-host');
        const qweatherKey = document.getElementById('world-sense-qweather-key');
        const festivalToggle = document.getElementById('world-sense-festival-toggle');
        const cacheBox = document.getElementById('world-sense-weather-cache');
        const previewBox = document.getElementById('world-sense-festival-preview');

        if (weatherToggle) weatherToggle.checked = draft.weather.enabled === true;
        if (weatherCity) weatherCity.value = draft.weather.city || '';
        if (qweatherHost) qweatherHost.value = draft.weather.apiHost || '';
        if (qweatherKey) qweatherKey.value = draft.weather.apiKey || '';
        if (weatherLocationHint) {
            weatherLocationHint.textContent = draft.weather.location
                ? `已选择：${draft.weather.location.displayName || draft.weather.location.name || draft.weather.city}`
                : '输入城市后搜索并选择具体地点，避免同名城市匹配错误。';
        }
        if (festivalToggle) festivalToggle.checked = draft.festival.enabled === true;
        if (cacheBox) cacheBox.innerHTML = this.buildWorldSenseWeatherCacheHtml(draft.weather.cache);

        if (previewBox) {
            // ★ 星期和节日共用一个开关，预览里也一起展示，方便小白确认会注入什么。
            const now = new Date();
            const weekText = WorldSense.buildWeekText(now);
            const festivalText = WorldSense.buildFestivalText(now);
            const previewLines = [];
            if (weekText) previewLines.push(`星期：${weekText}`);
            if (festivalText) previewLines.push(`节日：${festivalText}`);

            previewBox.textContent = draft.festival.enabled
                ? (previewLines.join('\n') || '暂时没有可用的星期和节日文案')
                : '星期和节日已关闭';
        }

        if (STATE.worldSenseTestStatus) {
            this.setWorldSenseStatus(STATE.worldSenseTestStatus.text, STATE.worldSenseTestStatus.className);
        } else {
            this.setWorldSenseStatus('- 天气测试待开始 -', 'api-status-text status-idle');
        }
    },

    collectWorldSenseDraftFromDom() {
        const draft = STATE.worldSenseDraft || WorldSense.cloneDraftFromSettings();
        const weatherToggle = document.getElementById('world-sense-weather-toggle');
        const weatherCity = document.getElementById('world-sense-weather-city');
        const qweatherHost = document.getElementById('world-sense-qweather-host');
        const qweatherKey = document.getElementById('world-sense-qweather-key');
        const festivalToggle = document.getElementById('world-sense-festival-toggle');

        // ★ 页面输入先收回草稿：
        // 这样“测试天气”“单独开关”“总保存”都走同一份数据，不会出现 UI 和入库内容不一致。
        draft.weather.enabled = weatherToggle ? weatherToggle.checked : draft.weather.enabled;
        draft.weather.city = WorldSense.normalizeCity(weatherCity ? weatherCity.value : draft.weather.city);
        draft.weather.apiHost = WorldSense.normalizeApiHost(qweatherHost ? qweatherHost.value : draft.weather.apiHost);
        draft.weather.apiKey = String(qweatherKey ? qweatherKey.value : draft.weather.apiKey || '').trim();
        draft.festival.enabled = festivalToggle ? festivalToggle.checked : draft.festival.enabled;

        STATE.worldSenseDraft = draft;
        return draft;
    },

    async persistWorldSenseDraft(options = {}) {
        const draft = options.draft || this.collectWorldSenseDraftFromDom();
        let nextCache = draft.weather.cache
            ? JSON.parse(JSON.stringify(draft.weather.cache))
            : null;

        // ★ 城市、地点或专业源配置变了都丢掉旧天气：
        // 避免页面改成新地点后仍注入旧缓存，也让刚配置好的和风天气能在下一次使用时立即接管。
        const savedLocation = STATE.settings.WORLD_SENSE_WEATHER_LOCATION;
        const nextLocation = draft.weather.location;
        const savedLocationKey = savedLocation
            ? `${Number(savedLocation.latitude)},${Number(savedLocation.longitude)}`
            : '';
        const nextLocationKey = nextLocation
            ? `${Number(nextLocation.latitude)},${Number(nextLocation.longitude)}`
            : '';
        const locationChanged = savedLocationKey !== nextLocationKey;
        const qweatherConfigChanged = WorldSense.normalizeApiHost(STATE.settings.WORLD_SENSE_WEATHER_API_HOST) !== draft.weather.apiHost ||
            String(STATE.settings.WORLD_SENSE_WEATHER_API_KEY || '').trim() !== draft.weather.apiKey;
        if (
            !draft.weather.city ||
            WorldSense.normalizeCity(nextCache?.cityQuery) !== draft.weather.city ||
            (options.keepWeatherCache !== true && locationChanged) ||
            (options.keepWeatherCache !== true && qweatherConfigChanged)
        ) {
            nextCache = null;
        }

        STATE.settings.WORLD_SENSE_WEATHER_ENABLED = draft.weather.enabled === true;
        STATE.settings.WORLD_SENSE_WEATHER_CITY = draft.weather.city;
        STATE.settings.WORLD_SENSE_WEATHER_LOCATION = nextLocation
            ? JSON.parse(JSON.stringify(nextLocation))
            : null;
        STATE.settings.WORLD_SENSE_WEATHER_API_HOST = draft.weather.apiHost;
        STATE.settings.WORLD_SENSE_WEATHER_API_KEY = draft.weather.apiKey;
        STATE.settings.WORLD_SENSE_WEATHER_CACHE = nextCache;
        STATE.settings.WORLD_SENSE_FESTIVAL_ENABLED = draft.festival.enabled === true;

        await Storage.saveSettings();

        STATE.worldSenseDraft = WorldSense.cloneDraftFromSettings();
        this.syncWorldSenseToggle();
        this.refreshDesktopWorldSenseWidgets();
        if (options.render !== false) this.renderWorldSenseSettings();
    },

    openWorldSenseLocationModal(searchResult) {
        const modal = document.getElementById('world-sense-location-modal');
        const list = document.getElementById('world-sense-location-candidates');
        const desc = document.getElementById('world-sense-location-modal-desc');
        if (!modal || !list) return;

        STATE.worldSenseLocationCandidates = searchResult.candidates || [];
        list.replaceChildren();
        if (desc) {
            desc.textContent = searchResult.fallbackReason
                ? '和风天气地点查询失败，下面是 Open-Meteo 返回的候选地点。'
                : `地点候选来源：${searchResult.sourceLabel}`;
        }

        STATE.worldSenseLocationCandidates.forEach((location, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'world-sense-location-candidate';
            button.dataset.index = String(index);
            button.textContent = location.displayName || location.name || '未命名地点';
            list.appendChild(button);
        });
        modal.classList.remove('hidden');
    },

    closeWorldSenseLocationModal() {
        document.getElementById('world-sense-location-modal')?.classList.add('hidden');
    },

    selectWorldSenseLocation(index) {
        const location = STATE.worldSenseLocationCandidates[index];
        if (!location) return;

        const draft = STATE.worldSenseDraft || WorldSense.cloneDraftFromSettings();
        draft.weather.location = JSON.parse(JSON.stringify(location));
        draft.weather.cache = null;
        STATE.worldSenseDraft = draft;
        this.closeWorldSenseLocationModal();
        this.renderWorldSenseSettings();
        this.setWorldSenseStatus(`已选择地点：${location.displayName || location.name}`, 'api-status-text status-success');
    },

    async searchWorldSenseWeatherLocation() {
        const draft = this.collectWorldSenseDraftFromDom();
        const button = document.getElementById('world-sense-weather-search-btn');
        if (!draft.weather.city) {
            this.setWorldSenseStatus('请先填写城市', 'api-status-text status-failure');
            return;
        }

        if (button) button.disabled = true;
        this.setWorldSenseStatus(`正在搜索地点：${draft.weather.city}`, 'api-status-text status-pending');
        try {
            const result = await WorldSense.searchLocationCandidates(draft.weather.city, {
                apiHost: draft.weather.apiHost,
                apiKey: draft.weather.apiKey
            });
            this.openWorldSenseLocationModal(result);
            this.setWorldSenseStatus(`找到 ${result.candidates.length} 个候选地点`, 'api-status-text status-success');
        } catch (error) {
            this.setWorldSenseStatus(`地点搜索失败：${error.message || error}`, 'api-status-text status-failure');
        } finally {
            if (button) button.disabled = false;
        }
    },

    async testWorldSenseWeather() {
        const draft = this.collectWorldSenseDraftFromDom();
        const testBtn = document.getElementById('world-sense-weather-test-btn');
        const city = draft.weather.city;

        if (!city) {
            this.setWorldSenseStatus('请先填写城市', 'api-status-text status-failure');
            return;
        }
        if (!draft.weather.location) {
            this.setWorldSenseStatus('请先点击“搜索地点”并选择具体地点', 'api-status-text status-failure');
            return;
        }

        if (testBtn) testBtn.disabled = true;
        this.setWorldSenseStatus(`正在测试天气：${city}`, 'api-status-text status-pending');

        try {
            const cache = await WorldSense.fetchWeather(city, {
                location: draft.weather.location,
                apiHost: draft.weather.apiHost,
                apiKey: draft.weather.apiKey,
                now: new Date()
            });
            // ★ 用户已经主动测试出天气了，就顺手打开天气分开关；
            // 否则“有缓存但分开关仍关闭”，桌面会继续显示天气未开启，看起来像保存没生效。
            draft.weather.enabled = true;
            draft.weather.cache = cache;
            STATE.worldSenseDraft = draft;
            await this.persistWorldSenseDraft({ draft, keepWeatherCache: true });
            this.renderWorldSenseSettings();
            const sourceText = cache.fallbackReason
                ? `来源：Open-Meteo；和风天气失败：${cache.fallbackReason}`
                : `来源：${cache.sourceLabel || 'Open-Meteo'}`;
            this.setWorldSenseStatus(`天气测试成功：${cache.cityName} ${WorldSense.formatWeatherSummary(cache)}（${sourceText}）`, 'api-status-text status-success');
        } catch (error) {
            this.setWorldSenseStatus(`天气测试失败：${error.message || error}`, 'api-status-text status-failure');
        } finally {
            if (testBtn) testBtn.disabled = false;
        }
    },

    async saveWorldSenseSettings() {
        // ★ 总保存只做兜底入库：
        // 天气状态栏继续保留“测试成功/失败/待开始”，不要在天气卡片里冒出“已保存”。
        await this.persistWorldSenseDraft();
    },

    async ensureWorldSenseWeatherReady() {
        const settings = STATE.settings;
        const city = WorldSense.normalizeCity(settings.WORLD_SENSE_WEATHER_CITY);

        if (settings.WORLD_SENSE_ENABLED !== true) return;
        if (settings.WORLD_SENSE_WEATHER_ENABLED !== true) return;
        if (!city) return;
        if (WorldSense.isWeatherCacheValid(settings.WORLD_SENSE_WEATHER_CACHE, city, new Date())) return;
        if (Date.now() < Number(STATE.worldSenseWeatherRetryAt || 0)) return;
        if (STATE.worldSenseWeatherRefreshPromise) return STATE.worldSenseWeatherRefreshPromise;

        // ★ 多个入口可能同时检查天气（桌面分钟计时器、聊天发送、打开详情页）：
        // 共用同一个 Promise，避免在 0 点或 12 点边界重复请求天气源。
        STATE.worldSenseWeatherRefreshPromise = (async () => {
            try {
                STATE.settings.WORLD_SENSE_WEATHER_CACHE = await WorldSense.fetchWeather(city, {
                    location: settings.WORLD_SENSE_WEATHER_LOCATION,
                    apiHost: settings.WORLD_SENSE_WEATHER_API_HOST,
                    apiKey: settings.WORLD_SENSE_WEATHER_API_KEY,
                    now: new Date()
                });
                STATE.worldSenseWeatherRetryAt = 0;
                await Storage.saveSettings();
                this.refreshDesktopWorldSenseWidgets();
            } catch (error) {
                // 自动刷新失败后 15 分钟再试，避免页面常驻时每分钟反复打失败请求。
                STATE.worldSenseWeatherRetryAt = Date.now() + 15 * 60 * 1000;
                console.warn('[WorldSense] weather refresh failed:', error);
            } finally {
                STATE.worldSenseWeatherRefreshPromise = null;
            }
        })();

        return STATE.worldSenseWeatherRefreshPromise;
    },
    // ★★★★★ 世界感知 END：页面设置层 ★★★★★

    // ★★★★★ 探索 TO DO / 倒数日 START：页面逻辑层 ★★★★★
    // 这一层专门处理页面渲染、弹窗和 IndexedDB 保存。
    // 日期和 prompt 文案放在 TodoContext，避免所有逻辑堆在事件监听里。
    syncTodoContextToggles() {
        const todoToggle = document.getElementById('todo-plan-enable-toggle');
        const countdownToggle = document.getElementById('countdown-enable-toggle');
        if (todoToggle) todoToggle.checked = STATE.settings.TODO_PLAN_INJECT_ENABLED === true;
        if (countdownToggle) countdownToggle.checked = STATE.settings.COUNTDOWN_INJECT_ENABLED === true;
    },

    async toggleTodoPlanInjectEnabled(enabled) {
        STATE.settings.TODO_PLAN_INJECT_ENABLED = !!enabled;
        await Storage.saveSettings();
        this.syncTodoContextToggles();
    },

    async toggleCountdownInjectEnabled(enabled) {
        STATE.settings.COUNTDOWN_INJECT_ENABLED = !!enabled;
        await Storage.saveSettings();
        this.syncTodoContextToggles();
    },

    // ★★★★★ 顶部通知 START：可复用的轻量状态汇报条 ★★★★★
    getTopNoticeTargetHandler(options = {}) {
        if (typeof options.onClick === 'function') return options.onClick;
        if (!options.targetView) return null;

        // ★ 通知路由：
        // 简单功能只需要 targetView；以后如果要跳到某条朋友圈/某个 TODO，
        // 可以继续在 options 里带 targetId，或直接传 onClick 做精确定位。
        return () => {
            if (typeof UI !== 'undefined' && typeof UI.switchView === 'function') {
                UI.switchView(options.targetView);
            }
        };
    },

    showTodoTopNotice(message, options = {}) {
        return this.showTopNotice(message, {
            ...options,
            targetView: options.targetView || 'todo-plan'
        });
    },

    // ★★★★★ 顶部通知：AI 新消息红点 + 横幅入口 START ★★★★★
    isViewingContactChat(contactId) {
        const appContainer = document.getElementById('app-container');
        // ★ currentContactId 只是“当前选中的联系人”，退到桌面/探索页时可能还没被清空；
        // 真正判断是不是正在聊天窗口，要同时看聊天层是否处在展开状态。
        return !!contactId
            && STATE.currentContactId === contactId
            && appContainer?.classList.contains('in-chat-mode');
    },

    markContactIncomingMessage(contact, options = {}) {
        if (!contact) return;
        contact.hasNewMsg = true;
        this.refreshDesktopUnreadDotsIfNeeded();

        if (options.notice === false || this.isViewingContactChat(contact.id)) return;
        const name = contact.name || 'AI';
        this.showTopNotice(`${name}发来了新消息`, {
            type: 'incoming-message',
            timeout: options.timeout || 6500,
            onClick: () => this.enterChat(contact.id)
        });
    },

    isViewingMomentsPage() {
        const viewMoments = document.getElementById('view-moments');
        // ★ currentMainView 会保留“从哪个主入口进来”，所以朋友圈页用实际显示状态判断。
        return !!viewMoments && getComputedStyle(viewMoments).display !== 'none';
    },

    showMomentReplyNotice(charId, options = {}) {
        // ★ 用户正在朋友圈列表里看回复时不打扰；历史加载也不会走这个入口。
        if (options.notice === false || this.isViewingMomentsPage()) return;

        this.markMomentReplyUnread();
        const contact = STATE.contacts.find(c => c.id === charId);
        const name = contact?.name || options.name || '有人';
        this.showTopNotice(`${name}回复了你的朋友圈`, {
            type: 'moment-reply',
            timeout: options.timeout || 6500,
            targetView: 'moments'
        });
    },

    showMomentLikeNotice(charId, options = {}) {
        // ★ 点赞和评论遵循同一套静默规则：正在朋友圈页时直接看列表变化，不重复弹横幅。
        if (options.notice === false || this.isViewingMomentsPage()) return;

        const contact = STATE.contacts.find(c => String(c.id) === String(charId));
        const name = contact?.name || options.name || '有人';
        this.showTopNotice(`${name}点赞了你的动态`, {
            type: 'moment-like',
            timeout: options.timeout || 6500,
            targetView: 'moments'
        });
    },
    // ★★★★★ 顶部通知：AI 新消息红点 + 横幅入口 END ★★★★★

    showTopNotice(message, options = {}) {
        let stack = document.getElementById('app-top-notice-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'app-top-notice-stack';
            stack.className = 'app-top-notice-stack';
            document.body.appendChild(stack);
        }

        const notice = document.createElement('div');
        notice.className = `app-top-notice ${options.type || ''}`.trim();
        if (options.layout === 'stacked') notice.classList.add('stacked');
        const targetHandler = this.getTopNoticeTargetHandler(options);
        if (targetHandler) {
            notice.classList.add('clickable');
            notice.setAttribute('role', 'button');
            notice.tabIndex = 0;
        }
        let startY = 0;
        let currentY = 0;
        let dragging = false;
        let didDrag = false;
        let closed = false;

        const closeNotice = () => {
            if (closed) return;
            closed = true;
            notice.classList.remove('show');
            notice.classList.add('hide-up');
            setTimeout(() => notice.remove(), 240);
        };

        const text = document.createElement('div');
        text.className = 'app-top-notice-text';
        if (typeof options.renderContent === 'function') {
            const customContent = options.renderContent({ closeNotice, notice });
            if (customContent instanceof Node) {
                text.appendChild(customContent);
            } else {
                text.textContent = message || '';
            }
        } else {
            text.textContent = message || '';
        }
        notice.appendChild(text);

        const actions = Array.isArray(options.actions) && options.actions.length
            ? options.actions
            : (options.actionLabel && typeof options.onAction === 'function'
                ? [{ label: options.actionLabel, onAction: options.onAction }]
                : []);

        if (actions.length) {
            const actionWrap = document.createElement('div');
            actionWrap.className = 'app-top-notice-actions';
            actions.slice(0, 3).forEach(action => {
                if (!action || !action.label || typeof action.onAction !== 'function') return;
                const actionBtn = document.createElement('button');
                actionBtn.type = 'button';
                actionBtn.className = `app-top-notice-action ${action.type || ''}`.trim();
                actionBtn.textContent = action.label;
                actionBtn.addEventListener('click', async () => {
                    try {
                        await action.onAction();
                    } catch (error) {
                        console.warn('[Notice] action failed:', error);
                    }
                    closeNotice();
                });
                actionWrap.appendChild(actionBtn);
            });
            notice.appendChild(actionWrap);
        }

        notice.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.app-top-notice-action')) return;
            dragging = true;
            didDrag = false;
            startY = event.clientY;
            currentY = 0;
            notice.classList.add('dragging');
            notice.setPointerCapture?.(event.pointerId);
        });

        notice.addEventListener('pointermove', (event) => {
            if (!dragging) return;
            currentY = Math.min(0, event.clientY - startY);
            if (Math.abs(currentY) > 6) didDrag = true;
            notice.style.transform = `translateY(${currentY}px)`;
            notice.style.opacity = String(Math.max(0.35, 1 + currentY / 90));
        });

        const finishDrag = (event) => {
            if (!dragging) return;
            dragging = false;
            notice.classList.remove('dragging');
            notice.releasePointerCapture?.(event.pointerId);
            notice.style.transform = '';
            notice.style.opacity = '';
            if (currentY < -32) closeNotice();
        };

        notice.addEventListener('pointerup', finishDrag);
        notice.addEventListener('pointercancel', finishDrag);
        notice.addEventListener('click', async (event) => {
            if (!targetHandler || closed) return;
            if (event.target.closest('.app-top-notice-action')) return;
            if (didDrag) {
                didDrag = false;
                return;
            }

            try {
                await targetHandler(event);
            } catch (error) {
                console.warn('[Notice] navigation failed:', error);
            }
            closeNotice();
        });
        notice.addEventListener('keydown', async (event) => {
            if (!targetHandler || closed) return;
            if (!['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            try {
                await targetHandler(event);
            } catch (error) {
                console.warn('[Notice] keyboard navigation failed:', error);
            }
            closeNotice();
        });

        stack.appendChild(notice);
        requestAnimationFrame(() => notice.classList.add('show'));

        const timeout = Number.isFinite(options.timeout) ? options.timeout : 5000;
        if (timeout > 0) {
            setTimeout(closeNotice, timeout);
        }

        return notice;
    },
    // ★★★★★ 顶部通知 END：可复用的轻量状态汇报条 ★★★★★

    escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // 朋友圈和搜索结果走 innerHTML 拼装时，所有可控文本都先从这里过一遍。
    // 图片只允许常见安全来源，避免 javascript: / svg data 等地址被塞进 src。
    sanitizeImageSrc(src) {
        const raw = String(src || '').trim();
        if (!raw) return '';
        if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
        if (/^blob:/i.test(raw)) return raw;
        try {
            const url = new URL(raw, location.href);
            if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
        } catch (e) {}
        return '';
    },

    renderTodoDatePicker(scope) {
        const isCountdown = scope === 'countdown';
        const offsetKey = isCountdown ? 'countdownDraftDateOffset' : 'todoPlanDraftDateOffset';
        const row = document.getElementById(isCountdown ? 'countdown-week-row' : 'todo-plan-week-row');
        const monthLabel = document.getElementById(isCountdown ? 'countdown-month-label' : 'todo-plan-month-label');
        const dateInput = document.getElementById(isCountdown ? 'countdown-date-input' : 'todo-plan-date-input');
        if (!row || !monthLabel || !dateInput) return;

        const today = TodoContext.fromDateKey(TodoContext.getTodayKey());
        const start = TodoContext.addDays(today, STATE[offsetKey] || 0);
        const selectedKey = dateInput.value || TodoContext.toDateKey(start);

        monthLabel.textContent = TodoContext.formatMonthRangeLabel(start);
        row.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const date = TodoContext.addDays(start, i);
            const dateKey = TodoContext.toDateKey(date);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `todo-date-chip${dateKey === selectedKey ? ' active' : ''}`;
            btn.dataset.dateKey = dateKey;
            btn.innerHTML = `<span class="week">${TodoContext.formatWeekLabel(dateKey)}</span><span class="day">${date.getDate()}</span>`;
            row.appendChild(btn);
        }

        this.renderTodoMonthPanel(scope);
    },

    getTodoMonthPickerState(scope) {
        const isCountdown = scope === 'countdown';
        const dateInput = document.getElementById(isCountdown ? 'countdown-date-input' : 'todo-plan-date-input');
        const date = TodoContext.fromDateKey(dateInput?.value || TodoContext.getTodayKey());
        const stateKey = isCountdown ? 'countdownMonthPicker' : 'todoPlanMonthPicker';

        if (!STATE[stateKey]) {
            STATE[stateKey] = {
                year: date.getFullYear(),
                month: date.getMonth() + 1
            };
        }
        return STATE[stateKey];
    },

    renderTodoMonthPanel(scope) {
        const isCountdown = scope === 'countdown';
        const panel = document.getElementById(isCountdown ? 'countdown-month-panel' : 'todo-plan-month-panel');
        const yearLabel = document.getElementById(isCountdown ? 'countdown-year-label' : 'todo-plan-year-label');
        const monthGrid = document.getElementById(isCountdown ? 'countdown-month-grid' : 'todo-plan-month-grid');
        if (!panel || !yearLabel || !monthGrid) return;

        const state = this.getTodoMonthPickerState(scope);
        yearLabel.textContent = state.year;
        monthGrid.innerHTML = '';

        for (let month = 1; month <= 12; month++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `todo-month-option${month === state.month ? ' active' : ''}`;
            btn.dataset.month = month;
            btn.textContent = month;
            monthGrid.appendChild(btn);
        }
    },

    toggleTodoMonthPanel(scope) {
        const isCountdown = scope === 'countdown';
        const panel = document.getElementById(isCountdown ? 'countdown-month-panel' : 'todo-plan-month-panel');
        const dateInput = document.getElementById(isCountdown ? 'countdown-date-input' : 'todo-plan-date-input');
        const stateKey = isCountdown ? 'countdownMonthPicker' : 'todoPlanMonthPicker';
        const date = TodoContext.fromDateKey(dateInput?.value || TodoContext.getTodayKey());

        STATE[stateKey] = {
            year: date.getFullYear(),
            month: date.getMonth() + 1
        };
        this.renderTodoMonthPanel(scope);
        panel?.classList.toggle('hidden');
    },

    shiftTodoMonthPanelYear(scope, delta) {
        const state = this.getTodoMonthPickerState(scope);
        state.year += delta;
        this.renderTodoMonthPanel(scope);
    },

    chooseTodoMonth(scope, month) {
        const isCountdown = scope === 'countdown';
        const state = this.getTodoMonthPickerState(scope);
        const dateInput = document.getElementById(isCountdown ? 'countdown-date-input' : 'todo-plan-date-input');
        const panel = document.getElementById(isCountdown ? 'countdown-month-panel' : 'todo-plan-month-panel');
        const offsetKey = isCountdown ? 'countdownDraftDateOffset' : 'todoPlanDraftDateOffset';
        const dateKey = `${state.year}-${TodoContext.pad(month)}-01`;

        // 选中月份后跳到当月 1 号，7 天条也从这一天开始。
        if (dateInput) dateInput.value = dateKey;
        STATE[offsetKey] = TodoContext.diffDays(dateKey);
        state.month = month;
        panel?.classList.add('hidden');
        this.renderTodoDatePicker(scope);
    },

    openTodoPlanModal(id = null) {
        const modal = document.getElementById('modal-todo-plan');
        const title = document.getElementById('todo-plan-modal-title');
        const textInput = document.getElementById('todo-plan-text');
        const dateInput = document.getElementById('todo-plan-date-input');
        if (!modal || !textInput || !dateInput) return;

        const item = id ? STATE.todoPlans.find(x => x.id === id) : null;
        STATE.editingTodoPlanId = item ? item.id : null;
        const dateKey = item?.dateKey || TodoContext.getTodayKey();
        STATE.todoPlanDraftDateOffset = Math.floor(TodoContext.diffDays(dateKey) / 7) * 7;

        if (title) title.textContent = item ? '编辑计划' : '新增计划';
        textInput.value = item?.text || '';
        dateInput.value = dateKey;
        this.renderTodoDatePicker('todo');
        modal.classList.remove('hidden');
        textInput.focus();
    },

    closeTodoPlanModal() {
        document.getElementById('modal-todo-plan')?.classList.add('hidden');
        STATE.editingTodoPlanId = null;
    },

    async saveTodoPlanFromModal() {
        const textInput = document.getElementById('todo-plan-text');
        const dateInput = document.getElementById('todo-plan-date-input');
        const text = textInput ? textInput.value.trim() : '';
        const dateKey = dateInput ? dateInput.value : TodoContext.getTodayKey();

        if (!text) {
            alert('写点计划内容吧');
            return;
        }

        const oldItem = STATE.editingTodoPlanId
            ? STATE.todoPlans.find(item => item.id === STATE.editingTodoPlanId)
            : null;

        if (oldItem) {
            oldItem.text = text;
            oldItem.dateKey = dateKey;
            oldItem.updatedAt = Date.now();
        } else {
            STATE.todoPlans.push({
                id: this.generateTodoPlanId(),
                text,
                dateKey,
                done: false,
                cancelled: false,
                createdAt: Date.now()
            });
        }

        await Storage.saveTodoPlans();
        this.closeTodoPlanModal();
        this.renderTodoPlans();
    },

    hasTodoTime(item) {
        return !!(item && item.startTime && item.endTime);
    },

    compareTodoPlans(a, b) {
        // ★ 排序统一收口：未完成未取消在前；同组内有时间的先按开始时间排。
        const aArchived = a.done === true || a.cancelled === true;
        const bArchived = b.done === true || b.cancelled === true;
        if (aArchived !== bArchived) return aArchived ? 1 : -1;

        const aHasTime = this.hasTodoTime(a);
        const bHasTime = this.hasTodoTime(b);
        if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
        if (aHasTime && bHasTime) {
            if (a.startTime !== b.startTime) return String(a.startTime).localeCompare(String(b.startTime));
            if (a.endTime !== b.endTime) return String(a.endTime).localeCompare(String(b.endTime));
        }

        return (a.createdAt || 0) - (b.createdAt || 0);
    },

    renderTodoPlans() {
        const list = document.getElementById('todo-plan-list');
        const empty = document.getElementById('todo-plan-empty');
        if (!list) return;

        const todayKey = TodoContext.getTodayKey();
        const allPlans = (STATE.todoPlans || []).filter(item => item && item.text);
        const overduePlans = allPlans
            .filter(item => item.dateKey < todayKey && item.done !== true && item.cancelled !== true)
            .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || this.compareTodoPlans(a, b));
        const currentFuturePlans = allPlans
            .filter(item => item.dateKey >= todayKey)
            .sort((a, b) => {
                if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
                return this.compareTodoPlans(a, b);
            });
        const historyDonePlans = allPlans
            .filter(item => item.dateKey < todayKey && (item.done === true || item.cancelled === true))
            .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || this.compareTodoPlans(a, b));

        list.innerHTML = '';
        if (empty) empty.style.display = allPlans.length ? 'none' : 'block';
        if (!allPlans.length) return;

        if (overduePlans.length) {
            this.appendTodoGroup(list, '逾期未完成', overduePlans, {
                groupClass: 'todo-overdue-group',
                collapsed: false,
                groupByDate: true
            });
        }

        const groups = new Map();
        currentFuturePlans.forEach(item => {
            if (!groups.has(item.dateKey)) groups.set(item.dateKey, []);
            groups.get(item.dateKey).push(item);
        });
        groups.forEach((items, dateKey) => {
            this.appendTodoGroup(list, TodoContext.formatDateLabel(dateKey), items, {
                dateKey,
                // ★ 未来计划也默认展开，方便一眼扫完整个后续安排；历史已完成仍在下面单独折叠。
                collapsed: false
            });
        });

        if (historyDonePlans.length) {
            this.appendTodoGroup(list, '历史已完成', historyDonePlans, {
                groupClass: 'todo-history-group',
                collapsed: true,
                groupByDate: true
            });
        }
    },

    appendTodoGroup(list, title, items, options = {}) {
        const group = document.createElement('section');
        group.className = `todo-date-group${options.groupClass ? ` ${options.groupClass}` : ''}${options.collapsed ? ' collapsed' : ''}`;
        if (options.dateKey) group.dataset.dateKey = options.dateKey;
        group.innerHTML = `
            <button type="button" class="todo-date-group-title" data-action="toggle-group">
                <span class="todo-group-arrow">▼</span>
                <span>${title}</span>
                <span class="todo-group-count">${items.length} 条</span>
            </button>
            <div class="todo-date-group-body"></div>
        `;

        const body = group.querySelector('.todo-date-group-body');

        if (options.groupByDate) {
            // ★ 逾期和历史组内部再按日期分小段：
            // 外层仍然只负责“逾期未完成 / 历史已完成”的折叠，内层日期不再折叠。
            const dateGroups = new Map();
            items.forEach(item => {
                if (!dateGroups.has(item.dateKey)) dateGroups.set(item.dateKey, []);
                dateGroups.get(item.dateKey).push(item);
            });

            dateGroups.forEach((dateItems, dateKey) => {
                const block = document.createElement('div');
                block.className = 'todo-inline-date-group';
                block.innerHTML = `<div class="todo-inline-date-pill">${TodoContext.formatDateLabel(dateKey)}</div>`;
                dateItems.forEach(item => block.appendChild(this.createTodoItemElement(item)));
                body.appendChild(block);
            });
        } else {
            items.forEach(item => body.appendChild(this.createTodoItemElement(item)));
        }
        list.appendChild(group);
    },

    createTodoItemElement(item) {
        const div = document.createElement('div');
        const hasTime = this.hasTodoTime(item);
        const timeHtml = hasTime
            ? `
                <div class="todo-time-stack" title="点击事项可调整时段">
                    <span class="todo-time-pill">${this.escapeHtml(item.startTime)}</span>
                    <span class="todo-time-pill">${this.escapeHtml(item.endTime)}</span>
                </div>
            `
            : '<div class="todo-time-stack empty" aria-hidden="true"></div>';

        div.className = `todo-item${item.done ? ' done' : ''}${item.cancelled ? ' cancelled' : ''}`;
        div.dataset.id = item.id;
        div.innerHTML = `
            <button type="button" class="todo-check-btn" data-action="toggle-todo" title="完成/取消完成"></button>
            ${timeHtml}
            <div class="todo-item-text">${this.escapeHtml(item.text)}</div>
            <button type="button" class="todo-icon-btn" data-action="edit-todo" title="编辑">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button type="button" class="todo-icon-btn todo-cancel-btn" data-action="cancel-todo" title="取消计划">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5v7"/><path d="M14.5 8.5v7"/></svg>
            </button>
            <button type="button" class="todo-icon-btn danger" data-action="delete-todo" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        `;
        return div;
    },

    async handleTodoPlanAction(action, id, groupEl = null) {
        if (action === 'toggle-group' && groupEl) {
            groupEl.classList.toggle('collapsed');
            return;
        }

        const item = STATE.todoPlans.find(x => x.id === id);
        if (!item) return;

        if (action === 'toggle-todo') {
            if (item.cancelled === true) return;
            item.done = !item.done;
            item.updatedAt = Date.now();
            await Storage.saveTodoPlans();
            this.renderTodoPlans();
        } else if (action === 'edit-todo') {
            this.openTodoPlanModal(id);
        } else if (action === 'cancel-todo') {
            item.cancelled = item.cancelled !== true;
            if (item.cancelled) item.done = false;
            item.updatedAt = Date.now();
            await Storage.saveTodoPlans();
            this.renderTodoPlans();
        } else if (action === 'delete-todo') {
            if (!confirm('确定要删除这条计划吗？')) return;
            STATE.todoPlans = STATE.todoPlans.filter(x => x.id !== id);
            await Storage.saveTodoPlans();
            this.renderTodoPlans();
        }
    },

    openTodoTimeModal(id) {
        const item = STATE.todoPlans.find(x => x.id === id);
        const modal = document.getElementById('modal-todo-time');
        const startInput = document.getElementById('todo-time-start');
        const endInput = document.getElementById('todo-time-end');
        const startPicker = document.getElementById('todo-time-start-picker');
        const endPicker = document.getElementById('todo-time-end-picker');
        if (!item || !modal || !startInput || !endInput) return;

        STATE.editingTodoTimeId = item.id;
        startInput.value = item.startTime || '';
        endInput.value = item.endTime || '';
        if (startPicker) startPicker.value = item.startTime || '';
        if (endPicker) endPicker.value = item.endTime || '';
        modal.classList.remove('hidden');
        startInput.focus();
    },

    closeTodoTimeModal() {
        document.getElementById('modal-todo-time')?.classList.add('hidden');
        STATE.editingTodoTimeId = null;
    },

    async clearTodoTimeFromModal() {
        const item = STATE.todoPlans.find(x => x.id === STATE.editingTodoTimeId);
        if (!item) return;

        delete item.startTime;
        delete item.endTime;
        item.updatedAt = Date.now();
        await Storage.saveTodoPlans();
        this.closeTodoTimeModal();
        this.renderTodoPlans();
    },

    async saveTodoTimeFromModal() {
        const item = STATE.todoPlans.find(x => x.id === STATE.editingTodoTimeId);
        const startInput = document.getElementById('todo-time-start');
        const endInput = document.getElementById('todo-time-end');
        if (!item || !startInput || !endInput) return;

        const startTime = this.normalizeTodoTimeValue(startInput.value);
        const endTime = this.normalizeTodoTimeValue(endInput.value);
        if (!startTime && !endTime) {
            await this.clearTodoTimeFromModal();
            return;
        }
        if (startInput.value.trim() && !startTime) {
            alert('开始时间格式要像 09:30 这样哦');
            startInput.focus();
            return;
        }
        if (endInput.value.trim() && !endTime) {
            alert('结束时间格式要像 18:00 这样哦');
            endInput.focus();
            return;
        }
        if (!startTime || !endTime) {
            alert('开始时间和结束时间都要选哦');
            return;
        }
        if (endTime <= startTime) {
            alert('结束时间要晚于开始时间');
            return;
        }

        item.startTime = startTime;
        item.endTime = endTime;
        item.updatedAt = Date.now();
        await Storage.saveTodoPlans();
        this.closeTodoTimeModal();
        this.renderTodoPlans();
    },

    normalizeTodoTimeValue(value) {
        // 手机端主输入框是 text，这里统一兜底成 HH:mm，避免保存半截时间
        const raw = String(value || '').trim();
        if (!raw) return '';

        const simpleDigits = raw.replace(/[^\d]/g, '');
        let hour = '';
        let minute = '';

        if (/^\d{1,2}:\d{1,2}$/.test(raw)) {
            [hour, minute] = raw.split(':');
        } else if (simpleDigits.length === 3) {
            hour = simpleDigits.slice(0, 1);
            minute = simpleDigits.slice(1);
        } else if (simpleDigits.length === 4) {
            hour = simpleDigits.slice(0, 2);
            minute = simpleDigits.slice(2);
        } else {
            return null;
        }

        const hh = Number(hour);
        const mm = Number(minute);
        if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
            return null;
        }

        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    },

    openCountdownModal(id = null) {
        const modal = document.getElementById('modal-countdown');
        const title = document.getElementById('countdown-modal-title');
        const textInput = document.getElementById('countdown-text');
        const dateInput = document.getElementById('countdown-date-input');
        if (!modal || !textInput || !dateInput) return;

        const item = id ? STATE.countdownDays.find(x => x.id === id) : null;
        const mode = item?.mode || STATE.countdownMode || 'down';
        STATE.editingCountdownDayId = item ? item.id : null;
        const dateKey = item?.dateKey || TodoContext.getTodayKey();
        STATE.countdownDraftDateOffset = Math.floor(TodoContext.diffDays(dateKey) / 7) * 7;

        if (title) title.textContent = item ? '编辑日期' : (mode === 'up' ? '新增正数日' : '新增倒数日');
        textInput.value = item?.text || '';
        dateInput.value = dateKey;
        this.setCountdownModalMode(mode);
        this.renderTodoDatePicker('countdown');
        modal.classList.remove('hidden');
        textInput.focus();
    },

    closeCountdownModal() {
        document.getElementById('modal-countdown')?.classList.add('hidden');
        STATE.editingCountdownDayId = null;
    },

    setCountdownMode(mode) {
        STATE.countdownMode = mode === 'up' ? 'up' : 'down';
        const tabs = document.querySelector('.countdown-tabs');
        if (tabs) {
            // ★ 胶囊底色交给 CSS 滑块动起来，这里只同步当前方向。
            tabs.classList.toggle('is-up', STATE.countdownMode === 'up');
        }
        document.querySelectorAll('.countdown-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === STATE.countdownMode);
        });
        this.renderCountdownDays();
    },

    setCountdownModalMode(mode) {
        const nextMode = mode === 'up' ? 'up' : 'down';
        document.querySelectorAll('.countdown-modal-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === nextMode);
        });
        const title = document.getElementById('countdown-modal-title');
        if (title && !STATE.editingCountdownDayId) {
            title.textContent = nextMode === 'up' ? '新增正数日' : '新增倒数日';
        }
    },

    getCountdownModalMode() {
        return document.querySelector('.countdown-modal-tab.active')?.dataset.mode || 'down';
    },

    async saveCountdownFromModal() {
        const textInput = document.getElementById('countdown-text');
        const dateInput = document.getElementById('countdown-date-input');
        const text = textInput ? textInput.value.trim() : '';
        const dateKey = dateInput ? dateInput.value : TodoContext.getTodayKey();
        const mode = this.getCountdownModalMode();

        if (!text) {
            alert('写点日期名称吧');
            return;
        }

        const oldItem = STATE.editingCountdownDayId
            ? STATE.countdownDays.find(item => item.id === STATE.editingCountdownDayId)
            : null;

        if (oldItem) {
            oldItem.text = text;
            oldItem.dateKey = dateKey;
            oldItem.mode = mode;
            oldItem.updatedAt = Date.now();
        } else {
            STATE.countdownDays.push({
                id: 'countdown_' + Date.now(),
                text,
                dateKey,
                mode,
                done: false,
                createdAt: Date.now()
            });
        }

        STATE.countdownMode = mode;
        await Storage.saveCountdownDays();
        this.closeCountdownModal();
        this.renderCountdownDays();
    },

    renderCountdownDays() {
        const list = document.getElementById('countdown-list');
        const empty = document.getElementById('countdown-empty');
        if (!list) return;

        const tabs = document.querySelector('.countdown-tabs');
        if (tabs) {
            // ★ 首次渲染 / 保存后回到当前类型时，也要把胶囊滑块的位置校准。
            tabs.classList.toggle('is-up', STATE.countdownMode === 'up');
        }
        document.querySelectorAll('.countdown-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === STATE.countdownMode);
        });

        const items = (STATE.countdownDays || [])
            .filter(item => item && item.mode === STATE.countdownMode && item.text)
            .sort((a, b) => {
                if (!!a.done !== !!b.done) return a.done ? 1 : -1;
                return TodoContext.diffDays(a.dateKey) - TodoContext.diffDays(b.dateKey);
            });

        list.innerHTML = '';
        if (empty) empty.style.display = items.length ? 'none' : 'block';
        items.forEach(item => list.appendChild(this.createCountdownElement(item)));
    },

    createCountdownElement(item) {
        const div = document.createElement('div');
        const diff = TodoContext.diffDays(item.dateKey);
        const dayText = item.mode === 'up' ? `已有${-diff}天` : `${diff}天`;
        div.className = `countdown-item${item.done ? ' done' : ''}`;
        div.dataset.id = item.id;
        div.innerHTML = `
            <button type="button" class="todo-check-btn" data-action="toggle-countdown" title="完成/取消完成"></button>
            <div class="countdown-item-text">${this.escapeHtml(item.text)}</div>
            <div class="countdown-day-number">${dayText}</div>
            <button type="button" class="todo-icon-btn" data-action="edit-countdown" title="编辑">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button type="button" class="todo-icon-btn danger" data-action="delete-countdown" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        `;
        return div;
    },

    async handleCountdownAction(action, id) {
        const item = STATE.countdownDays.find(x => x.id === id);
        if (!item) return;

        if (action === 'toggle-countdown') {
            item.done = !item.done;
            item.updatedAt = Date.now();
            await Storage.saveCountdownDays();
            this.renderCountdownDays();
        } else if (action === 'edit-countdown') {
            this.openCountdownModal(id);
        } else if (action === 'delete-countdown') {
            if (!confirm('确定要删除这个日期吗？')) return;
            STATE.countdownDays = STATE.countdownDays.filter(x => x.id !== id);
            await Storage.saveCountdownDays();
            this.renderCountdownDays();
        }
    },
    // ★★★★★ 探索 TO DO / 倒数日 END：页面逻辑层 ★★★★★

    // ★★★★★ 心笺 START：页面逻辑层 ★★★★★
    renderHeartNoteAvatar(contact) {
        if (contact.avatar && (contact.avatar.startsWith('data:') || contact.avatar.startsWith('http'))) {
            return `<img class="heart-note-avatar" src="${this.escapeHtml(contact.avatar)}" alt="">`;
        }
        return `<div class="heart-note-avatar heart-note-text-avatar">${this.escapeHtml(contact.avatar || '🌼')}</div>`;
    },

    renderHeartNoteContacts() {
        const list = document.getElementById('heart-note-contact-list');
        const empty = document.getElementById('heart-note-contact-empty');
        if (!list || typeof AgentHeartNoteManager === 'undefined') return;
        const contacts = STATE.contacts || [];
        list.innerHTML = '';
        if (empty) empty.style.display = contacts.length ? 'none' : 'block';
        contacts.forEach(contact => {
            const notebook = AgentHeartNoteManager.ensureNotebook(contact.id);
            const injectedCount = AgentHeartNoteManager.getInjectRecords(notebook, new Date()).length;
            const item = document.createElement('div');
            item.className = 'heart-note-contact';
            item.dataset.id = contact.id;
            item.innerHTML = `
                ${this.renderHeartNoteAvatar(contact)}
                <div class="heart-note-contact-info">
                    <div class="heart-note-contact-name">${this.escapeHtml(contact.name || '未命名角色')}</div>
                    <div class="heart-note-contact-status">${notebook.records.length}条心笺 · 注入${injectedCount}条</div>
                </div>
                <span class="heart-note-contact-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6L16 12L9 18" /></svg></span>
            `;
            list.appendChild(item);
        });
    },

    openHeartNoteDetail(contactId) {
        if (!(STATE.contacts || []).some(contact => contact.id === contactId)) return;
        STATE.currentHeartNoteContactId = contactId;
        STATE.heartNoteViewMode = 'all';
        UI.switchView('heart-note-detail');
    },

    setHeartNoteViewMode(mode) {
        STATE.heartNoteViewMode = mode === 'injected' ? 'injected' : 'all';
        this.renderHeartNoteDetail();
    },

    formatHeartNoteTime(record) {
        const date = new Date(Number(record?.createdAt) || Date.now());
        const pad = value => String(value).padStart(2, '0');
        return `${record?.dateKey || AgentHeartNoteManager.getTodayKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },

    renderHeartNoteDetail() {
        const contact = (STATE.contacts || []).find(item => item.id === STATE.currentHeartNoteContactId);
        const title = document.getElementById('heart-note-detail-title');
        const input = document.getElementById('heart-note-inject-days');
        const status = document.getElementById('heart-note-status');
        const list = document.getElementById('heart-note-detail-list');
        const empty = document.getElementById('heart-note-detail-empty');
        const tabs = document.querySelector('.heart-note-tabs');
        if (!list || typeof AgentHeartNoteManager === 'undefined') return;
        if (!contact) {
            if (title) title.textContent = '心笺';
            list.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }

        const notebook = AgentHeartNoteManager.ensureNotebook(contact.id);
        const injected = AgentHeartNoteManager.getInjectRecords(notebook, new Date());
        const mode = STATE.heartNoteViewMode === 'injected' ? 'injected' : 'all';
        const records = (mode === 'injected' ? injected : notebook.records)
            .filter(record => record && record.text)
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        if (title) title.textContent = contact.name || '心笺';
        if (input) input.value = notebook.injectDays;
        if (status) status.textContent = `${notebook.records.length}条心笺 · 注入${injected.length}条`;
        tabs?.classList.toggle('is-injected', mode === 'injected');
        document.querySelectorAll('.heart-note-tab').forEach(tab => {
            const active = tab.dataset.mode === mode;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        list.innerHTML = '';
        records.forEach(record => {
            const card = document.createElement('div');
            card.className = `heart-note-card${record.cancelled === true ? ' cancelled' : ''}`;
            card.dataset.id = record.id;
            card.innerHTML = `
                <div class="heart-note-card-foot">
                    <span class="heart-note-time">${this.escapeHtml(this.formatHeartNoteTime(record))}</span>
                    <div class="heart-note-actions">
                        <button type="button" class="heart-note-icon-btn heart-note-pin-btn${record.alwaysInject ? ' active' : ''}" data-action="toggle-heart-note-star" title="${record.alwaysInject ? '取消星标' : '星标'}" aria-pressed="${record.alwaysInject ? 'true' : 'false'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path class="heart-note-pin-shape" d="M12 17v5"></path><path class="heart-note-pin-shape" d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path></svg></button>
                        <button type="button" class="heart-note-icon-btn" data-action="edit-heart-note" title="修改"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                        <button type="button" class="heart-note-icon-btn heart-note-cancel-btn${record.cancelled === true ? ' active' : ''}" data-action="cancel-heart-note" title="${record.cancelled === true ? '恢复心笺' : '取消心笺'}" aria-pressed="${record.cancelled === true ? 'true' : 'false'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5v7"/><path d="M14.5 8.5v7"/></svg></button>
                        <button type="button" class="heart-note-icon-btn danger" data-action="delete-heart-note" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                    </div>
                </div>
                <div class="heart-note-text">${this.escapeHtml(record.text)}</div>
`;
            list.appendChild(card);
        });
        if (empty) {
            empty.style.display = records.length ? 'none' : 'block';
            empty.textContent = mode === 'injected' ? '当前没有会注入上下文的心笺。' : '还没有心笺，点右上角加一条吧。';
        }
    },

    openHeartNoteModal(noteId = null) {
        const notebook = AgentHeartNoteManager.getNotebook(STATE.currentHeartNoteContactId);
        const record = noteId ? (notebook?.records || []).find(item => item.id === noteId) : null;
        STATE.editingHeartNoteId = record?.id || null;
        const modal = document.getElementById('modal-heart-note-item');
        const title = document.getElementById('heart-note-item-modal-title');
        const input = document.getElementById('heart-note-item-text');
        if (title) title.textContent = record ? '编辑心笺' : '添加心笺';
        if (input) input.value = record?.text || '';
        modal?.classList.remove('hidden');
        input?.focus();
    },

    closeHeartNoteModal() {
        document.getElementById('modal-heart-note-item')?.classList.add('hidden');
        STATE.editingHeartNoteId = null;
    },

    async saveHeartNoteItem() {
        const contactId = STATE.currentHeartNoteContactId;
        if (!contactId) return;
        const notebook = AgentHeartNoteManager.ensureNotebook(contactId);
        const input = document.getElementById('heart-note-item-text');
        const text = AgentHeartNoteManager.cleanText(input?.value || '');
        if (!text) return alert('写点心笺内容吧');
        const now = Date.now();
        const editing = (notebook.records || []).find(record => record.id === STATE.editingHeartNoteId);
        const dateKey = editing?.dateKey || AgentHeartNoteManager.getTodayKey(new Date(now));
        const duplicateKey = AgentHeartNoteManager.buildDuplicateKey(text, dateKey);
        const duplicate = notebook.records.some(record => record.id !== editing?.id && AgentHeartNoteManager.buildDuplicateKey(record.text, record.dateKey || dateKey) === duplicateKey);
        if (duplicate) return alert('同一天已经有同名心笺了');
        if (editing) Object.assign(editing, { text, updatedAt: now });
        else notebook.records.push({ id: `heart_note_${now}_${Math.random().toString(36).slice(2, 8)}`, text, dateKey, createdAt: now, updatedAt: now, alwaysInject: false, cancelled: false, source: 'user' });
        notebook.updatedAt = now;
        await Storage.saveCharacterHeartNotes();
        this.closeHeartNoteModal();
        this.renderHeartNoteContacts();
        this.renderHeartNoteDetail();
    },

    async deleteHeartNoteItem(noteId) {
        const notebook = AgentHeartNoteManager.getNotebook(STATE.currentHeartNoteContactId);
        if (!notebook || !confirm('确定要删除这条心笺吗？')) return;
        notebook.records = notebook.records.filter(record => record.id !== noteId);
        notebook.updatedAt = Date.now();
        await Storage.saveCharacterHeartNotes();
        this.renderHeartNoteContacts();
        this.renderHeartNoteDetail();
    },

    async toggleHeartNoteStar(noteId) {
        const notebook = AgentHeartNoteManager.getNotebook(STATE.currentHeartNoteContactId);
        const record = (notebook?.records || []).find(item => item.id === noteId);
        if (!record) return;
        record.alwaysInject = record.alwaysInject !== true;
        record.updatedAt = Date.now();
        notebook.updatedAt = Date.now();
        await Storage.saveCharacterHeartNotes();
        this.renderHeartNoteContacts();
        this.renderHeartNoteDetail();
    },

    async toggleHeartNoteCancelled(noteId) {
        const notebook = AgentHeartNoteManager.getNotebook(STATE.currentHeartNoteContactId);
        const record = (notebook?.records || []).find(item => item.id === noteId);
        if (!record) return;
        // ★ cancel 与 TODO 一样可再次点击恢复；心笺本体和星标状态都原样保留。
        record.cancelled = record.cancelled !== true;
        record.updatedAt = Date.now();
        notebook.updatedAt = Date.now();
        await Storage.saveCharacterHeartNotes();
        this.renderHeartNoteContacts();
        this.renderHeartNoteDetail();
    },

    async saveHeartNoteInjectDays() {
        const notebook = AgentHeartNoteManager.getNotebook(STATE.currentHeartNoteContactId);
        const input = document.getElementById('heart-note-inject-days');
        if (!notebook || !input) return;
        notebook.injectDays = Math.max(1, Number.parseInt(input.value, 10) || AgentHeartNoteManager.defaultInjectDays);
        notebook.updatedAt = Date.now();
        await Storage.saveCharacterHeartNotes();
        this.renderHeartNoteContacts();
        this.renderHeartNoteDetail();
    },
    // ★★★★★ 心笺 END：页面逻辑层 ★★★★★

    // ★★★★★ Agent START：TODO 管理设置 + skill 执行 ★★★★★
    renderAgentList() {
        const list = document.getElementById('agent-list');
        if (!list) return;

        const todoEnabled = STATE.settings.AGENT_TODO_MANAGER_ENABLED === true;
        const heartNoteEnabled = STATE.settings.AGENT_HEART_NOTE_MANAGER_ENABLED === true;
        const presetIndex = Number.isInteger(STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX)
            ? STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX
            : -1;
        const preset = presetIndex >= 0 ? (STATE.settings.API_PRESETS || [])[presetIndex] : null;
        const modelText = preset ? `模型：${preset.name || '未命名预设'}` : '模型：跟随全局默认设置';

        const agentLogs = typeof API !== 'undefined' && typeof API.getAgentContextLogs === 'function'
            ? API.getAgentContextLogs()
            : { latest: null, pre: [], post: [] };
        const agentLogStatus = agentLogs.latest
            ? `最新：${agentLogs.latest.label || 'Agent 调用'}`
            : '点击查看最新记录';

        list.innerHTML = `
            <div class="agent-card" data-agent-log="context">
                <div class="agent-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 4h14"></path><path d="M5 8h14"></path><path d="M5 12h10"></path><path d="M5 18h6"></path><path d="M15 18h4"></path>
                    </svg>
                </div>
                <div class="agent-card-info">
                    <div class="agent-card-name">Agent 上下文日志</div>
                    <div class="agent-card-status">${this.escapeHtml(agentLogStatus)}</div>
                </div>
                <span class="agent-card-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>
                </span>
            </div>
            <div class="agent-card ${todoEnabled ? 'enabled' : ''}" data-agent="todo-manager">
                <div class="agent-card-icon">
                    <svg width="0.95em" height="0.95em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="m3 6 1 1 2-2"></path><path d="m3 12 1 1 2-2"></path><path d="m3 18 1 1 2-2"></path>
                    </svg>
                </div>
                <div class="agent-card-info">
                    <div class="agent-card-name">TODO 管理</div>
                    <div class="agent-card-status">${this.escapeHtml(todoEnabled ? `已启用 · ${modelText}` : `未启用 · ${modelText}`)}</div>
                </div>
                <label class="agent-menu-switch" title="启用/关闭 TODO 管理">
                    <input type="checkbox" id="agent-todo-manager-toggle" ${todoEnabled ? 'checked' : ''}>
                    <span class="app-switch-slider agent-switch-slider"></span>
                </label>
            </div>
            <div class="agent-card ${heartNoteEnabled ? 'enabled' : ''}" data-agent="heart-note-manager">
                <div class="agent-card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="0.95em" height="0.95em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-sparkles"><path d="M10 3H8"></path><path d="m15.007 5.008 3.987 3.986"></path><path d="M20 15v4"></path><path d="M21.174 6.813a2.82 2.82 0 0 0-3.986-3.987L3.842 16.175a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="M22 17h-4"></path><path d="M4 5v4"></path><path d="M6 7H2"></path><path d="M9 2v2"></path></svg>
                </div>
                <div class="agent-card-info">
                    <div class="agent-card-name">心笺管理</div>
                    <div class="agent-card-status">${this.escapeHtml(heartNoteEnabled ? `已启用 · ${modelText}` : `未启用 · ${modelText}`)}</div>
                </div>
                <label class="agent-menu-switch" title="启用/关闭心笺管理">
                    <input type="checkbox" id="agent-heart-note-manager-toggle" ${heartNoteEnabled ? 'checked' : ''}>
                    <span class="app-switch-slider agent-switch-slider"></span>
                </label>
            </div>
        `;
    },

    buildAgentCapabilityPrompt() {
        // ★★★★★ Agent：能力注入 START ★★★★★
        // 开启 skill 后向各 skill 收集能力说明；Router 只管分发，不直接塞业务 prompt。
        const capabilities = [];
        if (
            STATE.settings.AGENT_TODO_MANAGER_ENABLED === true
            && typeof AgentTodoManager !== 'undefined'
            && typeof AgentTodoManager.buildCapabilityPrompt === 'function'
        ) {
            capabilities.push(AgentTodoManager.buildCapabilityPrompt());
        }
        if (
            STATE.settings.AGENT_HEART_NOTE_MANAGER_ENABLED === true
            && typeof AgentHeartNoteManager !== 'undefined'
            && typeof AgentHeartNoteManager.buildCapabilityPrompt === 'function'
        ) {
            capabilities.push(AgentHeartNoteManager.buildCapabilityPrompt());
        }
        if (!capabilities.length) return '';
        return [
            '# 能力',
            '',
            ...capabilities.map(text => `- ${text}`)
        ].join('\n');
        // ★★★★★ Agent：能力注入 END ★★★★★
    },

    formatAgentContextLogItem(log, index) {
        if (!log) return '';
        const timeText = log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : '未知时间';
        const tokenText = `输入 ${log.prompt_tokens ?? 0} / 输出 ${log.completion_tokens ?? 0} / 总 ${log.total_tokens ?? 0}`;
        return [
            `#${index + 1} ${log.label || 'Agent 调用'} · ${timeText}`,
            `模型：${log.model || '未知模型'} · ${tokenText}`,
            '',
            '【请求】',
            log.content || log.request || '无请求记录',
            '',
            '【返回】',
            log.response || '暂无返回记录'
        ].join('\n');
    },

    renderAgentContextLogColumn(title, logs = []) {
        const items = Array.isArray(logs) ? logs.slice().reverse() : [];
        if (!items.length) {
            return `
                <section class="agent-log-section">
                    <h4>${this.escapeHtml(title)}</h4>
                    <div class="agent-log-empty">暂无记录</div>
                </section>
            `;
        }

        return `
            <section class="agent-log-section">
                <h4>${this.escapeHtml(title)}</h4>
                ${items.map((log, index) => `
                    <details class="agent-log-item" ${index === 0 ? 'open' : ''}>
                        <summary>${this.escapeHtml(log.label || 'Agent 调用')} · ${this.escapeHtml(log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : '未知时间')}</summary>
                        <pre>${this.escapeHtml(this.formatAgentContextLogItem(log, index))}</pre>
                    </details>
                `).join('')}
            </section>
        `;
    },

    async openAgentContextLogModal() {
        // ★★★★★ Agent 上下文日志 START：最新一条持久化查看 ★★★★★
        // Agent 模型日志只保留最新一次调用，面板样式跟主模型“上下文日志”保持一致。
        let modal = document.getElementById('agent-context-log-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'agent-context-log-modal';
            modal.className = 'log-modal hidden';
            modal.innerHTML = `
                <div class="glass-panel log-modal-content">
                    <div class="log-modal-header">
                        <div>
                            <h3 class="shangxiawen">Agent 上下文日志</h3>
                        </div>
                        <button id="agent-context-log-close-btn" class="log-close-btn" type="button">&times;</button>
                    </div>
                    <div class="log-modal-body">
                        <pre><code id="agent-context-log-content" class="log-content-text">暂无 Agent 调用记录...</code></pre>
                    </div>
                    <div id="agent-context-log-token" class="log-token-count"></div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (event) => {
                if (event.target === modal || event.target.closest('#agent-context-log-close-btn')) {
                    modal.classList.add('hidden');
                }
            });
        }

        const log = typeof API !== 'undefined' && typeof API.getLatestAgentContextLogPersisted === 'function'
            ? await API.getLatestAgentContextLogPersisted()
            : null;
        const contentEl = document.getElementById('agent-context-log-content');
        const tokenEl = document.getElementById('agent-context-log-token');
        if (log) {
            const promptTokens = log.prompt_tokens ?? log.tokens ?? 0;
            const completionTokens = log.completion_tokens ?? 0;
            const totalTokens = log.total_tokens ?? promptTokens + completionTokens;
            const tokenSource = log.isEstimated ? '估算' : '真实';
            const sourceText = log.label || 'Agent 调用';
            const hasPromptCacheUsage = log.has_prompt_cache_usage === true;
            const hitTokens = log.prompt_cache_hit_tokens ?? 0;
            const missTokens = log.prompt_cache_miss_tokens ?? 0;
            const hitRate = log.prompt_cache_hit_rate;
            const hitRateText = Number.isFinite(hitRate) ? `${(hitRate * 100).toFixed(2)}%` : '暂无比例';
            const promptCacheText = hasPromptCacheUsage
                ? `${hitTokens} 命中 / ${missTokens} 未命中（${hitRateText}）`
                : '未返回';

            if (contentEl) contentEl.innerText = log.content || log.request || '无请求记录';
            if (tokenEl) {
                tokenEl.innerHTML = `
                    <div class="log-token-grid single">
                        <div class="log-token-column">
                            <div>来源：${this.escapeHtml(sourceText)}（${this.escapeHtml(tokenSource)} Token）</div>
                            <div>输入 Token：${this.escapeHtml(promptTokens)}</div>
                            <div>输出 Token：${this.escapeHtml(completionTokens)}</div>
                            <div>总 Token：${this.escapeHtml(totalTokens)}</div>
                            <div>缓存命中：${this.escapeHtml(promptCacheText)}</div>
                        </div>
                    </div>
                `;
            }
        } else {
            if (contentEl) contentEl.innerText = '暂无 Agent 调用记录。';
            if (tokenEl) {
                tokenEl.innerHTML = `
                    <div class="log-token-grid single">
                        <div class="log-token-column">
                            <div>来源：无</div>
                            <div>输入 Token：0</div>
                            <div>输出 Token：0</div>
                            <div>总 Token：0</div>
                            <div>缓存命中：未返回</div>
                        </div>
                    </div>
                `;
            }
        }
        modal.classList.remove('hidden');
        // ★★★★★ Agent 上下文日志 END：最新一条持久化查看 ★★★★★
    },

    async toggleAgentTodoManagerEnabled(enabled) {
        STATE.settings.AGENT_TODO_MANAGER_ENABLED = !!enabled;
        // ★ 旧字段暂时镜像 TODO 开关，保持旧后台 pre-agent 入口可回滚。
        STATE.settings.AGENT_SKILL_ROUTER_ENABLED = !!enabled;
        await Storage.saveSettings();
        this.renderAgentList();
    },

    syncAgentHeartNoteToggles() {
        // ★ 心笺管理只有一个设置值；探索页和 Agent 页只是同一开关的两个操作入口。
        const enabled = STATE.settings.AGENT_HEART_NOTE_MANAGER_ENABLED === true;
        const exploreToggle = document.getElementById('heart-note-enable-toggle');
        const agentToggle = document.getElementById('agent-heart-note-manager-toggle');
        if (exploreToggle) exploreToggle.checked = enabled;
        if (agentToggle) agentToggle.checked = enabled;
    },

    async toggleAgentHeartNoteManagerEnabled(enabled) {
        STATE.settings.AGENT_HEART_NOTE_MANAGER_ENABLED = !!enabled;
        await Storage.saveSettings();
        this.renderAgentList();
        this.syncAgentHeartNoteToggles();
    },

    openAgentSettings() {
        const modal = document.getElementById('modal-agent-settings');
        const apiSelect = document.getElementById('agent-todo-api-preset');
        if (!modal || !apiSelect) return;

        const currentIndex = Number.isInteger(STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX)
            ? STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX
            : -1;

        apiSelect.innerHTML = '<option value="-1">-- 跟随全局默认 --</option>';
        (STATE.settings.API_PRESETS || []).forEach((preset, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            const modelName = preset.model || '未知模型';
            opt.textContent = `${preset.name} (${modelName})`;
            if (index === currentIndex) opt.selected = true;
            apiSelect.appendChild(opt);
        });

        modal.classList.remove('hidden');
    },

    async saveAgentSettings() {
        const modal = document.getElementById('modal-agent-settings');
        const apiSelect = document.getElementById('agent-todo-api-preset');
        const presetIndex = parseInt(apiSelect?.value ?? '-1', 10);

        STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX = Number.isFinite(presetIndex) ? presetIndex : -1;
        await Storage.saveSettings();
        modal?.classList.add('hidden');
        this.renderAgentList();
    },

    buildAgentTodoManagerRequestSettings() {
        const settings = {
            API_URL: STATE.settings.API_URL,
            API_KEY: STATE.settings.API_KEY,
            MODEL: STATE.settings.MODEL,
            ASYNC_BACKEND_ENABLED: false,
            MAX_TOKENS: 1200,
            TEMPERATURE: 0.1,
            CONTEXT_LIMIT: 4,
            CUSTOM_REQUEST_BODY_JSON: STATE.settings.CUSTOM_REQUEST_BODY_JSON || ''
        };

        const presetIndex = STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX;
        if (typeof presetIndex === 'number' && presetIndex >= 0) {
            const preset = (STATE.settings.API_PRESETS || [])[presetIndex];
            if (preset) {
                console.log(`[Agent] TODO 管理使用预设: ${preset.name}`);
                settings.API_URL = preset.url;
                settings.API_KEY = preset.key;
                settings.MODEL = preset.model;
                settings.CUSTOM_REQUEST_BODY_JSON = preset.extra_body_json || '';
                if (preset.max_tokens !== undefined && preset.max_tokens !== '') settings.MAX_TOKENS = Number(preset.max_tokens);
                if (preset.temperature !== undefined && preset.temperature !== '') settings.TEMPERATURE = Number(preset.temperature);
            }
        }

        return settings;
    },

    buildAgentSkillRouterRequestSettings(baseSettings) {
        // ★★★★★ Agent：总路由轻量模型参数 START ★★★★★
        // 总路由只选 Agent，不解析 TODO 字段；这里把输出预算压小，减少每轮闲聊的副模型费用。
        let customRequestBodyJson = baseSettings?.CUSTOM_REQUEST_BODY_JSON || '';
        try {
            const extra = customRequestBodyJson.trim() ? JSON.parse(customRequestBodyJson) : null;
            if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
                delete extra.max_tokens;
                delete extra.maxOutputTokens;
                if (extra.generationConfig && typeof extra.generationConfig === 'object') {
                    delete extra.generationConfig.maxOutputTokens;
                }
                customRequestBodyJson = JSON.stringify(extra);
            }
        } catch (error) {
            // ★ 自定义请求体坏了就交给 API.chat 原本的报错流程；这里只负责移除路由预算覆盖项。
        }
        const routerSettings = {
            ...baseSettings,
            TEMPERATURE: 0,
            MAX_TOKENS: Math.min(Number(baseSettings?.MAX_TOKENS) || 1200, 180),
            CUSTOM_REQUEST_BODY_JSON: customRequestBodyJson
        };
        // ★★★★★ Agent：总路由轻量模型参数 END ★★★★★
        return routerSettings;
    },

    buildAgentPostTodoRequestSettings(baseSettings) {
        // ★★★★★ Post Agent：回复后 TODO 建议轻量参数 START ★★★★★
        // post-agent 只看角色回复并生成待确认建议，输出很短，继续压小 token 预算。
        return {
            ...this.buildAgentSkillRouterRequestSettings(baseSettings),
            MAX_TOKENS: Math.min(Number(baseSettings?.MAX_TOKENS) || 1200, 700)
        };
    },

    normalizeAgentExecutions(userMessage) {
        // ★★★★★ Agent：消息级执行状态协议 START ★★★★★
        // agentExecutions 是消息级幂等表：每个 skill 一个 key。
        // 新 skill 请写成 agentExecutions.<skillName>，只保存 status / intents / suggestions / reason / error / message 等运行恢复字段；
        // 不要把日志字段（source、updatedAt、空数组、空 error）塞进聊天历史。
        if (!userMessage || typeof userMessage !== 'object') return {};
        if (!userMessage.agentExecutions || typeof userMessage.agentExecutions !== 'object' || Array.isArray(userMessage.agentExecutions)) {
            userMessage.agentExecutions = {};
        }
        // ★★★★★ Agent：消息级执行状态协议 END ★★★★★
        return userMessage.agentExecutions;
    },

    normalizeAgentExecutionSkillName(agentName) {
        // ★★★★★ Agent：旧 key 兼容 START ★★★★★
        // post_router / todo_manager_post 是早期 post-agent 分层留下的历史 key；
        // 新的『』协议里，router 只是过程，真正需要防重复的是 todo 这个 skill。
        const name = String(agentName || '').trim();
        if (name === 'todo_manager_post' || name === 'post_router') return 'todo';
        return name;
        // ★★★★★ Agent：旧 key 兼容 END ★★★★★
    },

    getAgentExecutionLegacyKeys(agentName) {
        const name = String(agentName || '').trim();
        if (name === 'todo' || name === 'todo_manager_post' || name === 'post_router') {
            return ['todo', 'todo_manager_post', 'post_router'];
        }
        return [name];
    },

    getAgentExecutionState(userMessage, agentName) {
        const executions = this.normalizeAgentExecutions(userMessage);
        const keys = this.getAgentExecutionLegacyKeys(agentName);
        for (const key of keys) {
            const state = executions[key];
            if (state && typeof state === 'object' && !Array.isArray(state)) return state;
        }
        return null;
    },

    buildAppliedAgentRuntimeResult(userMessage, agentName) {
        const state = this.getAgentExecutionState(userMessage, agentName);
        if (state?.status !== 'applied') return null;
        const prompt = String(state.resultPrompt || '').trim();
        return prompt ? { results: [{ prompt, reused: true }], prompts: [prompt] } : null;
    },

    compactAgentExecutionState(current = {}, patch = {}) {
        const merged = {
            ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}),
            ...(patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {})
        };
        const compact = {};
        const status = String(merged.status || '').trim();
        if (status) compact.status = status;

        const rawIntents = Array.isArray(merged.intents) ? merged.intents : (Array.isArray(merged.intentTexts) ? merged.intentTexts : []);
        const intents = rawIntents.map(text => String(text || '').trim()).filter(Boolean);
        if (intents.length) compact.intents = intents;

        const suggestions = Array.isArray(merged.suggestions) ? merged.suggestions.filter(Boolean) : [];
        if (status === 'suggested' && suggestions.length) compact.suggestions = suggestions;

        const reason = String(merged.reason || '').trim();
        if (reason && status !== 'applied') compact.reason = reason;

        const error = String(merged.error || '').trim();
        if (error) compact.error = error;

        const message = String(merged.message || '').trim();
        if (message) compact.message = message;

        const resultPrompt = String(merged.resultPrompt || '').trim();
        if (resultPrompt) compact.resultPrompt = resultPrompt;

        const confirmationId = String(merged.confirmationId || '').trim();
        if (confirmationId && status === 'suggested') compact.confirmationId = confirmationId;

        return compact;
    },

    ensureAgentConfirmationId(contact, assistantMessage, skillName) {
        const state = this.getAgentExecutionState(assistantMessage, skillName) || {};
        if (state.confirmationId) return state.confirmationId;
        const confirmationId = `agent_confirm_${skillName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.setAgentExecutionState(contact, assistantMessage, skillName, { confirmationId }).catch(error => {
            console.warn('[Agent][确认恢复] 保存 confirmationId 失败:', error);
        });
        return confirmationId;
    },

    hasAgentConfirmationNotice(confirmationId) {
        return !!confirmationId && Array.from(document.querySelectorAll('.app-top-notice[data-agent-confirmation-id]'))
            .some(notice => notice.dataset.agentConfirmationId === confirmationId);
    },

    bindAgentConfirmationNotice(notice, confirmationId) {
        if (notice && confirmationId) notice.dataset.agentConfirmationId = confirmationId;
        return notice;
    },

    restorePendingAgentConfirmations(contact) {
        // ★ 通用恢复入口：页面刷新或重新进入聊天后，TODO/心笺共用同一次扫描。
        if (!contact || !Array.isArray(contact.history)) return;
        let migratedUndoneState = false;
        contact.history.forEach(message => {
            if (!message || message.role !== 'assistant') return;
            const todoState = this.getAgentExecutionState(message, 'todo');
            // ★ 旧版撤销后误写成 suggested；进入聊天时迁移为终态，避免历史 suggestion 再次弹出。
            if (todoState?.status === 'suggested' && todoState.reason === 'user_undo_apply') {
                todoState.status = 'undone';
                delete todoState.suggestions;
                delete todoState.confirmationId;
                migratedUndoneState = true;
            }
            if (todoState?.status === 'suggested' && Array.isArray(todoState.suggestions) && todoState.suggestions.length) {
                const id = todoState.confirmationId || this.ensureAgentConfirmationId(contact, message, 'todo');
                if (!this.hasAgentConfirmationNotice(id)) this.showAgentPostTodoSuggestionNotice(contact, message, todoState.suggestions);
            }
            const heartState = this.getAgentExecutionState(message, 'heart_note');
            if (heartState?.status === 'suggested' && heartState.reason === 'user_undo_apply') {
                heartState.status = 'undone';
                delete heartState.suggestions;
                delete heartState.confirmationId;
                migratedUndoneState = true;
            }
            if (heartState?.status === 'suggested' && Array.isArray(heartState.suggestions) && heartState.suggestions.length) {
                const id = heartState.confirmationId || this.ensureAgentConfirmationId(contact, message, 'heart_note');
                if (!this.hasAgentConfirmationNotice(id)) this.showAgentHeartNoteSuggestionNotice(contact, message, heartState.suggestions);
            }
        });
        if (migratedUndoneState) {
            Storage.saveContacts().catch(error => console.warn('[Agent][确认恢复] 保存撤销状态迁移失败:', error));
        }
    },

    discardAgentConfirmationsForMessages(messages = []) {
        // ★ Reroll 会删掉旧 assistant 消息，它们尚未处理的顶部确认也必须同时作废。
        const ids = new Set();
        (messages || []).forEach(message => {
            ['todo', 'heart_note'].forEach(skillName => {
                const id = this.getAgentExecutionState(message, skillName)?.confirmationId;
                if (id) ids.add(id);
            });
        });
        document.querySelectorAll('.app-top-notice[data-agent-confirmation-id]').forEach(notice => {
            if (ids.has(notice.dataset.agentConfirmationId)) notice.remove();
        });
    },

    async setAgentExecutionState(contact, userMessage, agentName, patch = {}) {
        if (!userMessage || typeof userMessage !== 'object') return null;
        const executions = this.normalizeAgentExecutions(userMessage);
        const skillName = this.normalizeAgentExecutionSkillName(agentName);
        const current = executions[skillName] && typeof executions[skillName] === 'object'
            ? executions[skillName]
            : {};
        executions[skillName] = this.compactAgentExecutionState(current, patch);
        if (skillName === 'todo') {
            delete executions.todo_manager_post;
            delete executions.post_router;
        }
        if (contact && Array.isArray(contact.history)) {
            await Storage.saveContacts();
        }
        return executions[skillName];
    },

    normalizeAgentPostTodoSuggestions(postResult) {
        const rawOperations = Array.isArray(postResult?.operations) && postResult.operations.length
            ? postResult.operations
            : (Array.isArray(postResult?.todos) ? postResult.todos.map(todo => ({ ...todo, action: 'create' })) : []);
        const seenKeys = new Set((STATE.todoPlans || [])
            .filter(item => item && item.text && item.dateKey)
            .map(item => this.buildTodoDuplicateKey(item.text, item.dateKey)));

        return rawOperations.map((rawOperation, index) => {
            const operation = AgentTodoManager.normalizeOperation(rawOperation);
            if (!operation) return null;
            if (operation.action === 'create') {
                const text = AgentTodoManager.cleanText(operation.text || '', 120);
                const dateKey = AgentTodoManager.isDateKey(operation.dateKey) ? operation.dateKey : AgentTodoManager.getTodayKey();
                const startTime = AgentTodoManager.isTimeValue(operation.startTime) ? operation.startTime : '';
                const endTime = AgentTodoManager.isTimeValue(operation.endTime) ? operation.endTime : '';
                if (!text) return null;
                const duplicateKey = this.buildTodoDuplicateKey(text, dateKey);
                if (seenKeys.has(duplicateKey)) return null;
                seenKeys.add(duplicateKey);
                const item = {
                    action: 'create',
                    id: `todo_${Date.now()}_post_${index}_${Math.random().toString(36).slice(2, 8)}`,
                    text,
                    dateKey,
                    done: false,
                    cancelled: false,
                    createdAt: Date.now()
                };
                if (startTime && endTime && startTime < endTime) {
                    item.startTime = startTime;
                    item.endTime = endTime;
                }
                return item;
            }

            const candidates = AgentTodoManager.findTodoCandidates(operation);
            if (candidates.length !== 1) {
                console.warn('[Agent][TODO建议] 目标匹配失败:', {
                    operation,
                    candidateCount: candidates.length,
                    candidates: candidates.map(item => ({
                        id: item.id,
                        text: item.text,
                        dateKey: item.dateKey,
                        done: item.done === true,
                        cancelled: item.cancelled === true
                    }))
                });
                return null;
            }
            const target = candidates[0];
            const patchInfo = this.buildTodoPatchFromOperation(operation);
            if (!patchInfo || !Object.keys(patchInfo.patch).length) return null;
            return {
                ...operation,
                targetTodoId: target.id,
                targetText: target.text,
                targetDateKey: target.dateKey || AgentTodoManager.getTodayKey(),
                before: { ...target },
                patch: patchInfo.patch,
                actionText: patchInfo.actionText
            };
        }).filter(Boolean).slice(0, 5);
    },

    buildTodoPatchFromOperation(operation = {}) {
        const action = AgentTodoManager.normalizeAction(operation.action);
        const patch = {};
        let actionText = '更新了 TODO';

        if (action === 'complete') {
            patch.done = true;
            patch.cancelled = false;
            actionText = '完成了 TODO';
        } else if (action === 'cancel') {
            patch.cancelled = true;
            patch.done = false;
            actionText = '取消了 TODO';
        } else if (action === 'restore') {
            patch.done = false;
            patch.cancelled = false;
            actionText = '恢复了 TODO';
        }

        const newText = AgentTodoManager.cleanText(operation.newText || '', 120);
        if (newText) {
            patch.text = newText;
            if (actionText === '更新了 TODO') actionText = '改名了 TODO';
        }

        if (AgentTodoManager.isDateKey(operation.newDateKey)) {
            patch.dateKey = operation.newDateKey;
            if (actionText === '更新了 TODO') actionText = '调整了 TODO 日期';
        }

        if (AgentTodoManager.isTimeValue(operation.startTime) && AgentTodoManager.isTimeValue(operation.endTime) && operation.startTime < operation.endTime) {
            patch.startTime = operation.startTime;
            patch.endTime = operation.endTime;
            if (actionText === '更新了 TODO') actionText = '调整了 TODO 时间';
        }

        return { patch, actionText };
    },

    getAgentTodoOperationVerb(operation = {}) {
        const action = AgentTodoManager.normalizeAction(operation.action);
        return {
            create: '添加',
            complete: '完成',
            cancel: '取消',
            restore: '恢复',
            reschedule: '改期',
            rename: '改名',
            retime: '改时间'
        }[action] || '更新';
    },

    buildAgentTodoOperationLabel(operation = {}) {
        if (operation.action === 'create') {
            return this.formatAgentPostTodoSuggestionLine(operation);
        }
        const before = operation.before || {};
        const after = { ...before, ...(operation.patch || {}) };
        if (operation.action === 'reschedule') {
            return `${before.text || operation.targetText}：${before.dateKey || operation.targetDateKey || ''} -> ${after.dateKey || ''}`;
        }
        if (operation.action === 'retime') {
            const oldTime = before.startTime && before.endTime ? `${before.startTime}-${before.endTime}` : '无时间';
            const newTime = after.startTime && after.endTime ? `${after.startTime}-${after.endTime}` : '无时间';
            return `${before.text || operation.targetText}：${oldTime} -> ${newTime}`;
        }
        if (operation.action === 'rename') {
            return `${before.text || operation.targetText} -> ${after.text || ''}`;
        }
        return `${before.text || operation.targetText}：${before.dateKey || operation.targetDateKey || ''}`;
    },

    normalizeAgentTodoOperations(routerResult = {}) {
        if (Array.isArray(routerResult.operations) && routerResult.operations.length) {
            return routerResult.operations.map(item => AgentTodoManager.normalizeOperation(item)).filter(Boolean);
        }
        return AgentTodoManager.buildOperationsFromLegacy(routerResult);
    },

    normalizeAgentTodoCreateOperations(operations = []) {
        const seenKeys = new Set((STATE.todoPlans || [])
            .filter(item => item && item.text && item.dateKey)
            .map(item => this.buildTodoDuplicateKey(item.text, item.dateKey)));

        return operations.map((operation, index) => {
            const text = AgentTodoManager.cleanText(operation.text || '', 120);
            const dateKey = AgentTodoManager.isDateKey(operation.dateKey) ? operation.dateKey : AgentTodoManager.getTodayKey();
            const startTime = AgentTodoManager.isTimeValue(operation.startTime) ? operation.startTime : '';
            const endTime = AgentTodoManager.isTimeValue(operation.endTime) ? operation.endTime : '';
            if (!text) return null;
            const duplicateKey = this.buildTodoDuplicateKey(text, dateKey);
            if (seenKeys.has(duplicateKey)) return null;
            seenKeys.add(duplicateKey);
            const item = {
                id: `todo_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
                text,
                dateKey,
                done: false,
                cancelled: false,
                createdAt: Date.now()
            };
            if (startTime && endTime && startTime < endTime) {
                item.startTime = startTime;
                item.endTime = endTime;
            }
            return item;
        }).filter(Boolean).slice(0, 10);
    },

    buildAsyncBackendAgentPayload(contact, userText, requestSettings, userMessage = null) {
        // ★ 旧 pre-agent 后台执行入口默认关闭；新协议只从角色回复里的『动作意图』触发 TODO 建议。
        if (requestSettings?.AGENT_LEGACY_PRE_AGENT_ENABLED !== true) return null;
        if (STATE.settings.AGENT_SKILL_ROUTER_ENABLED !== true) return null;
        if (typeof AgentTodoManager === 'undefined') return null;
        if (!userText) return null;

        const existingState = this.getAgentExecutionState(userMessage, 'todo_manager');
        if (existingState?.status === 'applied') return null;

        const agentSettings = this.buildAgentTodoManagerRequestSettings();
        const authMode = requestSettings.ASYNC_BACKEND_KEY_MODE || 'client_key';
        return {
            todo_manager: {
                enabled: true,
                user_text: userText,
                contact_name: contact?.name || '',
                todo_snapshot: AgentTodoManager.buildTodoSnapshot(new Date()),
                dynamic_context_insert_mode: requestSettings.DYNAMIC_CONTEXT_INSERT_MODE || 'auto',
                api_url: agentSettings.API_URL,
                auth_mode: authMode,
                api_key: authMode === 'server_secret' ? '' : agentSettings.API_KEY,
                model: agentSettings.MODEL,
                temperature: agentSettings.TEMPERATURE,
                max_tokens: agentSettings.MAX_TOKENS,
                request_body_extra: this.parseRequestBodyExtraForAgent(agentSettings.CUSTOM_REQUEST_BODY_JSON)
            }
        };
    },

    parseRequestBodyExtraForAgent(rawJson) {
        const raw = String(rawJson || '').trim();
        if (!raw) return {};
        try {
            const data = JSON.parse(raw);
            return data && typeof data === 'object' && !Array.isArray(data)
                ? { ...data, stream: false }
                : {};
        } catch (error) {
            console.warn('[Agent][TODO管理] 请求体附加参数解析失败，后台 Agent 将忽略它:', error);
            return {};
        }
    },

    async runAgentTodoManager(contact, userText, userMessage = null, options = {}) {
        // ★ 旧 pre-agent 直接落地链路默认关闭；当前主协议只允许『动作意图』走 post-agent 确认条。
        if (options?.allowLegacyPreAgent !== true) return null;
        if (STATE.settings.AGENT_SKILL_ROUTER_ENABLED !== true) return null;
        if (typeof AgentTodoManager === 'undefined') return null;
        if (!userText) return null;

        const existingState = this.getAgentExecutionState(userMessage, 'todo_manager');
        if (existingState?.status === 'applied') {
            // ★★★★★ Agent：Reroll 防重复执行 START ★★★★★
            // 同一条用户消息已经成功落地过 TODO 操作时，重新生成只复用摘要给主模型，不再重复改 TODO。
            const resultPrompt = String(existingState.resultPrompt || '').trim();
            console.log('[Agent][TODO管理] 已执行过，本轮 Reroll 复用执行摘要。', existingState);
            // ★★★★★ Agent：Reroll 防重复执行 END ★★★★★
            return resultPrompt ? { prompt: resultPrompt, reused: true } : null;
        }

        const settings = this.buildAgentTodoManagerRequestSettings();
        if (!settings.API_URL || !settings.API_KEY || !settings.MODEL) {
            this.showTodoTopNotice('TODO 管理 API 配置缺失，请在 Agent 设置里选择可用模型。', { type: 'failure' });
            return null;
        }

        console.groupCollapsed(`[Agent][TODO管理] ${contact?.name || '未命名角色'} · ${new Date().toLocaleTimeString()}`);
        console.log('[Agent][TODO管理] 用户文字:', userText);
        console.log('[Agent][TODO管理] 请求模型:', {
            url: settings.API_URL,
            model: settings.MODEL,
            presetIndex: STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX
        });

        try {
            await this.setAgentExecutionState(contact, userMessage, 'todo_manager', {
                status: 'pending',
                error: '',
                resultPrompt: ''
            });

            // ★★★★★ Agent：总路由先判定 START ★★★★★
            // 先用短 prompt 只判断是否需要 Agent；闲聊直接放过，不再携带 TODO 专用长 prompt。
            if (typeof AgentSkillRouter === 'undefined') {
                throw new Error('AgentSkillRouter 未加载');
            }
            const routerSettings = this.buildAgentSkillRouterRequestSettings(settings);
            const routerMessages = AgentSkillRouter.buildRouterMessages(contact, userText);
            console.log('[Agent][总路由] Router messages:', routerMessages);
            const rawRouteText = await API.chat(routerMessages, {
                ...routerSettings,
                AGENT_LOG_PHASE: 'pre',
                AGENT_LOG_LABEL: 'Pre 总路由'
            });
            console.log('[Agent][总路由] 原始返回:', rawRouteText);
            const agentRoute = AgentSkillRouter.parseRouterResult(rawRouteText);
            console.log('[Agent][总路由] 解析结果:', agentRoute);

            if (agentRoute.intent === 'NONE') {
                console.log('[Agent][总路由] 本轮不需要 Agent。');
                await this.setAgentExecutionState(contact, userMessage, 'todo_manager', {
                    status: 'skipped',
                    reason: 'router_none'
                });
                return null;
            }

            if (agentRoute.intent === 'ASK_CONFIRMATION') {
                const message = AgentTodoManager.cleanText(
                    agentRoute.confirmation?.message || '这个操作需要你再说清楚一点，我先不自动执行。',
                    140
                );
                this.showTodoTopNotice(`${contact?.name || 'Agent'} 没有执行：${message}`, { type: 'pending' });
                await this.setAgentExecutionState(contact, userMessage, 'todo_manager', {
                    status: 'skipped',
                    reason: 'router_ask_confirmation',
                    message
                });
                return null;
            }

            if (agentRoute.agent !== 'todo_manager') {
                console.log('[Agent][总路由] 未启用的 Agent：', agentRoute.agent);
                await this.setAgentExecutionState(contact, userMessage, 'todo_manager', {
                    status: 'skipped',
                    reason: 'unknown_agent',
                    agent: agentRoute.agent || ''
                });
                return null;
            }
            // ★★★★★ Agent：总路由先判定 END ★★★★★

            // ★★★★★ Agent：TODO 专用执行 START ★★★★★
            // 命中 TODO 后才发送 TODO 详细规则和现有 TODO 快照，保持后续扩展 Agent 时的成本可控。
            const messages = AgentTodoManager.buildExecutorMessages(contact, userText, new Date());
            console.log('[Agent][TODO管理] Executor messages:', messages);
            const rawText = await API.chat(messages, {
                ...settings,
                AGENT_LOG_PHASE: 'pre',
                AGENT_LOG_LABEL: 'Pre TODO 执行'
            });
            console.log('[Agent][TODO管理] 原始返回:', rawText);
            const routerResult = AgentTodoManager.parseRouterResult(rawText);
            console.log('[Agent][TODO管理] 解析结果:', routerResult);
            const result = await this.executeAgentTodoSkill(routerResult, contact);
            // ★★★★★ Agent：TODO 专用执行 END ★★★★★

            const resultPrompt = String(result?.prompt || '').trim();
            await this.setAgentExecutionState(contact, userMessage, 'todo_manager', resultPrompt
                ? {
                    status: 'applied',
                    reason: 'skill_applied',
                    resultPrompt
                }
                : {
                    status: 'skipped',
                    reason: routerResult.intent === 'NONE' ? 'todo_none' : 'skill_noop',
                    resultPrompt: ''
                });
            console.log('[Agent][TODO管理] 执行结果:', result || '无操作');
            return result;
        } catch (error) {
            console.warn('[Agent] TODO 管理 failed:', error);
            await this.setAgentExecutionState(contact, userMessage, 'todo_manager', {
                status: 'failed',
                error: error?.message || String(error),
                resultPrompt: ''
            });
            this.showTodoTopNotice('TODO 管理没有执行：模型返回格式不正确。', { type: 'failure' });
            return {
                prompt: [
                    'TODO 管理本轮没有执行任何 TODO 操作。',
                    '原因：路由结果解析失败或模型返回格式不正确。',
                    '请不要提到系统、工具或 JSON，只需要自然继续回应用户。'
                ].join('\n')
            };
        } finally {
            console.groupEnd();
        }
    },

    // ★★★★★ Agent：意图括号触发主链路 START ★★★★★
    // 只有角色回复里出现『...』时才触发 Agent；普通对话不再每轮调用 router。
    async runAgentPostAgents(contact, assistantText, assistantMessage = null) {
        const todoEnabled = STATE.settings.AGENT_TODO_MANAGER_ENABLED === true;
        const heartNoteEnabled = STATE.settings.AGENT_HEART_NOTE_MANAGER_ENABLED === true;
        if (!todoEnabled && !heartNoteEnabled) return null;
        if (typeof AgentIntentMarkup === 'undefined') return null;
        if (!assistantText || !assistantMessage) return null;

        const actionableText = String(assistantText || '')
            .replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, '')
            .trim();
        const intentTexts = AgentIntentMarkup.extract(actionableText);
        console.groupCollapsed(`[Agent][意图括号] ${contact?.name || '未命名角色'} · ${new Date().toLocaleTimeString()}`);
        console.log('[Agent][意图括号] 角色回复:', assistantText);
        console.log('[Agent][意图括号] 提取结果:', intentTexts);

        try {
            if (!intentTexts.length) {
                return null;
            }

            // ★★★★★ Agent：意图括号路由 START ★★★★★
            // ★ 明确写出“心笺”的意图本地直达心笺 Agent，其余交给 TODO，避免为明确语法多跑一次小模型。
            const heartNoteIntents = heartNoteEnabled
                ? intentTexts.filter(text => /心笺/.test(text))
                : [];
            const todoIntents = todoEnabled
                ? intentTexts.filter(text => !/心笺/.test(text))
                : [];
            const results = await Promise.all([
                todoIntents.length ? this.runAgentTodoIntentOperations(contact, todoIntents, assistantMessage) : null,
                heartNoteIntents.length && typeof AgentRuntime !== 'undefined'
                    ? AgentRuntime.runHeartNoteManager({ app: this, contact, intentTexts: heartNoteIntents, assistantMessage })
                    : null
            ]);
            return results.filter(Boolean);
            // ★★★★★ Agent：意图括号路由 END ★★★★★
        } catch (error) {
            console.warn('[Agent][意图括号] failed:', error);
            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'failed',
                error: error?.message || String(error)
            });
            return null;
        } finally {
            console.groupEnd();
        }
    },

    async runAgentTodoIntentOperations(contact, intentTexts = [], assistantMessage = null) {
        if (STATE.settings.AGENT_TODO_MANAGER_ENABLED !== true) return null;
        if (typeof AgentTodoManager === 'undefined') return null;
        const validIntentTexts = Array.isArray(intentTexts)
            ? intentTexts.map(text => AgentTodoManager.cleanText(text, 200)).filter(Boolean)
            : [];
        if (!validIntentTexts.length || !assistantMessage) return null;

        const existingState = this.getAgentExecutionState(assistantMessage, 'todo');
        if (['suggested', 'applied', 'dismissed', 'undone', 'skipped', 'failed'].includes(existingState?.status)) {
            console.log('[Agent][TODO意图] 已有状态，本轮跳过:', existingState);
            return null;
        }

        const settings = this.buildAgentTodoManagerRequestSettings();
        if (!settings.API_URL || !settings.API_KEY || !settings.MODEL) {
            console.log('[Agent][TODO意图] API 配置缺失，跳过。');
            return null;
        }

        console.groupCollapsed(`[Agent][TODO意图] ${contact?.name || '未命名角色'} · ${new Date().toLocaleTimeString()}`);
        console.log('[Agent][TODO意图] 意图文本:', validIntentTexts);
        console.log('[Agent][TODO意图] 请求模型:', {
            url: settings.API_URL,
            model: settings.MODEL,
            presetIndex: STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX
        });

        try {
            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'pending',
                intents: validIntentTexts
            });

            // ★★★★★ Agent：TODO 意图确认 START ★★★★★
            // 『』里是角色发出的动作意图；为了防误删/误改，解析后先复用 suggestion 确认条，不直接落地。
            const messages = AgentTodoManager.buildExecutorMessages(contact, validIntentTexts.join('\n'), new Date(), '角色动作意图');
            console.log('[Agent][TODO意图] Messages:', messages);
            const rawText = await API.chat(messages, {
                ...settings,
                AGENT_LOG_PHASE: 'post',
                AGENT_LOG_LABEL: 'TODO 意图确认'
            });
            console.log('[Agent][TODO意图] 原始返回:', rawText);
            const routerResult = AgentTodoManager.parseRouterResult(rawText);
            console.log('[Agent][TODO意图] 解析结果:', routerResult);
            // ★★★★★ Agent：TODO 意图确认 END ★★★★★

            if (routerResult.intent === 'NONE') {
                await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                    status: 'skipped',
                    reason: 'intent_none',
                    intents: validIntentTexts
                });
                return null;
            }

            if (routerResult.intent === 'ASK_CONFIRMATION') {
                const message = AgentTodoManager.cleanText(
                    routerResult.confirmation?.message || '这个操作需要你再确认一下，我先不自动执行。',
                    140
                );
                this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} 没有执行：${message}`, { type: 'pending' });
                await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                    status: 'skipped',
                    reason: 'intent_ask_confirmation',
                    intents: validIntentTexts,
                    message
                });
                return null;
            }

            const suggestions = this.normalizeAgentPostTodoSuggestions(routerResult);
            if (!suggestions.length) {
                console.warn('[Agent][TODO意图] 操作包没有匹配到可执行 TODO:', {
                    intentTexts: validIntentTexts,
                    operations: routerResult.operations,
                    todoCount: Array.isArray(STATE.todoPlans) ? STATE.todoPlans.length : 0
                });
                this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} 没有执行：没有匹配到唯一的 TODO`, { type: 'pending' });
                await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                    status: 'skipped',
                    reason: 'intent_no_valid_suggestions',
                    intents: validIntentTexts
                });
                return null;
            }

            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'suggested',
                intents: validIntentTexts,
                suggestions
            });
            this.showAgentPostTodoSuggestionNotice(contact, assistantMessage, suggestions);
            console.log('[Agent][TODO意图] 已展示确认条:', suggestions);
            return { suggestions };
        } catch (error) {
            console.warn('[Agent][TODO意图] failed:', error);
            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'failed',
                error: error?.message || String(error),
                intents: validIntentTexts
            });
            this.showTodoTopNotice('TODO 管理没有执行：模型返回格式不正确。', { type: 'failure' });
            return null;
        } finally {
            console.groupEnd();
        }
    },
    // ★★★★★ Agent：意图括号触发主链路 END ★★★★★

    // ★★★★★ Agent 心笺 START：意图解析、确认与撤销 ★★★★★
    normalizeAgentHeartNoteSuggestions(contact, result = {}) {
        if (typeof AgentHeartNoteManager === 'undefined') return [];
        const notebook = AgentHeartNoteManager.ensureNotebook(contact?.id);
        const todayKey = AgentHeartNoteManager.getTodayKey();
        const seenCreateKeys = new Set((notebook.records || [])
            .filter(record => record && record.text)
            .map(record => AgentHeartNoteManager.buildDuplicateKey(record.text, record.dateKey || todayKey)));

        return (result.operations || []).map(operation => {
            const normalized = AgentHeartNoteManager.normalizeOperation(operation);
            if (!normalized) return null;
            if (normalized.action === 'create') {
                if (!normalized.text) return null;
                const duplicateKey = AgentHeartNoteManager.buildDuplicateKey(normalized.text, todayKey);
                // ★ 心笺与 TODO 一样：同一角色、同一天、同名内容只提交一次。
                if (seenCreateKeys.has(duplicateKey)) return null;
                seenCreateKeys.add(duplicateKey);
                return { action: 'create', text: normalized.text, dateKey: todayKey };
            }

            const candidates = AgentHeartNoteManager.findCandidates(contact?.id, normalized);
            if (candidates.length !== 1) return null;
            const target = candidates[0];
            if (normalized.action === 'update' && !normalized.newText) return null;
            if (normalized.action === 'update') {
                const targetDateKey = target.dateKey || todayKey;
                const newKey = AgentHeartNoteManager.buildDuplicateKey(normalized.newText, targetDateKey);
                const duplicate = (notebook.records || []).some(record => record.id !== target.id
                    && AgentHeartNoteManager.buildDuplicateKey(record.text, record.dateKey || targetDateKey) === newKey);
                if (duplicate) return null;
            }
            return {
                ...normalized,
                targetNoteId: target.id,
                targetText: target.text,
                before: { ...target }
            };
        }).filter(Boolean);
    },

    buildAgentHeartNoteOperationLabel(operation = {}) {
        const verb = {
            create: '添加',
            update: '修改',
            delete: '删除',
            star: '星标',
            unstar: '取消星标'
        }[operation.action] || '更新';
        if (operation.action === 'update') return `${verb} ${operation.targetText} → ${operation.newText}`;
        return `${verb} ${operation.text || operation.targetText || ''}`;
    },

    async runAgentHeartNoteIntentOperations(contact, intentTexts = [], assistantMessage = null) {
        if (STATE.settings.AGENT_HEART_NOTE_MANAGER_ENABLED !== true) return null;
        if (typeof AgentHeartNoteManager === 'undefined' || !assistantMessage) return null;
        const validIntents = (intentTexts || []).map(text => AgentHeartNoteManager.cleanText(text, 1200)).filter(Boolean);
        if (!validIntents.length) return null;

        const existingState = this.getAgentExecutionState(assistantMessage, 'heart_note');
        if (['pending', 'suggested', 'applied', 'dismissed', 'undone', 'skipped', 'failed'].includes(existingState?.status)) return null;
        const settings = this.buildAgentTodoManagerRequestSettings();
        if (!settings.API_URL || !settings.API_KEY || !settings.MODEL) {
            this.showTopNotice('心笺管理 API 配置缺失，请在 Agent 设置里选择可用模型。', { type: 'failure' });
            return null;
        }

        try {
            await this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'pending', intents: validIntents });
            const messages = AgentHeartNoteManager.buildExecutorMessages(contact, validIntents, new Date());
            const rawText = await API.chat(messages, {
                ...settings,
                AGENT_LOG_PHASE: 'post',
                AGENT_LOG_LABEL: '心笺意图确认'
            });
            const result = AgentHeartNoteManager.parseResult(rawText);
            if (result.intent === 'NONE') {
                await this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'skipped', reason: 'intent_none', intents: validIntents });
                return null;
            }
            if (result.intent === 'ASK_CONFIRMATION') {
                const message = AgentHeartNoteManager.cleanText(result.confirmation?.message || '这个心笺操作需要说得更具体。', 160);
                this.showTopNotice(`${contact?.name || '心笺管理'} 没有执行：${message}`, { type: 'pending' });
                await this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'skipped', reason: 'ask_confirmation', message, intents: validIntents });
                return null;
            }

            const suggestions = this.normalizeAgentHeartNoteSuggestions(contact, result);
            if (!suggestions.length) {
                this.showTopNotice(`${contact?.name || '当前角色'} 没有提交心笺：可能已有同日同名内容，或目标不唯一`, { type: 'pending' });
                await this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'skipped', reason: 'no_valid_suggestions', intents: validIntents });
                return null;
            }
            await this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'suggested', intents: validIntents, suggestions });
            this.showAgentHeartNoteSuggestionNotice(contact, assistantMessage, suggestions);
            return { suggestions };
        } catch (error) {
            console.warn('[Agent][心笺管理] failed:', error);
            await this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'failed', error: error?.message || String(error), intents: validIntents });
            this.showTopNotice('心笺管理没有执行：模型返回格式不正确。', { type: 'failure' });
            return null;
        }
    },

    showAgentHeartNoteSuggestionNotice(contact, assistantMessage, suggestions = []) {
        const valid = (suggestions || []).filter(Boolean);
        if (!valid.length) return null;
        let checkboxList = null;
        const getSelected = () => checkboxList
            ? Array.from(checkboxList.querySelectorAll('input:checked')).map(input => valid[Number(input.dataset.index)]).filter(Boolean)
            : valid;
        const confirmationId = this.ensureAgentConfirmationId(contact, assistantMessage, 'heart_note');
        if (this.hasAgentConfirmationNotice(confirmationId)) return null;
        const notice = this.showTopNotice('', {
            type: 'pending',
            layout: 'stacked',
            timeout: 0,
            renderContent: () => {
                const wrap = document.createElement('div');
                wrap.className = 'agent-suggestion-notice';
                const title = document.createElement('div');
                title.className = 'agent-suggestion-title';
                title.textContent = `${contact?.name || '当前角色'}想操作 ${valid.length} 条心笺：`;
                checkboxList = document.createElement('div');
                checkboxList.className = 'agent-suggestion-list';
                valid.forEach((item, index) => {
                    const row = document.createElement('label');
                    row.className = 'agent-suggestion-option desktop-switch-cell';
                    row.innerHTML = `<input type="checkbox" data-index="${index}" checked><span>${this.escapeHtml(this.buildAgentHeartNoteOperationLabel(item))}</span>`;
                    checkboxList.appendChild(row);
                });
                wrap.append(title, checkboxList);
                return wrap;
            },
            actions: [
                { label: '执行选中', onAction: () => this.applyAgentHeartNoteSuggestions(contact, assistantMessage, getSelected()) },
                { label: valid.length === 1 ? '执行' : '全部执行', onAction: () => this.applyAgentHeartNoteSuggestions(contact, assistantMessage, valid) },
                { label: '忽略', type: 'secondary', onAction: () => this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'dismissed', reason: 'user_dismissed' }) }
            ]
        });
        return this.bindAgentConfirmationNotice(notice, confirmationId);
    },

    async applyAgentHeartNoteSuggestions(contact, assistantMessage, suggestions = []) {
        if (!suggestions.length) {
            this.showTopNotice('还没有选中要执行的心笺操作。', { type: 'pending' });
            return null;
        }
        const notebook = AgentHeartNoteManager.ensureNotebook(contact?.id);
        const createdIds = [];
        const snapshots = [];
        const applied = [];
        const originalOrder = (notebook.records || []).map(record => record.id);

        for (const suggestion of suggestions) {
            if (suggestion.action === 'create') {
                const now = Date.now();
                const dateKey = AgentHeartNoteManager.getTodayKey(new Date(now));
                const duplicateKey = AgentHeartNoteManager.buildDuplicateKey(suggestion.text, dateKey);
                const duplicate = (notebook.records || []).some(record => AgentHeartNoteManager.buildDuplicateKey(record.text, record.dateKey || dateKey) === duplicateKey);
                if (duplicate) continue;
                const record = {
                    id: `heart_note_${now}_${Math.random().toString(36).slice(2, 8)}`,
                    text: suggestion.text,
                    dateKey,
                    createdAt: now,
                    updatedAt: now,
                    alwaysInject: false,
                    cancelled: false,
                    source: 'assistant'
                };
                notebook.records.push(record);
                createdIds.push(record.id);
                applied.push({ ...suggestion, appliedNoteId: record.id });
                continue;
            }

            const index = notebook.records.findIndex(record => record.id === suggestion.targetNoteId);
            if (index < 0) continue;
            const record = notebook.records[index];
            if (suggestion.action === 'update') {
                const dateKey = record.dateKey || AgentHeartNoteManager.getTodayKey(new Date(record.createdAt || Date.now()));
                const duplicateKey = AgentHeartNoteManager.buildDuplicateKey(suggestion.newText, dateKey);
                const duplicate = notebook.records.some(other => other.id !== record.id
                    && AgentHeartNoteManager.buildDuplicateKey(other.text, other.dateKey || dateKey) === duplicateKey);
                if (duplicate) continue;
            }
            if (!snapshots.some(snapshot => snapshot.record.id === record.id)) {
                snapshots.push({ record: { ...record }, index: originalOrder.indexOf(record.id) });
            }
            if (suggestion.action === 'delete') notebook.records.splice(index, 1);
            if (suggestion.action === 'update') Object.assign(record, { text: suggestion.newText, updatedAt: Date.now() });
            if (suggestion.action === 'star') Object.assign(record, { alwaysInject: true, updatedAt: Date.now() });
            if (suggestion.action === 'unstar') Object.assign(record, { alwaysInject: false, updatedAt: Date.now() });
            applied.push(suggestion);
        }
        if (!applied.length) {
            this.showTopNotice('心笺没有变化：内容可能已重复或目标已变更。', { type: 'pending' });
            return null;
        }

        notebook.updatedAt = Date.now();
        await Storage.saveCharacterHeartNotes();
        this.renderHeartNoteContacts();
        this.renderHeartNoteDetail();
        await this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'applied', suggestions: applied });
        const single = applied[0] || {};
        const noticeText = applied.length === 1
            ? ({
                create: `已添加心笺：${single.text}`,
                update: `已修改心笺：${single.newText}`,
                delete: `已删除心笺：${single.targetText}`,
                star: `已星标心笺：${single.targetText}`,
                unstar: `已取消星标心笺：${single.targetText}`
            }[single.action] || '已更新心笺')
            : `已执行 ${applied.length} 项心笺操作`;
        this.showTopNotice(`${contact?.name || '当前角色'} ${noticeText}`, {
            onClick: () => {
                STATE.currentHeartNoteContactId = contact?.id || STATE.currentHeartNoteContactId;
                UI.switchView('heart-note-detail');
            },
            actionLabel: '撤销',
            onAction: async () => {
                const ids = new Set(createdIds);
                notebook.records = notebook.records.filter(record => !ids.has(record.id));
                snapshots.sort((a, b) => a.index - b.index).forEach(snapshot => {
                    const currentIndex = notebook.records.findIndex(record => record.id === snapshot.record.id);
                    if (currentIndex >= 0) notebook.records.splice(currentIndex, 1, snapshot.record);
                    else notebook.records.splice(Math.min(snapshot.index, notebook.records.length), 0, snapshot.record);
                });
                notebook.updatedAt = Date.now();
                await Storage.saveCharacterHeartNotes();
                this.renderHeartNoteContacts();
                this.renderHeartNoteDetail();
                // ★ 撤销代表用户已完成一次决定，写入终态后不再恢复原 suggestion。
                await this.setAgentExecutionState(contact, assistantMessage, 'heart_note', { status: 'undone', reason: 'user_undo_apply' });
            }
        });
        return applied;
    },
    // ★★★★★ Agent 心笺 END：意图解析、确认与撤销 ★★★★★

    async runAgentTodoPostSuggestions(contact, assistantText, assistantMessage = null) {
        if (STATE.settings.AGENT_TODO_MANAGER_ENABLED !== true) return null;
        if (typeof AgentTodoManager === 'undefined') return null;
        if (!assistantText || !assistantMessage) return null;

        const existingState = this.getAgentExecutionState(assistantMessage, 'todo');
        if (['suggested', 'applied', 'dismissed', 'undone', 'skipped'].includes(existingState?.status)) {
            console.log('[PostAgent][TODO建议] 已有状态，本轮跳过:', existingState);
            return null;
        }

        const settings = this.buildAgentPostTodoRequestSettings(this.buildAgentTodoManagerRequestSettings());
        if (!settings.API_URL || !settings.API_KEY || !settings.MODEL) {
            console.log('[PostAgent][TODO建议] API 配置缺失，跳过。');
            return null;
        }

        console.groupCollapsed(`[PostAgent][TODO建议] ${contact?.name || '未命名角色'} · ${new Date().toLocaleTimeString()}`);
        console.log('[PostAgent][TODO建议] 角色回复:', assistantText);
        console.log('[PostAgent][TODO建议] 请求模型:', {
            url: settings.API_URL,
            model: settings.MODEL,
            presetIndex: STATE.settings.AGENT_SKILL_ROUTER_API_PRESET_INDEX
        });

        try {
            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'pending',
                intents: typeof AgentIntentMarkup !== 'undefined' ? AgentIntentMarkup.extract(assistantText || '') : []
            });

            // ★★★★★ Post Agent：回复后 TODO 建议 START ★★★★★
            // post-agent 只产出待用户确认的 TODO 管理建议；真正写入仍然由确认条控制。
            const messages = AgentTodoManager.buildPostSuggestionMessages(contact, assistantText, new Date());
            console.log('[PostAgent][TODO建议] Messages:', messages);
            const rawText = await API.chat(messages, {
                ...settings,
                AGENT_LOG_PHASE: 'post',
                AGENT_LOG_LABEL: 'Post TODO 建议'
            });
            console.log('[PostAgent][TODO建议] 原始返回:', rawText);
            const postResult = AgentTodoManager.parsePostSuggestionResult(rawText);
            console.log('[PostAgent][TODO建议] 解析结果:', postResult);
            // ★★★★★ Post Agent：回复后 TODO 建议 END ★★★★★

            if (postResult.intent === 'NONE') {
                await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                    status: 'skipped',
                    reason: 'post_none'
                });
                return null;
            }

            const suggestions = this.normalizeAgentPostTodoSuggestions(postResult);
            if (!suggestions.length) {
                await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                    status: 'skipped',
                    reason: 'post_no_valid_suggestions'
                });
                return null;
            }

            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'suggested',
                suggestions
            });
            this.showAgentPostTodoSuggestionNotice(contact, assistantMessage, suggestions);
            console.log('[PostAgent][TODO建议] 已展示确认条:', suggestions);
            return { suggestions };
        } catch (error) {
            console.warn('[PostAgent][TODO建议] failed:', error);
            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'failed',
                error: error?.message || String(error)
            });
            return null;
        } finally {
            console.groupEnd();
        }
    },

    formatAgentPostTodoSuggestionLine(item) {
        const timeText = item.startTime && item.endTime
            ? `，${item.startTime}-${item.endTime}`
            : item.startTime
                ? `，${item.startTime}`
                : '';
        return `${item.text}：${item.dateKey}${timeText}`;
    },

    showAgentPostTodoSuggestionNotice(contact, assistantMessage, suggestions = []) {
        const validSuggestions = Array.isArray(suggestions)
            ? suggestions.filter(item => item && (item.text || item.targetTodoId || item.targetText))
            : [];
        if (!validSuggestions.length) return null;

        const confirmationId = this.ensureAgentConfirmationId(contact, assistantMessage, 'todo');
        if (this.hasAgentConfirmationNotice(confirmationId)) return null;

        const roleName = contact?.name || '当前角色';
        const title = validSuggestions.length === 1
            ? `${roleName} 建议管理 TODO：`
            : `${roleName} 建议管理 ${validSuggestions.length} 项 TODO：`;

        // ★★★★★ Post Agent：持久确认条 START ★★★★★
        // 角色回复只能提出建议；真正管理 TODO 必须等用户点“执行”。
        let checkboxList = null;
        const getSelectedSuggestions = () => {
            if (!checkboxList) return validSuggestions;
            return Array.from(checkboxList.querySelectorAll('input[type="checkbox"]:checked'))
                .map(input => validSuggestions[Number(input.dataset.index)])
                .filter(Boolean);
        };

        const notice = this.showTopNotice('', {
            type: 'pending',
            layout: 'stacked',
            timeout: 0,
            renderContent: () => {
                const wrap = document.createElement('div');
                wrap.className = 'agent-suggestion-notice';

                const titleEl = document.createElement('div');
                titleEl.className = 'agent-suggestion-title';
                titleEl.textContent = title;
                wrap.appendChild(titleEl);

                checkboxList = document.createElement('div');
                checkboxList.className = 'agent-suggestion-list';
                validSuggestions.forEach((item, index) => {
                    const row = document.createElement('label');
                    row.className = 'agent-suggestion-option desktop-switch-cell';
                    const verb = this.getAgentTodoOperationVerb(item);
                    const label = this.buildAgentTodoOperationLabel(item);
                    row.innerHTML = `
                        <input type="checkbox" data-index="${index}" checked>
                        <span>${this.escapeHtml(`${verb} ${label}`)}</span>
                    `;
                    checkboxList.appendChild(row);
                });
                wrap.appendChild(checkboxList);
                return wrap;
            },
            actions: [
                {
                    label: '执行选中',
                    onAction: async () => {
                        await this.applyAgentPostTodoSuggestions(contact, assistantMessage, getSelectedSuggestions());
                    }
                },
                {
                    label: validSuggestions.length === 1 ? '执行' : '全部执行',
                    onAction: async () => {
                        await this.applyAgentPostTodoSuggestions(contact, assistantMessage, validSuggestions);
                    }
                },
                {
                    label: '忽略',
                    type: 'secondary',
                    onAction: async () => {
                        console.log('[PostAgent][TODO建议] 用户忽略建议:', validSuggestions);
                        await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                            status: 'dismissed',
                            reason: 'user_dismissed',
                            suggestions: validSuggestions
                        });
                    }
                }
            ]
        });
        return this.bindAgentConfirmationNotice(notice, confirmationId);
        // ★★★★★ Post Agent：持久确认条 END ★★★★★
    },

    async applyAgentPostTodoSuggestions(contact, assistantMessage, suggestions = []) {
        if (!Array.isArray(suggestions) || !suggestions.length) {
            console.log('[PostAgent][TODO建议] 用户没有选中任何建议。');
            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'suggested',
                reason: 'user_apply_empty_selection',
                suggestions: this.getAgentExecutionState(assistantMessage, 'todo')?.suggestions || []
            });
            this.showTopNotice('还没有选中要执行的 TODO 建议。', { type: 'pending' });
            return null;
        }

        const seenKeys = new Set((STATE.todoPlans || [])
            .filter(item => item && item.text && item.dateKey)
            .map(item => this.buildTodoDuplicateKey(item.text, item.dateKey)));
        const applied = [];
        const snapshots = [];

        for (const suggestion of suggestions) {
            if (!suggestion) continue;
            if (suggestion.action === 'create') {
                if (!suggestion.text || !suggestion.dateKey) continue;
                const key = this.buildTodoDuplicateKey(suggestion.text, suggestion.dateKey);
                if (seenKeys.has(key)) continue;
                seenKeys.add(key);
                const item = {
                    ...suggestion,
                    id: suggestion.id || `todo_${Date.now()}_post_apply_${applied.length}_${Math.random().toString(36).slice(2, 8)}`,
                    done: false,
                    cancelled: false,
                    createdAt: suggestion.createdAt || Date.now()
                };
                delete item.action;
                STATE.todoPlans.push(item);
                applied.push({ ...suggestion, appliedTodoId: item.id, text: item.text });
                continue;
            }

            const item = STATE.todoPlans.find(todo => todo.id === suggestion.targetTodoId);
            if (!item || !suggestion.patch || !Object.keys(suggestion.patch).length) continue;
            snapshots.push({ ...item });
            Object.assign(item, suggestion.patch, { updatedAt: Date.now() });
            applied.push({ ...suggestion, text: item.text });
        }

        if (!applied.length) {
            console.log('[PostAgent][TODO建议] 没有可执行项，可能已重复或目标已变化:', suggestions);
            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'skipped',
                reason: 'user_apply_noop',
                suggestions
            });
            this.showTodoTopNotice(`${contact?.name || '当前角色'} 没有执行：TODO 可能已重复或目标已变化`, { type: 'pending' });
            return null;
        }

        await Storage.saveTodoPlans();
        this.renderTodoPlans();
        this.renderDesktop();
        await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
            status: 'applied',
            suggestions: applied
        });
        console.log('[PostAgent][TODO建议] 用户确认执行:', applied);

        const noticeText = applied.length === 1
            ? `${this.getAgentTodoOperationVerb(applied[0])}了 TODO：${applied[0].text || applied[0].targetText}`
            : `执行了 ${applied.length} 项 TODO 建议`;
        this.showTodoTopNotice(`${contact?.name || '当前角色'} ${noticeText}`, {
            actionLabel: '撤销',
            onAction: async () => {
                const createIds = new Set(applied.filter(item => item.action === 'create').map(item => item.appliedTodoId));
                STATE.todoPlans = STATE.todoPlans.filter(todoItem => !createIds.has(todoItem.id));
                snapshots.forEach(snapshot => {
                    const current = STATE.todoPlans.find(todoItem => todoItem.id === snapshot.id);
                    if (!current) return;
                    Object.keys(current).forEach(key => delete current[key]);
                    Object.assign(current, snapshot);
                });
                await Storage.saveTodoPlans();
                this.renderTodoPlans();
                this.renderDesktop();
                await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                    status: 'undone',
                    reason: 'user_undo_apply'
                });
                console.log('[PostAgent][TODO建议] 已撤销确认执行:', applied);
            }
        });
        return applied;
    },

    async consumeWorkerPostAgentResult(contact, assistantMessage, postAgentResult = null) {
        if (!postAgentResult || typeof postAgentResult !== 'object') return false;

        // ★★★★★ Post Agent：Worker 结果预留入口 START ★★★★★
        // 现在 post-agent 仍走前端轻量方案；以后 Worker 若返回 job.post_agent，
        // 这里会优先消费 Worker 结果，避免同一条 assistant 回复再跑前端 post-agent。
        const route = postAgentResult.route && typeof postAgentResult.route === 'object'
            ? postAgentResult.route
            : {};
        const agent = String(route.agent || postAgentResult.agent || '').trim();
        if (agent !== 'todo_manager_post' && agent !== 'todo') return true;

        const suggestions = this.normalizeAgentPostTodoSuggestions({
            operations: Array.isArray(postAgentResult.operations) ? postAgentResult.operations : [],
            todos: Array.isArray(postAgentResult.suggestions) ? postAgentResult.suggestions : []
        });
        if (!suggestions.length) {
            await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
                status: 'skipped',
                reason: postAgentResult.reason || 'worker_post_no_valid_suggestions'
            });
            return true;
        }

        await this.setAgentExecutionState(contact, assistantMessage, 'todo', {
            status: 'suggested',
            suggestions
        });
        this.showAgentPostTodoSuggestionNotice(contact, assistantMessage, suggestions);
        console.log('[PostAgent][Worker预留] 已消费 Worker 建议:', suggestions);
        return true;
        // ★★★★★ Post Agent：Worker 结果预留入口 END ★★★★★
    },

    async executeAgentTodoSkill(routerResult, contact) {
        // ★ 旧 pre-agent 直接落地入口：
        // 现在主链路不主动调用它；保留给以后恢复“用户消息直接触发 Agent”时复用。
        if (!routerResult || routerResult.intent === 'NONE') return null;
        if (routerResult.intent === 'MANAGE_TODO') {
            return this.executeAgentTodoOperations(this.normalizeAgentTodoOperations(routerResult), contact);
        }
        if (Array.isArray(routerResult.operations) && routerResult.operations.length) {
            return this.executeAgentTodoOperations(this.normalizeAgentTodoOperations(routerResult), contact);
        }
        if (routerResult.intent === 'CREATE_TODO') return this.createTodosFromAgent(routerResult, contact);
        if (routerResult.intent === 'UPDATE_TODO') return this.updateTodoFromAgent(routerResult, contact);

        if (routerResult.intent === 'ASK_CONFIRMATION') {
            const message = AgentTodoManager.cleanText(
                routerResult.confirmation?.message || '这个操作需要你再确认一下，我先不自动执行。',
                140
            );
            this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} 没有执行：${message}`, { type: 'pending' });
            return null;
        }

        return null;
    },

    async executeAgentTodoOperations(operations = [], contact) {
        // ★ 旧 pre-agent 直接落地执行器：
        // 会立刻写入/修改 TODO，并把执行摘要回注主模型；当前『』协议改走确认条，不直接调用这里。
        const validOperations = Array.isArray(operations) ? operations.filter(Boolean) : [];
        if (!validOperations.length) return null;

        const createOperations = validOperations.filter(item => item.action === 'create');
        const updateOperations = validOperations.filter(item => item.action !== 'create');
        const createdItems = this.normalizeAgentTodoCreateOperations(createOperations);
        const updatedItems = [];
        const oldSnapshots = [];

        for (const operation of updateOperations) {
            const candidates = AgentTodoManager.findTodoCandidates(operation);
            if (candidates.length !== 1) continue;

            const item = candidates[0];
            const patchInfo = this.buildTodoPatchFromOperation(operation);
            if (!patchInfo || !Object.keys(patchInfo.patch).length) continue;

            oldSnapshots.push({ ...item });
            Object.assign(item, patchInfo.patch, { updatedAt: Date.now() });
            updatedItems.push({
                item,
                before: oldSnapshots[oldSnapshots.length - 1],
                action: operation.action,
                actionText: patchInfo.actionText
            });
        }

        if (!createdItems.length && !updatedItems.length) {
            this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} 没有执行：没有可落地的 TODO 操作`, { type: 'pending' });
            return null;
        }

        STATE.todoPlans.push(...createdItems);
        await Storage.saveTodoPlans();
        this.renderTodoPlans();
        this.renderDesktop();

        const noticeText = createdItems.length + updatedItems.length === 1
            ? (createdItems[0]
                ? `添加了 TODO：${createdItems[0].text}`
                : `${updatedItems[0].actionText}：${updatedItems[0].item.text}`)
            : `执行了 ${createdItems.length + updatedItems.length} 项 TODO 操作`;
        this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} ${noticeText}`, {
            actionLabel: '撤销',
            onAction: async () => {
                const createdIds = new Set(createdItems.map(item => item.id));
                STATE.todoPlans = STATE.todoPlans.filter(todoItem => !createdIds.has(todoItem.id));
                oldSnapshots.forEach(snapshot => {
                    const current = STATE.todoPlans.find(todoItem => todoItem.id === snapshot.id);
                    if (!current) return;
                    Object.keys(current).forEach(key => delete current[key]);
                    Object.assign(current, snapshot);
                });
                await Storage.saveTodoPlans();
                this.renderTodoPlans();
                this.renderDesktop();
                console.log('[Agent][TODO管理] 已撤销统一操作:', { createdItems, oldSnapshots });
            }
        });

        const createdLines = createdItems.map(item => {
            const timeText = item.startTime && item.endTime ? `，时间 ${item.startTime}-${item.endTime}` : '';
            return `- 添加：${item.text}：${item.dateKey}${timeText}`;
        });
        const updatedLines = updatedItems.map(entry => {
            const after = AgentTodoManager.formatTodoLabel(entry.item);
            const statusText = entry.item.done ? '，状态为已完成' : entry.item.cancelled ? '，状态为已取消' : '';
            return `- ${this.getAgentTodoOperationVerb(entry)}：${after}${statusText}`;
        });

        return {
            prompt: [
                `你已经为用户执行了 ${createdItems.length + updatedItems.length} 项 TODO 操作。`,
                ...createdLines,
                ...updatedLines,
                '请自然回应，不要提到系统、工具或 JSON。'
            ].join('\n')
        };
    },

    normalizeAgentTodoCreates(routerResult) {
        const rawTodos = Array.isArray(routerResult?.todos) && routerResult.todos.length
            ? routerResult.todos
            : [routerResult?.todo || {}];
        const seenKeys = new Set((STATE.todoPlans || [])
            .filter(item => item && item.text && item.dateKey)
            .map(item => this.buildTodoDuplicateKey(item.text, item.dateKey)));

        return rawTodos.map((todo, index) => {
            const text = AgentTodoManager.cleanText(todo.text || todo.title || '', 120);
            const dateKey = AgentTodoManager.isDateKey(todo.dateKey) ? todo.dateKey : AgentTodoManager.getTodayKey();
            const startTime = AgentTodoManager.isTimeValue(todo.startTime) ? todo.startTime : '';
            const endTime = AgentTodoManager.isTimeValue(todo.endTime) ? todo.endTime : '';
            if (!text) return null;
            const duplicateKey = this.buildTodoDuplicateKey(text, dateKey);
            if (seenKeys.has(duplicateKey)) return null;
            seenKeys.add(duplicateKey);
            const item = {
                id: `todo_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
                text,
                dateKey,
                done: false,
                cancelled: false,
                createdAt: Date.now()
            };
            if (startTime && endTime && startTime < endTime) {
                item.startTime = startTime;
                item.endTime = endTime;
            }
            return item;
        }).filter(Boolean).slice(0, 10);
    },

    buildTodoDuplicateKey(text, dateKey) {
        return `${dateKey}::${String(text || '').replace(/\s+/g, ' ').trim().toLowerCase()}`;
    },

    async createTodosFromAgent(routerResult, contact) {
        const items = this.normalizeAgentTodoCreates(routerResult);

        if (!items.length) {
            this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} 没有添加：同一天已有相同 TODO`, { type: 'pending' });
            return {
                prompt: ''
            };
        }

        STATE.todoPlans.push(...items);
        await Storage.saveTodoPlans();
        this.renderTodoPlans();
        this.renderDesktop();
        const noticeText = items.length === 1
            ? `添加了 TODO：${items[0].text}`
            : `添加了 ${items.length} 个 TODO`;
        this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} ${noticeText}`, {
            actionLabel: '撤销',
            onAction: async () => {
                const ids = new Set(items.map(item => item.id));
                STATE.todoPlans = STATE.todoPlans.filter(todoItem => !ids.has(todoItem.id));
                await Storage.saveTodoPlans();
                this.renderTodoPlans();
                this.renderDesktop();
                console.log('[Agent][TODO管理] 已撤销批量创建:', items);
            }
        });

        const createdLines = items.map(item => {
            const timeText = item.startTime && item.endTime ? `，时间 ${item.startTime}-${item.endTime}` : '';
            return `- ${item.text}：${item.dateKey}${timeText}`;
        });
        return {
            prompt: [
                `你已经为用户添加了 ${items.length} 项 TODO。`,
                ...createdLines
            ].join('\n')
        };
    },

    async updateTodoFromAgent(routerResult, contact) {
        const candidates = AgentTodoManager.findTodoCandidates(routerResult);
        if (candidates.length !== 1) {
            const hint = candidates.length > 1
                ? `找到了 ${candidates.length} 条可能的 TODO，需要用户确认是哪一条。`
                : '没有找到唯一匹配的 TODO，需要用户说得更具体。';
            this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} 没有修改 TODO：${hint}`, { type: 'pending' });
            return null;
        }

        const item = candidates[0];
        const update = routerResult.update || {};
        const status = String(update.status || update.action || '').trim().toLowerCase();
        const newText = AgentTodoManager.cleanText(update.newText || '', 120);
        const newDateKey = AgentTodoManager.isDateKey(update.newDateKey) ? update.newDateKey : '';
        const startTime = AgentTodoManager.isTimeValue(update.startTime) ? update.startTime : '';
        const endTime = AgentTodoManager.isTimeValue(update.endTime) ? update.endTime : '';
        const oldLabel = AgentTodoManager.formatTodoLabel(item);
        const oldSnapshot = { ...item };
        let actionText = '更新了 TODO';

        if (['cancelled', 'canceled', 'cancel', 'deleted', 'delete', 'removed', 'remove'].includes(status)) {
            item.cancelled = true;
            item.done = false;
            actionText = '取消了 TODO';
        } else if (status === 'done' || status === 'completed') {
            item.done = true;
            item.cancelled = false;
            actionText = '完成了 TODO';
        } else if (status === 'active' || status === 'undone') {
            item.done = false;
            item.cancelled = false;
            actionText = '恢复了 TODO';
        }

        if (newText) item.text = newText;
        if (newDateKey) {
            item.dateKey = newDateKey;
            actionText = actionText === '更新了 TODO' ? '调整了 TODO 日期' : actionText;
        }
        if (startTime && endTime && startTime < endTime) {
            item.startTime = startTime;
            item.endTime = endTime;
            actionText = actionText === '更新了 TODO' ? '调整了 TODO 时间' : actionText;
        }
        item.updatedAt = Date.now();

        await Storage.saveTodoPlans();
        this.renderTodoPlans();
        this.renderDesktop();
        this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} ${actionText}：${item.text}`, {
            actionLabel: '撤销',
            onAction: async () => {
                const current = STATE.todoPlans.find(todoItem => todoItem.id === oldSnapshot.id);
                if (!current) return;
                Object.keys(current).forEach(key => delete current[key]);
                Object.assign(current, oldSnapshot);
                await Storage.saveTodoPlans();
                this.renderTodoPlans();
                this.renderDesktop();
                console.log('[Agent][TODO管理] 已撤销更新:', oldSnapshot);
            }
        });

        return {
            prompt: [
                `你已经为用户${actionText}。`,
                `原内容：${oldLabel}`,
                `现在：${AgentTodoManager.formatTodoLabel(item)}${item.done ? '，状态为已完成' : ''}${item.cancelled ? '，状态为已取消' : ''}。`,
                '请自然回应，不要提到系统、工具或 JSON。'
            ].join('\n')
        };
    },

    appliedAgentActionStorageKey() {
        return 'telewindy_applied_agent_actions_v1';
    },

    loadAppliedAgentActionIds() {
        try {
            const ids = JSON.parse(localStorage.getItem(this.appliedAgentActionStorageKey()) || '[]');
            return Array.isArray(ids) ? ids : [];
        } catch (error) {
            return [];
        }
    },

    saveAppliedAgentActionIds(ids) {
        localStorage.setItem(this.appliedAgentActionStorageKey(), JSON.stringify(ids.slice(-300)));
    },

    async applyAsyncBackendAgentStage(job, contact = null, userMessage = null) {
        if (!job) return false;
        if (job.agent_status === 'failed') {
            await this.setAgentExecutionState(contact, userMessage, 'todo_manager', {
                status: 'failed',
                error: String(job.agent_error || job.error || 'async_agent_failed'),
                resultPrompt: ''
            });
            return false;
        }
        if (job.agent_status !== 'done') return false;
        if (!Array.isArray(job.agent_actions) || !job.agent_actions.length) {
            await this.setAgentExecutionState(contact, userMessage, 'todo_manager', {
                status: 'skipped',
                reason: 'async_no_actions',
                resultPrompt: String(job.agent_prompt || '').trim()
            });
            return false;
        }

        // ★ 后台 Agent 先完成、主模型后完成：
        // 轮询 running job 时就可以把 TODO 操作落到本地；最终 done 再看到同一批 action，
        // 由 actionId 去重兜底，避免重复创建/取消。
        console.info('[Agent][后台] 收到提前完成的 TODO 管理结果:', {
            jobId: API.asyncJobLogId(job.jobId || ''),
            actionCount: job.agent_actions.length
        });
        const changed = await this.applyAsyncAgentActions(job.agent_actions, contact);
        await this.setAgentExecutionState(contact, userMessage, 'todo_manager', changed
            ? {
                status: 'applied',
                reason: 'async_actions_applied',
                resultPrompt: String(job.agent_prompt || '').trim()
            }
            : {
                status: 'skipped',
                reason: 'async_actions_noop',
                resultPrompt: String(job.agent_prompt || '').trim()
            });
        return changed;
    },

    async applyAsyncAgentActions(actions, contact = null) {
        if (!Array.isArray(actions) || !actions.length) return false;

        const appliedIds = this.loadAppliedAgentActionIds();
        let changed = false;
        for (const action of actions) {
            if (!action || !action.id || appliedIds.includes(action.id)) continue;
            const applied = await this.applyAsyncAgentAction(action, contact);
            appliedIds.push(action.id);
            if (applied) changed = true;
        }

        this.saveAppliedAgentActionIds([...new Set(appliedIds)]);
        if (changed) {
            await Storage.saveTodoPlans();
            this.renderTodoPlans();
            this.renderDesktop();
        }
        return changed;
    },

    async applyAsyncAgentAction(action, contact = null) {
        console.log('[Agent][后台] 应用 action:', action);
        if (action.type === 'todo.create' && action.item) {
            if (STATE.todoPlans.some(item => item.id === action.item.id)) return false;
            STATE.todoPlans.push({ ...action.item });
            this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} ${action.notice || `添加了 TODO：${action.item.text}`}`, {
                actionLabel: '撤销',
                onAction: async () => {
                    STATE.todoPlans = STATE.todoPlans.filter(item => item.id !== action.item.id);
                    await Storage.saveTodoPlans();
                    this.renderTodoPlans();
                    this.renderDesktop();
                    console.log('[Agent][后台] 已撤销 action:', action.id);
                }
            });
            return true;
        }

        if (action.type === 'todo.create_many' && Array.isArray(action.items)) {
            const newItems = action.items.filter(item => item && item.id && !STATE.todoPlans.some(todo => todo.id === item.id));
            if (!newItems.length) return false;
            STATE.todoPlans.push(...newItems.map(item => ({ ...item })));
            this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} ${action.notice || `添加了 ${newItems.length} 个 TODO`}`, {
                actionLabel: '撤销',
                onAction: async () => {
                    const ids = new Set(newItems.map(item => item.id));
                    STATE.todoPlans = STATE.todoPlans.filter(item => !ids.has(item.id));
                    await Storage.saveTodoPlans();
                    this.renderTodoPlans();
                    this.renderDesktop();
                    console.log('[Agent][后台] 已撤销批量创建 action:', action.id);
                }
            });
            return true;
        }

        if (action.type === 'todo.update' && action.todoId && action.patch) {
            const item = STATE.todoPlans.find(todo => todo.id === action.todoId);
            if (!item) {
                this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} 有一项后台操作未应用：本地计划已变化`, { type: 'pending' });
                return false;
            }

            const before = { ...item };
            Object.assign(item, action.patch, { updatedAt: Date.now() });
            this.showTodoTopNotice(`${contact?.name || 'TODO 管理'} ${action.notice || `更新了 TODO：${item.text}`}`, {
                actionLabel: '撤销',
                onAction: async () => {
                    const current = STATE.todoPlans.find(todo => todo.id === before.id);
                    if (!current) return;
                    Object.keys(current).forEach(key => delete current[key]);
                    Object.assign(current, before);
                    await Storage.saveTodoPlans();
                    this.renderTodoPlans();
                    this.renderDesktop();
                    console.log('[Agent][后台] 已撤销 action:', action.id);
                }
            });
            return true;
        }

        return false;
    },
    // ★★★★★ Agent END：TODO 管理设置 + skill 执行 ★★★★★

    // ★★★★★ 角色记忆 START：页面逻辑层 ★★★★★
    // 角色记忆是“每日总结”：生成昨天，聊天时注入昨天及更早的最近 N 天。
    renderMemoryAvatar(contact) {
        if (contact.avatar && (contact.avatar.startsWith('data:') || contact.avatar.startsWith('http'))) {
            return `<img class="character-memory-avatar" src="${this.escapeHtml(contact.avatar)}" alt="">`;
        }
        return `<div class="character-memory-avatar text-avatar">${this.escapeHtml(contact.avatar || '🌼')}</div>`;
    },

    getCharacterMemoryStatusText(memory) {
        if (!memory || memory.enabled !== true) return '未开启';
        if (memory.isGenerating) return '生成中';
        const records = (memory.records || []).filter(record => record && Array.isArray(record.memories) && record.memories.length);
        if (records.length) return `${records.length} 天记忆 · 注入 ${memory.injectDays || CharacterMemory.defaultInjectDays} 天`;
        if ((memory.records || []).some(record => record?.error)) return '有生成失败记录';
        return '待生成';
    },

    openCharacterMemorySettings() {
        const modal = document.getElementById('modal-character-memory-settings');
        const apiSelect = document.getElementById('character-memory-api-preset');
        if (!modal || !apiSelect) return;

        const currentIndex = Number.isInteger(STATE.settings.CHARACTER_MEMORY_API_PRESET_INDEX)
            ? STATE.settings.CHARACTER_MEMORY_API_PRESET_INDEX
            : -1;

        apiSelect.innerHTML = '<option value="-1">-- 跟随全局默认 --</option>';
        (STATE.settings.API_PRESETS || []).forEach((preset, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            const modelName = preset.model || '未知模型';
            opt.textContent = `${preset.name} (${modelName})`;
            if (index === currentIndex) opt.selected = true;
            apiSelect.appendChild(opt);
        });

        modal.classList.remove('hidden');
    },

    async saveCharacterMemorySettings() {
        const modal = document.getElementById('modal-character-memory-settings');
        const apiSelect = document.getElementById('character-memory-api-preset');
        const presetIndex = parseInt(apiSelect?.value ?? '-1', 10);

        STATE.settings.CHARACTER_MEMORY_API_PRESET_INDEX = Number.isFinite(presetIndex) ? presetIndex : -1;
        await Storage.saveSettings();
        modal?.classList.add('hidden');
        this.renderCharacterMemoryList();
    },

    renderCharacterMemoryList() {
        const list = document.getElementById('character-memory-list');
        const empty = document.getElementById('character-memory-empty');
        if (!list) return;

        const contacts = STATE.contacts || [];
        list.innerHTML = '';
        if (empty) empty.style.display = contacts.length ? 'none' : 'block';

        contacts.forEach(contact => {
            const memory = CharacterMemory.ensureMemory(contact.id);
            const item = document.createElement('div');
            item.className = `character-memory-contact${memory.enabled ? ' enabled' : ''}`;
            item.dataset.id = contact.id;
            item.innerHTML = `
                ${this.renderMemoryAvatar(contact)}
                <div class="character-memory-contact-info">
                    <div class="character-memory-contact-name">${this.escapeHtml(contact.name || '未命名角色')}</div>
                    <div class="character-memory-contact-status">${this.escapeHtml(this.getCharacterMemoryStatusText(memory))}</div>
                </div>
                <label class="character-memory-switch" title="启用/关闭角色记忆">
                    <input type="checkbox" ${memory.enabled ? 'checked' : ''}>
                    <span class="character-memory-switch-slider"></span>
                </label>
                <span class="arrow">
                    <svg width="1.5em" height="1.5em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 6L16 12L9 18" />
                    </svg>
                </span>
            `;
            list.appendChild(item);
        });
    },

    openCharacterMemoryDetail(contactId) {
        const contact = STATE.contacts.find(item => item.id === contactId);
        if (!contact) return;
        STATE.currentMemoryContactId = contactId;
        STATE.characterMemoryViewMode = 'all';
        UI.switchView('character-memory-detail');
    },

    setCharacterMemoryViewMode(mode) {
        STATE.characterMemoryViewMode = mode === 'injected' ? 'injected' : 'all';
        this.renderCharacterMemoryDetail();
    },

    getCharacterMemoryDetailRecords(memory) {
        const mode = STATE.characterMemoryViewMode === 'injected' ? 'injected' : 'all';
        if (mode === 'injected') {
            // ★★★ 注入视图直接复用真实注入规则，避免 UI 展示和上下文注入出现两套口径。
            return CharacterMemory.getInjectRecords(memory, new Date())
                .filter(record => record && Array.isArray(record.memories) && record.memories.length)
                .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
        }

        return (memory.records || [])
            .filter(record => record && (record.memories?.length || record.comment || record.error))
            .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    },

    createCharacterMemoryCard(record) {
        const card = document.createElement('div');
        card.className = 'character-memory-card';
        card.dataset.dateKey = record.dateKey;
        const items = (record.memories || []).map(item => {
            const alwaysInject = item && typeof item === 'object' && item.alwaysInject === true;
            return `
                <div class="character-memory-item" data-id="${this.escapeHtml(item.id)}">
                    <div class="character-memory-text">${this.escapeHtml(item.text || '')}</div>
                    <button type="button" class="character-memory-icon-btn character-memory-pin-btn${alwaysInject ? ' active' : ''}" data-action="toggle-memory-pin" title="${alwaysInject ? '取消长期记住' : '长期记住'}" aria-pressed="${alwaysInject ? 'true' : 'false'}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path class="character-memory-pin-shape" d="M12 17v5"></path>
                            <path class="character-memory-pin-shape" d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path>
                        </svg>
                    </button>
                    <button type="button" class="character-memory-icon-btn" data-action="edit-memory-item" title="修改记忆">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button type="button" class="character-memory-icon-btn danger" data-action="delete-memory-item" title="删除记忆">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
            `;
        }).join('');
        const comment = record.comment
            ? `<div class="character-memory-comment">${this.escapeHtml(record.comment)}</div>`
            : '';
        const error = record.error
            ? `<div class="character-memory-comment">生成失败：${this.escapeHtml(record.error)}</div>`
            : '';
        card.innerHTML = `
                <div class="character-memory-card-head">
                    <div class="character-memory-date">${this.escapeHtml(record.dateKey)}</div>
                    <div class="character-memory-card-actions">
                        <button type="button" class="character-memory-icon-btn" data-action="add-memory-item" title="添加一条当天记忆" aria-label="添加一条当天记忆">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 5v14"></path>
                                <path d="M5 12h14"></path>
                            </svg>
                        </button>
                        <button type="button" class="character-memory-icon-btn" data-action="reroll-memory-day" title="重新总结这天的记忆">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"></path>
                                <path d="M3 21v-5h5"></path>
                                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"></path>
                                <path d="M21 3v5h-5"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="character-memory-items">${items}</div>
                ${comment}
                ${error}
            `;
        return card;
    },

    renderCharacterMemoryDetail() {
        const contact = STATE.contacts.find(item => item.id === STATE.currentMemoryContactId);
        const title = document.getElementById('character-memory-detail-title');
        const status = document.getElementById('character-memory-status');
        const input = document.getElementById('character-memory-inject-days');
        const list = document.getElementById('character-memory-detail-list');
        const empty = document.getElementById('character-memory-detail-empty');
        const mode = STATE.characterMemoryViewMode === 'injected' ? 'injected' : 'all';
        const tabs = document.querySelector('.character-memory-tabs');
        if (!list) return;

        tabs?.classList.toggle('is-injected', mode === 'injected');
        document.querySelectorAll('.character-memory-tab').forEach(btn => {
            const active = btn.dataset.mode === mode;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        if (!contact) {
            if (title) title.textContent = '角色记忆';
            list.innerHTML = '';
            if (empty) {
                empty.textContent = '开启记忆后，会在这里显示每日总结。';
                empty.style.display = 'block';
            }
            return;
        }

        const memory = CharacterMemory.ensureMemory(contact.id);
        if (title) title.textContent = contact.name || '角色记忆';
        if (input) input.value = Math.max(1, Number.parseInt(memory.injectDays, 10) || CharacterMemory.defaultInjectDays);
        const allRecords = (memory.records || []).filter(record => record && (record.memories?.length || record.error));
        if (status) {
            status.textContent = `${this.getCharacterMemoryStatusText(memory)} · 共 ${allRecords.length} 天`;
            status.className = `character-memory-status${memory.isGenerating ? ' pending' : ''}${allRecords.some(record => record.error) ? ' failure' : ''}`;
        }

        list.innerHTML = '';
        const records = this.getCharacterMemoryDetailRecords(memory);
        if (empty) {
            empty.textContent = mode === 'injected'
                ? '当前没有会注入上下文的记忆。'
                : '开启记忆后，会在这里显示每日总结。';
            empty.style.display = records.length ? 'none' : 'block';
        }

        records.forEach(record => {
            list.appendChild(this.createCharacterMemoryCard(record));
        });
    },

    async saveCharacterMemoryInjectDays() {
        const input = document.getElementById('character-memory-inject-days');
        const memory = CharacterMemory.getMemory(STATE.currentMemoryContactId);
        if (!input || !memory) return;
        const value = Math.max(1, Number.parseInt(input.value, 10) || CharacterMemory.defaultInjectDays);
        input.value = value;
        memory.injectDays = value;
        memory.updatedAt = Date.now();
        await Storage.saveCharacterMemories();
        this.renderCharacterMemoryList();
        this.renderCharacterMemoryDetail();
    },

    buildMemoryRequestSettings(contact) {
        const settings = {
            API_URL: STATE.settings.API_URL,
            API_KEY: STATE.settings.API_KEY,
            MODEL: STATE.settings.MODEL,
            ASYNC_BACKEND_ENABLED: false,
            MAX_TOKENS: 1200,
            TEMPERATURE: 0.3,
            CONTEXT_LIMIT: 10,
            // ★ 自动/手动生成角色记忆都属于资料整理，不计入桌面的互动日志。
            COUNT_AS_INTERACTION: false,
            CUSTOM_REQUEST_BODY_JSON: STATE.settings.CUSTOM_REQUEST_BODY_JSON || ''
        };

        const presetIndex = STATE.settings.CHARACTER_MEMORY_API_PRESET_INDEX;
        if (typeof presetIndex === 'number' && presetIndex >= 0) {
            const preset = (STATE.settings.API_PRESETS || [])[presetIndex];
            if (preset) {
                console.log(`[角色记忆] 使用预设: ${preset.name}`);
                settings.API_URL = preset.url;
                settings.API_KEY = preset.key;
                settings.MODEL = preset.model;
                settings.CUSTOM_REQUEST_BODY_JSON = preset.extra_body_json || '';
                if (preset.max_tokens !== undefined && preset.max_tokens !== '') settings.MAX_TOKENS = Number(preset.max_tokens);
                if (preset.temperature !== undefined && preset.temperature !== '') settings.TEMPERATURE = Number(preset.temperature);
            }
        }

        return settings;
    },

    async generateCharacterMemory(contactId, dateKey = CharacterMemory.getYesterdayKey(), options = {}) {
        const contact = STATE.contacts.find(item => item.id === contactId);
        if (!contact) return false;

        const memory = CharacterMemory.ensureMemory(contactId);
        if (memory.isGenerating) return false;

        const dayMessages = CharacterMemory.collectMessagesForDate(contact, dateKey);
        if (!dayMessages.length) {
            // ★ 空聊天日不创建空 card，只记住这天已经检查过，避免每天打开都空跑。
            memory.lastAutoGenerateDateKey = dateKey;
            memory.updatedAt = Date.now();
            await Storage.saveCharacterMemories();
            this.renderCharacterMemoryList();
            this.renderCharacterMemoryDetail();
            return true;
        }

        const settings = this.buildMemoryRequestSettings(contact);
        const record = CharacterMemory.ensureRecord(memory, dateKey);
        if (!settings.API_URL || !settings.API_KEY || !settings.MODEL) {
            record.error = 'API 配置缺失';
            await Storage.saveCharacterMemories();
            this.renderCharacterMemoryList();
            this.renderCharacterMemoryDetail();
            if (!options.silent) alert('API配置缺失！请检查设置。');
            return false;
        }

        memory.isGenerating = true;
        record.isGenerating = true;
        record.error = '';
        this.renderCharacterMemoryList();
        this.renderCharacterMemoryDetail();

        for (let attempt = 0; attempt <= CharacterMemory.maxRetry; attempt++) {
            try {
                const messages = CharacterMemory.buildGenerationMessages(contact, dateKey);
                const rawText = await API.chat(messages, settings);
                const parsed = CharacterMemory.parseAiMemory(rawText);

                // ★ AI 重新总结只替换 AI 记忆，用户亲手补进来的内容必须留下来。
                const manualMemories = (record.memories || []).filter(item => item?.createdManually === true);
                record.memories = [...parsed.memories, ...manualMemories];
                record.comment = parsed.comment;
                record.generatedAt = new Date().toISOString();
                record.updatedAt = Date.now();
                record.error = '';
                record.isGenerating = false;
                memory.enabled = true;
                memory.lastAutoGenerateDateKey = dateKey;
                memory.updatedAt = Date.now();
                memory.isGenerating = false;
                await Storage.saveCharacterMemories();
                this.renderCharacterMemoryList();
                this.renderCharacterMemoryDetail();
                return true;
            } catch (error) {
                console.warn('[CharacterMemory] generate failed:', error);
                record.error = error.message || String(error);
            }
        }

        record.isGenerating = false;
        memory.isGenerating = false;
        memory.lastAutoGenerateDateKey = dateKey;
        await Storage.saveCharacterMemories();
        this.renderCharacterMemoryList();
        this.renderCharacterMemoryDetail();
        return false;
    },

    async toggleCharacterMemoryEnabled(contactId, enabled) {
        const memory = CharacterMemory.ensureMemory(contactId);
        memory.enabled = !!enabled;
        memory.updatedAt = Date.now();
        await Storage.saveCharacterMemories();
        this.renderCharacterMemoryList();
        if (enabled) this.ensureCharacterMemoryReady(contactId, { silent: true });
    },

    async ensureCharacterMemoryReady(contactId, options = {}) {
        const memory = CharacterMemory.ensureMemory(contactId);
        const targetDateKey = CharacterMemory.getYesterdayKey();
        if (memory.enabled !== true || memory.isGenerating) return false;
        const record = CharacterMemory.getRecord(memory, targetDateKey);
        if (record && (record.memories?.length || record.error)) return true;
        if (memory.lastAutoGenerateDateKey === targetDateKey) return true;
        return this.generateCharacterMemory(contactId, targetDateKey, options);
    },

    async ensureEnabledCharacterMemories(options = {}) {
        if (STATE.memoryQueueRunning) return;
        STATE.memoryQueueRunning = true;

        const enabledIds = (STATE.characterMemories || [])
            .filter(memory => memory && memory.enabled === true)
            .map(memory => memory.charId);
        const priorityIds = options.priorityId ? [options.priorityId] : [];
        const queue = [...new Set([...priorityIds, ...enabledIds])]
            .filter(id => STATE.contacts.some(contact => contact.id === id));

        for (const contactId of queue) {
            const memory = CharacterMemory.ensureMemory(contactId);
            if (memory.enabled === true) {
                await this.ensureCharacterMemoryReady(contactId, { silent: true });
            }
        }

        STATE.memoryQueueRunning = false;
    },

    startCharacterMemoryDateWatcher() {
        STATE.memoryLastDateKey = CharacterMemory.getTodayKey();
        if (STATE.memoryDateTimer) clearInterval(STATE.memoryDateTimer);

        // ★ 前端开着跨过 0 点时，下一轮分钟检查会排队总结“刚过去的昨天”。
        STATE.memoryDateTimer = setInterval(() => {
            const todayKey = CharacterMemory.getTodayKey();
            if (todayKey === STATE.memoryLastDateKey) return;
            STATE.memoryLastDateKey = todayKey;
            this.ensureEnabledCharacterMemories({
                priorityId: STATE.currentContactId || STATE.currentMemoryContactId || null,
                silent: true
            });
        }, 60 * 1000);
    },

    async rerollCharacterMemoryDay(dateKey) {
        if (!STATE.currentMemoryContactId || !dateKey) return;
        if (!confirm('你要重新总结这天的记忆吗？')) return;
        await this.generateCharacterMemory(STATE.currentMemoryContactId, dateKey, { silent: false, force: true });
    },

    openMemoryItemModal(dateKey, itemId) {
        const memory = CharacterMemory.getMemory(STATE.currentMemoryContactId);
        const record = CharacterMemory.getRecord(memory, dateKey);
        const item = record?.memories?.find(entry => entry.id === itemId);
        const modal = document.getElementById('modal-character-memory-item');
        const title = document.getElementById('character-memory-item-modal-title');
        const textInput = document.getElementById('character-memory-item-text');
        if (!item || !modal || !textInput) return;

        STATE.editingMemoryItem = { dateKey, itemId };
        if (title) title.textContent = '编辑记忆';
        textInput.value = item.text || '';
        modal.classList.remove('hidden');
        textInput.focus();
    },

    openAddMemoryItemModal(dateKey) {
        const memory = CharacterMemory.getMemory(STATE.currentMemoryContactId);
        const record = CharacterMemory.getRecord(memory, dateKey);
        const modal = document.getElementById('modal-character-memory-item');
        const title = document.getElementById('character-memory-item-modal-title');
        const textInput = document.getElementById('character-memory-item-text');
        if (!record || !modal || !textInput) return;

        // ★ 复用编辑弹窗，但用 isNew 区分保存时是修改旧条目还是追加新条目。
        STATE.editingMemoryItem = { dateKey, itemId: null, isNew: true };
        if (title) title.textContent = '添加记忆';
        textInput.value = '';
        modal.classList.remove('hidden');
        textInput.focus();
    },

    closeMemoryItemModal() {
        document.getElementById('modal-character-memory-item')?.classList.add('hidden');
        STATE.editingMemoryItem = null;
    },

    async saveMemoryItemFromModal() {
        const memory = CharacterMemory.getMemory(STATE.currentMemoryContactId);
        const editing = STATE.editingMemoryItem;
        const record = CharacterMemory.getRecord(memory, editing?.dateKey);
        const textInput = document.getElementById('character-memory-item-text');
        const text = textInput ? textInput.value.trim() : '';
        if (!record || !editing) return;
        if (!text) {
            alert('写点记忆内容吧');
            return;
        }

        if (editing.isNew) {
            // ★ 手动添加的记忆做独立标记，之后重新总结当天内容时不会被 AI 覆盖掉。
            record.memories.push({
                id: `memory_item_${Date.now()}_manual`,
                text,
                alwaysInject: false,
                userEdited: true,
                createdManually: true,
                updatedAt: Date.now()
            });
        } else {
            const item = record.memories?.find(entry => entry.id === editing.itemId);
            if (!item) return;
            item.text = text;
            item.userEdited = true;
            item.updatedAt = Date.now();
        }
        record.updatedAt = Date.now();
        memory.updatedAt = Date.now();
        await Storage.saveCharacterMemories();
        this.closeMemoryItemModal();
        this.renderCharacterMemoryDetail();
        this.renderCharacterMemoryList();
    },

    async deleteMemoryItem(dateKey, itemId) {
        const memory = CharacterMemory.getMemory(STATE.currentMemoryContactId);
        const record = CharacterMemory.getRecord(memory, dateKey);
        if (!record) return;
        if (!confirm('确定要删除这条记忆吗？')) return;

        record.memories = (record.memories || []).filter(item => item.id !== itemId);
        record.updatedAt = Date.now();
        memory.updatedAt = Date.now();
        await Storage.saveCharacterMemories();
        this.renderCharacterMemoryDetail();
        this.renderCharacterMemoryList();
    },

    async toggleMemoryItemPin(dateKey, itemId) {
        const memory = CharacterMemory.getMemory(STATE.currentMemoryContactId);
        const record = CharacterMemory.getRecord(memory, dateKey);
        const item = record?.memories?.find(entry => entry.id === itemId);
        if (!item || typeof item !== 'object') return;

        // ★ 单条长期记住不改变“注入 X 天”的省 token 策略，只额外放行用户钉住的旧记忆。
        item.alwaysInject = item.alwaysInject !== true;
        item.updatedAt = Date.now();
        record.updatedAt = Date.now();
        memory.updatedAt = Date.now();
        await Storage.saveCharacterMemories();
        this.renderCharacterMemoryDetail();
        this.renderCharacterMemoryList();
    },
    // ★★★★★ 角色记忆 END：页面逻辑层 ★★★★★

    // ★★★★★ 角色日程 START：页面逻辑层 ★★★★★
    // 角色日程是“探索页玩法”，但生成结果会作为角色自己的动态状态注入聊天。
    renderScheduleAvatar(contact) {
        if (contact.avatar && (contact.avatar.startsWith('data:') || contact.avatar.startsWith('http'))) {
            return `<img class="character-schedule-avatar" src="${this.escapeHtml(contact.avatar)}" alt="">`;
        }
        return `<div class="character-schedule-avatar text-avatar">${this.escapeHtml(contact.avatar || '🌼')}</div>`;
    },

    getCharacterScheduleStatusText(schedule) {
        if (!schedule || schedule.enabled !== true) return '未开启';
        if (schedule.isGenerating) return '生成中';
        if (CharacterSchedule.isFresh(schedule)) return `今日 ${schedule.entries.length} 段`;
        if (schedule.error) return '生成失败';
        return '待生成';
    },

    openCharacterScheduleSettings() {
        const modal = document.getElementById('modal-character-schedule-settings');
        const apiSelect = document.getElementById('character-schedule-api-preset');
        if (!modal || !apiSelect) return;

        const currentIndex = Number.isInteger(STATE.settings.CHARACTER_SCHEDULE_API_PRESET_INDEX)
            ? STATE.settings.CHARACTER_SCHEDULE_API_PRESET_INDEX
            : -1;

        apiSelect.innerHTML = '<option value="-1">-- 跟随全局默认 --</option>';
        (STATE.settings.API_PRESETS || []).forEach((preset, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            const modelName = preset.model || '未知模型';
            opt.textContent = `${preset.name} (${modelName})`;
            if (index === currentIndex) opt.selected = true;
            apiSelect.appendChild(opt);
        });

        modal.classList.remove('hidden');
    },

    async saveCharacterScheduleSettings() {
        const modal = document.getElementById('modal-character-schedule-settings');
        const apiSelect = document.getElementById('character-schedule-api-preset');
        const presetIndex = parseInt(apiSelect?.value ?? '-1', 10);

        STATE.settings.CHARACTER_SCHEDULE_API_PRESET_INDEX = Number.isFinite(presetIndex) ? presetIndex : -1;
        await Storage.saveSettings();
        modal?.classList.add('hidden');
    },

    renderCharacterScheduleList() {
        const list = document.getElementById('character-schedule-list');
        const empty = document.getElementById('character-schedule-empty');
        if (!list) return;

        const contacts = STATE.contacts || [];
        list.innerHTML = '';
        if (empty) empty.style.display = contacts.length ? 'none' : 'block';

        contacts.forEach(contact => {
            const schedule = CharacterSchedule.ensureSchedule(contact.id);
            const item = document.createElement('div');
            item.className = `character-schedule-contact${schedule.enabled ? ' enabled' : ''}`;
            item.dataset.id = contact.id;
            item.innerHTML = `
                ${this.renderScheduleAvatar(contact)}
                <div class="character-schedule-contact-info">
                    <div class="character-schedule-contact-name">${this.escapeHtml(contact.name || '未命名角色')}</div>
                    <div class="character-schedule-contact-status">${this.escapeHtml(this.getCharacterScheduleStatusText(schedule))}</div>
                </div>
                <label class="todo-menu-switch character-schedule-switch" title="启用/关闭角色日程">
                    <input type="checkbox" ${schedule.enabled ? 'checked' : ''}>
                    <span class="app-switch-slider todo-switch-slider"></span>
                </label>
                <span class="arrow">
                    <svg width="1.5em" height="1.5em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 6L16 12L9 18" />
                    </svg>
                </span>
            `;
            list.appendChild(item);
        });
    },

    openCharacterScheduleDetail(contactId) {
        const contact = STATE.contacts.find(item => item.id === contactId);
        if (!contact) return;
        STATE.currentScheduleContactId = contactId;
        UI.switchView('character-schedule-detail');
        this.ensureCharacterScheduleReady(contactId, { priority: true, silent: true });
    },

    renderCharacterScheduleDetail() {
        const contact = STATE.contacts.find(item => item.id === STATE.currentScheduleContactId);
        const title = document.getElementById('character-schedule-detail-title');
        const status = document.getElementById('character-schedule-status');
        const list = document.getElementById('character-schedule-detail-list');
        const empty = document.getElementById('character-schedule-detail-empty');
        if (!list) return;

        if (!contact) {
            if (title) title.textContent = '角色日程';
            list.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }

        const schedule = CharacterSchedule.ensureSchedule(contact.id);
        if (title) title.textContent = contact.name || '角色日程';
        if (status) {
            const dateText = schedule.dateKey ? `日期：${schedule.dateKey}` : '今天还没有生成日程';
            const stateText = this.getCharacterScheduleStatusText(schedule);
            status.textContent = `${stateText} · ${dateText}`;
            status.className = `character-schedule-status${schedule.isGenerating ? ' pending' : ''}${schedule.error ? ' failure' : ''}`;
        }

        list.innerHTML = '';
        const entries = schedule.entries || [];
        if (empty) empty.style.display = entries.length ? 'none' : 'block';

        entries.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'character-schedule-entry';
            item.dataset.id = entry.id;
            item.innerHTML = `
                <div class="character-schedule-time-pill">${this.escapeHtml(entry.start)}-${this.escapeHtml(entry.end)}</div>
                <div class="character-schedule-entry-text">${this.escapeHtml(entry.text)}</div>
                <button type="button" class="todo-icon-btn" data-action="edit-schedule-entry" title="编辑">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
            `;
            list.appendChild(item);
        });
    },

    buildScheduleRequestSettings(contact) {
        const settings = {
            API_URL: STATE.settings.API_URL,
            API_KEY: STATE.settings.API_KEY,
            MODEL: STATE.settings.MODEL,
            ASYNC_BACKEND_ENABLED: false,
            MAX_TOKENS: 2400,
            TEMPERATURE: 0.9,
            CONTEXT_LIMIT: 10,
            // ★ 角色日程是系统生成内容，不代表用户和 AI 发生了一次互动。
            COUNT_AS_INTERACTION: false,
            CUSTOM_REQUEST_BODY_JSON: STATE.settings.CUSTOM_REQUEST_BODY_JSON || ''
        };

        const presetIndex = STATE.settings.CHARACTER_SCHEDULE_API_PRESET_INDEX;
        if (typeof presetIndex === 'number' && presetIndex >= 0) {
            const preset = (STATE.settings.API_PRESETS || [])[presetIndex];
            if (preset) {
                console.log(`[角色日程] 使用预设: ${preset.name}`);
                settings.API_URL = preset.url;
                settings.API_KEY = preset.key;
                settings.MODEL = preset.model;
                settings.CUSTOM_REQUEST_BODY_JSON = preset.extra_body_json || '';
                if (preset.max_tokens !== undefined && preset.max_tokens !== '') settings.MAX_TOKENS = Number(preset.max_tokens);
                if (preset.temperature !== undefined && preset.temperature !== '') settings.TEMPERATURE = Number(preset.temperature);
            }
        }

        return settings;
    },

    async generateCharacterSchedule(contactId, options = {}) {
        const contact = STATE.contacts.find(item => item.id === contactId);
        if (!contact) return false;

        const schedule = CharacterSchedule.ensureSchedule(contactId);
        if (schedule.isGenerating) return false;
        const settings = this.buildScheduleRequestSettings(contact);
        if (!settings.API_URL || !settings.API_KEY || !settings.MODEL) {
            schedule.error = 'API 配置缺失';
            await Storage.saveCharacterSchedules();
            this.renderCharacterScheduleDetail();
            if (!options.silent) alert('API配置缺失！请检查设置。');
            return false;
        }

        schedule.isGenerating = true;
        schedule.error = '';
        this.renderCharacterScheduleList();
        this.renderCharacterScheduleDetail();

        for (let attempt = 0; attempt <= CharacterSchedule.maxRetry; attempt++) {
            try {
                const messages = CharacterSchedule.buildGenerationMessages(contact, new Date());
                const rawText = await API.chat(messages, settings);
                const entries = CharacterSchedule.parseAiSchedule(rawText);

                schedule.enabled = true;
                schedule.dateKey = CharacterSchedule.getTodayKey();
                schedule.entries = entries;
                schedule.generatedAt = new Date().toISOString();
                schedule.updatedAt = Date.now();
                schedule.isGenerating = false;
                schedule.error = '';
                await Storage.saveCharacterSchedules();
                this.renderCharacterScheduleList();
                this.renderCharacterScheduleDetail();
                return true;
            } catch (error) {
                console.warn('[CharacterSchedule] generate failed:', error);
                schedule.error = error.message || String(error);
            }
        }

        schedule.isGenerating = false;
        await Storage.saveCharacterSchedules();
        this.renderCharacterScheduleList();
        this.renderCharacterScheduleDetail();
        return false;
    },

    async toggleCharacterScheduleEnabled(contactId, enabled) {
        const schedule = CharacterSchedule.ensureSchedule(contactId);
        schedule.enabled = !!enabled;
        schedule.updatedAt = Date.now();
        await Storage.saveCharacterSchedules();
        this.renderCharacterScheduleList();
        if (enabled) this.ensureCharacterScheduleReady(contactId, { priority: true, silent: true });
    },

    async ensureCharacterScheduleReady(contactId, options = {}) {
        const schedule = CharacterSchedule.ensureSchedule(contactId);
        if (schedule.enabled !== true || schedule.isGenerating) return false;
        if (CharacterSchedule.isFresh(schedule)) return true;
        return this.generateCharacterSchedule(contactId, options);
    },

    async ensureEnabledCharacterSchedules(options = {}) {
        if (STATE.scheduleQueueRunning) return;
        STATE.scheduleQueueRunning = true;

        const enabledIds = (STATE.characterSchedules || [])
            .filter(schedule => schedule && schedule.enabled === true)
            .map(schedule => schedule.charId);
        const priorityIds = options.priorityId ? [options.priorityId] : [];
        const queue = [...new Set([...priorityIds, ...enabledIds])]
            .filter(id => STATE.contacts.some(contact => contact.id === id));

        for (const contactId of queue) {
            const schedule = CharacterSchedule.ensureSchedule(contactId);
            if (schedule.enabled === true && !CharacterSchedule.isFresh(schedule)) {
                await this.ensureCharacterScheduleReady(contactId, { silent: true });
            }
        }

        STATE.scheduleQueueRunning = false;
    },

    startCharacterScheduleDateWatcher() {
        STATE.scheduleLastDateKey = CharacterSchedule.getTodayKey();
        if (STATE.scheduleDateTimer) clearInterval(STATE.scheduleDateTimer);

        // ★ 前端开着跨过 0 点时，下一轮分钟检查会排队刷新已开启角色。
        STATE.scheduleDateTimer = setInterval(() => {
            const todayKey = CharacterSchedule.getTodayKey();
            if (todayKey === STATE.scheduleLastDateKey) return;
            STATE.scheduleLastDateKey = todayKey;
            this.ensureEnabledCharacterSchedules({
                priorityId: STATE.currentContactId || STATE.currentScheduleContactId || null,
                silent: true
            });
        }, 60 * 1000);
    },

    openScheduleEntryModal(entryId) {
        const schedule = CharacterSchedule.getSchedule(STATE.currentScheduleContactId);
        const entry = schedule?.entries?.find(item => item.id === entryId);
        const modal = document.getElementById('modal-character-schedule-entry');
        const timeEl = document.getElementById('character-schedule-entry-time');
        const textInput = document.getElementById('character-schedule-entry-text');
        if (!entry || !modal || !textInput) return;

        STATE.editingScheduleEntryId = entryId;
        if (timeEl) timeEl.textContent = `${entry.start} - ${entry.end}`;
        textInput.value = entry.text || '';
        modal.classList.remove('hidden');
        textInput.focus();
    },

    closeScheduleEntryModal() {
        document.getElementById('modal-character-schedule-entry')?.classList.add('hidden');
        STATE.editingScheduleEntryId = null;
    },

    async saveScheduleEntryFromModal() {
        const schedule = CharacterSchedule.getSchedule(STATE.currentScheduleContactId);
        const entry = schedule?.entries?.find(item => item.id === STATE.editingScheduleEntryId);
        const textInput = document.getElementById('character-schedule-entry-text');
        const text = textInput ? textInput.value.trim() : '';
        if (!entry) return;
        if (!text) {
            alert('写点日程内容吧');
            return;
        }

        entry.text = text;
        entry.userEdited = true;
        schedule.updatedAt = Date.now();
        await Storage.saveCharacterSchedules();
        this.closeScheduleEntryModal();
        this.renderCharacterScheduleDetail();
    },
    // ★★★★★ 角色日程 END：页面逻辑层 ★★★★★

    loadAsyncBackendSettings() {
        const urlInput = document.getElementById('async-backend-url');
        const tokenInput = document.getElementById('async-backend-token');
        const status = document.getElementById('async-backend-status');

        this.syncAsyncBackendToggle();
        const proactiveToggle = document.getElementById('async-backend-proactive-capability-toggle');
        if (proactiveToggle) proactiveToggle.checked = STATE.settings.PROACTIVE_MESSAGES?.enabled === true;
        if (urlInput) urlInput.value = STATE.settings.ASYNC_BACKEND_URL || '';
        if (tokenInput) tokenInput.value = STATE.settings.ASYNC_BACKEND_TOKEN || '';
        if (status && STATE.asyncBackendTestStatus) {
            status.textContent = STATE.asyncBackendTestStatus.text;
            status.className = STATE.asyncBackendTestStatus.className;
        }
        // ★ 每次打开设置页都读一次已部署版本；输入框改动后旧请求结果会被丢弃。
        this.refreshAsyncBackendVersion(STATE.settings.ASYNC_BACKEND_URL || '', STATE.settings.ASYNC_BACKEND_TOKEN || '');
    },

    async refreshAsyncBackendVersion(backendUrl, token) {
        const versionStatus = document.getElementById('async-backend-version-status');
        if (!versionStatus) return;
        if (!backendUrl || !token) {
            versionStatus.textContent = '填写并保存 Worker 地址与口令后可检查版本';
            versionStatus.className = 'api-status-text status-idle';
            return;
        }
        versionStatus.textContent = '正在检查 Worker 版本…';
        versionStatus.className = 'api-status-text status-pending';
        try {
            const meta = await API.getAsyncBackendMetadata(backendUrl, token);
            const urlInput = document.getElementById('async-backend-url');
            const tokenInput = document.getElementById('async-backend-token');
            if (urlInput?.value.trim().replace(/\/+$/, '') !== backendUrl || tokenInput?.value.trim() !== token) return;
            const currentVersion = String(meta?.version || '');
            const expectedVersion = CONFIG.WORKER_VERSION;
            const outdated = !currentVersion || currentVersion.localeCompare(expectedVersion, undefined, { numeric: true }) < 0;
            versionStatus.textContent = outdated
                ? `Worker ${currentVersion || '旧版'}，当前前端需要 ${expectedVersion}；部署按钮用户可等待自动同步，或到自己的 GitHub Actions 运行 Sync TeleWindy Worker；旧手动部署请按教程更新`
                : `Worker ${currentVersion}，版本已匹配`;
            versionStatus.className = `api-status-text ${outdated ? 'status-failure' : 'status-success'}`;
        } catch (error) {
            versionStatus.textContent = `无法检查 Worker 版本：${API.explainAsyncBackendError(error)}`;
            versionStatus.className = 'api-status-text status-failure';
        }
    },

    loadAsyncReplySettings() {
        const ttlInput = document.getElementById('async-backend-ttl-hours');
        const keyMode = STATE.settings.ASYNC_BACKEND_KEY_MODE || CONFIG.DEFAULT.ASYNC_BACKEND_KEY_MODE || 'client_key';
        const modeInput = document.querySelector(`input[name="async-backend-key-mode"][value="${keyMode}"]`);
        if (modeInput) modeInput.checked = true;
        if (ttlInput) ttlInput.value = STATE.settings.ASYNC_BACKEND_TTL_HOURS || CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS;
        this.renderAsyncBackendPendingJobs();
    },

    async saveAsyncBackendSettings() {
        const urlInput = document.getElementById('async-backend-url');
        const tokenInput = document.getElementById('async-backend-token');
        const status = document.getElementById('async-backend-status');

        STATE.settings.ASYNC_BACKEND_URL = urlInput ? urlInput.value.trim().replace(/\/+$/, '') : '';
        STATE.settings.ASYNC_BACKEND_TOKEN = tokenInput ? tokenInput.value.trim() : '';
        this.syncAsyncBackendToggle();

        await Storage.saveSettings();
        this.refreshAsyncBackendVersion(STATE.settings.ASYNC_BACKEND_URL, STATE.settings.ASYNC_BACKEND_TOKEN);
        // ★ 两个能力共用 Worker URL/访问口令；在后台服务页保存后，主动消息状态立即重新检测。
        if (typeof ProactiveMessages !== 'undefined' && typeof ProactiveMessages.onSharedBackendSettingsChanged === 'function') {
            ProactiveMessages.onSharedBackendSettingsChanged();
        }

        if (status) {
            status.textContent = '已保存';
            status.className = 'api-status-text status-success';
            STATE.asyncBackendTestStatus = {
                text: status.textContent,
                className: status.className
            };
        }
    },

    async saveAsyncReplySettings() {
        const ttlInput = document.getElementById('async-backend-ttl-hours');
        const modeInput = document.querySelector('input[name="async-backend-key-mode"]:checked');
        const status = document.getElementById('async-reply-status');
        const ttlHours = ttlInput && ttlInput.value.trim()
            ? Number(ttlInput.value)
            : CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS;
        // ★ 调用模式和保留时间只归切屏回复页保存，避免后台服务页覆盖未提交的输入。
        STATE.settings.ASYNC_BACKEND_KEY_MODE = modeInput ? modeInput.value : (CONFIG.DEFAULT.ASYNC_BACKEND_KEY_MODE || 'client_key');
        STATE.settings.ASYNC_BACKEND_TTL_HOURS = Number.isFinite(ttlHours)
            ? Math.min(Math.max(ttlHours, 0.25), 24)
            : CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS;
        if (ttlInput) ttlInput.value = STATE.settings.ASYNC_BACKEND_TTL_HOURS;
        await Storage.saveSettings();
        if (status) {
            status.textContent = '已保存';
            status.className = 'api-status-text status-success';
        }
    },

    syncAsyncBackendToggle() {
        // ★ 探索页快捷开关与“后台运行服务”能力开关读取同一字段，避免两个入口显示不一致。
        ['async-backend-enable-toggle', 'async-backend-reply-capability-toggle'].forEach(id => {
            const toggle = document.getElementById(id);
            if (toggle) toggle.checked = STATE.settings.ASYNC_BACKEND_ENABLED !== false;
        });
    },

    async toggleAsyncBackendEnabled(enabled) {
        STATE.settings.ASYNC_BACKEND_ENABLED = !!enabled;
        await Storage.saveSettings();
        this.syncAsyncBackendToggle();
    },

    async clearAsyncBackendPendingJobs() {
        const status = document.getElementById('async-reply-status');
        const jobs = API.loadPendingJobs();

        const setStatus = (text, className) => {
            if (!status) return;
            status.textContent = text;
            status.className = className;
        };

        if (!jobs.length) {
            const diagnosticsCount = API.loadAsyncBackendDiagnostics().length;
            if (diagnosticsCount) {
                API.clearAsyncBackendDiagnostics();
                this.renderAsyncBackendPendingJobs();
                setStatus(`已清理 ${diagnosticsCount} 条后台诊断日志`, 'api-status-text status-success');
                return;
            }
            setStatus('没有需要清理的后台任务', 'api-status-text status-idle');
            return;
        }

        if (!confirm(`确定清理 ${jobs.length} 个后台任务记录吗？正在生成的回复可能不会自动回填。`)) {
            return;
        }

        setStatus(`正在清理 ${jobs.length} 个后台任务...`, 'api-status-text status-pending');

        await Promise.allSettled(
            jobs.map(job => {
                if (!job.backendUrl || !job.jobId || !job.token) return Promise.resolve();
                return API.deleteChatJob(job.backendUrl, job.jobId, job.token);
            })
        );

        API.savePendingJobs([]);
        API.clearAsyncBackendDiagnostics();
        this.renderAsyncBackendPendingJobs();
        setStatus(`已清理 ${jobs.length} 个后台任务记录和本地诊断日志`, 'api-status-text status-success');
    },

    renderAsyncBackendPendingJobs() {
        const summaryEl = document.getElementById('async-backend-pending-summary');
        const listEl = document.getElementById('async-backend-pending-list');
        if (!summaryEl || !listEl) return;

        const jobs = API.loadPendingJobs();
        const diagnostics = API.loadAsyncBackendDiagnostics().slice(-12).reverse();
        const activeJobs = jobs.filter(job => job.status !== 'failed');
        const failedJobs = jobs.filter(job => job.status === 'failed');
        const now = Date.now();

        if (!jobs.length) {
            summaryEl.textContent = '暂无待接收任务';
            listEl.innerHTML = this.renderAsyncBackendDiagnosticList(diagnostics);
            return;
        }

        const oldestMs = activeJobs.length
            ? Math.max(...activeJobs.map(job => now - Number(job.createdAt || now)))
            : 0;
        const oldestText = oldestMs ? this.formatAsyncBackendPendingAge(oldestMs) : '无';
        summaryEl.textContent = `待接收 ${activeJobs.length} 个，已停止 ${failedJobs.length} 个，最久等待 ${oldestText}`;

        // ★ 只显示前 6 条，避免小屏设置页被历史残留刷太长；完整清理交给按钮处理。
        const pendingHtml = jobs.slice(0, 6).map(job => {
            const ageMs = now - Number(job.createdAt || now);
            const isStale = job.status !== 'failed' && ageMs > 30 * 60 * 1000;
            const label = job.context?.scope === 'moments' ? '朋友圈' : '聊天';
            const statusText = job.status === 'failed' ? '已停止' : (isStale ? '可能卡住' : '接收中');
            return `
                <div class="async-backend-pending-item ${isStale ? 'is-stale' : ''}">
                    <span class="async-backend-pending-job">${label} ${API.asyncJobLogId(job.jobId)} · ${statusText}</span>
                    <span class="async-backend-pending-age">${this.formatAsyncBackendPendingAge(ageMs)}</span>
                </div>
            `;
        }).join('');
        listEl.innerHTML = pendingHtml + this.renderAsyncBackendDiagnosticList(diagnostics);
    },

    renderAsyncBackendDiagnosticList(diagnostics) {
        if (!diagnostics.length) return '';

        const items = diagnostics.map(event => {
            const code = this.escapeHtml(event.code || '');
            const message = this.escapeHtml(API.describeAsyncBackendEvent(event.code, event.detail || {}));
            const jobText = event.jobId ? ` · ${API.asyncJobLogId(event.jobId)}` : '';
            const meta = [
                this.formatAsyncBackendDiagnosticTime(event.ts),
                jobText,
                event.detail?.model ? ` · ${event.detail.model}` : '',
                event.detail?.intent ? ` · ${event.detail.intent}` : '',
                Number.isFinite(Number(event.detail?.actionCount)) ? ` · ${event.detail.actionCount} 个操作` : '',
                event.detail?.source === 'worker' ? ' · Worker' : ''
            ].join('');

            return `
                <div class="diagnostic-log-item">
                    <div class="diagnostic-log-main">
                        <span class="diagnostic-log-code">${code}</span>
                        <span class="diagnostic-log-text">${message}</span>
                    </div>
                    <div class="diagnostic-log-meta">${this.escapeHtml(meta)}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="async-backend-diagnostic-title">最近诊断日志</div>
            <div class="async-backend-diagnostic-list">${items}</div>
        `;
    },

    formatAsyncBackendDiagnosticTime(ts) {
        const date = new Date(Number(ts || Date.now()));
        if (Number.isNaN(date.getTime())) return '';
        return `${TodoContext.pad(date.getHours())}:${TodoContext.pad(date.getMinutes())}:${TodoContext.pad(date.getSeconds())}`;
    },

    formatAsyncBackendPendingAge(ageMs) {
        const minutes = Math.max(0, Math.floor(ageMs / 60000));
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes} 分钟`;
        const hours = Math.floor(minutes / 60);
        const restMinutes = minutes % 60;
        return restMinutes ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
    },

    async testAsyncBackendSettings() {
        const urlInput = document.getElementById('async-backend-url');
        const tokenInput = document.getElementById('async-backend-token');
        const status = document.getElementById('async-backend-status');
        const backendUrl = urlInput ? urlInput.value.trim().replace(/\/+$/, '') : '';
        const token = tokenInput ? tokenInput.value.trim() : '';
        // ★ 测试连接读取已保存的切屏调用模式，避免使用另一个页面尚未保存的草稿。
        const keyMode = STATE.settings.ASYNC_BACKEND_KEY_MODE || CONFIG.DEFAULT.ASYNC_BACKEND_KEY_MODE || 'client_key';
        const ttlHours = STATE.settings.ASYNC_BACKEND_TTL_HOURS || CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS;
        const model = STATE.settings.MODEL || CONFIG.DEFAULT.MODEL;
        const apiUrl = STATE.settings.API_URL || CONFIG.DEFAULT.API_URL;
        const apiKey = STATE.settings.API_KEY || CONFIG.DEFAULT.API_KEY || '';

        if (!status) return;
        const setTestStatus = (text, className) => {
            status.textContent = text;
            status.className = className;
            STATE.asyncBackendTestStatus = { text, className };
        };

        if (!backendUrl || !token) {
            setTestStatus('请先填写后台URL和后台密钥', 'api-status-text status-failure');
            return;
        }

        setTestStatus(`正在测试后台连接：${model}`, 'api-status-text status-pending');

        try {
            await this.refreshAsyncBackendVersion(backendUrl, token);
            await API.testAsyncBackendConnection({
                ASYNC_BACKEND_URL: backendUrl,
                ASYNC_BACKEND_TOKEN: token,
                ASYNC_BACKEND_KEY_MODE: keyMode,
                ASYNC_BACKEND_TTL_HOURS: Number.isFinite(ttlHours)
                    ? Math.min(Math.max(ttlHours, 0.25), 24)
                    : CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS,
                API_URL: apiUrl,
                API_KEY: apiKey,
                MODEL: model
            });

            setTestStatus('后台连接测试成功', 'api-status-text status-success');
        } catch (error) {
            setTestStatus(`后台连接测试失败：${API.explainAsyncBackendError(error)}`, 'api-status-text status-failure');
        }
    },
    // ============================================================
    // ★★★★★ 后台回复接收 END：App 层 ★★★★★
    // ============================================================

    // APP CONTROLLER.enterChat
    enterChat(id) {
        const contact = STATE.contacts.find(c => c.id === id);
        if (!contact) return;
        this.clearTransientChatErrors(contact);
        
        STATE.currentContactId = id;
     

        // ★★★ 修复：强制清空所有历史搜索(jump)带来的残留状态 ★★★
        STATE.chatMode = 'normal';
        STATE.visibleMsgCount = CONFIG.CHAT_PAGE_SIZE || 15;
        STATE.jumpStartIndex = null;
        STATE.jumpEndIndex = null;
        STATE.targetHighlightIndex = null;



        UI.switchView('chat');

        // ★★★ 核心修复：在渲染前强制让滚动条归零，彻底切断上个角色高度的残留 ★★★
        if (UI.els.chatMsgs && UI.els.chatMsgs.parentElement) {
            UI.els.chatMsgs.parentElement.scrollTop = 0;
        }


        // ★★★ 新增：进入聊天时，根据全局状态，正确设置顶部的“正在输入”或“在线”状态
        // 检查当前是不是应该显示“正在输入”
        const isLoading = STATE.typingContactId === id;
        // 更新UI（即使isLoading是false，也需要调用一次来把状态文字设置为当前联系人名）
        UI.setLoading(isLoading, id);


        if (contact.hasNewMsg) {
            contact.hasNewMsg = false; 
            Storage.saveContacts(); 
        }

        UI.renderChatHistory(contact);
        UI.renderContacts(); 
        this.restorePendingAgentConfirmations(contact);
    },

    clearTransientChatErrors(contact) {
        if (!contact || !Array.isArray(contact.history)) return false;

        const before = contact.history.length;
        // ★ 后台接收失败提示只负责“当场告诉用户发生了什么”：
        // 重新进入聊天窗口时自动清掉，保持和旧的 load failed 临时气泡一样不长期占位。
        contact.history = contact.history.filter(msg => {
            const isOldAsyncFailBubble = msg?.asyncJobId && String(msg.content || '').startsWith('(发送失败:');
            return msg?.isTransientError !== true && !isOldAsyncFailBubble;
        });
        if (contact.history.length === before) return false;

        Storage.saveContacts().catch(error => console.warn('[Chat] clear transient errors failed:', error));
        return true;
    },

    // ★★★★★ 本轮背景兼容提示 START ★★★★★
    isDynamicContextSystemRoleError(error) {
        const message = String(error?.message || error || '').toLowerCase();
        if (!message.includes('system') && !message.includes('系统')) return false;

        // 只拦“多 system / system role 不兼容”这一类错误，避免普通 API 报错也弹兼容提示。
        const roleRelated = /(role|message|messages|system\s*message|系统消息|角色)/i.test(message);
        const incompatible = /(invalid|unsupported|not supported|not allowed|must be first|only.*first|should be first|不支持|不允许|非法|无效|必须.*第一|只能.*第一)/i.test(message);
        return roleRelated && incompatible;
    },

    getDynamicContextWarnKey(contact, requestSettings) {
        // 同一轮页面里同一个 API 预设只提醒一次；用户如果确认，会直接写进设置。
        const presetName = contact?.linkedPresetName || 'global';
        const apiUrl = requestSettings?.API_URL || '';
        const model = requestSettings?.MODEL || '';
        return `dynamic-context-system-role:${presetName}:${apiUrl}:${model}`;
    },

    async maybePromptDynamicContextCompatMode(error, requestSettings, contact) {
        if (!['system', 'auto'].includes(requestSettings?.DYNAMIC_CONTEXT_INSERT_MODE)) return false;
        if (!this.isDynamicContextSystemRoleError(error)) return false;

        const warnKey = this.getDynamicContextWarnKey(contact, requestSettings);
        if (sessionStorage.getItem(warnKey) === '1') return false;
        sessionStorage.setItem(warnKey, '1');

        const presetName = contact?.linkedPresetName || '';
        const targetText = presetName
            ? `API 预设「${presetName}」`
            : '当前全局文字模型设置';
        const shouldSwitch = confirm(
            `这个接口看起来不支持额外的 system 消息。\n\n是否把${targetText}的「本轮背景插入方式」切换为「合并到用户消息（兼容）」？\n\n本次失败不会自动重试，切换后下次发送生效。`
        );
        if (!shouldSwitch) return false;

        let switchedPreset = false;
        if (presetName && Array.isArray(STATE.settings.API_PRESETS)) {
            const preset = STATE.settings.API_PRESETS.find(item => item && item.name === presetName);
            if (preset) {
                preset.dynamic_context_insert_mode = 'user';
                switchedPreset = true;
            }
        }

        if (!switchedPreset) {
            STATE.settings.DYNAMIC_CONTEXT_INSERT_MODE = 'user';
        }

        await Storage.saveSettings();

        const modeSelect = document.getElementById('dynamic-context-insert-mode');
        if (modeSelect && !switchedPreset) {
            modeSelect.value = 'user';
        }

        alert(`${targetText}已切换为兼容模式。`);
        return true;
    },
    // ★★★★★ 本轮背景兼容提示 END ★★★★★

    // ★★★★★ 缓存友好历史窗口 START ★★★★★
    ensureHistoryCacheMetadata(contact) {
        if (!contact || !Array.isArray(contact.history)) return false;

        let changed = false;
        let nextSeq = Number.isInteger(contact.historyCacheNextSeq)
            ? contact.historyCacheNextSeq
            : 0;

        contact.history.forEach(msg => {
            if (!msg || typeof msg !== 'object') return;

            if (!msg.cacheId) {
                msg.cacheId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
                changed = true;
            }

            if (!Number.isInteger(msg.cacheSeq) || msg.cacheSeq < 0) {
                msg.cacheSeq = nextSeq;
                nextSeq += 1;
                changed = true;
            } else if (msg.cacheSeq >= nextSeq) {
                nextSeq = msg.cacheSeq + 1;
            }
        });

        if (contact.historyCacheNextSeq !== nextSeq) {
            contact.historyCacheNextSeq = nextSeq;
            changed = true;
        }

        return changed;
    },

    selectHistoryWindowRecords(contact, requestSettings) {
        const history = Array.isArray(contact?.history) ? contact.history : [];
        const minLimit = Math.max(1, parseInt(requestSettings.CONTEXT_LIMIT, 10) || 5);
        const maxLimit = Math.max(minLimit, parseInt(requestSettings.HISTORY_WINDOW_MAX_CONTEXT, 10) || 25);
        const strategy = requestSettings.HISTORY_WINDOW_STRATEGY === 'strict_recent'
            ? 'strict_recent'
            : 'cache_friendly';

        const eligibleRecords = history
            .map((msg, index) => ({ msg, index }))
            .filter(record => {
                const msg = record.msg || {};
                const isOldAsyncFailBubble = msg?.asyncJobId && String(msg.content || '').startsWith('(发送失败:');
                return msg.role !== 'system' && msg.isTransientError !== true && !isOldAsyncFailBubble;
            });
        const isAiVisibleRecord = (record) => !!HistoryVisibility.buildVisibleMessage(record.msg, {
            preserveTimestamp: true,
            includeImageDescription: true
        });
        if (strategy === 'strict_recent') {
            const visibleRecords = eligibleRecords.filter(isAiVisibleRecord);
            const selected = visibleRecords.slice(-minLimit);
            return {
                records: selected,
                log: {
                    strategy: '严格最近 N 条',
                    startIndex: selected.length ? selected[0].index + 1 : 0,
                    rawCount: selected.length,
                    sentCount: 0,
                    minContext: minLimit,
                    maxContext: maxLimit
                },
                changed: false
            };
        }

        const visibleRecords = eligibleRecords.filter(isAiVisibleRecord);
        const latestSeq = visibleRecords.reduce((max, record) => {
            const seq = Number.isInteger(record.msg?.cacheSeq) ? record.msg.cacheSeq : -1;
            return Math.max(max, seq);
        }, -1);

        if (latestSeq < 0) {
            return {
                records: [],
                log: {
                    strategy: '缓存友好',
                    startIndex: 0,
                    rawCount: 0,
                    sentCount: 0,
                    minContext: minLimit,
                    maxContext: maxLimit
                },
                changed: false
            };
        }

        let changed = false;
        const minStartRecord = visibleRecords.slice(-minLimit)[0] || visibleRecords[0];
        let startSeq = Number.isInteger(contact?.historyWindowStartSeq)
            ? contact.historyWindowStartSeq
            : -1;

        // ★ 缓存友好窗口：先固定最近“最短上下文”的起点，再只往尾部追加。
        // 增长到“最长上下文”后重新换成最近的最短窗口，避免上下文条数被块大小放大。
        let selected = visibleRecords
            .filter(record => {
                const seq = Number.isInteger(record.msg?.cacheSeq) ? record.msg.cacheSeq : -1;
                return seq >= 0 && seq >= startSeq;
            });

        if (startSeq < 0 || latestSeq < startSeq || selected.length < Math.min(minLimit, visibleRecords.length) || selected.length > maxLimit) {
            startSeq = Number.isInteger(minStartRecord?.msg?.cacheSeq) ? minStartRecord.msg.cacheSeq : 0;
            selected = visibleRecords.filter(record => {
                const seq = Number.isInteger(record.msg?.cacheSeq) ? record.msg.cacheSeq : -1;
                return seq >= 0 && seq >= startSeq;
            });
        }

        if (contact && contact.historyWindowStartSeq !== startSeq) {
            contact.historyWindowStartSeq = startSeq;
            changed = true;
        }

        return {
            records: selected,
            log: {
                strategy: '缓存友好',
                startIndex: selected.length ? selected[0].index + 1 : 0,
                rawCount: selected.length,
                sentCount: 0,
                minContext: minLimit,
                maxContext: maxLimit,
                startSeq,
                latestSeq
            },
            changed
        };
    },
    // ★★★★★ 缓存友好历史窗口 END ★★★★★

    // ★★★★★ 请求缓存调试指纹 START ★★★★★
    // 这些 hash 只用于前端日志排查：看两轮请求是稳定前缀变了，还是本轮动态背景/世界书变了。
    // 它们不会发给模型，也不是安全用途的加密 hash。
    hashForCacheDebug(value) {
        const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
        let hash = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    },

    summarizeMessagesForCacheDebug(messages) {
        if (!Array.isArray(messages)) return [];
        return messages.map((message, index) => {
            const content = String(message?.content || '');
            return {
                index: index + 1,
                role: message?.role || 'unknown',
                chars: content.length,
                hash: this.hashForCacheDebug(`${message?.role || ''}\n${content}`)
            };
        });
    },

    buildRequestCacheDebugLog(options = {}) {
        const messages = Array.isArray(options.messages) ? options.messages : [];
        const stableMessageCount = Math.max(0, Math.min(messages.length, options.stableMessageCount || 0));
        const stableMessages = messages.slice(0, stableMessageCount);
        const dynamicContextText = options.dynamicContextText || '';
        const originalUserText = options.originalUserText || '';
        const finalUserMessage = [...messages].reverse().find(message => message?.role === 'user') || null;
        const triggeredEntries = Array.isArray(options.triggeredWorldInfoEntries)
            ? options.triggeredWorldInfoEntries
            : [];
        const constantEntries = Array.isArray(options.constantWorldInfoEntries)
            ? options.constantWorldInfoEntries
            : [];

        return {
            created_at: new Date().toISOString(),
            model: options.model || '',
            insert_mode: options.insertMode || 'system',
            history_window: options.historyWindowLog || null,
            stable_message_count: stableMessageCount,
            stable_prefix_hash: this.hashForCacheDebug(stableMessages),
            full_messages_hash: this.hashForCacheDebug(messages),
            dynamic_context_hash: dynamicContextText ? this.hashForCacheDebug(dynamicContextText) : 'empty',
            dynamic_context_chars: dynamicContextText.length,
            original_user_hash: originalUserText ? this.hashForCacheDebug(originalUserText) : 'empty',
            final_user_hash: finalUserMessage ? this.hashForCacheDebug(finalUserMessage.content || '') : 'empty',
            message_summaries: this.summarizeMessagesForCacheDebug(messages),
            triggered_world_info_count: triggeredEntries.length,
            triggered_world_info: triggeredEntries.map(entry => ({
                book: entry.book || '未命名世界书',
                comment: entry.comment || '未命名条目',
                uid: entry.uid || '',
                keys: Array.isArray(entry.keys) ? entry.keys : []
            })),
            constant_world_info_count: constantEntries.length,
            constant_world_info: constantEntries.map(entry => ({
                book: entry.book || '未命名世界书',
                comment: entry.comment || '未命名条目',
                uid: entry.uid || '',
                keys: Array.isArray(entry.keys) ? entry.keys : []
            })),
            extra_body_hash: options.extraBodyJson ? this.hashForCacheDebug(options.extraBodyJson) : 'empty'
        };
    },
    // ★★★★★ 请求缓存调试指纹 END ★★★★★
    

    // APP CONTROLLER.handleSend
    async handleSend(isReroll = false) {
        const contact = STATE.contacts.find(c => c.id === STATE.currentContactId);
        if (!contact) return;


        // ============================================================
        // 1. 准备 API 配置
        // ============================================================

        // 1.1 先载入全局默认设置
        let requestSettings = {
            API_URL: STATE.settings.API_URL,
            API_KEY: STATE.settings.API_KEY,
            MODEL: STATE.settings.MODEL,
            ASYNC_BACKEND_ENABLED: STATE.settings.ASYNC_BACKEND_ENABLED !== false,
            ASYNC_BACKEND_URL: STATE.settings.ASYNC_BACKEND_URL || '',
            ASYNC_BACKEND_TOKEN: STATE.settings.ASYNC_BACKEND_TOKEN || '',
            ASYNC_BACKEND_KEY_MODE: STATE.settings.ASYNC_BACKEND_KEY_MODE || CONFIG.DEFAULT.ASYNC_BACKEND_KEY_MODE || 'client_key',
            ASYNC_BACKEND_TTL_HOURS: STATE.settings.ASYNC_BACKEND_TTL_HOURS || CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS,
            CONTACT_ID: contact.id,

            MAX_TOKENS: STATE.settings.MAX_TOKENS || 32700,
            TEMPERATURE: STATE.settings.TEMPERATURE !== undefined ? STATE.settings.TEMPERATURE : 1.1,
            CONTEXT_LIMIT: STATE.settings.CONTEXT_LIMIT || CONFIG.DEFAULT.CONTEXT_LIMIT || 5,
            HISTORY_WINDOW_STRATEGY: STATE.settings.HISTORY_WINDOW_STRATEGY || CONFIG.DEFAULT.HISTORY_WINDOW_STRATEGY || 'cache_friendly',
            HISTORY_WINDOW_MAX_CONTEXT: STATE.settings.HISTORY_WINDOW_MAX_CONTEXT || CONFIG.DEFAULT.HISTORY_WINDOW_MAX_CONTEXT || 25,
            DYNAMIC_CONTEXT_INSERT_MODE: STATE.settings.DYNAMIC_CONTEXT_INSERT_MODE || CONFIG.DEFAULT.DYNAMIC_CONTEXT_INSERT_MODE || 'auto',

            // ★ 图片处理方式独立于 API 预设：切换角色专属文字预设时也继续跟随全局选择。
            IMAGE_API_MODE: STATE.settings.IMAGE_API_MODE === 'multimodal' ? 'multimodal' : 'separate',

            // ★★★ 新增：请求体附加参数 JSON ★★★
            CUSTOM_REQUEST_BODY_JSON: STATE.settings.CUSTOM_REQUEST_BODY_JSON || ''
        };

        // 1.2 检查预设覆盖
        if (contact.linkedPresetName) {
            const presets = STATE.settings.API_PRESETS || [];
            const targetPreset = presets.find(p => p.name === contact.linkedPresetName);
            
            if (targetPreset) {
                console.log(`[System] 使用角色专属预设: ${targetPreset.name}`);
                
                requestSettings.API_URL = targetPreset.url;
                requestSettings.API_KEY = targetPreset.key;
                requestSettings.MODEL = targetPreset.model;

                if (targetPreset.max_tokens !== undefined && targetPreset.max_tokens !== "") {
                    requestSettings.MAX_TOKENS = parseInt(targetPreset.max_tokens, 10);
                }

                if (targetPreset.temperature !== undefined && targetPreset.temperature !== "") {
                    requestSettings.TEMPERATURE = parseFloat(targetPreset.temperature);
                }

                if (targetPreset.context_limit !== undefined && targetPreset.context_limit !== "") {
                    requestSettings.CONTEXT_LIMIT = parseInt(targetPreset.context_limit, 10);
                }

                if (targetPreset.history_window_strategy) {
                    requestSettings.HISTORY_WINDOW_STRATEGY = targetPreset.history_window_strategy;
                }

                if (targetPreset.history_window_max_context !== undefined && targetPreset.history_window_max_context !== "") {
                    requestSettings.HISTORY_WINDOW_MAX_CONTEXT = parseInt(targetPreset.history_window_max_context, 10);
                } else if (targetPreset.history_window_block_size !== undefined && targetPreset.history_window_block_size !== "") {
                    // ★ 兼容旧预设：旧“每块消息数”近似迁移为新的最长上下文。
                    requestSettings.HISTORY_WINDOW_MAX_CONTEXT = parseInt(targetPreset.history_window_block_size, 10);
                }

                // ★★★ 新增：角色绑定 API 总预设时，也使用这个总预设保存的请求体附加参数 ★★★
                requestSettings.CUSTOM_REQUEST_BODY_JSON = targetPreset.extra_body_json || '';
                requestSettings.DYNAMIC_CONTEXT_INSERT_MODE = targetPreset.dynamic_context_insert_mode || requestSettings.DYNAMIC_CONTEXT_INSERT_MODE || CONFIG.DEFAULT.DYNAMIC_CONTEXT_INSERT_MODE || 'auto';

            } else {
                console.warn(`[System] 绑定的预设 "${contact.linkedPresetName}" 未找到，已回退到全局设置。`);
            }
        }

        // 1.3 最终兜底
        requestSettings.MAX_TOKENS = parseInt(requestSettings.MAX_TOKENS, 10);
        if (isNaN(requestSettings.MAX_TOKENS) || requestSettings.MAX_TOKENS <= 0) {
            requestSettings.MAX_TOKENS = 32700;
        }

        requestSettings.TEMPERATURE = parseFloat(requestSettings.TEMPERATURE);
        if (isNaN(requestSettings.TEMPERATURE)) {
            requestSettings.TEMPERATURE = 1.1;
        }

        requestSettings.CONTEXT_LIMIT = parseInt(requestSettings.CONTEXT_LIMIT, 10);
        if (isNaN(requestSettings.CONTEXT_LIMIT) || requestSettings.CONTEXT_LIMIT <= 0) {
            requestSettings.CONTEXT_LIMIT = CONFIG.DEFAULT.CONTEXT_LIMIT || 5;
        }
        if (!['cache_friendly', 'strict_recent'].includes(requestSettings.HISTORY_WINDOW_STRATEGY)) {
            requestSettings.HISTORY_WINDOW_STRATEGY = 'cache_friendly';
        }
        requestSettings.HISTORY_WINDOW_MAX_CONTEXT = parseInt(requestSettings.HISTORY_WINDOW_MAX_CONTEXT, 10);
        if (isNaN(requestSettings.HISTORY_WINDOW_MAX_CONTEXT) || requestSettings.HISTORY_WINDOW_MAX_CONTEXT <= 0) {
            requestSettings.HISTORY_WINDOW_MAX_CONTEXT = CONFIG.DEFAULT.HISTORY_WINDOW_MAX_CONTEXT || 25;
        }
        if (requestSettings.HISTORY_WINDOW_MAX_CONTEXT < requestSettings.CONTEXT_LIMIT) {
            requestSettings.HISTORY_WINDOW_MAX_CONTEXT = requestSettings.CONTEXT_LIMIT;
        }
        if (!['auto', 'system', 'user'].includes(requestSettings.DYNAMIC_CONTEXT_INSERT_MODE)) {
            requestSettings.DYNAMIC_CONTEXT_INSERT_MODE = CONFIG.DEFAULT.DYNAMIC_CONTEXT_INSERT_MODE || 'auto';
        }

        // 1.4 简单的配置检查
        const usingAsyncBackend = API.shouldUseAsyncBackend(requestSettings);
        const asyncNeedsClientKey = usingAsyncBackend && requestSettings.ASYNC_BACKEND_KEY_MODE !== 'server_secret';
        if (((!usingAsyncBackend || asyncNeedsClientKey) && (!requestSettings.API_URL || !requestSettings.API_KEY)) || !requestSettings.MODEL) {
            alert('API配置缺失！请检查设置。');
            return;
        }

        // 调试日志：看看最终发出去的参数对不对
        console.log("最终发送参数:", { 
            model: requestSettings.MODEL, 
            tokens: requestSettings.MAX_TOKENS, 
            temp: requestSettings.TEMPERATURE,
            historyMinContext: requestSettings.CONTEXT_LIMIT,
            historyWindowStrategy: requestSettings.HISTORY_WINDOW_STRATEGY,
            historyWindowMaxContext: requestSettings.HISTORY_WINDOW_MAX_CONTEXT,
            dynamicContextInsertMode: requestSettings.DYNAMIC_CONTEXT_INSERT_MODE,
            imageApiMode: requestSettings.IMAGE_API_MODE,
            linkedPresetName: contact.linkedPresetName || "跟随全局默认设置",
            extraBodyJson: requestSettings.CUSTOM_REQUEST_BODY_JSON || ""
        });

        // 角色没有绑定专属 System Prompt 时，永远跟随主设置里当前保存的全局提示词。
        // 注意：空字符串是有效设置，代表本次请求不发送第一条 system prompt。
        let systemPrompt = STATE.settings.SYSTEM_PROMPT !== undefined
            ? STATE.settings.SYSTEM_PROMPT
            : CONFIG.SYSTEM_PROMPT;
        if (contact.linkedSystemPromptPresetName) {
            const systemPresets = STATE.settings.SYSTEM_PROMPT_PRESETS || [];
            const targetSystemPreset = systemPresets.find(p => p.name === contact.linkedSystemPromptPresetName);
            if (targetSystemPreset) {
                systemPrompt = targetSystemPreset.prompt !== undefined ? targetSystemPreset.prompt : '';
                console.log(`[System Prompt] 使用角色专属预设: ${targetSystemPreset.name}`);
            } else {
                console.warn(`[System Prompt] 绑定的预设 "${contact.linkedSystemPromptPresetName}" 未找到，已回退到全局设置。`);
            }
        }

        // ============================================================
        // 2. 准备发送内容 (Reroll vs New Message)
        // ============================================================
        let userText = UI.els.input.value.trim();
        const timestamp = formatTimestamp();
        let agentUserMessage = null;
        let currentMomentTurnId = null;
        
        // ★ 判断是否有待发送的图片 (只有非 Reroll 时才处理新图)
        const hasPendingImage = (STATE.pendingImage && !isReroll);
        let imageDescription = ""; 
        let currentImageBase64 = null;

        // 如果既没文本也没图，且不是reroll，就退出
        if (!isReroll && !userText && !hasPendingImage) return;

        // =================================================================
        // ★★★ 第一步：如果是 Reroll，先弹窗问用户确不确定 ★★★
        // =================================================================
        if (isReroll) {
            const isConfirmed = confirm("重新生成消息？"); 
            if (!isConfirmed) return; // 如果点取消，直接退出，页面一动不动，还在看历史
        }
        
        // =================================================================
        // ★★★ 第二步：现在确认要发消息（或确认Reroll）了，强制切回最新底部 ★★★
        // =================================================================
        if (STATE.chatMode === 'jump') {
            STATE.chatMode = 'normal';
            STATE.visibleMsgCount = Math.max(CONFIG.CHAT_PAGE_SIZE, STATE.visibleMsgCount || 15);
            UI.renderChatHistory(contact);
        }
        // ★★★ Presence：用户主动发消息/重生成时，立刻把角色状态拉回在线 ★★★
        UI.touchContactPresence(contact);

        // =================================================================

        // =================================================================
        // ★★★ 第三步：执行真正的 Reroll 或 发新消息逻辑 ★★★
        // =================================================================
        if (isReroll) {
            const lastUserMsg = [...contact.history].reverse().find(m => m.role === 'user');
            if (!lastUserMsg) return;
            agentUserMessage = lastUserMsg;
            // 朋友圈按“用户消息轮次”消费；重 roll 复用同一个 turnId，不再额外扣次数。
            if (!lastUserMsg.momentInjectionTurnId) {
                lastUserMsg.momentInjectionTurnId = `moment_turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            }
            currentMomentTurnId = lastUserMsg.momentInjectionTurnId;
            // Reroll 复用历史记录里的文本
            userText = lastUserMsg.content;
            
            // ★ 多模态重新生成必须复用这条用户消息原来的图片；普通模式仍然只复用已经保存的识图描述。
            // 图片气泡被“向 Ta 隐藏”后不能偷偷重新带回请求，索引规则与渲染/删除保持一致。
            if (requestSettings.IMAGE_API_MODE === 'multimodal' && Array.isArray(lastUserMsg.images) && lastUserMsg.images[0]) {
                const imagePartIndex = HistoryVisibility.getTextParagraphs(lastUserMsg).length;
                const hiddenIndices = Array.isArray(lastUserMsg.hiddenIndices) ? lastUserMsg.hiddenIndices : [];
                if (!hiddenIndices.includes(imagePartIndex)) {
                    currentImageBase64 = lastUserMsg.images[0];
                }
            }
            
            // 移除最近的 AI 回复；同时作废绑定在旧回复上的 Agent 待确认操作。
            const removedAssistantMessages = [];
            while(contact.history.length > 0 && contact.history[contact.history.length-1].role === 'assistant') {
                removedAssistantMessages.push(contact.history.pop());
            }
            this.discardAgentConfirmationsForMessages(removedAssistantMessages);
            UI.removeLatestAiBubbles();
        } 

        // New Message 逻辑：上屏 & 识图
        else {
            // 1. 决定图片数据
            if (hasPendingImage) {
                currentImageBase64 = STATE.pendingImage;
            }

            // 2. 立即在 UI 显示用户消息
            const currentMsgIndex = contact.history.length; // 即将存入的索引
            const paragraphs = splitMessageIntoBubbleParts(userText);
            
            const group = document.createElement('div');
            group.className = 'message-group';
            group.dataset.msgIndex = currentMsgIndex;
            group.dataset.sender = 'user';

            // --- 修复点开始 ---
            
            // 2.1 渲染文本部分
            // 只要有文本就渲染文本气泡，不处理图片
            if (paragraphs.length > 0) {
                paragraphs.forEach((p, index) => {
                    if (p.trim() === '---') {
                        // ✅ 正确做法：创建一个节点，然后塞进 group
                        const separator = document.createElement('div');
                        separator.className = 'chat-separator animate';
                        group.appendChild(separator); 
                    } else {
                        // ★ 纯文本气泡，传 null (不带图)
                        const bubble = UI.createSingleBubble(
                            parseCustomMarkdown(p.trim()), 'user', null, timestamp, currentMsgIndex, true, index, null
                        );
                        group.appendChild(bubble);
                    }
                });
            } 
            // 删除了原本这里的 else if (hasPendingImage) {...} 
            // 因为它和下面的逻辑重复，会导致纯图发送时出现两个气泡

            // 2.2 ★★★ 统一渲染图片气泡 ★★★
            // 无论是“纯图”还是“文+图”，图片都由此处统一生成
            if (currentImageBase64) {
                // 这是一个只有图的气泡
                // 注意：index 使用 paragraphs.length，这样如果上面有文本，图片的 index 就是接在文本后面的
                const imgBubble = UI.createSingleBubble(
                    "", 'user', null, timestamp, currentMsgIndex, true, paragraphs.length, currentImageBase64
                );
                group.appendChild(imgBubble);
            }

            // --- 修复点结束 ---

            UI.els.chatMsgs.appendChild(group);
            UI.scrollToBottom();

            // 3. UI 清理 (清空输入框和预览)
            UI.els.input.value = '';
            UI.els.input.style.height = '38px'; // ★★★ 就是这里！发送后，把输入框高度重置回 38px ★★★
            if (UI.els.previewContainer) UI.els.previewContainer.style.display = 'none'; // 隐藏预览
            STATE.pendingImage = null; // ★ 清空暂存，防止下次误发
            if (window.innerWidth < 800) UI.els.input.blur();

            // 4. ★★★ 核心分支：如果有图，先跑识图 API ★★★
            // 4. ★★★ 核心分支：如果有图，先跑识图 API ★★★
            if (hasPendingImage && requestSettings.IMAGE_API_MODE === 'separate') {
                const visionSettings = {
                    // 稍微优化下默认值，如果这里是空字符串， fetch 会直接报错被 catch 捕获
                    url: STATE.settings.VISION_URL, 
                    key: STATE.settings.VISION_KEY || STATE.settings.API_KEY,
                    model: STATE.settings.VISION_MODEL || 'Qwen/Qwen3-VL-30B-A3B-Instruct',
                    prompt: STATE.settings.VISION_PROMPT || '描述这张图片'
                };

                if (usingAsyncBackend) {
                    // ★ 后台识图：
                    // 走 Worker 时不在前端等待视觉模型，避免手机切屏时识图请求被浏览器杀掉。
                    // 图片和视觉配置只随本次 job 临时发送，Worker 用完不会存 KV。
                    const visionAuthMode = requestSettings.ASYNC_BACKEND_KEY_MODE || 'client_key';
                    requestSettings.ASYNC_BACKEND_VISION = {
                        image: currentImageBase64,
                        url: visionSettings.url,
                        key: visionAuthMode === 'server_secret' ? '' : visionSettings.key,
                        model: visionSettings.model,
                        prompt: visionSettings.prompt,
                        auth_mode: visionAuthMode
                    };
                    requestSettings.ASYNC_BACKEND_USER_MESSAGE_INDEX = currentMsgIndex;
                } else {
                    UI.setLoading(true, contact.id);
                    try {
                        // 如果连 URL 都没填，直接抛出错误，不发请求了
                        if (!visionSettings.url) throw new Error("未配置视觉API地址");

                        imageDescription = await API.analyzeImage(currentImageBase64, visionSettings);

                    } catch (err) {
                        console.error("识图流程跳过/失败:", err);
                        // ★ 给 AI 一个明确的提示，告诉它为什么看不见
                        imageDescription = "（系统提示：用户发送了一张图片，但由于未配置视觉模型或网络错误，无法提供图片内容的文本描述。请根据用户的文字上下文进行回复，如果需要，可以礼貌地询问图片内容。）";
                    }
                }
            }

            // 5. 存入历史记录 (Step 3 - Storage)
            // 构造新消息对象
            const momentInjectionTurnId = `moment_turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const newUserMsg = { 
                role: 'user', 
                content: `[${timestamp}] ${userText}`, // 注意：content 里不含描述，描述是后台用的
                timestamp: timestamp,
                // ★ 稳定消息身份让主动补发可以按时间插入，而不会让后台任务只靠易变的数组下标找错消息。
                messageId: ProactiveMessages.makeId('user'),
                eventAt: Date.now(),
                recordedAt: Date.now(),
                momentInjectionTurnId: momentInjectionTurnId,
                // ★ 存图和描述
                images: currentImageBase64 ? [currentImageBase64] : null,
                image_description: imageDescription || null
            };

            // ★ 存储优化：只保留最后 3 张图的 base64，旧的删掉 base64 省空间
            let imgCount = 0;
            if (newUserMsg.images) imgCount++; 
            for (let i = contact.history.length - 1; i >= 0; i--) {
                if (contact.history[i].images && contact.history[i].images.length > 0) {
                    imgCount++;
                    if (imgCount > 3) {
                        contact.history[i].images = null; 
                        contact.history[i].isImageExpired = true; 
                    }
                }
            }
            
            contact.history.push(newUserMsg);
            agentUserMessage = newUserMsg;
            requestSettings.ASYNC_BACKEND_USER_MESSAGE_ID = newUserMsg.messageId;
            currentMomentTurnId = momentInjectionTurnId;
        }

        // 保存一次（包含刚刚优化的图片数据）
        await Storage.saveContacts();
        if (!isReroll && agentUserMessage) {
            ProactiveMessages.onUserMessage(contact).catch(error => console.warn('[主动消息] 用户消息同步失败:', error));
        }
        UI.setLoading(true, contact.id);

        // ★★★★★ Agent：前置执行关闭 START ★★★★★
        // 新协议由角色回复里的『行动意图』触发 skill；用户消息阶段不再让副模型抢先判断。
        const agentRuntimeResult = null;
        // ★★★★★ Agent：前置执行关闭 END ★★★★★

        // ============================================================
        // 3. 构建发送给 AI 的上下文 (缝合怪逻辑)
        // ============================================================
        
        const historyMetadataChanged = this.ensureHistoryCacheMetadata(contact);
        if (historyMetadataChanged) {
            await Storage.saveContacts();
        }
        const historyWindow = this.selectHistoryWindowRecords(contact, requestSettings);
        if (historyWindow.changed) {
            await Storage.saveContacts();
        }

        // 预处理 History：统一走 AI 可见历史清洗，避免聊天、朋友圈、记忆各写一套隐藏规则。
        const recentHistory = historyWindow.records
            .map(record => record.msg)
            .map(msg => HistoryVisibility.buildVisibleMessage(msg, {
                preserveTimestamp: true,
                includeImageDescription: true
            }))
            .filter(m => m !== null);
        historyWindow.log.sentCount = recentHistory.length;
        requestSettings.HISTORY_WINDOW_LOG = historyWindow.log;

        // ★★★ 缓存优化：把“当前 user”从历史尾部拆出来。
        // 日级稳定背景前置到角色设定后；auto 模式把本轮触发世界书并入当前 user，避免打穿历史前缀缓存。
        const historyForPayload = [...recentHistory];
        let currentUserMessage = null;
        if (historyForPayload.length && historyForPayload[historyForPayload.length - 1].role === 'user') {
            currentUserMessage = historyForPayload.pop();
        }

        // ★ 纯图片多模态消息没有 image_description，历史清洗会自然得到空文本。
        // 这里仅给本轮请求补一个很短的文字块，不写回聊天记录，也不会多渲染一个用户气泡。
        if (!currentUserMessage && currentImageBase64 && requestSettings.IMAGE_API_MODE === 'multimodal') {
            currentUserMessage = { role: 'user', content: '请查看这张图片。' };
        }


        // 构造最终 Payload
        // 空白 System Prompt 不塞空壳 system 消息，避免请求体里出现无意义的 content: ""。
        const messagesToSend = [];
        const routineDynamicContextPrompts = [];
        const volatileDynamicContextPrompts = [];
        let triggeredWorldInfoPrompt = '';
        if ((systemPrompt || '').trim()) {
            messagesToSend.push({ role: 'system', content: systemPrompt });
        }
        const agentCapabilityPrompt = this.buildAgentCapabilityPrompt();
        const contactPromptBlocks = [
            (contact.prompt || '').trim(),
            agentCapabilityPrompt
        ].filter(Boolean);
        // User Prompt 和 skill 能力都为空时不塞空壳 system 消息，保持 messages 列表干净。
        if (contactPromptBlocks.length) {
            messagesToSend.push({ role: 'system', content: `=== User Prompt ===\n${contactPromptBlocks.join('\n\n')}` });
        }

        // ★★★★★ 世界书分层注入 START ★★★★★
        // 常驻世界书放进前置世界书 system；关键词触发世界书按插入方式进入 user 或同一个世界书 system。
        // 图片描述是给主模型看的辅助信息，不属于用户亲口说的话；
        // 所以世界书扫描单独吃一份去掉图片描述的 history，避免图片内容误触发关键词。
        const worldInfoScanHistory = recentHistory.map(m => ({
            role: m.role,
            content: (m.content || '').replace(/\n\n\[System Info: 对方发送了一张图片，图片内容描述:[\s\S]*$/g, '')
        }));
        const worldInfoByType = (typeof WorldInfoEngine.scanByType === 'function')
            ? WorldInfoEngine.scanByType(userText, worldInfoScanHistory, contact.id, contact.name)
            : { constant: null, triggered: WorldInfoEngine.scan(userText, worldInfoScanHistory, contact.id, contact.name) };
        // ★★★★★ 世界书分层注入 END ★★★★★

        // ★★★★★ 世界感知：收集本轮动态背景 START ★★★★★
        // 这里会先检查天气缓存是不是当前 0/12 点刷新时段的。
        // 如果今天还没有缓存，就在真正发请求前补一次。
        await this.ensureWorldSenseWeatherReady();
        const worldSensePrompt = WorldSense.buildPromptFromSettings(STATE.settings, new Date());
        if (worldSensePrompt) {
            routineDynamicContextPrompts.push(worldSensePrompt);
        }
        // ★★★★★ 世界感知：收集本轮动态背景 END ★★★★★

        // ★★★★★ 探索 TO DO / 倒数日：收集本轮动态背景 START ★★★★★
        // 开关只控制是否告诉 AI；本地列表本身会继续保存在 IndexedDB。
        const todoContextPrompt = TodoContext.buildPrompt(new Date());
        if (todoContextPrompt) {
            routineDynamicContextPrompts.push(todoContextPrompt);
        }
        // ★★★★★ 探索 TO DO / 倒数日：收集本轮动态背景 END ★★★★★

        // ★★★★★ 角色记忆：收集本轮动态背景 START ★★★★★
        // 记忆只注入昨天及更早的总结；寄语只在 UI 展示，不进入上下文。
        await this.ensureCharacterMemoryReady(contact.id, { priority: true, silent: true });
        const characterMemoryPrompt = CharacterMemory.buildChatPrompt(contact.id, new Date());
        if (characterMemoryPrompt) {
            routineDynamicContextPrompts.push(characterMemoryPrompt);
        }
        // ★★★★★ 角色记忆：收集本轮动态背景 END ★★★★★

        // ★★★★★ 心笺：收集本轮动态背景 START ★★★★★
        // ★ 心笺允许当天记录立即注入；超出天数后只保留用户/角色星标的内容。
        const heartNotePrompt = typeof AgentHeartNoteManager !== 'undefined'
            ? AgentHeartNoteManager.buildChatPrompt(contact.id, new Date())
            : '';
        if (heartNotePrompt) routineDynamicContextPrompts.push(heartNotePrompt);
        // ★★★★★ 心笺：收集本轮动态背景 END ★★★★★

        // ★★★★★ Agent：skill 执行结果回注 START ★★★★★
        // 主模型只看到自然语言摘要，不能看到 worker model 的原始 JSON。
        // Agent 刚刚改变了前端状态，属于“本轮即时信息”，和触发世界书一样按缓存优化策略分流。
        if (agentRuntimeResult && Array.isArray(agentRuntimeResult.prompts)) {
            volatileDynamicContextPrompts.push(...agentRuntimeResult.prompts);
        }
        // ★★★★★ Agent：skill 执行结果回注 END ★★★★★

        // ★★★★★ 角色日程：收集本轮动态背景 START ★★★★★
        // 日程只在该角色开启时注入；如果今天还没生成，会优先补当前角色这一份。
        await this.ensureCharacterScheduleReady(contact.id, { priority: true, silent: true });
        const characterSchedulePrompt = CharacterSchedule.buildChatPrompt(contact.id, new Date());
        if (characterSchedulePrompt) {
            routineDynamicContextPrompts.push(characterSchedulePrompt);
        }
        // ★★★★★ 角色日程：收集本轮动态背景 END ★★★★★
        
        // World Info 扫描：这里只放关键词触发条目，常驻条目已经放进稳定区。
        if (worldInfoByType.triggered) {
            triggeredWorldInfoPrompt = `=== 背景信息补充 ===\n${worldInfoByType.triggered}`;
        }


        // ★★★★★ 番茄钟：按角色收集实时状态与完成通知 START ★★★★★
        // 先校正截止时间，避免后台定时器延迟导致已完成的番茄仍被写成进行中。
        // ★ 正式聊天只需要校正番茄钟状态，不在聊天输入期间重绘隐藏的番茄钟页面。
        await Pomodoro.tick(Date.now(), { renderMode: 'indicator' });
        const pomodoroUpdateInfo = Pomodoro.context(contact.id, currentMomentTurnId);
        requestSettings.POMODORO_INJECTION = pomodoroUpdateInfo;
        // 与朋友圈共用即时背景队列且排在它前面，统一走 auto / user / system 分流。
        if (pomodoroUpdateInfo.prompt) volatileDynamicContextPrompts.push(pomodoroUpdateInfo.prompt);
        // 请求快照随用户消息保存，后台恢复也只消费本次实际发送的记录。
        const pomodoroUserMessage = [...contact.history].reverse().find(m => m.role === 'user');
        if (pomodoroUserMessage) {
            pomodoroUserMessage.pomodoroInjection = pomodoroUpdateInfo;
            await Storage.saveContacts();
        }
        // ★★★★★ 番茄钟：按角色收集实时状态与完成通知 END ★★★★★

        // ★★★ 【核心修改】检查朋友圈并注入 ★★★
        let momentsUpdateInfo = null;
        try {
            // 调用我们刚才写的辅助函数
            // 注意：如果你把函数放在 App 对象下，记得用 this.getMomentsContextForChat
            // 如果是定义在外部，直接用
            if (typeof this.getMomentsContextForChat === 'function') {
                momentsUpdateInfo = this.getMomentsContextForChat(contact.id, currentMomentTurnId);
            } else if (typeof App !== 'undefined' && typeof App.getMomentsContextForChat === 'function') {
                momentsUpdateInfo = App.getMomentsContextForChat(contact.id, currentMomentTurnId);
            }

            if (momentsUpdateInfo && momentsUpdateInfo.prompt) {
                console.log(`[Chat] 注入朋友圈动态 context (${momentsUpdateInfo.momentIds.length}条)`);
                // 朋友圈是本轮通知型背景，不混进“今日稳定背景”；auto 下随本轮触发世界书并入当前 user。
                volatileDynamicContextPrompts.push(momentsUpdateInfo.prompt);
            }
        } catch (e) {
            console.warn("朋友圈注入失败:", e);
        }

        let dynamicContextContent = '';
        const allDynamicContextPrompts = [
            ...routineDynamicContextPrompts,
            ...volatileDynamicContextPrompts,
            triggeredWorldInfoPrompt
        ].filter(Boolean);
        const systemDynamicContextPrompts = requestSettings.DYNAMIC_CONTEXT_INSERT_MODE === 'user'
            ? []
            : routineDynamicContextPrompts;
        const userDynamicContextPrompts = requestSettings.DYNAMIC_CONTEXT_INSERT_MODE === 'user'
            ? allDynamicContextPrompts
            : requestSettings.DYNAMIC_CONTEXT_INSERT_MODE === 'auto'
                ? [triggeredWorldInfoPrompt, ...volatileDynamicContextPrompts].filter(Boolean)
                : [];

        if (allDynamicContextPrompts.length) {
            dynamicContextContent = [
                '=== 本轮背景资料 ===',
                '',
                ...allDynamicContextPrompts
            ].join('\n\n');
        }

        if (systemDynamicContextPrompts.length) {
            // ★★★★★ 日级稳定背景前置 START ★★★★★
            // 天气、日期、TODO、日程等一天内相对稳定的信息，紧跟角色设定；不再插到最新 user 前面。
            messagesToSend.push({
                role: 'system',
                content: [
                    '=== 今日背景信息 ===',
                    '',
                    ...systemDynamicContextPrompts
                ].join('\n\n')
            });
            // ★★★★★ 日级稳定背景前置 END ★★★★★
        }

        const worldInfoSystemBlocks = [];
        if (worldInfoByType.constant) {
            worldInfoSystemBlocks.push(`=== 常驻世界知识/环境信息 ===\n${worldInfoByType.constant}`);
        }
        if (requestSettings.DYNAMIC_CONTEXT_INSERT_MODE === 'system' && triggeredWorldInfoPrompt) {
            // ★ system 模式没有缓存收益；本轮触发世界书和常驻世界书放在同一条世界书 system 里，语义更集中。
            worldInfoSystemBlocks.push(triggeredWorldInfoPrompt);
        }
        if (requestSettings.DYNAMIC_CONTEXT_INSERT_MODE === 'system' && volatileDynamicContextPrompts.length) {
            worldInfoSystemBlocks.push([
                '=== 本轮即时系统信息 ===',
                '',
                ...volatileDynamicContextPrompts
            ].join('\n\n'));
        }
        if (worldInfoSystemBlocks.length) {
            messagesToSend.push({
                role: 'system',
                content: worldInfoSystemBlocks.join('\n\n')
            });
        }

        // 追加历史：当前 user 已经拆到最后单独处理，保证用户原话仍然压轴。
        historyForPayload.forEach(h => messagesToSend.push(h));

        if (userDynamicContextPrompts.length && currentUserMessage) {
            // ★★★★★ 自动缓存优化：本轮触发世界书并入当前 user START ★★★★★
            // user 模式会把所有动态背景合并进当前 user；auto 模式只合并变化最大的本轮触发世界书。
            // 日级稳定背景已经前置；新增世界书尽量压到末尾，保护历史前缀缓存。
            const userContextTitle = requestSettings.DYNAMIC_CONTEXT_INSERT_MODE === 'auto'
                ? '【系统信息补充】'
                : '【系统信息补充】';
            currentUserMessage = {
                ...currentUserMessage,
                content: [
                    userContextTitle,
                    userDynamicContextPrompts.join('\n\n'),
                    '',
                    '【系统信息补充END】',
                    '',
                    '【用户当前消息】',
                    currentUserMessage.content
                ].join('\n\n')
            };
            // ★★★★★ 自动缓存优化：本轮触发世界书并入当前 user END ★★★★★
        } else if (userDynamicContextPrompts.length) {
            // 极少数没有当前 user 的调用兜底：不能合并时仍保留动态背景，避免世界书静默丢失。
            const firstNonSystemIndex = messagesToSend.findIndex(message => message?.role !== 'system');
            const insertIndex = firstNonSystemIndex >= 0 ? firstNonSystemIndex : messagesToSend.length;
            messagesToSend.splice(insertIndex, 0, {
                role: 'system',
                content: [
                    '=== 本轮背景资料 ===',
                    '',
                    ...userDynamicContextPrompts
                ].join('\n\n')
            });
        }

        const stableMessageCount = messagesToSend.length;

        if (currentUserMessage) {
            messagesToSend.push(currentUserMessage);
        }
        requestSettings.ASYNC_BACKEND_REQUEST_USER_MESSAGE_INDEX = currentUserMessage
            ? messagesToSend.length - 1
            : -1;

        // ★ 多模态只携带本轮原图：历史中的其它 images 不进入 messagesToSend，避免每轮重复计算图片 Token。
        requestSettings.MULTIMODAL_IMAGE = requestSettings.IMAGE_API_MODE === 'multimodal'
            ? (currentImageBase64 || '')
            : '';
        requestSettings.MULTIMODAL_MESSAGE_INDEX = requestSettings.MULTIMODAL_IMAGE
            ? requestSettings.ASYNC_BACKEND_REQUEST_USER_MESSAGE_INDEX
            : -1;
        requestSettings.ASYNC_BACKEND_AGENT = null;
        if (requestSettings.ASYNC_BACKEND_AGENT?.todo_manager) {
            await this.setAgentExecutionState(contact, agentUserMessage, 'todo_manager', {
                status: 'pending',
                error: '',
                resultPrompt: ''
            });
        }
        requestSettings.ASYNC_BACKEND_ON_JOB_UPDATE = usingAsyncBackend
            ? async (job) => this.applyAsyncBackendAgentStage(job, contact, agentUserMessage)
            : null;
        requestSettings.REQUEST_CACHE_DEBUG_LOG = this.buildRequestCacheDebugLog({
            messages: messagesToSend,
            stableMessageCount,
            dynamicContextText: dynamicContextContent,
            originalUserText: userText,
            insertMode: requestSettings.DYNAMIC_CONTEXT_INSERT_MODE,
            historyWindowLog: requestSettings.HISTORY_WINDOW_LOG,
            triggeredWorldInfoEntries: worldInfoByType.triggeredEntries || [],
            constantWorldInfoEntries: worldInfoByType.constantEntries || [],
            extraBodyJson: requestSettings.CUSTOM_REQUEST_BODY_JSON || '',
            model: requestSettings.MODEL
        });

        // ============================================================
        // 4. 发送请求给 AI (Step 4)
        // ============================================================
        try {
            const aiText = await API.chat(messagesToSend, requestSettings);
            
            const aiTimestamp = formatTimestamp();
            const asyncJobId = usingAsyncBackend ? API.lastAsyncBackendResult?.jobId : null;
            const asyncImageDescription = usingAsyncBackend ? API.lastAsyncBackendResult?.image_description : null;
            const asyncAgentActions = usingAsyncBackend ? API.lastAsyncBackendResult?.agent_actions : null;
            const asyncAgentPrompt = usingAsyncBackend ? API.lastAsyncBackendResult?.agent_prompt : '';
            const asyncAgentStatus = usingAsyncBackend ? API.lastAsyncBackendResult?.agent_status : '';
            const asyncAgentError = usingAsyncBackend ? API.lastAsyncBackendResult?.agent_error : '';
            const asyncUserMessageIndex = usingAsyncBackend ? API.lastAsyncBackendResult?.userMessageIndex : null;
            const asyncUserMessageId = usingAsyncBackend ? API.lastAsyncBackendResult?.userMessageId : null;

            // ★ 后台识图回填：
            // 前台轮询链路如果顺利等到 Worker 完成，也要把图片描述补进刚刚的用户消息。
            // 这样后续上下文仍然沿用原本的 image_description 注入逻辑。
            if (asyncImageDescription && (asyncUserMessageId || agentUserMessage?.messageId || Number.isInteger(asyncUserMessageIndex))) {
                const stableUserMessageId = asyncUserMessageId || agentUserMessage?.messageId;
                const imageMsg = stableUserMessageId
                    ? contact.history.find(item => item?.messageId === stableUserMessageId)
                    : contact.history[asyncUserMessageIndex];
                if (imageMsg && imageMsg.role === 'user' && imageMsg.images && !imageMsg.image_description) {
                    imageMsg.image_description = asyncImageDescription;
                }
            }

            if (Array.isArray(asyncAgentActions) && asyncAgentActions.length) {
                await this.applyAsyncAgentActions(asyncAgentActions, contact);
            }

            if (usingAsyncBackend && requestSettings.ASYNC_BACKEND_AGENT?.todo_manager) {
                if (asyncAgentStatus === 'failed') {
                    await this.setAgentExecutionState(contact, agentUserMessage, 'todo_manager', {
                        status: 'failed',
                        error: asyncAgentError || 'async_agent_failed',
                        resultPrompt: ''
                    });
                } else if (Array.isArray(asyncAgentActions) && asyncAgentActions.length) {
                    await this.setAgentExecutionState(contact, agentUserMessage, 'todo_manager', {
                        status: 'applied',
                        reason: 'async_final_actions',
                        resultPrompt: String(asyncAgentPrompt || '').trim()
                    });
                } else {
                    await this.setAgentExecutionState(contact, agentUserMessage, 'todo_manager', {
                        status: 'skipped',
                        reason: 'async_final_no_actions',
                        resultPrompt: String(asyncAgentPrompt || '').trim()
                    });
                }
            }

            const alreadySavedByResume = asyncJobId
                ? contact.history.some(msg => msg.asyncJobId === asyncJobId)
                : false;
            let newAiMessageIndex = contact.history.length - 1;

            // ★★★★★ 后台回复接收：双链路去重 START ★★★★★
            // 停在聊天页切后台时，可能出现两条链路同时完成：
            // 1. handleSend 里原本的前台等待链路；
            // 2. visibilitychange/pageshow 触发的 pending job 恢复链路。
            // 两边拿到的是同一个 Worker job，所以前台保存时也写 asyncJobId，
            // 并且保存前先查一次，防止恢复链路已经把同一条回复写进 history。
            if (!alreadySavedByResume) {
                const aiMessage = {
                    role: 'assistant',
                    content: aiText,
                    timestamp: aiTimestamp,
                    messageId: ProactiveMessages.makeId('assistant'),
                    eventAt: Date.now(),
                    recordedAt: Date.now(),
                    replyToMessageId: agentUserMessage?.messageId || ''
                };
                if (asyncJobId) aiMessage.asyncJobId = asyncJobId;
                contact.history.push(aiMessage);
                newAiMessageIndex = contact.history.length - 1;
            } else {
                newAiMessageIndex = contact.history.findIndex(msg => msg.asyncJobId === asyncJobId);
            }
            // ★★★★★ 后台回复接收：双链路去重 END ★★★★★

            // ★★★ Presence：AI 回复入库后也算一次互动，保持顶部状态新鲜 ★★★
            UI.touchContactPresence(contact);

            const assistantMessage = contact.history[newAiMessageIndex] || null;
            if (assistantMessage && assistantMessage.role === 'assistant') {
                const consumedWorkerPostAgent = await this.consumeWorkerPostAgentResult(contact, assistantMessage, API.lastAsyncBackendResult?.post_agent);
                if (!consumedWorkerPostAgent) {
                    this.runAgentPostAgents(contact, aiText, assistantMessage).catch(error => {
                        console.warn('[PostAgent][总路由] async failed:', error);
                    });
                }
            }

            // ★ 番茄钟只有正式回复成功才扣次数；Reroll 和后台恢复由 turnId 去重。
            await Pomodoro.consume(pomodoroUpdateInfo);

            // ★★★ 【核心修改】AI回复成功后，按聊天轮次扣除朋友圈通知 ★★★
            if (momentsUpdateInfo && momentsUpdateInfo.momentIds) {
                const consumedTurnId = momentsUpdateInfo.turnId || currentMomentTurnId;
                let anyChanged = false;
                momentsUpdateInfo.momentIds.forEach(mid => {
                    const m = STATE.moments.find(x => x.id === mid);
                    if (!m || !m.chatInjectionStatus || !consumedTurnId) return;

                    if (!m.chatInjectionActiveTurn || typeof m.chatInjectionActiveTurn !== 'object' || Array.isArray(m.chatInjectionActiveTurn)) {
                        m.chatInjectionActiveTurn = {};
                    }
                    if (m.chatInjectionActiveTurn[contact.id] === consumedTurnId) return;

                    const remainingTurns = Number(m.chatInjectionStatus[contact.id]) || 0;
                    if (remainingTurns > 0) {
                        m.chatInjectionStatus[contact.id] = remainingTurns - 1;
                        m.chatInjectionActiveTurn[contact.id] = consumedTurnId;
                        anyChanged = true;
                        console.log(`[Chat] 朋友圈 ${mid} 对角色 ${contact.name} 的剩余通知轮次: ${m.chatInjectionStatus[contact.id]}`);
                    }
                });
                // 如果数据变了，记得保存朋友圈数据库
                if (anyChanged) {
                    if (typeof Storage.saveMoments === 'function') await Storage.saveMoments();
                    else if (typeof this.saveMoments === 'function') await this.saveMoments();
                }
            }






            // 只有当前还在这个窗口才渲染
            if (this.isViewingContactChat(contact.id)) {
                await Storage.saveContacts();
                if (!alreadySavedByResume) {
                    ProactiveMessages.onAssistantMessage(contact).catch(error => console.warn('[主动消息] 角色回复同步失败:', error));
                }
                
                // 渲染 AI 瀑布流
                if (!alreadySavedByResume) {
                    await UI.playWaterfall(aiText, contact.avatar, aiTimestamp, newAiMessageIndex, contact.name);
                } else {
                    UI.renderChatHistory(contact);
                }
            } else {
                if (!alreadySavedByResume) {
                    this.markContactIncomingMessage(contact);
                }
                await Storage.saveContacts();
                if (!alreadySavedByResume) {
                    ProactiveMessages.onAssistantMessage(contact).catch(error => console.warn('[主动消息] 角色回复同步失败:', error));
                }
                UI.renderContacts(); 
                this.refreshDesktopUnreadDotsIfNeeded();
            }
            
            UI.setLoading(false, contact.id);
            
        } catch (error) {
            console.error(error);

            // ★★★★★ 后台回复接收：手机切屏保护 START ★★★★★
            // 这里接住 API 层抛来的“pending 标记”：它不是发送失败，
            // 只是手机浏览器把前台轮询断开了。用户消息已经发给 Worker，
            // 所以不要往聊天里追加失败气泡，保留 pending job 等回前台取结果。
            if (error.isAsyncBackendPending) {
                UI.setLoading(false, contact.id);
                UI.renderContacts();
                this.scheduleAsyncBackendResumeCheck(1200);
                return;
            }
            // ★★★★★ 后台回复接收：手机切屏保护 END ★★★★★

            await this.maybePromptDynamicContextCompatMode(error, requestSettings, contact);

            if (this.isViewingContactChat(contact.id)) {
                UI.setLoading(false, contact.id);
                const errorIndex = contact.history.length > 0 ? contact.history.length - 1 : 0;
                UI.appendMessageBubble(`(发送失败: ${error.message})`, 'ai', contact.avatar, null, errorIndex);
            }
        } finally {
            if (this.isViewingContactChat(contact.id)) {
                UI.updateRerollState(contact);
            }
            // 手机端不自动聚焦，防止键盘弹起遮挡
            if (window.innerWidth >= 800 && UI.els.input) UI.els.input.focus();
        }
    },

    syncHistoryWindowStrategyUI() {
        const strategySelect = document.getElementById('history-window-strategy');
        const cacheControls = document.getElementById('history-window-cache-controls');
        const maxContextRow = document.getElementById('history-window-max-context-row');
        if (!strategySelect || !cacheControls) return;

        // ★ 缓存友好和严格模式都用最短上下文；最长上下文只在缓存友好模式下生效。
        cacheControls.style.display = 'grid';
        if (maxContextRow) {
            maxContextRow.style.display = strategySelect.value === 'cache_friendly' ? '' : 'none';
        }
    },

    // ★★★★★ 图片处理方式 UI START ★★★★★
    syncImageApiModeUI() {
        const checkedMode = document.querySelector('input[name="image-api-mode"]:checked')?.value;
        const mode = checkedMode === 'multimodal' ? 'multimodal' : 'separate';
        const visionSettings = document.getElementById('separate-vision-settings');
        if (visionSettings) {
            visionSettings.classList.toggle('hidden', mode === 'multimodal');
        }
    },
    // ★★★★★ 图片处理方式 UI END ★★★★★

    openSettings() {
        UI.els.mainModal.classList.remove('hidden');
        const s = STATE.settings;

        UI.els.settingUrl.value = s.API_URL || '';
        UI.els.settingKey.value = s.API_KEY || '';
        if (UI.els.settingAsyncBackendUrl) UI.els.settingAsyncBackendUrl.value = s.ASYNC_BACKEND_URL || '';
        if (UI.els.settingAsyncBackendToken) UI.els.settingAsyncBackendToken.value = s.ASYNC_BACKEND_TOKEN || '';
        if (UI.els.settingAsyncBackendTtlHours) UI.els.settingAsyncBackendTtlHours.value = s.ASYNC_BACKEND_TTL_HOURS || CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS;
        if (typeof App !== 'undefined' && typeof App.syncAsyncBackendToggle === 'function') {
            App.syncAsyncBackendToggle();
        }
        
        UI.els.settingModel.value = s.MODEL || 'deepseek-ai/DeepSeek-V3.2';
        if (s.MODEL) {
            UI.els.settingModel.innerHTML = '';
            const option = document.createElement('option');
            option.value = s.MODEL;
            option.textContent = s.MODEL;
            UI.els.settingModel.appendChild(option);
        }

        // 回显 MaxTokens、Temperature 和缓存友好上下文窗口
        const maxTokensInput = document.getElementById('custom-max-tokens');
        const tempInput = document.getElementById('custom-temperature');
        const contextLimitInput = document.getElementById('custom-context-limit');
        const historyWindowStrategySelect = document.getElementById('history-window-strategy');
        const historyWindowMaxContextInput = document.getElementById('history-window-max-context');
        const dynamicContextModeSelect = document.getElementById('dynamic-context-insert-mode');
        
        if (maxTokensInput) {
            maxTokensInput.value = s.MAX_TOKENS || 32700;
        }

        if (tempInput) {
            tempInput.value = s.TEMPERATURE !== undefined ? s.TEMPERATURE : 1.1;
        }

        if (contextLimitInput) {
            contextLimitInput.value = s.CONTEXT_LIMIT || CONFIG.DEFAULT.CONTEXT_LIMIT || 5;
        }

        if (historyWindowStrategySelect) {
            historyWindowStrategySelect.value = s.HISTORY_WINDOW_STRATEGY || CONFIG.DEFAULT.HISTORY_WINDOW_STRATEGY || 'cache_friendly';
            historyWindowStrategySelect.onchange = () => this.syncHistoryWindowStrategyUI();
        }

        if (historyWindowMaxContextInput) {
            const minContextValue = parseInt(contextLimitInput?.value, 10) || CONFIG.DEFAULT.CONTEXT_LIMIT || 5;
            const maxContextValue = s.HISTORY_WINDOW_MAX_CONTEXT
                || s.HISTORY_WINDOW_BLOCK_SIZE
                || CONFIG.DEFAULT.HISTORY_WINDOW_MAX_CONTEXT
                || 25;
            historyWindowMaxContextInput.value = Math.max(minContextValue, parseInt(maxContextValue, 10) || minContextValue);
        }
        this.syncHistoryWindowStrategyUI();

        if (dynamicContextModeSelect) {
            dynamicContextModeSelect.value = s.DYNAMIC_CONTEXT_INSERT_MODE || CONFIG.DEFAULT.DYNAMIC_CONTEXT_INSERT_MODE || 'auto';
        }

        // ★★★ 新增：回显请求体附加参数 JSON ★★★
        const requestBodyInput = document.getElementById('custom-request-body-json');
        if (requestBodyInput) {
            requestBodyInput.value = s.CUSTOM_REQUEST_BODY_JSON || '';
        }

        // System Prompt 是全局可编辑项；旧数据没有时回落到 CONFIG 里的原始默认值。
        // 已保存的空字符串要原样回显，用来支持“全局不发送 system prompt”。
        if (UI.els.settingSystemPrompt) {
            UI.els.settingSystemPrompt.value = s.SYSTEM_PROMPT !== undefined ? s.SYSTEM_PROMPT : CONFIG.SYSTEM_PROMPT;
        }

        if (document.getElementById('gist-token')) {
            document.getElementById('gist-token').value = s.GIST_TOKEN || ''; 
        }

        // ★★★ 回显思考链显示开关：默认展示，只有勾选后才隐藏气泡 ★★★
        const hideThoughtToggle = document.getElementById('hide-thought-process-toggle');
        if (hideThoughtToggle) {
            hideThoughtToggle.checked = s.HIDE_THOUGHT_PROCESS === true;
        }

        // ★ 图片处理方式不跟随 API 预设；旧设置没有该字段时继续使用单独视觉 API。
        const imageApiMode = s.IMAGE_API_MODE === 'multimodal' ? 'multimodal' : 'separate';
        const imageApiModeRadio = document.querySelector(`input[name="image-api-mode"][value="${imageApiMode}"]`);
        if (imageApiModeRadio) imageApiModeRadio.checked = true;
        this.syncImageApiModeUI();
        
        // 壁纸回显
        const previewImg = document.getElementById('wallpaper-preview-img');
        const previewDiv = document.getElementById('wallpaper-preview');

        // 回填视觉 API 设置
        if (UI.els.settingVisionUrl) {
            UI.els.settingVisionUrl.value = s.VISION_URL || '';
        }

        if (UI.els.settingVisionKey) {
            UI.els.settingVisionKey.value = s.VISION_KEY || '';
        }

        if (UI.els.settingVisionModel) {
            UI.els.settingVisionModel.value = s.VISION_MODEL || 'Qwen/Qwen3-VL-30B-A3B-Instruct';
        }

        if (UI.els.settingVisionPrompt) {
            UI.els.settingVisionPrompt.value = s.VISION_PROMPT || '请详细地描述这张图片的内容。不要发表评论，只需客观描述。';
        }

        UI.renderVisionPresetMenu(); 

        if (previewImg && previewDiv && s.WALLPAPER && s.WALLPAPER.startsWith('data:')) {
            previewImg.src = s.WALLPAPER;
            previewDiv.classList.remove('hidden');
        }

        UI.applyAppearance();

        // CSS 输入框回显
        const cssInput = document.getElementById('custom-css-input');
        if (cssInput) {
            cssInput.value = s.CUSTOM_CSS || '';
        }

        UI.renderPresetMenu();

        // ★★★ 新增：请求体附加参数预设菜单 ★★★
        if (typeof UI.renderRequestBodyPresetMenu === 'function') {
            UI.renderRequestBodyPresetMenu();
        }

        if (typeof UI.renderSystemPromptPresetMenu === 'function') {
            UI.renderSystemPromptPresetMenu();
        }

        UI.initWorldInfoTab();
        UI.renderCssPresetMenu();
    },

    // --- 世界书相关操作 ---

    // 切换当前书
    switchWorldInfoBook(bookId) {
        STATE.currentBookId = bookId;
        UI.updateCurrentBookSettingsUI();
        UI.renderWorldInfoList();
        this.clearWorldInfoEditor();
    },

    // 兼容旧版单角色绑定；新版弹窗统一读写 characterIds。
    getWorldInfoBookScopeIds(book) {
        if (!book) return [];
        if (Array.isArray(book.characterIds)) {
            return book.characterIds.filter(Boolean);
        }
        return book.characterId ? [book.characterId] : [];
    },

    // 绑定当前书的角色范围：空数组代表全局，非空数组代表多角色生效。
    async bindCurrentBookToChars(charIds) {
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (book) {
            const cleanIds = Array.isArray(charIds) ? [...new Set(charIds.filter(Boolean))] : [];
            book.characterIds = cleanIds;
            book.characterId = cleanIds[0] || '';
            await Storage.saveWorldInfo();
            UI.updateCurrentBookSettingsUI();
        }
    },

    openWorldbookScopeModal() {
        const modal = document.getElementById('modal-worldbook-scope');
        const globalCheckbox = document.getElementById('wi-scope-global-checkbox');
        const charContainer = document.getElementById('wi-scope-char-list');
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!modal || !globalCheckbox || !charContainer || !book) return;

        const scopeIds = this.getWorldInfoBookScopeIds(book);
        globalCheckbox.checked = scopeIds.length === 0;
        charContainer.innerHTML = '';

        if (STATE.contacts.length === 0) {
            charContainer.innerHTML = '<p class="no-data-hint">暂无联系人</p>';
        } else {
            STATE.contacts.forEach(contact => {
                const label = document.createElement('label');
                label.className = 'worldbook-scope-checkbox-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = contact.id;
                checkbox.checked = scopeIds.includes(contact.id);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) globalCheckbox.checked = false;
                    const anyChecked = !!charContainer.querySelector('input[type="checkbox"]:checked');
                    if (!anyChecked) globalCheckbox.checked = true;
                });

                const name = document.createElement('span');
                name.className = 'worldbook-scope-char-name';
                name.textContent = contact.name;

                label.appendChild(checkbox);
                label.appendChild(name);
                charContainer.appendChild(label);
            });
        }

        globalCheckbox.onchange = () => {
            if (!globalCheckbox.checked) {
                const anyChecked = !!charContainer.querySelector('input[type="checkbox"]:checked');
                if (!anyChecked) globalCheckbox.checked = true;
                return;
            }
            charContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
        };

        modal.classList.remove('hidden');
    },

    async saveWorldbookScopeModal() {
        const modal = document.getElementById('modal-worldbook-scope');
        const globalCheckbox = document.getElementById('wi-scope-global-checkbox');
        const charContainer = document.getElementById('wi-scope-char-list');
        if (!modal || !globalCheckbox || !charContainer) return;

        const selectedIds = globalCheckbox.checked
            ? []
            : Array.from(charContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        await this.bindCurrentBookToChars(selectedIds);
        modal.classList.add('hidden');
    },
    
    loadWorldInfoEntry(uid) {
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!book) return;

        const entry = book.entries.find(e => e.uid === uid);
        if (!entry) return;

        document.getElementById('wi-edit-uid').value = entry.uid;
        document.getElementById('wi-edit-keys').value = entry.keys.join(', ');
        document.getElementById('wi-edit-content').value = entry.content;
        document.getElementById('wi-edit-constant').checked = entry.constant;

        // ★★★ 核心修改：把内存里的名字填进输入框
        const commentInput = document.getElementById('wi-edit-comment');
        if (commentInput) {
            commentInput.value = entry.comment || ''; 
        }
        
        // 顺便刷新一下列表高亮
        UI.renderWorldInfoList(); 
    },

    async saveWorldInfoEntry() {
        // 1. 获取当前书
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!book) return alert("请先新建或选择一本世界书");

        // 2. 获取所有输入框的值
        const uid = document.getElementById('wi-edit-uid').value;
        const keysStr = document.getElementById('wi-edit-keys').value || ""; // 防止 null
        const content = document.getElementById('wi-edit-content').value || "";
        const constant = document.getElementById('wi-edit-constant').checked;
        
        // ★★★ 关键：获取名称输入框 ★★★
        const commentInput = document.getElementById('wi-edit-comment');
        // 如果输入框存在，就取值；不存在（比如界面没渲染对）就给 null
        let userComment = commentInput ? commentInput.value.trim() : null;

        // 3. 处理 Key (把字符串转成数组)
        const keys = keysStr.split(/[,，]/).map(k => k.trim()).filter(k => k);

        if (!content && !keys.length) {
            alert('请至少填写内容或关键词');
            return;
        }

        // 4. 查找或新建条目
        let entry = book.entries.find(e => e.uid === uid);
        
        if (entry) {
            // === 更新逻辑 ===
            entry.keys = keys;
            entry.content = content;
            entry.constant = constant;

            // ★★★ 核心修复：优先使用用户输入的名字 ★★★
            if (userComment !== null && userComment !== "") {
                // 如果用户填了字，就用用户的
                entry.comment = userComment;
            } else if (!entry.comment && keys.length > 0) {
                // 只有当“用户没填”且“原先也没名字”时，才用 Key 兜底
                entry.comment = keys[0];
            }
            // 如果用户清空了输入框，且没有Key，那就让它空着或者叫未命名
            if (!entry.comment) entry.comment = '未命名条目';
            
        } else {
            // === 新建逻辑 ===
            entry = {
                uid: Date.now().toString(),
                keys: keys,
                content: content,
                constant: constant,
                // ★★★ 新建时也是一样：优先用输入框的值
                comment: userComment || keys[0] || '新建条目'
            };
            book.entries.push(entry);
        }

        // 5. 保存到数据库
        await Storage.saveWorldInfo();

        // ★★★ 新增的提示代码就在这里！ ★★★
        alert(`条目 [${entry.comment}] 已保存成功！`); 
        
        // 6. 强制刷新列表 (解决左侧不更新的问题)
        UI.renderWorldInfoList(); 
        
        // 7. 重新加载当前条目 (让输入框里的值保持同步)
        this.loadWorldInfoEntry(entry.uid);
        
        console.log("已保存条目:", entry.comment); // 调试用，看控制台有没有打印名字
    },

    async deleteWorldInfoEntry() {
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!book) return;

        const uid = document.getElementById('wi-edit-uid').value;
        if (!uid) return;
        if (confirm('确定删除此条目吗？')) {
            book.entries = book.entries.filter(e => e.uid !== uid);
            await Storage.saveWorldInfo();
            this.clearWorldInfoEditor();
            UI.renderWorldInfoList();
        }
    },

    clearWorldInfoEditor() {
        document.getElementById('wi-edit-uid').value = '';
        document.getElementById('wi-edit-keys').value = '';
        
        // ★★★ 新增：清空名称输入框
        const commentInput = document.getElementById('wi-edit-comment');
        if (commentInput) commentInput.value = '';

        document.getElementById('wi-edit-content').value = '';
        document.getElementById('wi-edit-constant').checked = false;
        UI.renderWorldInfoList();
    },

    // ★★★ 大分类（书）的操作 ★★★
    async createNewBook() {
        const name = prompt("请输入新世界书的名称：", "新世界书");
        if (name) {
            const newBook = {
                id: 'book_' + Date.now(),
                name: name,
                characterId: '', // 默认全局
                characterIds: [], // 空数组代表全局；旧字段 characterId 留作兼容
                entries: []
            };
            STATE.worldInfoBooks.push(newBook);
            STATE.currentBookId = newBook.id;
            await Storage.saveWorldInfo();
            UI.renderBookSelect();
            UI.renderWorldInfoList();
        }
    },

    async renameCurrentBook() {
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!book) return;
        const newName = prompt("重命名世界书：", book.name);
        if (newName) {
            book.name = newName;
            await Storage.saveWorldInfo();
            UI.renderBookSelect();
        }
    },

    async deleteCurrentBook() {
        if (STATE.worldInfoBooks.length <= 1) {
            return alert("至少保留一本世界书");
        }
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!book) return;
        
        if (confirm(`确定要彻底删除整本《${book.name}》吗？\n里面的所有条目都会消失，不可恢复。`)) {
            STATE.worldInfoBooks = STATE.worldInfoBooks.filter(b => b.id !== STATE.currentBookId);
            STATE.currentBookId = STATE.worldInfoBooks[0].id; // 切换到第一本
            await Storage.saveWorldInfo();
            UI.renderBookSelect();
            UI.renderWorldInfoList();
        }
    },

    exportCurrentBook() {
        const book = STATE.worldInfoBooks.find(b => b.id === STATE.currentBookId);
        if (!book) return;

        const jsonStr = WorldInfoEngine.exportToST(book);
        const blob = new Blob([jsonStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${book.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async handleImportWorldInfo(file) {
        if (!file) return;

        try {
            // 1. 直接等待文件读取为文本，不用写 reader.onload 了
            const content = await file.text(); 
            
            // 2. 剩下的逻辑像流水账一样写下来
            const newBook = WorldInfoEngine.importFromST(content, file.name);
            STATE.worldInfoBooks.push(newBook);
            STATE.currentBookId = newBook.id; 
            
            // 3. 等待数据库保存
            await Storage.saveWorldInfo();
            
            // 4. 刷新界面
            UI.renderBookSelect();
            UI.renderWorldInfoList();
            
            alert(`成功导入《${newBook.name}》，包含 ${newBook.entries.length} 个条目！`);
            
        } catch (err) {
            alert(err.message);
        }
    },

    // ----------------------

    async handleSavePreset() {
        const name = prompt("请为当前配置输入一个预设名称 (如: Gemini Pro)");
        if (!name) return;

        // 获取当前输入框的值
        const maxTokensInput = document.getElementById('custom-max-tokens');
        const tempInput = document.getElementById('custom-temperature');
        const contextLimitInput = document.getElementById('custom-context-limit');
        const historyWindowStrategySelect = document.getElementById('history-window-strategy');
        const historyWindowMaxContextInput = document.getElementById('history-window-max-context');
        const dynamicContextModeSelect = document.getElementById('dynamic-context-insert-mode');
        const requestBodyInput = document.getElementById('custom-request-body-json');

        // 1. 构造新预设对象
        const minContextValue = contextLimitInput && contextLimitInput.value
            ? parseInt(contextLimitInput.value, 10)
            : (CONFIG.DEFAULT.CONTEXT_LIMIT || 5);
        const rawMaxContextValue = historyWindowMaxContextInput && historyWindowMaxContextInput.value
            ? parseInt(historyWindowMaxContextInput.value, 10)
            : (CONFIG.DEFAULT.HISTORY_WINDOW_MAX_CONTEXT || 25);

        const preset = {
            name: name,
            url: UI.els.settingUrl.value.trim(),
            key: UI.els.settingKey.value.trim(),
            model: UI.els.settingModel.value,

            max_tokens: maxTokensInput && maxTokensInput.value ? parseInt(maxTokensInput.value, 10) : 32700,
            temperature: tempInput && tempInput.value ? parseFloat(tempInput.value) : 1.1,
            context_limit: minContextValue,
            history_window_strategy: historyWindowStrategySelect ? historyWindowStrategySelect.value : 'cache_friendly',
            history_window_max_context: Math.max(minContextValue, rawMaxContextValue),
            dynamic_context_insert_mode: dynamicContextModeSelect ? dynamicContextModeSelect.value : (CONFIG.DEFAULT.DYNAMIC_CONTEXT_INSERT_MODE || 'auto'),

            // ★★★ 新增：API 总预设里保存当前请求体附加参数 ★★★
            extra_body_json: requestBodyInput ? requestBodyInput.value.trim() : ''
        };

        // 2. 校验必填项
        if (!preset.url || !preset.key) {
            return alert("请先填好 API 地址和密钥！");
        }

        // 3. 如果请求体附加参数不为空，先检查是不是合法 JSON
        if (preset.extra_body_json) {
            try {
                JSON.parse(preset.extra_body_json);
            } catch (err) {
                alert("请求体附加参数不是合法 JSON，请检查格式后再保存 API 预设。");
                console.error("请求体附加参数 JSON 解析失败:", err);
                return;
            }
        }

        // 4. 确保数组存在
        if (!STATE.settings.API_PRESETS) STATE.settings.API_PRESETS = [];

        // 5. 查重与覆盖逻辑
        const existingIndex = STATE.settings.API_PRESETS.findIndex(p => p.name === name);

        if (existingIndex >= 0) {
            if (confirm(`API 预设 "${name}" 已存在，确定要覆盖吗？`)) {
                STATE.settings.API_PRESETS[existingIndex] = preset;
            } else {
                return;
            }
        } else {
            STATE.settings.API_PRESETS.push(preset);
        }

        // 6. 保存并刷新菜单
        await Storage.saveSettings();
        UI.renderPresetMenu(); 

        if (typeof UI.renderRequestBodyPresetMenu === 'function') {
            UI.renderRequestBodyPresetMenu();
        }

        alert(`API 预设 "${name}" 已保存`);
    },




    handleLoadPreset(index) {
        if (index === "") return;

        const preset = STATE.settings.API_PRESETS[index];

        if (preset) {
            UI.els.settingUrl.value = preset.url;
            UI.els.settingKey.value = preset.key;
            UI.els.settingModel.innerHTML = '';
            const option = document.createElement('option');
            option.value = preset.model;
            option.textContent = preset.model;
            UI.els.settingModel.appendChild(option);
            UI.els.settingModel.value = preset.model;

            const maxTokensInput = document.getElementById('custom-max-tokens');
            const tempInput = document.getElementById('custom-temperature');
            const contextLimitInput = document.getElementById('custom-context-limit');
            const historyWindowStrategySelect = document.getElementById('history-window-strategy');
            const historyWindowMaxContextInput = document.getElementById('history-window-max-context');
            const dynamicContextModeSelect = document.getElementById('dynamic-context-insert-mode');
            const requestBodyInput = document.getElementById('custom-request-body-json');

            if (maxTokensInput) {
                maxTokensInput.value = preset.max_tokens || 32700;
            }

            if (tempInput) {
                tempInput.value = preset.temperature !== undefined ? preset.temperature : 1.1;
            }

            if (contextLimitInput) {
                contextLimitInput.value = preset.context_limit || CONFIG.DEFAULT.CONTEXT_LIMIT || 5;
            }

            if (historyWindowStrategySelect) {
                historyWindowStrategySelect.value = preset.history_window_strategy || 'cache_friendly';
            }

            if (historyWindowMaxContextInput) {
                const minContextValue = parseInt(contextLimitInput?.value, 10) || CONFIG.DEFAULT.CONTEXT_LIMIT || 5;
                const maxContextValue = preset.history_window_max_context
                    || preset.history_window_block_size
                    || CONFIG.DEFAULT.HISTORY_WINDOW_MAX_CONTEXT
                    || 25;
                historyWindowMaxContextInput.value = Math.max(minContextValue, parseInt(maxContextValue, 10) || minContextValue);
            }
            this.syncHistoryWindowStrategyUI();

            if (dynamicContextModeSelect) {
                dynamicContextModeSelect.value = preset.dynamic_context_insert_mode || CONFIG.DEFAULT.DYNAMIC_CONTEXT_INSERT_MODE || 'auto';
            }

            // ★★★ 新增：加载 API 总预设里保存的请求体附加参数 ★★★
            if (requestBodyInput) {
                requestBodyInput.value = preset.extra_body_json || '';
            }

            // 如果有请求体参数预设下拉框，选择 API 总预设后不强行匹配小预设
            // 因为 API 总预设保存的是实际 JSON 内容，不一定来自某个小预设
            const requestBodyPresetSelect = document.getElementById('request-body-preset-select');
            if (requestBodyPresetSelect) {
                requestBodyPresetSelect.value = '';
            }

            console.log("[API Preset] 已加载 API 总预设:", {
                name: preset.name,
                model: preset.model,
                max_tokens: preset.max_tokens,
                temperature: preset.temperature,
                context_limit: preset.context_limit,
                history_window_strategy: preset.history_window_strategy || 'cache_friendly',
                history_window_max_context: preset.history_window_max_context || preset.history_window_block_size || CONFIG.DEFAULT.HISTORY_WINDOW_MAX_CONTEXT || 25,
                dynamic_context_insert_mode: preset.dynamic_context_insert_mode || CONFIG.DEFAULT.DYNAMIC_CONTEXT_INSERT_MODE || 'auto',
                extra_body_json: preset.extra_body_json || ''
            });
        }
    },


    async handleDeletePreset() {
        const select = document.getElementById('preset-select');
        const index = select.value;
        if (index === "") return alert("请先选择一个预设");
        
        if (confirm(`确定删除 "${STATE.settings.API_PRESETS[index].name}" 吗？`)) {
            STATE.settings.API_PRESETS.splice(index, 1);
            await Storage.saveSettings();
            UI.renderPresetMenu();
        }
    },

    // ==================== System Prompt 预设 ================================
    async handleSaveSystemPromptPreset() {
        const input = document.getElementById('global-system-prompt');
        if (!input) return alert("找不到 System Prompt 输入框。");

        const name = prompt("请为当前 System Prompt 输入一个预设名称，例如：角色扮演 / 普通助手");
        if (!name) return;

        const promptText = input.value.trim();

        if (!STATE.settings.SYSTEM_PROMPT_PRESETS) {
            STATE.settings.SYSTEM_PROMPT_PRESETS = [];
        }

        const preset = {
            name: name,
            prompt: promptText
        };

        // 同名预设直接走覆盖确认，和 API/CSS 预设保持同一套手感。
        const existingIndex = STATE.settings.SYSTEM_PROMPT_PRESETS.findIndex(p => p.name === name);
        if (existingIndex >= 0) {
            if (!confirm(`System Prompt 预设 "${name}" 已存在，确定要覆盖吗？`)) return;
            STATE.settings.SYSTEM_PROMPT_PRESETS[existingIndex] = preset;
        } else {
            STATE.settings.SYSTEM_PROMPT_PRESETS.push(preset);
        }

        // 允许保存空白预设：角色选中后就完全不发送第一条 system prompt。
        STATE.settings.SYSTEM_PROMPT = promptText;
        await Storage.saveSettings();
        UI.renderSystemPromptPresetMenu();
        alert(`System Prompt 预设 "${name}" 已保存`);
    },

    handleLoadSystemPromptPreset(index) {
        if (index === "") return;

        const preset = (STATE.settings.SYSTEM_PROMPT_PRESETS || [])[index];
        const input = document.getElementById('global-system-prompt');
        if (!preset || !input) return;

        input.value = preset.prompt !== undefined ? preset.prompt : '';
        STATE.settings.SYSTEM_PROMPT = input.value.trim();
    },

    handleRestoreDefaultSystemPrompt() {
        const input = document.getElementById('global-system-prompt');
        if (!input) return;

        // 只回填内置原文，不改 STATE 或存储；沿用设置面板的保存流程正式生效。
        input.value = CONFIG.SYSTEM_PROMPT;

        // 恢复后不再对应某个用户预设，清空选择，避免名称与内容对不上。
        const select = document.getElementById('system-prompt-preset-select');
        if (select) select.value = '';
    },

    async handleDeleteSystemPromptPreset() {
        const select = document.getElementById('system-prompt-preset-select');
        const index = select ? select.value : "";
        if (index === "") return alert("请先选择一个 System Prompt 预设。");

        const presets = STATE.settings.SYSTEM_PROMPT_PRESETS || [];
        const preset = presets[index];
        if (!preset) return alert("没有找到这个 System Prompt 预设。");

        if (confirm(`确定删除 System Prompt 预设 "${preset.name}" 吗？`)) {
            presets.splice(index, 1);
            await Storage.saveSettings();
            UI.renderSystemPromptPresetMenu();
        }
    },
    // ==================== System Prompt 预设结束 ================================

    async saveSettingsFromUI() {
        let rawUrl = UI.els.settingUrl.value.trim().replace(/\/+$/, '');
        if (rawUrl && !rawUrl.includes('anthropic') && !rawUrl.includes('googleapis')) {
            if (rawUrl.endsWith('/chat/completion')) rawUrl += 's'; 
            else if (!rawUrl.includes('/chat/completions')) {
                rawUrl += rawUrl.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
            }
        }
        
        const s = STATE.settings;
        s.API_URL = rawUrl;
        s.API_KEY = UI.els.settingKey.value.trim();
        if (UI.els.settingAsyncBackendUrl) {
            s.ASYNC_BACKEND_URL = UI.els.settingAsyncBackendUrl.value.trim().replace(/\/+$/, '');
        }
        if (UI.els.settingAsyncBackendToken) {
            s.ASYNC_BACKEND_TOKEN = UI.els.settingAsyncBackendToken.value.trim();
        }
        s.ASYNC_BACKEND_ENABLED = s.ASYNC_BACKEND_ENABLED !== false;
        if (UI.els.settingAsyncBackendTtlHours) {
            const ttlHours = UI.els.settingAsyncBackendTtlHours.value.trim()
                ? Number(UI.els.settingAsyncBackendTtlHours.value)
                : CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS;
            s.ASYNC_BACKEND_TTL_HOURS = Number.isFinite(ttlHours)
                ? Math.min(Math.max(ttlHours, 0.25), 24)
                : CONFIG.DEFAULT.ASYNC_BACKEND_TTL_HOURS;
        }
        s.MODEL = UI.els.settingModel.value;

        // 获取 DOM 元素
        const maxTokensInput = document.getElementById('custom-max-tokens');
        const tempInput = document.getElementById('custom-temperature');
        const contextLimitInput = document.getElementById('custom-context-limit');
        const historyWindowStrategySelect = document.getElementById('history-window-strategy');
        const historyWindowMaxContextInput = document.getElementById('history-window-max-context');
        const dynamicContextModeSelect = document.getElementById('dynamic-context-insert-mode');

        // 解析数值，如果为空或非法，则回退到默认值
        if (maxTokensInput) {
            const val = parseInt(maxTokensInput.value, 10);
            s.MAX_TOKENS = !isNaN(val) ? val : 32700;
        }

        if (tempInput) {
            const val = parseFloat(tempInput.value);
            s.TEMPERATURE = !isNaN(val) ? val : 1.1;
        }

        if (contextLimitInput) {
            const val = parseInt(contextLimitInput.value, 10);
            s.CONTEXT_LIMIT = (!isNaN(val) && val > 0) ? val : (CONFIG.DEFAULT.CONTEXT_LIMIT || 5);
        }

        if (historyWindowStrategySelect) {
            s.HISTORY_WINDOW_STRATEGY = ['cache_friendly', 'strict_recent'].includes(historyWindowStrategySelect.value)
                ? historyWindowStrategySelect.value
                : 'cache_friendly';
        }

        if (historyWindowMaxContextInput) {
            const val = parseInt(historyWindowMaxContextInput.value, 10);
            s.HISTORY_WINDOW_MAX_CONTEXT = (!isNaN(val) && val > 0) ? val : (CONFIG.DEFAULT.HISTORY_WINDOW_MAX_CONTEXT || 25);
            if (s.HISTORY_WINDOW_MAX_CONTEXT < s.CONTEXT_LIMIT) {
                s.HISTORY_WINDOW_MAX_CONTEXT = s.CONTEXT_LIMIT;
            }
        }

        if (dynamicContextModeSelect) {
            s.DYNAMIC_CONTEXT_INSERT_MODE = ['auto', 'system', 'user'].includes(dynamicContextModeSelect.value)
                ? dynamicContextModeSelect.value
                : (CONFIG.DEFAULT.DYNAMIC_CONTEXT_INSERT_MODE || 'auto');
        }

        // ★★★ 新增：保存请求体附加参数 JSON ★★★
        const requestBodyInput = document.getElementById('custom-request-body-json');
        if (requestBodyInput) {
            s.CUSTOM_REQUEST_BODY_JSON = requestBodyInput.value.trim();
        }

        if (UI.els.settingSystemPrompt) {
            s.SYSTEM_PROMPT = UI.els.settingSystemPrompt.value.trim();
        }

        const tEl = document.getElementById('gist-token');
        if (tEl) s.GIST_TOKEN = tEl.value.trim() || ''; 

        // 处理壁纸
        const wallpaperPreview = document.getElementById('wallpaper-preview-img');
        if (wallpaperPreview && wallpaperPreview.src && wallpaperPreview.src.startsWith('data:')) {
            s.WALLPAPER = wallpaperPreview.src;
        } else if (!s.WALLPAPER) {
            s.WALLPAPER = CONFIG.DEFAULT.WALLPAPER;
        }

        // 保存主题
        const checkedTheme = document.querySelector('input[name="theme-select"]:checked');
        if (checkedTheme) {
            s.THEME = checkedTheme.value;
        } else {
            s.THEME = 'light';
        }

        // 保存自定义模式底座：默认暗色，保持老用户原来的 custom 观感。
        const checkedCustomBase = document.querySelector('input[name="custom-base-theme"]:checked');
        s.CUSTOM_BASE_THEME = checkedCustomBase && checkedCustomBase.value === 'light' ? 'light' : 'dark';

        // 保存自定义 CSS
        const cssInput = document.getElementById('custom-css-input');
        if (cssInput) {
            s.CUSTOM_CSS = cssInput.value;
        }

        // 保存主题色：三个滑条分别落到 H/S/L，最终由 applyThemeColor 写入 --primary-btn-text。
        const themeColorH = document.getElementById('theme-color-h');
        const themeColorS = document.getElementById('theme-color-s');
        const themeColorL = document.getElementById('theme-color-l');
        if (themeColorH && themeColorS && themeColorL) {
            s.THEME_COLOR_H = parseInt(themeColorH.value, 10);
            s.THEME_COLOR_S = parseInt(themeColorS.value, 10);
            s.THEME_COLOR_L = parseInt(themeColorL.value, 10);
        }

        // 保存字体大小
        const slider = document.getElementById('font-size-slider');
        if (slider) {
            s.FONT_SIZE = parseInt(slider.value, 10);
        }

        // ★★★ 保存思考链显示开关：只影响前端展示，不影响模型输出和上下文清洗 ★★★
        const hideThoughtToggle = document.getElementById('hide-thought-process-toggle');
        if (hideThoughtToggle) {
            s.HIDE_THOUGHT_PROCESS = hideThoughtToggle.checked === true;
        }

        // ★ 图片处理方式单独保存，不写进文字 API 总预设。
        const checkedImageApiMode = document.querySelector('input[name="image-api-mode"]:checked');
        s.IMAGE_API_MODE = checkedImageApiMode?.value === 'multimodal' ? 'multimodal' : 'separate';

        // 保存视觉设置
        if (UI.els.settingVisionUrl) s.VISION_URL = UI.els.settingVisionUrl.value.trim();
        if (UI.els.settingVisionKey) s.VISION_KEY = UI.els.settingVisionKey.value.trim();
        if (UI.els.settingVisionModel) s.VISION_MODEL = UI.els.settingVisionModel.value.trim();
        if (UI.els.settingVisionPrompt) s.VISION_PROMPT = UI.els.settingVisionPrompt.value.trim();

        // 保存并应用
        await Storage.saveSettings();
        UI.applyAppearance(); 

        // ★★★ 刷新当前聊天，让思考链显示开关保存后立刻生效 ★★★
        const currentContact = STATE.contacts.find(c => c.id === STATE.currentContactId);
        if (currentContact && this.isViewingContactChat(currentContact.id)) {
            UI.renderChatHistory(currentContact, false, true);
        }

        UI.els.mainModal.classList.add('hidden');
    },

    /*1212*/
    // 【7. APP CONTROLLER】
    handleMessageAction(action) {
        // 1. 获取选中索引
        const msgIndex = STATE.selectedMessageIndex;

        // 2. 获取当前角色
        const currentId = STATE.currentContactId;
        const currentContact = STATE.contacts.find(c => c.id === currentId);

        if (!currentContact) {
            console.error("错误：找不到当前角色");
            return;
        }

        // --- 核心数据获取 ---
        const msgData = currentContact.history[msgIndex]; 

        if (!msgData) {
            console.error("找不到该条消息，索引:", msgIndex);
            return;
        }

        // 定义时间戳正则（Edit和Copy公用）
        const timestampRegex = /^\[(?:[A-Z][a-z]{2}\.\d{1,2}|\d{4}-\d{2}-\d{2})\s\d{2}:\d{2}\]\s/;

        // 3. 执行动作
        if (action === 'edit') {
            let originalContent = msgData.content;
            let timestampPart = ''; // 用于暂存时间戳头
            let cleanContent = originalContent;

            // ★★★ 只有用户消息的时间戳是系统静默加的；AI 自己输出的开头时间戳要允许用户编辑删除。★★★
            if (msgData.role === 'user') {
                const match = originalContent.match(timestampRegex);
                if (match) {
                    timestampPart = match[0]; // 比如 "[Dec.14 16:39] "
                    cleanContent = originalContent.replace(timestampRegex, ''); // 去掉用户消息的系统时间戳
                }
            }
            // 传入干净的文本给弹窗
            UI.showEditModal(cleanContent, (newText) => {
                // 如果文本有变化
                if (newText && newText !== cleanContent) {
                    // ★ 核心：保存时把原时间戳拼回去
                    msgData.content = timestampPart + newText;
                    
                    Storage.saveContacts(); 

                    // ★★★ 核心修复：加上 (..., false, true) ★★★
                    // 告诉渲染函数：“不要加载更多，但要保持滚动位置”
                    UI.renderChatHistory(currentContact, false, true);
                }
            });
        } 
        else if (action === 'delete') {
            if (confirm("确定要删除这条消息吗？")) {

                // 1. 获取当前滚动条位置（保险起见，虽然通常不需要手动恢复）
                const scrollContainer = UI.els.chatMsgs.parentElement;
                const currentScrollTop = scrollContainer.scrollTop;

                // 2. 执行删除数据
                currentContact.history.splice(msgIndex, 1);

                // 3. 保存
                Storage.saveContacts();

                // 4. ★★★ 重新渲染，并传入 true (keepScrollPosition) ★★★
                // 这样 UI 就不会自动滚到底部了
                UI.renderChatHistory(currentContact, false, true); 
            }
        }
        // ★★★ 新增：处理隐藏/显示 ★★★
        else if (action === 'toggle-hidden') {
            // 1. 切换状态 (如果原来是 true 变成 false，反之亦然)
            msgData.isHidden = !msgData.isHidden;

            // 2. 保存数据
            Storage.saveContacts();

            // 3. 重新渲染 (传入 keepScrollPosition=true，保证不乱跳)
            UI.renderChatHistory(currentContact, false, true);
        }

        if (action === 'multi-select') {
            this.enterSelectMode();
            // 自动选中触发菜单的那个气泡
            const msgIndex = STATE.selectedMessageIndex;
            // 假设我们能获取到刚才点的那个元素 (这里稍微简化，先进入模式)
            // 你可以通过之前 savedRect 对应的元素来选中，或者留空让用户自己选
        }

        else if (action === 'copy') {
            // ★★★ 修改：复制逻辑（支持文本+图片描述） ★★★
            let contentToCopy = msgData.content || "";
            
            // 1. 先去除时间戳 (保留纯内容)
            if (timestampRegex.test(contentToCopy)) {
                contentToCopy = contentToCopy.replace(timestampRegex, '');
            }

            // 2. 清洗 Markdown 符号 
            contentToCopy = cleanMarkdownForCopy(contentToCopy);

            // 3. ★★★ 核心新增：处理图片附加信息 ★★★
            let imageSuffix = "";
            
            // 优先：如果有图片描述，直接使用描述（无论图片是否已清理）
            if (msgData.image_description) {
                imageSuffix = `[图片描述: ${msgData.image_description}]`;
            } 
            // 其次：如果没描述，但有未清理的图片
            else if (msgData.images && msgData.images.length > 0) {
                imageSuffix = `[图片]`;
            } 
            // 最后：如果没描述，且图片已被清理（显示过期占位符）
            else if (msgData.isImageExpired) {
                imageSuffix = `[图片（原图已清理）]`;
            }

            // 4. 将文本和图片描述组合
            let finalCopyText = "";
            if (contentToCopy && imageSuffix) {
                // 既有字又有图，用换行隔开
                finalCopyText = `${contentToCopy}\n\n${imageSuffix}`;
            } else if (contentToCopy) {
                // 只有字
                finalCopyText = contentToCopy;
            } else if (imageSuffix) {
                // 只有图 (纯图消息)
                finalCopyText = imageSuffix;
            }

            // 5. 执行复制
            navigator.clipboard.writeText(finalCopyText)
                .then(() => {
                    Toast.show('已复制');
                })
                .catch(err => {
                    console.error("复制失败:", err);
                    alert("复制失败，请检查浏览器权限");
                });
        }

    },

    // ===================2. 进入多选模式=============================
    enterSelectMode() {
        STATE.isSelectMode = true;
        STATE.selectedBubbles = new Set(); // 重置选择
        
        // 给容器加类名，触发 CSS 样式
        UI.els.chatMsgs.classList.add('select-mode');
        
        // 显示底部操作栏
        document.getElementById('multi-select-bar').classList.remove('hidden');
        this.updateSelectCount();
        
        // 绑定点击事件 (通过委托)
        if (!this._boundSelectClick) {
            this._selectClickHandler = (e) => {
                if (!STATE.isSelectMode) return;
                // 复制按钮保留自身行为，不能被多选模式截获成“选择整条气泡”
                if (e.target.closest('.code-copy-btn')) return;
                
                const bubble = e.target.closest('.message-bubble');
                if (bubble) {
                    // 阻止图片查看等默认行为
                    e.preventDefault(); 
                    e.stopPropagation();
                    
                    this.toggleBubbleSelection(bubble);
                }
            };
            UI.els.chatMsgs.addEventListener('click', this._selectClickHandler, true); // true: 捕获阶段，优先处理
            this._boundSelectClick = true;
        }
        
        // 绑定底部按钮事件
        this.bindSelectBarEvents();
    },

    // 3. 退出多选模式
    exitSelectMode() {
        STATE.isSelectMode = false;
        STATE.selectedBubbles.clear();
        
        UI.els.chatMsgs.classList.remove('select-mode');
        document.getElementById('multi-select-bar').classList.add('hidden');
        
        // 移除所有选中的视觉样式
        document.querySelectorAll('.message-bubble.selected').forEach(el => el.classList.remove('selected'));
        
        // 解绑点击事件 (可选，或者一直留着判断 isSelectMode)
        if (this._boundSelectClick) {
            UI.els.chatMsgs.removeEventListener('click', this._selectClickHandler, true);
            this._boundSelectClick = false;
        }
    },

    // 4. 切换单个气泡选中状态
    toggleBubbleSelection(bubbleEl) {
        if (bubbleEl.classList.contains('selected')) {
            bubbleEl.classList.remove('selected');
            STATE.selectedBubbles.delete(bubbleEl);
        } else {
            bubbleEl.classList.add('selected');
            STATE.selectedBubbles.add(bubbleEl);
        }
        this.updateSelectCount();
    },

    // 5. 更新计数
    updateSelectCount() {
        const count = STATE.selectedBubbles.size;
        document.getElementById('select-count-num').innerText = count;
    },

    // 6. 绑定底部按钮事件 (只绑定一次)
    bindSelectBarEvents() {
        if (this._selectBarEventsBound) return;
        
        document.getElementById('btn-exit-select').addEventListener('click', () => this.exitSelectMode());
        document.getElementById('btn-batch-copy').addEventListener('click', () => this.handleBatchCopy());
        document.getElementById('btn-batch-delete').addEventListener('click', () => this.handleBatchDelete());
       
        // ★★★ 新增：绑定隐藏按钮 ★★★
        document.getElementById('btn-batch-hide').addEventListener('click', () => this.handleBatchToggleHidden());
        
        this._selectBarEventsBound = true;
    },



    // ==========================================
    // ★★★ 核心：批量复制逻辑 ★★★
    // ==========================================
    handleBatchCopy() {
        if (STATE.selectedBubbles.size === 0) return;

        const contact = STATE.contacts.find(c => c.id === STATE.currentContactId);
        
        // 1. 排序 (兼容 'thought' 排序)
        const sortedBubbles = Array.from(STATE.selectedBubbles).sort((a, b) => {
            const msgIndexA = parseInt(a.dataset.msgIndex);
            const msgIndexB = parseInt(b.dataset.msgIndex);
            if (msgIndexA !== msgIndexB) return msgIndexA - msgIndexB;
            
            const getPartVal = (bubble) => {
                const pIdx = bubble.dataset.partIndex;
                return pIdx === 'thought' ? -1 : parseInt(pIdx);
            };
            return getPartVal(a) - getPartVal(b);
        });

        // 2. 提取内容 (★★★ 核心修改：直接从数据源读取，无视 DOM 折叠状态 ★★★)
        const textParts = sortedBubbles.map(bubble => {
            try {
                const img = bubble.querySelector('img'); 
                const expiredPlaceholder = bubble.querySelector('.expired-image-placeholder');
                
                const mIdx = parseInt(bubble.dataset.msgIndex);
                const msg = contact ? contact.history[mIdx] : null;
                
                // A & B: 处理图片
                if (img || expiredPlaceholder) {
                    if (!contact) return img ? "[图片]" : "[图片已清理]";
                    if (msg && msg.image_description) {
                        return `[图片描述: ${msg.image_description}]`;
                    } else {
                        return img ? "[图片]" : "[图片（原图已清理）]";
                    }
                } 

                // C. 处理文本 / 思考块
                // 如果找不到数据兜底用 DOM 提取
                if (!msg) return cleanMarkdownForCopy(bubble.innerText); 

                const rawPIdx = bubble.dataset.partIndex;
                const pIdx = rawPIdx === 'thought' ? 'thought' : parseInt(rawPIdx);

                let contentToParse = msg.content || '';
                
                // 1) 去除时间戳
                if (msg.role === 'user') {
                    contentToParse = contentToParse.replace(/^\[(?:[A-Z][a-z]{2}\.\d{1,2}|\d{4}-\d{2}-\d{2})\s\d{2}:\d{2}\]\s/, '');
                }
                
                // 2) AI 引用切分兼容
                if (msg.role === 'assistant') {
                    contentToParse = normalizeChatQuoteBreaks(contentToParse);
                }

                // 3) 把思考过程抽离出来
                let thoughtText = '';
                contentToParse = contentToParse.replace(/<(?:think|thinking|thought)>([\s\S]*?)<\/(?:think|thinking|thought)>/gi, (match, inner) => {
                    thoughtText = inner.trim();
                    return '';
                });

                // 4) 根据选中的索引，精准返回数据
                if (pIdx === 'thought') {
                    // 如果勾选的是思考过程，直接返回这段文字，不受界面折叠影响
                    // 这里加了个 [思考过程] 标识，复制出来排版更清晰
                    return `[思考过程]\n${cleanMarkdownForCopy(thoughtText)}`;
                } else {
                    // 如果勾选的是正文气泡
                    const paragraphs = splitMessageIntoBubbleParts(contentToParse);
                    if (paragraphs[pIdx]) {
                        return cleanMarkdownForCopy(paragraphs[pIdx]);
                    } else {
                        // 兜底防错
                        return cleanMarkdownForCopy(bubble.innerText);
                    }
                }
                
            } catch (e) {
                console.error("提取单条消息失败:", e);
                return ""; 
            }
        });

        // 拼接所有选中的内容
        const fullText = textParts.filter(t => t).join('\n\n');
        
        // 3. 执行复制
        navigator.clipboard.writeText(fullText)
            .then(() => {
                Toast.show('已复制');
            })
            .catch(err => {
                console.error('无法复制文本: ', err);
                alert('复制失败，请检查浏览器权限');
            })
            .finally(() => {
                this.exitSelectMode();
            });
    },


    // ==========================================
    // ★★★ 新增：批量隐藏/显示逻辑 ★★★
    // ==========================================
    handleBatchToggleHidden() {
        if (STATE.selectedBubbles.size === 0) return;

        const currentContact = STATE.contacts.find(c => c.id === STATE.currentContactId);
        if (!currentContact) return;

        // 1. 整理选中的目标
        const selectionMap = {};
        let anyVisibleFound = false;

        STATE.selectedBubbles.forEach(bubble => {
            const mIdx = parseInt(bubble.dataset.msgIndex);
            
            // ★★★ 核心修改 1：兼容 'thought' 索引的解析 ★★★
            const rawPIdx = bubble.dataset.partIndex;
            const pIdx = rawPIdx === 'thought' ? 'thought' : parseInt(rawPIdx);
            
            if (!selectionMap[mIdx]) selectionMap[mIdx] = [];
            selectionMap[mIdx].push(pIdx);

            // 检查当前状态
            const msg = currentContact.history[mIdx];
            const currentHiddenList = msg.hiddenIndices || [];
            
            if (!currentHiddenList.includes(pIdx)) {
                anyVisibleFound = true;
            }
        });

        // 2. 目标动作
        const shouldHide = anyVisibleFound;

        // 3. 执行更新
        Object.keys(selectionMap).forEach(key => {
            const mIdx = parseInt(key);
            const pIndices = selectionMap[mIdx]; 
            const msg = currentContact.history[mIdx];

            if (!msg.hiddenIndices) msg.hiddenIndices = [];

            pIndices.forEach(pIdx => {
                if (shouldHide) {
                    if (!msg.hiddenIndices.includes(pIdx)) {
                        msg.hiddenIndices.push(pIdx);
                    }
                } else {
                    msg.hiddenIndices = msg.hiddenIndices.filter(id => id !== pIdx);
                }
            });
            
            // ★★★ 核心修改 2：兼容 'thought' 的排序逻辑 ★★★
            // 让 'thought' 排在最前面，其他数字按大小排
            msg.hiddenIndices.sort((a, b) => {
                const valA = a === 'thought' ? -1 : a;
                const valB = b === 'thought' ? -1 : b;
                return valA - valB;
            });
        });

        // 4. 保存并刷新
        Storage.saveContacts();
        this.exitSelectMode();
        UI.renderChatHistory(currentContact, false, true);
    },

    // ==========================================
    // ★★★ 核心：批量删除逻辑 ★★★
    // ==========================================
    handleBatchDelete() {
        if (STATE.selectedBubbles.size === 0) return;
        if (!confirm(`确定要删除选中的 ${STATE.selectedBubbles.size} 条内容吗？`)) return;

        const currentContact = STATE.contacts.find(c => c.id === STATE.currentContactId);
        if (!currentContact) return;

        // 1. 将待删除项按 msgIndex 分组
        const deletionMap = {};

        STATE.selectedBubbles.forEach(bubble => {
            const mIdx = parseInt(bubble.dataset.msgIndex);
            // ★★★ 核心修改 1：兼容思考气泡的字符串索引 'thought' ★★★
            const rawPIdx = bubble.dataset.partIndex;
            const pIdx = rawPIdx === 'thought' ? 'thought' : parseInt(rawPIdx);
            
            if (!deletionMap[mIdx]) deletionMap[mIdx] = [];
            deletionMap[mIdx].push(pIdx);
        });

        // 2. 遍历分组，执行删除 (从后往前删)
        const affectedIndices = Object.keys(deletionMap).map(Number).sort((a, b) => b - a);

        affectedIndices.forEach(msgIndex => {
            const msg = currentContact.history[msgIndex];
            const partsToDelete = deletionMap[msgIndex]; // 例如: [0, 2, 'thought']

            let content = msg.content || '';
            const timestampRegex = /^\[(?:[A-Z][a-z]{2}\.\d{1,2}|\d{4}-\d{2}-\d{2})\s\d{2}:\d{2}\]\s/;
            let timestampPart = '';
            
            if (match = content.match(timestampRegex)) {
                timestampPart = match[0];
                content = content.replace(timestampRegex, '');
            }

            // ==============================================================
            // ★★★ 核心修改 2：切分段落前，必须先将思考过程抽离，保证段落索引准确 ★★★
            // ==============================================================
            let thoughtMatchText = ""; 
            if (msg.role === 'assistant') {
                // 找出并保存原生的 <think> 块，同时把它从 content 里挖掉
                content = content.replace(/<(?:think|thinking|thought)>([\s\S]*?)<\/(?:think|thinking|thought)>/gi, (match) => {
                    thoughtMatchText = match; 
                    return ''; 
                });
                
                content = normalizeChatQuoteBreaks(content);
            }
            
            // 现在 content 里只有纯文本了，切分出来的索引绝对准确
            let paragraphs = splitMessageIntoBubbleParts(content);
            const imagePartIndex = paragraphs.length;
            
            // --- B. 处理文本删除 ---
            let newParagraphs = paragraphs.filter((_, index) => !partsToDelete.includes(index));

            // --- C. 处理图片删除 ---
            if (partsToDelete.includes(imagePartIndex)) {
                msg.images = null;
                msg.image_description = null; 
                msg.isImageExpired = false;   
            }

            // --- D. 重组 ---
            const hasImagesLeft = (msg.images && msg.images.length > 0) || msg.isImageExpired;
            // ★★★ 判断思考气泡是否幸存（存在，且没被勾选删除） ★★★
            const hasThoughtLeft = (msg.role === 'assistant' && thoughtMatchText && !partsToDelete.includes('thought'));
            
            // 如果 文字没了 AND 图片没了 AND 思考过程也没了，这消息就废了
            if (newParagraphs.length === 0 && !hasImagesLeft && !hasThoughtLeft) {
                // 彻底删除整条消息
                currentContact.history.splice(msgIndex, 1);
            } else {
                // 更新文本
                let newContent = newParagraphs.join('\n\n');
                
                if (msg.role === 'user') {
                    newContent = timestampPart + newContent;
                } else if (msg.role === 'assistant') {
                    // ★★★ 如果思考气泡幸存，把它拼回最前面 ★★★
                    if (hasThoughtLeft) {
                        newContent = thoughtMatchText + '\n\n' + newContent;
                    }
                }
                
                msg.content = newContent.trim();
            }
        });

        // 3. 保存并刷新
        Storage.saveContacts();
        this.exitSelectMode();
        UI.renderChatHistory(currentContact, false, true);
    },

    // ===================结束多选模式=============================

    // ============================================================
    // ★★★★★ 联系人列表长按菜单 START ★★★★★
    // 这一组函数只服务联系人列表：
    // 1. 长按联系人后弹出独立菜单；
    // 2. 菜单里可以切换置顶，也可以进入上下箭头排序模式；
    // 3. 排序结果直接写回 STATE.contacts，所以保存后刷新仍然保持顺序。
    // 注意：这里不复用消息气泡菜单的类名和状态，避免两个菜单互相影响。
    // ============================================================

    hideContactActionMenu() {
        const menu = document.getElementById('contact-action-menu');
        if (menu) menu.style.display = 'none';
        STATE.selectedContactActionId = null;
    },

    showContactActionMenu(contactId) {
        const menu = document.getElementById('contact-action-menu');
        if (!menu) return;

        const contact = STATE.contacts.find(c => c.id === contactId);
        if (!contact) return;

        STATE.selectedContactActionId = contactId;

        // 如果已经置顶，再长按时就显示“取消置顶”
        const pinBtn = menu.querySelector('[data-action="toggle-pin"]');
        if (pinBtn) pinBtn.textContent = contact.isPinned ? '取消置顶' : '置顶';

        // 菜单事件只绑定一次；之后每次打开只改文案和选中的 contactId
        if (!menu.dataset.bound) {
            menu.dataset.bound = 'true';
            menu.addEventListener('click', (event) => {
                const btn = event.target.closest('button');
                if (!btn) return;

                const action = btn.dataset.action;
                if (action === 'cancel') {
                    this.hideContactActionMenu();
                    return;
                }

                this.handleContactListAction(action);
            });

            menu.querySelector('.contact-menu-backdrop')?.addEventListener('click', () => {
                this.hideContactActionMenu();
            });
        }

        menu.style.display = 'flex';
    },

    async handleContactListAction(action) {
        const contactId = STATE.selectedContactActionId;
        if (!contactId && action !== 'sort') return;

        if (action === 'toggle-pin') {
            // 切换联系人自身的置顶标记，再统一整理一次数组顺序
            const contact = STATE.contacts.find(c => c.id === contactId);
            if (!contact) return;

            contact.isPinned = !contact.isPinned;
            this.normalizeContactOrder();
            await Storage.saveContacts();
            UI.renderContacts();
        } else if (action === 'sort') {
            // 进入排序模式后，renderContacts 会给每一项补上上下箭头
            STATE.isContactSortMode = true;
            UI.renderContacts();
        }

        this.hideContactActionMenu();
    },

    normalizeContactOrder() {
        // 置顶项永远在前面；同组内的相对顺序不动，方便上下箭头继续微调
        STATE.contacts = [
            ...STATE.contacts.filter(c => c.isPinned),
            ...STATE.contacts.filter(c => !c.isPinned)
        ];
    },

    async moveContactInList(contactId, direction) {
        const contact = STATE.contacts.find(c => c.id === contactId);
        if (!contact) return;

        // 先拆成两个小组，保证置顶联系人不会被普通联系人挤下去
        const pinnedContacts = STATE.contacts.filter(c => c.isPinned);
        const normalContacts = STATE.contacts.filter(c => !c.isPinned);
        const group = contact.isPinned ? pinnedContacts : normalContacts;
        const index = group.findIndex(c => c.id === contactId);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= group.length) return;

        [group[index], group[targetIndex]] = [group[targetIndex], group[index]];
        STATE.contacts = [...pinnedContacts, ...normalContacts];

        await Storage.saveContacts();
        UI.renderContacts();
    },

    // ★★★★★ 联系人列表长按菜单 END ★★★★★


    hideMessageContextMenu() {
        if (this.els.msgContextMenu) {
            this.els.msgContextMenu.style.display = 'none';
        }
        STATE.selectedMessageIndex = null;
    },


    // 【7. APP CONTROLLER】
    showMessageContextMenu(msgIndex, rect) {
        STATE.selectedMessageIndex = msgIndex;

        const menu = document.getElementById('msg-context-menu');

        // --- 事件绑定区域 (保持你原有的逻辑不变，只绑定一次) ---
        if (!menu.dataset.initialized) {
            menu.dataset.initialized = 'true';
            menu.addEventListener('click', e => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const action = btn.dataset.action;
                // 如果处于防误触锁定状态，直接无视点击
                if (menu.classList.contains('locked')) return; 

                if (action === 'cancel') {
                    this.hideMessageContextMenu();
                    return;
                }
                // 这里的 this 需要确保指向 Controller 实例
                // 如果是在回调里，可能需要用 App.handleMessageAction 或箭头函数上下文
                this.handleMessageAction(action); 
                this.hideMessageContextMenu();
            });
            menu.querySelector('.menu-backdrop').addEventListener('click', () => {
                this.hideMessageContextMenu();
            });
        }

        // ★★★ 新增：动态修改按钮文字 ★★★
        const currentContact = STATE.contacts.find(c => c.id === STATE.currentContactId);
        if (currentContact) {
            const msg = currentContact.history[msgIndex];
            // 找到我们在 HTML 里加的那个按钮 (假设你加了 data-action="toggle-hidden")
            const toggleBtn = menu.querySelector('button[data-action="toggle-hidden"]');
            
            if (toggleBtn) {
                if (msg.isHidden) {
                    toggleBtn.textContent = "取消隐藏";
                } else {
                    toggleBtn.textContent = "向Ta隐藏";
                }
            }
        }
        // ★★★ 结束新增 ★★★



        // --- ★★★★★ 核心修改：防误触锁 ★★★★★ ---
        
        // 1. 先加上锁定 class (或者直接用 style)
        menu.classList.add('locked');
        menu.style.pointerEvents = 'none'; // 物理禁用点击
        menu.style.display = 'flex';       // 显示出来
        
        // 2. 300毫秒后解锁
        setTimeout(() => {
            menu.classList.remove('locked');
            menu.style.pointerEvents = 'auto'; // 恢复点击
        }, 300);
    },

    // 隐藏方法
    hideMessageContextMenu() {
        const menu = document.getElementById('msg-context-menu');
        if (menu) menu.style.display = 'none';
    },


    /* =================== 朋友圈 ===========================*/

    // 在 App 对象中添加
    switchMainTab(tab) {
        // ★ 桌面加入以后，底部主 tab 统一交给 UI.switchView 管；
        // 这里保留老函数名，避免旧事件或调试代码调用时还去找已经不存在的 view-list。
        const viewName = tab === 'chat' ? 'contact-list' : (tab || 'desktop');
        UI.switchView(viewName);
    },

    




    // ★★★★★ 朋友圈 2.0：数据兼容、作者资料与页面状态 START ★★★★★
    normalizeMomentsData() {
        if (!Array.isArray(STATE.moments)) {
            STATE.moments = [];
            return true;
        }

        let changed = false;
        STATE.moments.forEach(moment => {
            if (!moment || typeof moment !== 'object') return;
            // ★ 旧版本里的动态全部由用户发布；补 authorId 后即可无损进入“我的主页”。
            if (!moment.authorId) {
                moment.authorId = 'user';
                changed = true;
            }
            if (!Array.isArray(moment.comments)) {
                moment.comments = [];
                changed = true;
            }
            if (!Array.isArray(moment.likes)) {
                moment.likes = [];
                changed = true;
            }
            if (!moment.createdAt) {
                moment.createdAt = Number(moment.timestamp || Date.now());
                changed = true;
            }
        });
        return changed;
    },

    normalizeCharacterMomentStats() {
        // ★ 升级前已经生成的角色动态也要计入冷却，避免版本更新后立即重复发帖。
        const settings = STATE.momentsSettings || CONFIG.DEFAULT.MOMENTS_SETTINGS;
        let changed = false;
        if (!settings.autoMomentStatsByChar || typeof settings.autoMomentStatsByChar !== 'object') {
            settings.autoMomentStatsByChar = {};
            changed = true;
        }
        const today = this.getMomentLocalDateKey(Date.now());
        const characterMoments = (Array.isArray(STATE.moments) ? STATE.moments : [])
            .filter(moment => String(moment.authorId || 'user') !== 'user');

        characterMoments.forEach(moment => {
            const key = String(moment.authorId);
            if (settings.autoMomentStatsByChar[key]) return;
            const authorMoments = characterMoments.filter(item => String(item.authorId) === key);
            const createdTimes = authorMoments
                .map(item => Number(item.createdAt || 0))
                .filter(Number.isFinite);
            settings.autoMomentStatsByChar[key] = {
                lastGeneratedAt: createdTimes.length ? Math.max(...createdTimes) : 0,
                dailyDate: today,
                dailyCount: authorMoments.filter(item => this.getMomentLocalDateKey(Number(item.createdAt || 0)) === today).length
            };
            changed = true;
        });
        return changed;
    },

    getLatestCharacterMomentCreatedAt() {
        return (Array.isArray(STATE.moments) ? STATE.moments : [])
            .filter(moment => String(moment?.authorId || 'user') !== 'user')
            .reduce((latest, moment) => {
                const createdAt = Number(moment.createdAt || moment.timestamp || 0);
                return Number.isFinite(createdAt) ? Math.max(latest, createdAt) : latest;
            }, 0);
    },

    updateCharacterMomentUnreadDot() {
        const dot = document.getElementById('explore-moments-unread-dot');
        if (!dot) return;

        const latestCreatedAt = this.getLatestCharacterMomentCreatedAt();
        const lastSeenAt = Number(STATE.momentsSettings?.lastSeenCharacterMomentAt || 0);
        const storedReplyCount = Number(STATE.momentsSettings?.unreadMomentReplyCount || 0);
        const unreadReplyCount = Number.isFinite(storedReplyCount) ? Math.max(0, Math.floor(storedReplyCount)) : 0;
        const hasNewCharacterMoment = latestCreatedAt > lastSeenAt;

        // ★ 回复优先显示条数；只有新动态时仍保持原来的纯红点。
        dot.textContent = unreadReplyCount > 0 ? String(unreadReplyCount) : '';
        dot.classList.toggle('has-reply-count', unreadReplyCount > 0);
        dot.classList.toggle('hidden', !hasNewCharacterMoment && unreadReplyCount === 0);
        dot.setAttribute('aria-label', unreadReplyCount > 0 ? `${unreadReplyCount} 条未读朋友圈回复` : '有新朋友圈');
    },

    markMomentReplyUnread() {
        const settings = STATE.momentsSettings || CONFIG.DEFAULT.MOMENTS_SETTINGS;
        const storedReplyCount = Number(settings.unreadMomentReplyCount || 0);
        const oldCount = Number.isFinite(storedReplyCount) ? Math.max(0, Math.floor(storedReplyCount)) : 0;
        settings.unreadMomentReplyCount = oldCount + 1;
        STATE.momentsSettings = settings;
        this.updateCharacterMomentUnreadDot();

        // ★ 回复可能来自同步或后台恢复链路，这里独立落库，刷新页面后数量也能保留。
        Storage.saveMomentsSettings?.().catch(error => {
            console.warn('[朋友圈] 未读回复条数保存失败:', error);
        });
    },

    async markCharacterMomentsSeen() {
        const latestCreatedAt = this.getLatestCharacterMomentCreatedAt();
        const settings = STATE.momentsSettings || CONFIG.DEFAULT.MOMENTS_SETTINGS;
        const lastSeenAt = Number(settings.lastSeenCharacterMomentAt || 0);
        const storedReplyCount = Number(settings.unreadMomentReplyCount || 0);
        const unreadReplyCount = Number.isFinite(storedReplyCount) ? Math.max(0, Math.floor(storedReplyCount)) : 0;

        settings.lastSeenCharacterMomentAt = Math.max(lastSeenAt, latestCreatedAt);
        settings.unreadMomentReplyCount = 0;
        STATE.momentsSettings = settings;
        this.updateCharacterMomentUnreadDot();
        if (settings.lastSeenCharacterMomentAt !== lastSeenAt || unreadReplyCount > 0) {
            try {
                await Storage.saveMomentsSettings();
            } catch (error) {
                console.warn('[朋友圈] 未读状态保存失败:', error);
            }
        }
    },

    getMomentAuthor(authorId) {
        if (!authorId || authorId === 'user') {
            return {
                id: 'user',
                name: STATE.momentsSettings?.username || '你的名字',
                signature: STATE.momentsSettings?.signature || '写下你的此刻心情...',
                avatar: STATE.momentsSettings?.avatar || 'assets/images/user.jpg',
                isUser: true
            };
        }

        const contact = STATE.contacts.find(item => String(item.id) === String(authorId));
        return {
            id: String(authorId),
            name: contact?.name || '已删除的角色',
            // ★ 角色主页不使用占位个性签名，只保留用户自己设置的签名。
            signature: '',
            avatar: contact?.avatar || '🌼',
            isUser: false,
            contact
        };
    },

    renderMomentAvatar(author, className = 'moment-author-avatar') {
        const avatar = String(author?.avatar || '').trim();
        if (/^(data:image\/|https?:\/\/|blob:|\.\/assets\/|assets\/)/i.test(avatar)) {
            return `<img class="${className}" src="${this.escapeHtml(avatar)}" alt="">`;
        }
        return `<span class="${className} text-avatar">${this.escapeHtml(avatar || '🌼')}</span>`;
    },

    getCharacterMomentCover(authorId) {
        const covers = [
            'assets/images/moments-cover-01.webp',
            'assets/images/moments-cover-02.webp',
            'assets/images/moments-cover-03.webp',
            'assets/images/moments-cover-04.webp',
            'assets/images/moments-cover-05.webp',
            'assets/images/moments-cover-06.webp',
            'assets/images/moments-cover-07.webp',
            'assets/images/moments-cover-08.webp'
        ];
        // ★ 首次进入角色主页时随机分配，之后把索引存入朋友圈设置，避免每次打开都换封面。
        const settings = STATE.momentsSettings || CONFIG.DEFAULT.MOMENTS_SETTINGS;
        if (!settings.characterMomentCoverIndexes || typeof settings.characterMomentCoverIndexes !== 'object') {
            settings.characterMomentCoverIndexes = {};
        }
        const key = String(authorId || '');
        let coverIndex = Number(settings.characterMomentCoverIndexes[key]);
        if (!Number.isInteger(coverIndex) || coverIndex < 0 || coverIndex >= covers.length) {
            coverIndex = Math.floor(Math.random() * covers.length);
            settings.characterMomentCoverIndexes[key] = coverIndex;
            Storage.saveMomentsSettings?.().catch(error => console.warn('[朋友圈] 角色封面分配保存失败:', error));
        }
        return covers[coverIndex];
    },

    openMomentProfile(authorId) {
        STATE.momentsViewMode = 'profile';
        STATE.momentsProfileAuthorId = String(authorId || 'user');
        STATE.visibleMomentsCount = CONFIG.MOMENTS_PAGE_SIZE;
        this.renderMomentsUI();
        document.getElementById('moments-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showMomentsFeed() {
        STATE.momentsViewMode = 'feed';
        STATE.momentsProfileAuthorId = null;
        STATE.visibleMomentsCount = CONFIG.MOMENTS_PAGE_SIZE;
        this.renderMomentsUI();
        document.getElementById('moments-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // 渲染公共动态流或某一个人的主页；公屏不显示编号，个人主页按作者动态重排编号。
    renderMomentsUI() {
        const feed = document.getElementById('moments-feed');
        const loadMoreBtn = document.getElementById('btn-load-more-moments');
        if (!feed) return;

        const isProfile = STATE.momentsViewMode === 'profile';
        const profileAuthorId = String(STATE.momentsProfileAuthorId || 'user');
        const profileAuthor = this.getMomentAuthor(profileAuthorId);
        const currentSettings = STATE.momentsSettings || CONFIG.DEFAULT.MOMENTS_SETTINGS;
        const allMoments = Array.isArray(STATE.moments) ? STATE.moments : [];
        const visibleAuthorIds = new Set(
            Array.isArray(currentSettings.visibleCharacterAuthors)
                ? currentSettings.visibleCharacterAuthors.map(String)
                : []
        );
        const showAllCharacterAuthors = visibleAuthorIds.size === 0;
        const pageMoments = isProfile
            ? allMoments.filter(moment => String(moment.authorId || 'user') === profileAuthorId)
            : allMoments.filter(moment => {
                const authorId = String(moment.authorId || 'user');
                return authorId === 'user' || showAllCharacterAuthors || visibleAuthorIds.has(authorId);
            });
        const sortedMoments = [...pageMoments].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
        const visibleData = sortedMoments.slice(0, STATE.visibleMomentsCount);

        const title = document.getElementById('moments-page-title');
        const profileHeader = document.getElementById('moments-profile-header');
        const writeBtn = document.getElementById('btn-write-moment');
        if (title) title.textContent = isProfile ? profileAuthor.name : '朋友圈';
        if (profileHeader) {
            profileHeader.classList.remove('hidden');
            profileHeader.classList.toggle('profile-mode', isProfile);
        }
        if (writeBtn) writeBtn.classList.toggle('hidden', isProfile && !profileAuthor.isUser);

        // ★ 公屏复用用户原有封面；进入角色主页后再切换为对应资料。
        {
            const headerAuthor = isProfile ? profileAuthor : this.getMomentAuthor('user');
            const bgImg = document.getElementById('moments-bg');
            const avatarImg = document.getElementById('moments-avatar');
            const avatarButton = document.getElementById('moments-avatar-button');
            const username = document.getElementById('moments-username');
            const signature = document.getElementById('moments-signature');
            if (bgImg) {
                bgImg.src = headerAuthor.isUser
                    ? (currentSettings.bgImage || 'assets/images/wallpaper.jpg')
                    : this.getCharacterMomentCover(headerAuthor.id);
                bgImg.title = headerAuthor.isUser ? '点击更换背景' : `${headerAuthor.name} 的主页背景`;
                bgImg.classList.toggle('clickable-img', headerAuthor.isUser);
            }
            if (avatarImg) {
                const avatar = String(headerAuthor.avatar || '');
                avatarImg.src = /^(data:image\/|https?:\/\/|blob:|\.\/assets\/|assets\/)/i.test(avatar)
                    ? avatar
                    : 'assets/images/char.jpg';
                avatarImg.title = !isProfile ? '进入我的主页' : (headerAuthor.isUser ? '点击更换头像' : headerAuthor.name);
            }
            if (avatarButton) {
                avatarButton.setAttribute('aria-label', !isProfile ? '进入我的主页' : (headerAuthor.isUser ? '更换头像' : `${headerAuthor.name} 的头像`));
                avatarButton.classList.toggle('clickable-img', !isProfile || headerAuthor.isUser);
            }
            if (username) username.textContent = headerAuthor.name;
            if (signature) {
                signature.textContent = headerAuthor.isUser ? headerAuthor.signature : '';
                // ★ 公屏与“我的主页”继续显示用户签名，角色主页不留空白占位。
                signature.classList.toggle('hidden', !headerAuthor.isUser);
            }
        }

        let feedHtml = '';
        visibleData.forEach((moment, index) => {
            const author = this.getMomentAuthor(moment.authorId || 'user');
            const safeMomentId = this.escapeHtml(moment.id || '');
            const safeAuthorId = this.escapeHtml(author.id);
            const safeAuthorName = this.escapeHtml(author.name);
            const safeMomentText = this.escapeHtml(moment.text || '').replace(/\n/g, '<br>');
            const safeMomentTime = this.escapeHtml(formatTimeForMoments(moment.timestamp));
            const safeImageSrc = this.sanitizeImageSrc(moment.image);
            const imgHtml = safeImageSrc
                ? `<img class="moment-img" src="${this.escapeHtml(safeImageSrc)}" alt="动态图片">`
                : '';
            const floorNum = sortedMoments.length - index;
            const likes = Array.isArray(moment.likes) ? moment.likes : [];
            const comments = Array.isArray(moment.comments) ? moment.comments : [];
            const userLiked = likes.includes('user');

            const likeNames = likes.map(likerId => this.getMomentAuthor(likerId).name).filter(Boolean);
            const likesHtml = likeNames.length
                ? `<div class="moment-like-panel"><div class="moment-likes"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path></svg>${this.escapeHtml(likeNames.join('、'))}</div></div>`
                : '';
            let commentsHtml = '';
            comments.forEach(comment => {
                const sender = this.getMomentAuthor(comment.senderId);
                const replyPrefix = comment.replyToId && comment.replyToName
                    ? `<span class="comment-reply-prefix">回复 ${this.escapeHtml(comment.replyToName)}：</span>`
                    : '';
                commentsHtml += `
                    <div class="comment-item">
                        <button type="button" class="comment-name comment-sender-name"
                            data-moment-id="${safeMomentId}"
                            data-comment-id="${this.escapeHtml(comment.id || '')}"
                            data-char-id="${this.escapeHtml(comment.senderId || '')}"
                            data-char-name="${this.escapeHtml(sender.name)}">${this.escapeHtml(sender.name)}</button><span>：</span>
                        ${replyPrefix}<span>${this.escapeHtml(comment.text || '')}</span>
                    </div>`;
            });
            const commentsPanelHtml = commentsHtml
                ? `<div class="moment-comment-panel"><div class="moment-comments">${commentsHtml}</div></div>`
                : '';
            const interactionHtml = likesHtml || commentsPanelHtml
                ? `<div class="moment-interactions">${likesHtml}${commentsPanelHtml}</div>`
                : '';

            feedHtml += `
                <article class="moment-card ${isProfile ? 'profile-moment-card' : 'feed-moment-card'}" id="m-${safeMomentId}" data-moment-id="${safeMomentId}">
                    <button type="button" class="moment-avatar-button" data-moment-action="profile" data-author-id="${safeAuthorId}" aria-label="查看 ${safeAuthorName} 的主页">
                        ${this.renderMomentAvatar(author)}
                    </button>
                    <div class="moment-card-main">
                        <!-- ★ 公屏右侧放时间；个人主页右侧放编号，两者都与昵称共用一行。 -->
                        <div class="moment-card-heading">
                            <button type="button" class="moment-author-name" data-moment-action="profile" data-author-id="${safeAuthorId}">${safeAuthorName}</button>
                            ${isProfile
                                ? `<span class="moment-floor">#${floorNum}</span>`
                                : `<span class="moment-corner-time">${safeMomentTime}</span>`}
                        </div>
                        <div class="moment-content">${safeMomentText}${imgHtml}</div>
                        ${isProfile ? `<div class="moment-meta-row"><span>${safeMomentTime}</span></div>` : ''}
                        <div class="moment-action-row">
                            <button type="button" class="moment-action-btn ${userLiked ? 'active' : ''}" data-moment-action="like" data-moment-id="${safeMomentId}" aria-label="${userLiked ? '取消点赞' : '点赞'}">
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path></svg><span>点赞</span>
                            </button>
                            <button type="button" class="moment-action-btn" data-moment-action="comment" data-moment-id="${safeMomentId}" aria-label="评论">
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path></svg><span>评论</span>
                            </button>
                        </div>
                        ${interactionHtml}
                    </div>
                </article>`;
        });

        if (!feedHtml) {
            feedHtml = `<div class="moments-empty-state"><span>◌</span><p>${isProfile ? '这里还没有动态' : '还没有人留下朋友圈'}</p><small>${isProfile && profileAuthor.isUser ? '写下此刻，第一条就从这里开始。' : '稍后再来看看吧。'}</small></div>`;
        }
        feed.innerHTML = feedHtml;

        if (loadMoreBtn) {
            loadMoreBtn.style.display = STATE.visibleMomentsCount < sortedMoments.length ? 'block' : 'none';
        }
    },
    // ★★★★★ 朋友圈 2.0：数据兼容、作者资料与页面状态 END ★★★★★


    loadMoreMoments() {
        STATE.visibleMomentsCount += CONFIG.MOMENTS_PAGE_SIZE;
        this.renderMomentsUI();
    },

    // ===========================================
    // 1. 打开朋友圈设置弹窗 (填充数据)
    // ===========================================
    openMomentsSettings() {
        // 1. 获取 DOM
        const modal = document.getElementById('modal-moments-settings');
        const apiSelect = document.getElementById('m-setting-api-preset');
        const charContainer = document.getElementById('m-setting-allowed-chars');
        const authorContainer = document.getElementById('m-setting-visible-authors');
        
        // 2. 确保配置对象存在
        if (!STATE.momentsSettings) {
            STATE.momentsSettings = JSON.parse(JSON.stringify(CONFIG.DEFAULT.MOMENTS_SETTINGS));
        }

        // 3. 填充 API 预设下拉框 (修复点：显示模型名)
        apiSelect.innerHTML = '<option value="-1">-- 跟随全局默认 --</option>';
        if (STATE.settings.API_PRESETS && STATE.settings.API_PRESETS.length > 0) {
            STATE.settings.API_PRESETS.forEach((preset, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                // ★★★ 修改点：显示 "预设名 (模型名)" ★★★
                const modelName = preset.model || '未知模型';
                opt.textContent = `${preset.name} (${modelName})`;
                
                // 回显选中状态
                if (String(index) === String(STATE.momentsSettings.apiPresetIndex)) {
                    opt.selected = true;
                }
                apiSelect.appendChild(opt);
            });
        }

        // 4. 两份名单沿用旧版的双列文字选择 UI；空选仍代表全部角色。
        const renderCharacterChoices = (container, selectedIds) => {
            if (!container) return;
            container.innerHTML = '';
            if (STATE.contacts.length === 0) {
                container.innerHTML = '<p class="no-data-hint">暂无联系人</p>';
                return;
            }

            STATE.contacts.forEach(contact => {
                const label = document.createElement('label');
                label.className = 'checkbox-item moments-character-choice';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = contact.id;
                input.checked = Array.isArray(selectedIds) && selectedIds.map(String).includes(String(contact.id));
                const name = document.createElement('span');
                name.className = 'char-name';
                name.textContent = contact.name;
                label.append(input, name);
                container.appendChild(label);
            });
        };
        renderCharacterChoices(charContainer, STATE.momentsSettings.allowedChars);
        renderCharacterChoices(authorContainer, STATE.momentsSettings.visibleCharacterAuthors);

        const autoEnabled = document.getElementById('m-setting-auto-enabled');
        const probability = Math.max(0, Math.min(100, Number(STATE.momentsSettings.autoCharacterMomentProbability ?? 50)));
        const likeProbability = Math.max(0, Math.min(100, Number(STATE.momentsSettings.autoCharacterLikeProbability ?? 25)));
        if (autoEnabled) autoEnabled.checked = STATE.momentsSettings.autoCharacterMomentsEnabled !== false;
        const probabilityInput = document.getElementById('m-setting-auto-probability');
        const probabilityRange = document.getElementById('m-setting-auto-probability-range');
        const likeProbabilityInput = document.getElementById('m-setting-auto-like-probability');
        const likeProbabilityRange = document.getElementById('m-setting-auto-like-probability-range');
        if (probabilityInput) probabilityInput.value = probability;
        if (probabilityRange) probabilityRange.value = probability;
        if (likeProbabilityInput) likeProbabilityInput.value = likeProbability;
        if (likeProbabilityRange) likeProbabilityRange.value = likeProbability;

        // 5. 显示弹窗
        modal.classList.remove('hidden');
    },


    // ===========================================
    // 2. 保存朋友圈设置
    // ===========================================
    saveMomentsSettings() {
        const apiSelect = document.getElementById('m-setting-api-preset');
        const charContainer = document.getElementById('m-setting-allowed-chars');
        const authorContainer = document.getElementById('m-setting-visible-authors');
        
        // 获取选中的 API 索引
        const presetIndex = parseInt(apiSelect.value);

        // 获取选中的联系人 ID
        const allowed = [];
        const checkboxes = charContainer.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(cb => allowed.push(cb.value));
        const visibleAuthors = [];
        authorContainer?.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => visibleAuthors.push(cb.value));
        const probability = Math.max(0, Math.min(100, parseInt(document.getElementById('m-setting-auto-probability')?.value, 10) || 0));
        const likeProbability = Math.max(0, Math.min(100, parseInt(document.getElementById('m-setting-auto-like-probability')?.value, 10) || 0));

        // 更新 STATE
        const wasAutoEnabled = STATE.momentsSettings.autoCharacterMomentsEnabled !== false;
        const autoEnabled = document.getElementById('m-setting-auto-enabled')?.checked !== false;
        STATE.momentsSettings.apiPresetIndex = presetIndex;
        STATE.momentsSettings.allowedChars = allowed;
        STATE.momentsSettings.visibleCharacterAuthors = visibleAuthors;
        STATE.momentsSettings.autoCharacterMomentsEnabled = autoEnabled;
        STATE.momentsSettings.autoCharacterMomentProbability = probability;
        STATE.momentsSettings.autoCharacterLikeProbability = likeProbability;
        // ★ 总开关重新开启时从当下重新计算时间窗，不会回填到停用期间的日期。
        if (!wasAutoEnabled && autoEnabled) {
            STATE.momentsSettings.lastAutoMomentCheckAt = Date.now();
        }

        // 持久化保存
        if (Storage.saveMomentsSettings) {
            Storage.saveMomentsSettings();
        } else {
            // 如果你还没封装专门的保存函数，可以用通用的 set
            // DB.set(CONFIG.MOMENTS_SETTINGS_KEY, STATE.momentsSettings);
            console.warn("请确保实现了 Storage.saveMomentsSettings()");
        }

        // 关闭弹窗
        document.getElementById('modal-moments-settings').classList.add('hidden');
        this.renderMomentsUI();
        alert("设置已保存");
    },

    rollCharacterLikes(allowedIds) {
        // ★ 点赞是纯本地行为：每个可见角色独立掷一次，不额外消耗 API 和 Token。
        const probability = Math.max(0, Math.min(100, Number(STATE.momentsSettings?.autoCharacterLikeProbability ?? 25)));
        const allowedSet = new Set((Array.isArray(allowedIds) ? allowedIds : []).map(String));
        return STATE.contacts
            .filter(contact => allowedSet.has(String(contact.id)))
            .filter(() => Math.random() * 100 < probability)
            .map(contact => String(contact.id));
    },

    scheduleCharacterLikes(targetMoment, allowedIds) {
        const likerIds = this.rollCharacterLikes(allowedIds);
        likerIds.forEach(charId => {
            // ★ 每位命中角色独立等待 3～5 秒，再写入点赞，避免发帖瞬间整排亮起。
            const delay = 3000 + Math.floor(Math.random() * 2001);
            setTimeout(async () => {
                const moment = STATE.moments.find(item => String(item.id) === String(targetMoment?.id));
                if (!moment || String(moment.authorId || 'user') !== 'user') return;

                if (!Array.isArray(moment.likes)) moment.likes = [];
                if (moment.likes.map(String).includes(String(charId))) return;
                moment.likes.push(String(charId));

                if (typeof Storage !== 'undefined' && Storage.saveMoments) {
                    await Storage.saveMoments();
                } else {
                    this.saveMoments();
                }
                this.renderMomentsUI();
                this.showMomentLikeNotice(charId);
            }, delay);
        });
    },


    // 发布朋友圈并触发 AI 评论 (核心引擎逻辑)
    async publishMoment() {
        const textInput = document.getElementById('m-write-text');
        const imgPreview = document.getElementById('m-write-img-preview');
        const modal = document.getElementById('modal-write-moment');
        const fileInput = document.getElementById('m-write-img-input');
        const btnUpload = document.getElementById('btn-m-upload-img');

        // 1. 获取内容
        const text = textInput.value.trim();
        
        // 判断是否有图片：必须 display 不为 none 且 src 有效
        let imageBase64 = null;
        if (imgPreview && imgPreview.style.display !== 'none' && imgPreview.src && imgPreview.src.startsWith('data:image')) {
            imageBase64 = imgPreview.src;
        }

        // 2. 校验空内容
        if (!text && !imageBase64) {
            alert("写点什么吧");
            return;
        }



        // ★★★ 新增逻辑：计算哪些人有权限看到这条朋友圈，并初始化计数器 ★★★
        const injectionStatus = {};
        // 1. 获取允许名单
        let allowedIds = [];
        if (STATE.momentsSettings.allowedChars && STATE.momentsSettings.allowedChars.length > 0) {
            allowedIds = STATE.momentsSettings.allowedChars;
        } else {
            // 如果没设置白名单，默认所有人都能看
            allowedIds = STATE.contacts.map(c => c.id);
        }
        
        // 2. 给每个能看到的人，设置初始计数为 2，可以看到两条2条
        allowedIds.forEach(cid => {
            injectionStatus[cid] = CONFIG.MOMENTS_INJECT_COUNT;  // AI在聊天中感知新朋友圈的聊天轮次/朋友圈注入 在config.js里
        });



        // 3. 构造数据
        const newMoment = {
            id: 'm_' + Date.now(),
            authorId: 'user',
            text: text,
            image: imageBase64,
            timestamp: Date.now(),
            createdAt: Date.now(),
            comments: [],
            likes: [],
            // ★★★ 新增字段：用于记录聊天时的注入状态 ★★★
            chatInjectionStatus: injectionStatus,
            // 记录每个角色已经消费过的用户消息轮次，避免重 roll 重复扣轮次。
            chatInjectionActiveTurn: {} 
        };

        // 4. 保存数据
        // 注意：unshift 把新动态加到最前面，符合直觉
        STATE.moments.unshift(newMoment); 
        
        if (typeof Storage !== 'undefined' && Storage.saveMoments) {
            Storage.saveMoments();
        } else {
            console.warn("Storage.saveMoments 未定义，数据未持久化");
        }
        
        // 5. 重置 UI
        textInput.value = '';
        if (imgPreview) {
            imgPreview.src = '';
            imgPreview.style.display = 'none';
        }
        if (fileInput) fileInput.value = '';
        if (btnUpload) btnUpload.innerText = "添加图片";
        
        // 关闭弹窗
        if (modal) modal.classList.add('hidden');

        // 6. 刷新列表并触发 AI
        this.renderMomentsUI();
        this.scheduleCharacterLikes(newMoment, allowedIds);
        
        // 确保 triggerAIComments 函数存在
        if (typeof this.triggerAIComments === 'function') {
            this.triggerAIComments(newMoment);
        } else {
            console.warn("triggerAIComments 函数未定义，AI 未评论");
        }
    },


    // ===========================================
    // 触发 AI 评论 (修复版 + 引入世界书)
    // ===========================================
    async triggerAIComments(targetMoment) {
        // 1. 筛选允许评论的联系人
        let validCommentators = STATE.contacts;
        if (STATE.momentsSettings.allowedChars && STATE.momentsSettings.allowedChars.length > 0) {
            const allowedIds = STATE.momentsSettings.allowedChars.map(String);
            validCommentators = STATE.contacts.filter(c => allowedIds.includes(String(c.id)));
        }

        console.log(`[朋友圈] 触发评论，共 ${validCommentators.length} 个角色参与`);

        // 2. 逐个角色生成评论
        for (const char of validCommentators) {

            // 2.1 构造 Prompt
            // ★★★ 朋友圈评论也走统一 AI 可见历史：隐藏消息会顺延补足最近 5 条。★★★
            const visibleHistoryForMoment = HistoryVisibility.collectVisibleMessages(char, {
                limit: 5,
                preserveTimestamp: true,
                includeImageDescription: true
            });
            let historyContext = visibleHistoryForMoment.length
                ? HistoryVisibility.formatForRoleLines(char, visibleHistoryForMoment, { assistantName: '你', userName: '用户' })
                : "无";

            // ★★★ 新增：扫描世界书（将动态内容作为触发文本传入） ★★★
            const worldInfoPrompt = WorldInfoEngine.scan(targetMoment.text, [], char.id, char.name);
            let wiSection = worldInfoPrompt ? `\n【世界知识/环境信息】\n${worldInfoPrompt}\n` : "";

            const promptText = `
    【系统设定】
    ${char.prompt}
    ${wiSection}
    【历史参考】
    以下是我们最近的聊天记录摘要：
    ${historyContext}

    【当前情境】
    用户发布了一条动态：
    “${targetMoment.text}”

    【任务要求】
    请根据系统设定，以社交平台上的互动方式，对用户的这条动态进行评论。不需要括号描述任何环境、动作，直接输出你要说的内容即可。
    `;

            try {
                // 默认使用全局配置
                let targetApiConfig = {
                    API_URL: STATE.settings.API_URL,
                    API_KEY: STATE.settings.API_KEY,
                    MODEL: STATE.settings.MODEL,
                    MAX_TOKENS: STATE.settings.MAX_TOKENS || 200, 
                    TEMPERATURE: 1.1 
                };

                // 检查是否使用了朋友圈专属预设
                const presetIndex = STATE.momentsSettings.apiPresetIndex;
                if (typeof presetIndex === 'number' && presetIndex >= 0) {
                    const preset = STATE.settings.API_PRESETS[presetIndex];
                    if (preset) {
                        console.log(`[朋友圈] 角色 ${char.name} 使用预设: ${preset.name}`);
                        targetApiConfig.API_URL = preset.url;
                        targetApiConfig.API_KEY = preset.key;
                        targetApiConfig.MODEL = preset.model;
                        if(preset.max_tokens) targetApiConfig.MAX_TOKENS = parseInt(preset.max_tokens);
                        if(preset.temperature) targetApiConfig.TEMPERATURE = parseFloat(preset.temperature);
                    }
                }

                // 2.2 发送请求
                const messages = [{ role: 'user', content: promptText }];
                targetApiConfig = this.applyAsyncBackendToMomentConfig(
                    targetApiConfig,
                    this.buildMomentsAsyncContext('append_comment', {
                        momentId: targetMoment.id,
                        charId: char.id
                    })
                );
                let aiReplyText = await API.chat(messages, targetApiConfig);
                const asyncJobId = API.lastAsyncBackendResult?.jobId || null;

                // ★★★ 新增：在存入朋友圈数组前，从源头剔除 AI 的思考过程 ★★★
                aiReplyText = aiReplyText.replace(/<(?:think|thinking|thought)>[\s\S]*?<\/(?:think|thinking|thought)>/gi, '').trim();

                // 2.3 写入评论
                if (!asyncJobId || !targetMoment.comments.some(c => c.asyncJobId === asyncJobId)) {
                    const comment = {
                        id: 'c_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        senderId: char.id,
                        text: aiReplyText,
                        timestamp: Date.now()
                    };
                    if (asyncJobId) comment.asyncJobId = asyncJobId;
                    targetMoment.comments.push(comment);
                    this.showMomentReplyNotice(char.id);
                }

                // 2.4 保存并刷新
                if (typeof Storage !== 'undefined' && Storage.saveMoments) {
                    Storage.saveMoments();
                } else {
                    this.saveMoments(); 
                }
                this.renderMomentsUI();

            } catch (err) {
                if (err.isAsyncBackendPending) {
                    // ★ 朋友圈评论已经交给 Worker 继续跑了：前端回来后按 context 回填，不按失败处理。
                    this.scheduleAsyncBackendResumeCheck(1200);
                    continue;
                }
                console.error(`[朋友圈] 角色 ${char.name} 评论失败:`, err);
            }
            
            // 简单的防并发延迟
            await new Promise(r => setTimeout(r, 2000)); 
        }
    },

    // ★★★★★ 角色自动动态 START ★★★★★
    getMomentsApiConfig(maxTokens = 1200) {
        let config = {
            API_URL: STATE.settings.API_URL,
            API_KEY: STATE.settings.API_KEY,
            MODEL: STATE.settings.MODEL,
            MAX_TOKENS: maxTokens,
            TEMPERATURE: 1.1
        };
        const presetIndex = STATE.momentsSettings?.apiPresetIndex;
        if (typeof presetIndex === 'number' && presetIndex >= 0) {
            const preset = STATE.settings.API_PRESETS?.[presetIndex];
            if (preset) {
                config.API_URL = preset.url;
                config.API_KEY = preset.key;
                config.MODEL = preset.model;
                if (preset.max_tokens) config.MAX_TOKENS = Math.min(parseInt(preset.max_tokens, 10), maxTokens);
                if (preset.temperature) config.TEMPERATURE = parseFloat(preset.temperature);
            }
        }
        return config;
    },

    extractMomentJson(rawText) {
        const cleanText = String(rawText || '')
            .replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, '')
            .replace(/```(?:json)?/gi, '')
            .replace(/```/g, '')
            .trim();
        try {
            return JSON.parse(cleanText);
        } catch (error) {
            // ★ 允许模型在 JSON 前后多说一句，但提取出的对象本身仍必须是合法 JSON。
            const start = cleanText.indexOf('{');
            const end = cleanText.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try {
                    return JSON.parse(cleanText.slice(start, end + 1));
                } catch (nestedError) {}
            }
            throw new Error('角色动态返回的 JSON 无法解析');
        }
    },

    normalizeCharacterMomentResponse(rawText, windowStart, windowEnd) {
        const data = this.extractMomentJson(rawText);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('角色动态返回的 JSON 不是对象');
        }
        const text = typeof data.text === 'string' ? data.text.trim().slice(0, 1200) : '';
        if (!text) throw new Error('角色动态内容为空');

        const now = Date.now();
        const rawEnd = Number(windowEnd);
        const safeEnd = Number.isFinite(rawEnd) ? Math.min(rawEnd, now) : now;
        const rawStart = Number(windowStart);
        const safeStart = Number.isFinite(rawStart) && rawStart <= safeEnd
            ? rawStart
            : safeEnd - 12 * 60 * 60 * 1000;
        const parsedTime = new Date(data.timestamp || '').getTime();
        const fallbackTime = safeStart + Math.floor(Math.random() * Math.max(1, safeEnd - safeStart + 1));
        const timestamp = Number.isFinite(parsedTime) && parsedTime >= safeStart && parsedTime <= safeEnd
            ? parsedTime
            : fallbackTime;
        return { text, timestamp: Math.trunc(timestamp) };
    },

    getMomentLocalDateKey(timestamp = Date.now()) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    getCharacterAutoMomentStats(charId, now = Date.now()) {
        const settings = STATE.momentsSettings || CONFIG.DEFAULT.MOMENTS_SETTINGS;
        if (!settings.autoMomentStatsByChar || typeof settings.autoMomentStatsByChar !== 'object') {
            settings.autoMomentStatsByChar = {};
        }
        const key = String(charId);
        const today = this.getMomentLocalDateKey(now);
        const saved = settings.autoMomentStatsByChar[key] || {};
        if (saved.dailyDate !== today) {
            saved.dailyDate = today;
            saved.dailyCount = 0;
        }
        const lastGeneratedAt = Number(saved.lastGeneratedAt || 0);
        const dailyCount = Number(saved.dailyCount || 0);
        saved.lastGeneratedAt = Number.isFinite(lastGeneratedAt) ? lastGeneratedAt : 0;
        saved.dailyCount = Number.isFinite(dailyCount) ? Math.max(0, Math.floor(dailyCount)) : 0;
        settings.autoMomentStatsByChar[key] = saved;
        return saved;
    },

    isCharacterMomentEligible(charId, now = Date.now()) {
        const stats = this.getCharacterAutoMomentStats(charId, now);
        const cooldownMs = 4 * 60 * 60 * 1000;
        return stats.dailyCount < 3 && (!stats.lastGeneratedAt || now - stats.lastGeneratedAt >= cooldownMs);
    },

    async registerCharacterMomentCreated(charId, createdAt = Date.now()) {
        // ★ 冷却使用真实生成时间，不使用 AI 回填的展示时间，否则回填到几小时前会绕过冷却。
        const stats = this.getCharacterAutoMomentStats(charId, createdAt);
        stats.lastGeneratedAt = createdAt;
        stats.dailyCount += 1;
        await Storage.saveMomentsSettings();
    },

    async saveCharacterMomentFromResponse(charId, rawText, windowStart, windowEnd, asyncJobId = null) {
        if (asyncJobId && STATE.moments.some(moment => moment.asyncJobId === asyncJobId)) return false;
        const contact = STATE.contacts.find(item => String(item.id) === String(charId));
        if (!contact) return false;

        const generated = this.normalizeCharacterMomentResponse(rawText, windowStart, windowEnd);
        const createdAt = Date.now();
        const newMoment = {
            id: 'm_char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            authorId: contact.id,
            text: generated.text,
            image: null,
            timestamp: generated.timestamp,
            createdAt,
            comments: [],
            likes: [],
            // ★ 角色发帖只通知作者本人；独立常量方便以后与用户动态分别调整轮次。
            chatInjectionStatus: {
                [String(contact.id)]: CONFIG.CHARACTER_MOMENT_INJECT_COUNT
            },
            chatInjectionActiveTurn: {}
        };
        if (asyncJobId) newMoment.asyncJobId = asyncJobId;
        STATE.moments.unshift(newMoment);
        await Storage.saveMoments();
        try {
            await this.registerCharacterMomentCreated(contact.id, createdAt);
        } catch (error) {
            console.warn('[朋友圈] 角色动态冷却记录保存失败:', error);
        }
        this.renderMomentsUI();
        if (this.isViewingMomentsPage()) {
            await this.markCharacterMomentsSeen();
        } else {
            this.updateCharacterMomentUnreadDot();
        }
        return true;
    },

    async maybeGenerateCharacterMoment(reason = 'startup') {
        // ★ 一次页面生命周期只掷一次；pageshow 和延时启动同时触发也不会重复请求 API。
        if (this._autoMomentGenerationChecked || this._autoMomentGenerationRunning) return false;
        this._autoMomentGenerationChecked = true;
        const settings = STATE.momentsSettings || CONFIG.DEFAULT.MOMENTS_SETTINGS;
        if (settings.autoCharacterMomentsEnabled === false || !STATE.contacts.length) return false;

        const selectedIds = Array.isArray(settings.visibleCharacterAuthors)
            ? settings.visibleCharacterAuthors.map(String)
            : [];
        const selectedContacts = selectedIds.length
            ? STATE.contacts.filter(contact => selectedIds.includes(String(contact.id)))
            : [...STATE.contacts];

        // ★ 后台已有角色发帖任务时不要再开第二条，避免网络切换后重复生成。
        const hasPendingGeneration = typeof API.loadPendingJobs === 'function'
            && API.loadPendingJobs().some(job => job.status !== 'failed'
                && job.context?.scope === 'moments'
                && job.context?.type === 'generate_character_moment');
        if (hasPendingGeneration) return false;

        const now = Date.now();
        this._autoMomentGenerationRunning = true;
        try {
            // ★ 先保留上一次检查时间作为窗口起点，再把本轮检查时间推进到 now。
            const previousCheckAt = Number(settings.lastAutoMomentCheckAt || 0);
            const windowStart = previousCheckAt > 0 && previousCheckAt < now
                ? previousCheckAt
                : now - 12 * 60 * 60 * 1000;
            settings.lastAutoMomentCheckAt = now;
            let candidates = selectedContacts.filter(contact => this.isCharacterMomentEligible(contact.id, now));
            await Storage.saveMomentsSettings();

            if (!candidates.length) return false;

            const probability = Math.max(0, Math.min(100, Number(settings.autoCharacterMomentProbability ?? 50)));
            if (Math.random() * 100 >= probability) return false;

            // ★ 有多个候选时避开最新一条角色动态的作者，让公屏不会总被同一个人刷满。
            const latestCharacterMoment = [...STATE.moments]
                .filter(moment => String(moment.authorId || 'user') !== 'user')
                .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
            if (latestCharacterMoment && candidates.length > 1) {
                const alternatives = candidates.filter(contact => String(contact.id) !== String(latestCharacterMoment.authorId));
                if (alternatives.length) candidates = alternatives;
            }
            const contact = candidates[Math.floor(Math.random() * candidates.length)];

            // ★ 角色日程已开启且今天有缓存时，发动态也复用聊天里的“当前 / 上一段 / 下一段”格式。
            const characterSchedulePrompt = CharacterSchedule.buildChatPrompt(contact.id, new Date(now));
            const characterScheduleSection = characterSchedulePrompt
                ? `\n【角色日程】\n${characterSchedulePrompt}\n`
                : '';

            const directions = [
                '近期对话相关，但不复述聊天原句',
                '自己的日常片段',
                '突然想到的一句话',
                '情绪或内心感受',
                '类似歌词、诗句气质的原创表达',
                '对周围环境或时间的感受'
            ];
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const visibleHistory = HistoryVisibility.collectVisibleMessages(contact, {
                limit: 5,
                preserveTimestamp: true,
                includeImageDescription: true
            });
            const historyText = visibleHistory.length
                ? HistoryVisibility.formatForRoleLines(contact, visibleHistory, { assistantName: '你', userName: '用户' })
                : '无';
            const recentMoments = [...STATE.moments]
                .filter(moment => String(moment.authorId || 'user') === String(contact.id))
                .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
                .slice(0, 3)
                .map(moment => `- ${formatTimeForMoments(moment.timestamp)}：${moment.text}`)
                .join('\n') || '无';
            const worldInfoPrompt = WorldInfoEngine.scan(`${direction}\n${historyText}`, [], contact.id, contact.name);
            const worldInfoSection = worldInfoPrompt ? `\n【世界知识/环境信息】\n${worldInfoPrompt}\n` : '';
            const startText = new Date(windowStart).toLocaleString('zh-CN', { hour12: false });
            const endText = new Date(now).toLocaleString('zh-CN', { hour12: false });
            const promptText = `【系统设定】\n${contact.prompt || ''}\n${characterScheduleSection}${worldInfoSection}\n【近期聊天】\n${historyText}\n\n【你最近的三条动态】\n${recentMoments}\n\n【本次内容方向】\n${direction}\n\n【可用发帖时间】\n${startText} 至 ${endText}\n\n【任务】\n你是 ${contact.name}。像真人使用朋友圈一样，发布一条自然、独立的文字动态。可以联系近期聊天，也可以写自己的生活和心情，也可以分享你喜欢的诗句、歌词或书摘。不要提到你是 AI，不要写动作括号，不要解释，不要重复最近动态，不要凭空创造会改变人物关系的重大事件。正文建议 10～180 字。\n只输出严格 JSON：{"text":"动态正文","timestamp":"带时区的 ISO 8601 时间"}`;

            let apiConfig = this.getMomentsApiConfig(1200);
            // ★ 角色自动发朋友圈不是用户互动；朋友圈里的评论、回复仍沿用默认计数。
            apiConfig.COUNT_AS_INTERACTION = false;
            apiConfig = this.applyAsyncBackendToMomentConfig(
                apiConfig,
                this.buildMomentsAsyncContext('generate_character_moment', {
                    charId: contact.id,
                    windowStart,
                    windowEnd: now,
                    reason
                })
            );
            const rawText = await API.chat([{ role: 'user', content: promptText }], apiConfig);
            const asyncJobId = API.lastAsyncBackendResult?.jobId || null;
            return await this.saveCharacterMomentFromResponse(contact.id, rawText, windowStart, now, asyncJobId);
        } catch (error) {
            if (error.isAsyncBackendPending) {
                this.scheduleAsyncBackendResumeCheck(1200);
                return false;
            }
            console.warn('[朋友圈] 角色自动动态生成失败:', error);
            return false;
        } finally {
            this._autoMomentGenerationRunning = false;
        }
    },
    // ★★★★★ 角色自动动态 END ★★★★★

    // ★★★★★ 朋友圈点赞与主动评论 START ★★★★★
    async toggleMomentLike(momentId) {
        const moment = STATE.moments.find(item => item.id === momentId);
        if (!moment) return;
        if (!Array.isArray(moment.likes)) moment.likes = [];
        const index = moment.likes.indexOf('user');
        if (index >= 0) moment.likes.splice(index, 1);
        else moment.likes.push('user');
        await Storage.saveMoments();
        this.renderMomentsUI();
    },

    openMomentCommentComposer(momentId) {
        const moment = STATE.moments.find(item => item.id === momentId);
        if (!moment) return;
        STATE.composingMomentCommentId = momentId;
        const author = this.getMomentAuthor(moment.authorId || 'user');
        const title = document.getElementById('moment-comment-modal-title');
        const textarea = document.getElementById('m-comment-text');
        if (title) title.textContent = author.isUser ? '写评论' : `评论 ${author.name}`;
        if (textarea) textarea.value = '';
        document.getElementById('modal-write-moment-comment')?.classList.remove('hidden');
        textarea?.focus();
    },

    async publishMomentComment() {
        const moment = STATE.moments.find(item => item.id === STATE.composingMomentCommentId);
        const textarea = document.getElementById('m-comment-text');
        const text = String(textarea?.value || '').trim();
        if (!moment || !text) {
            if (!text) alert('写点什么吧');
            return;
        }

        const userComment = {
            id: 'c_user_' + Date.now(),
            senderId: 'user',
            text,
            timestamp: Date.now()
        };
        if (!Array.isArray(moment.comments)) moment.comments = [];
        moment.comments.push(userComment);
        document.getElementById('modal-write-moment-comment')?.classList.add('hidden');
        STATE.composingMomentCommentId = null;
        await Storage.saveMoments();
        this.renderMomentsUI();

        // ★ 评论角色动态时只让动态作者回复；第一版不触发其他角色互评。
        if (String(moment.authorId || 'user') !== 'user') {
            this.triggerCharacterMomentAuthorReply(moment, userComment);
        }
    },

    async triggerCharacterMomentAuthorReply(moment, userComment) {
        const contact = STATE.contacts.find(item => String(item.id) === String(moment.authorId));
        if (!contact) return;
        const threadText = (moment.comments || []).slice(-8).map(comment => {
            const sender = this.getMomentAuthor(comment.senderId);
            return `${sender.name}：${comment.text}`;
        }).join('\n');
        const worldInfoPrompt = WorldInfoEngine.scan(`${moment.text}\n${userComment.text}`, [], contact.id, contact.name);
        const worldInfoSection = worldInfoPrompt ? `\n【世界知识/环境信息】\n${worldInfoPrompt}\n` : '';
        const promptText = `【系统设定】\n${contact.prompt || ''}\n${worldInfoSection}\n【你的动态】\n${moment.text}\n\n【评论区】\n${threadText}\n\n【任务】\n用户刚刚评论了你的动态。请以 ${contact.name} 的身份自然回复用户，像朋友圈评论一样简短。不要输出动作描写、括号或解释，直接输出回复正文。`;

        try {
            let apiConfig = this.getMomentsApiConfig(700);
            apiConfig = this.applyAsyncBackendToMomentConfig(
                apiConfig,
                this.buildMomentsAsyncContext('reply_to_character_moment', {
                    momentId: moment.id,
                    charId: contact.id,
                    replyToId: 'user',
                    replyToName: STATE.momentsSettings?.username || '我'
                })
            );
            let replyText = await API.chat([{ role: 'user', content: promptText }], apiConfig);
            const asyncJobId = API.lastAsyncBackendResult?.jobId || null;
            replyText = String(replyText || '').replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, '').trim();
            if (!replyText) return;
            if (!asyncJobId || !moment.comments.some(comment => comment.asyncJobId === asyncJobId)) {
                moment.comments.push({
                    id: 'c_char_' + Date.now(),
                    senderId: contact.id,
                    text: replyText,
                    replyToId: 'user',
                    replyToName: STATE.momentsSettings?.username || '我',
                    timestamp: Date.now(),
                    ...(asyncJobId ? { asyncJobId } : {})
                });
                this.showMomentReplyNotice(contact.id);
            }
            await Storage.saveMoments();
            this.renderMomentsUI();
        } catch (error) {
            if (error.isAsyncBackendPending) {
                this.scheduleAsyncBackendResumeCheck(1200);
                return;
            }
            console.warn(`[朋友圈] ${contact.name} 回复角色动态评论失败:`, error);
        }
    },
    // ★★★★★ 朋友圈点赞与主动评论 END ★★★★★




    // ===========================================
    // 执行朋友圈操作 (复制、编辑、删除)
    // ===========================================
    handleMomentAction(action) {
        const momentId = STATE.selectedMomentId;
        if (!momentId) return;

        // 1. 查找朋友圈数据
        const momentIndex = STATE.moments.findIndex(m => m.id === momentId);
        if (momentIndex === -1) return;
        
        const momentData = STATE.moments[momentIndex];

        // 2. 隐藏弹出的操作菜单
        const actionModal = document.getElementById('modal-moment-actions');
        if (actionModal) actionModal.classList.add('hidden');

        // 3. 执行对应的动作
        if (action === 'copy') {
            let contentToCopy = momentData.text || "";
            
            // 如果这条朋友圈带图，给复制内容加个提示
            if (momentData.image) {
                contentToCopy += "\n[图片]";
            }

            copyPlainText(contentToCopy)
                .then(() => {
                    Toast.show('已复制');
                })
                .catch(err => {
                    console.error("复制失败:", err);
                    alert("复制失败，请检查浏览器权限");
                });
        } 
        else if (action === 'edit') {
            const cleanContent = momentData.text;
            
            // ★ 这里兼容了你之前的 UI.showEditModal 逻辑
            // 如果你没有定义 UI.showEditModal，就会自动降级使用浏览器自带的 prompt
            if (typeof UI !== 'undefined' && typeof UI.showEditModal === 'function') {
                UI.showEditModal(cleanContent, (newText) => {
                    if (newText && newText !== cleanContent) {
                        momentData.text = newText;
                        this.saveAndRenderMoments();
                    }
                });
            } else {
                const newText = prompt("编辑朋友圈内容：", cleanContent);
                if (newText !== null && newText.trim() !== "" && newText !== cleanContent) {
                    momentData.text = newText;
                    this.saveAndRenderMoments();
                }
            }
        } 
        else if (action === 'delete') {
            if (confirm("确定要彻底删除这条朋友圈吗？")) {
                // 删掉数据
                STATE.moments.splice(momentIndex, 1);
                this.saveAndRenderMoments();
            }
        }
    },

    // 辅助保存和渲染的方法（统一处理容错）
    saveAndRenderMoments() {
        // 保存到本地存储
        if (typeof Storage !== 'undefined' && Storage.saveMoments) {
            Storage.saveMoments();
        } else if (typeof this.saveMoments === 'function') {
            this.saveMoments();
        }

        // 刷新列表视图
        if (typeof this.renderMomentsUI === 'function') {
            this.renderMomentsUI();
        } else if (typeof App !== 'undefined' && typeof App.renderMomentsUI === 'function') {
            App.renderMomentsUI();
        }
    },



    // ===========================================
    // 处理评论的点击菜单操作 (复制、编辑、重新生成)
    // ===========================================
    async handleCommentAction(action) {
        const ctx = STATE.selectedCommentContext;
        if (!ctx) return;

        // 1. 查找对应的数据
        const momentIndex = STATE.moments.findIndex(m => m.id === ctx.momentId);
        if (momentIndex === -1) return;
        const momentData = STATE.moments[momentIndex];
        
        const commentIndex = momentData.comments.findIndex(c => c.id === ctx.commentId);
        if (commentIndex === -1) return;
        const commentData = momentData.comments[commentIndex];

        // 2. 隐藏弹出的操作菜单
        const actionModal = document.getElementById('modal-comment-actions');
        if (actionModal) actionModal.classList.add('hidden');

        // 3. 分支执行
        if (action === 'copy') {
            copyPlainText(commentData.text)
                .then(() => Toast.show('已复制'))
                .catch(err => {
                    console.error("评论复制失败:", err);
                    alert("复制失败，请检查浏览器权限");
                });
        } 
        else if (action === 'edit') {
            const cleanContent = commentData.text;
            // 兼容你原来的编辑逻辑
            if (typeof UI !== 'undefined' && typeof UI.showEditModal === 'function') {
                UI.showEditModal(cleanContent, (newText) => {
                    if (newText && newText !== cleanContent) {
                        commentData.text = newText;
                        this.saveAndRenderMoments();
                    }
                });
            } else {
                const newText = prompt("编辑评论内容：", cleanContent);
                if (newText !== null && newText.trim() !== "" && newText !== cleanContent) {
                    commentData.text = newText;
                    this.saveAndRenderMoments();
                }
            }
        } 
        else if (action === 'regen') {
            if (ctx.charId === 'user') {
                alert("自己的评论不能重新生成哦！");
                return;
            }

            const targetChar = STATE.contacts.find(c => String(c.id) === String(ctx.charId));
            if (!targetChar) return;
            const momentAuthor = this.getMomentAuthor(momentData.authorId || 'user');
            const momentScene = momentAuthor.isUser
                ? `用户发布了一条动态：“${momentData.text}”`
                : `你自己发布了一条动态：“${momentData.text}”`;

            console.log(`[朋友圈] 重新生成 ${ctx.charName} 的评论`);

            // 提取对话流：只截取这条评论【之前】的评论作为上下文，不包括要重生成的这条本身
                    let threadContext = momentData.comments.slice(0, commentIndex)
                        .filter(c => {
                    if (c.senderId === ctx.charId) return true;
                    if (c.senderId === 'user') {
                        // ★★★ 核心优雅逻辑：如果有 replyToId，直接精确比对ID，绝对不会错！
                        if (c.replyToId) {
                            return c.replyToId === ctx.charId;
                        }
                        // ★ 兼容老数据：如果老数据没有 replyToId，降级使用旧的字符串匹配
                        if (c.text.startsWith('回复 ') && !c.text.startsWith(`回复 ${ctx.charName}:`)) return false; 
                        return true; 
                    }
                    return false;
                })
                .map(c => {
                    let name = c.senderId === 'user' ? '用户' : ctx.charName;
                    let cleanText = c.text;
                    
                    // ★ 兼容老数据：如果老数据自带前缀，还是给它切掉，避免喂给AI时啰嗦
                    if (c.senderId === 'user' && !c.replyToId && cleanText.startsWith(`回复 ${ctx.charName}: `)) {
                        cleanText = cleanText.replace(`回复 ${ctx.charName}: `, '');
                    }

                    // 过滤 AI 的思考过程
                    if (c.senderId !== 'user') {
                        cleanText = cleanText.replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, '').trim();
                    }
                    return `${name}: ${cleanText}`;
                }).join('\n');  

            let promptText = "";
            
            // ★★★ 新增：扫描世界书（综合动态内容和评论区上下文来进行扫描） ★★★
            const scanText = momentData.text + "\n" + threadContext;
            const worldInfoPrompt = WorldInfoEngine.scan(scanText, [], targetChar.id, targetChar.name);
            let wiSection = worldInfoPrompt ? `\n【世界知识/环境信息】\n${worldInfoPrompt}\n` : "";

            if (threadContext.trim() === "") {

                // ★★★ 重生成评论同样走统一 AI 可见历史，避免隐藏内容在再生成时漏出。★★★
                const visibleHistoryForMoment = HistoryVisibility.collectVisibleMessages(targetChar, {
                    limit: 5,
                    preserveTimestamp: true,
                    includeImageDescription: true
                });
                let historyContext = visibleHistoryForMoment.length
                    ? HistoryVisibility.formatForRoleLines(targetChar, visibleHistoryForMoment, { assistantName: '你', userName: '用户' })
                    : "无";

                promptText = `【系统设定】\n${targetChar.prompt}\n${wiSection}\n【历史参考】\n${historyContext}\n【当前情境】\n${momentScene}\n【任务要求】\n重新生成你在这条动态下的评论。按照社交软件的语言习惯简短回复，50 字以下。不要用括号描述环境或动作，直接输出评论正文。`;
            } else {
                // 这是追问回复
                promptText = `【系统设定】\n${targetChar.prompt}\n${wiSection}\n【动态内容】\n${momentScene}\n【评论区对话流】\n${threadContext}\n【任务】\n用户刚刚在评论区专门回复了你。请根据你的人设，继续在评论区回复用户。保持简短，像朋友圈评论一样自然。不要输出动作描写。`;
            }

            // 先把界面改成加载中
            const originalText = commentData.text; // 缓存原文本
            commentData.text = "...重新生成中...";
            this.saveAndRenderMoments();

            try {
                let targetApiConfig = {
                    API_URL: STATE.settings.API_URL,
                    API_KEY: STATE.settings.API_KEY,
                    MODEL: STATE.settings.MODEL,
                    MAX_TOKENS: 5000, 
                    TEMPERATURE: 1.1
                };
                const presetIndex = STATE.momentsSettings?.apiPresetIndex;
                if (typeof presetIndex === 'number' && presetIndex >= 0) {
                    const preset = STATE.settings.API_PRESETS[presetIndex];
                    if (preset) {
                        targetApiConfig.API_URL = preset.url;
                        targetApiConfig.API_KEY = preset.key;
                        targetApiConfig.MODEL = preset.model;
                        if(preset.max_tokens) targetApiConfig.MAX_TOKENS = parseInt(preset.max_tokens);
                        if(preset.temperature) targetApiConfig.TEMPERATURE = parseFloat(preset.temperature);
                    }
                }
                
                // 【补上这行请求代码】
                targetApiConfig = this.applyAsyncBackendToMomentConfig(
                    targetApiConfig,
                    this.buildMomentsAsyncContext('regenerate_comment', {
                        momentId: momentData.id,
                        commentId: commentData.id,
                        originalText
                    })
                );
                let aiReplyText = await API.chat([{role:'user', content: promptText}], targetApiConfig);
                const asyncJobId = API.lastAsyncBackendResult?.jobId || null;

                // ★★★ 新增：重新生成存入前，也必须剔除思考过程 ★★★
                aiReplyText = aiReplyText.replace(/<(?:think|thinking|thought)>[\s\S]*?<\/(?:think|thinking|thought)>/gi, '').trim();
                
                commentData.text = aiReplyText;
                if (asyncJobId) commentData.asyncJobId = asyncJobId;
                this.saveAndRenderMoments();

            } catch (e) {
                if (e.isAsyncBackendPending) {
                    this.scheduleAsyncBackendResumeCheck(1200);
                    return;
                }
                console.error("重新生成失败:", e);
                alert("重新生成失败，已恢复原评论");
                commentData.text = originalText; // 回退原文本
                this.saveAndRenderMoments();
            }
        }
        // ★★★ 新增：删除评论逻辑 ★★★
        else if (action === 'delete') {
            if (confirm("确定要删除这条评论吗？")) {
                // 根据上面找到的索引，从 comments 数组中删掉这条评论
                momentData.comments.splice(commentIndex, 1);
                // 保存并重新渲染 UI
                this.saveAndRenderMoments();
            }
        }
    },

    // ===========================================
    // 打开自定义回复输入框 (替代 alert/prompt)
    // ===========================================
    openReplyModal() {
        const ctx = STATE.selectedCommentContext;
        if (!ctx) return;
        
        if (ctx.charId === 'user') {
            alert("不能回复自己哦！如果需要可以点击编辑~");
            return;
        }

        // 关闭菜单，打开输入框
        document.getElementById('modal-comment-actions').classList.add('hidden');
        const modal = document.getElementById('modal-reply-comment');
        const title = document.getElementById('modal-reply-title');
        const textarea = document.getElementById('m-reply-text');
        
        title.innerText = `回复 ${ctx.charName}`;
        textarea.value = '';
        modal.classList.remove('hidden');
        textarea.focus();
    },

    // ===========================================
    // 执行回复并触发AI (完美继承你的上下文引擎 + 世界书)
    // ===========================================
    async executeCommentReply() {
        const ctx = STATE.selectedCommentContext;
        if (!ctx) return;

        const textarea = document.getElementById('m-reply-text');
        const userReplyText = textarea.value.trim();
        
        if (!userReplyText) {
            alert("写点什么吧");
            return;
        }

        // 关闭输入弹窗
        document.getElementById('modal-reply-comment').classList.add('hidden');

        const targetMoment = STATE.moments.find(m => m.id === ctx.momentId);
        const targetChar = STATE.contacts.find(c => String(c.id) === String(ctx.charId));
        if (!targetMoment || !targetChar) return;

        // 1. 存入用户回复
        targetMoment.comments.push({
            id: 'c_' + Date.now(),
            senderId: 'user',
            // ★ 改动1：只存用户真正输入的文本，不再硬拼接 "回复 xxx: "
            text: userReplyText, 
            // ★ 改动2：增加专属字段，明确记录这条评论是回复谁的
            replyToId: ctx.charId,     
            replyToName: ctx.charName, 
            timestamp: Date.now()
        });
        this.saveAndRenderMoments();

        // 2. 触发 AI 追问
        console.log(`[朋友圈] 触发追问回复: ${targetChar.name}`);

        // 提取对话流 (这里以 executeCommentReply 中的那段为例，regen 里的同理替换)
        let threadContext = targetMoment.comments
            .filter(c => {
                if (c.senderId === ctx.charId) return true;
                if (c.senderId === 'user') {
                    // ★★★ 核心优雅逻辑：如果有 replyToId，直接精确比对ID，绝对不会错！
                    if (c.replyToId) {
                        return c.replyToId === ctx.charId;
                    }
                    // ★ 兼容老数据：如果老数据没有 replyToId，降级使用旧的字符串匹配
                    if (c.text.startsWith('回复 ') && !c.text.startsWith(`回复 ${ctx.charName}:`)) return false; 
                    return true; 
                }
                return false;
            })
            .map(c => {
                let name = c.senderId === 'user' ? '用户' : ctx.charName;
                let cleanText = c.text;
                
                // ★ 兼容老数据：如果老数据自带前缀，还是给它切掉，避免喂给AI时啰嗦
                if (c.senderId === 'user' && !c.replyToId && cleanText.startsWith(`回复 ${ctx.charName}: `)) {
                    cleanText = cleanText.replace(`回复 ${ctx.charName}: `, '');
                }

                // 过滤 AI 的思考过程
                if (c.senderId !== 'user') {
                    cleanText = cleanText.replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, '').trim();
                }
                return `${name}: ${cleanText}`;
            }).join('\n');

        // ★★★ 新增：扫描世界书（用动态内容+用户回复的文本进行扫描） ★★★
        const scanText = targetMoment.text + "\n" + userReplyText;
        const worldInfoPrompt = WorldInfoEngine.scan(scanText, [], targetChar.id, targetChar.name);
        let wiSection = worldInfoPrompt ? `\n【世界知识/环境信息】\n${worldInfoPrompt}\n` : "";
        const momentAuthor = this.getMomentAuthor(targetMoment.authorId || 'user');
        const momentScene = momentAuthor.isUser
            ? `用户发布的动态：${targetMoment.text}`
            : `你自己发布的动态：${targetMoment.text}`;

        const promptText = `
    【系统设定】
    ${targetChar.prompt}
    ${wiSection}
    【动态内容】
    ${momentScene}

    【评论区对话流】
    ${threadContext}

    【任务】
    用户刚刚在评论区专门回复了你。请根据你的人设，继续在评论区回复用户。
    注意：保持简短，像朋友圈评论一样自然。不要输出动作描写(如笑)，直接输出想说的话。
    `;

        try {
            let targetApiConfig = {
                API_URL: STATE.settings.API_URL,
                API_KEY: STATE.settings.API_KEY,
                MODEL: STATE.settings.MODEL,
                MAX_TOKENS: 2000, 
                TEMPERATURE: 1.1
            };

            const presetIndex = STATE.momentsSettings?.apiPresetIndex;
            if (typeof presetIndex === 'number' && presetIndex >= 0) {
                const preset = STATE.settings.API_PRESETS[presetIndex];
                if (preset) {
                    targetApiConfig.API_URL = preset.url;
                    targetApiConfig.API_KEY = preset.key;
                    targetApiConfig.MODEL = preset.model;
                    if(preset.max_tokens) targetApiConfig.MAX_TOKENS = parseInt(preset.max_tokens);
                    if(preset.temperature) targetApiConfig.TEMPERATURE = parseFloat(preset.temperature);
                }
            }

            targetApiConfig = this.applyAsyncBackendToMomentConfig(
                targetApiConfig,
                this.buildMomentsAsyncContext('reply_comment', {
                    momentId: targetMoment.id,
                    charId: targetChar.id
                })
            );
            let aiReplyText = await API.chat([{role:'user', content: promptText}], targetApiConfig);
            const asyncJobId = API.lastAsyncBackendResult?.jobId || null;
            

            // ★★★ 新增：追问回复存入前，剔除思考过程 ★★★
            aiReplyText = aiReplyText.replace(/<(?:think|thinking|thought)>[\s\S]*?<\/(?:think|thinking|thought)>/gi, '').trim();

            if (!asyncJobId || !targetMoment.comments.some(c => c.asyncJobId === asyncJobId)) {
                const comment = {
                    id: 'c_' + Date.now(),
                    senderId: targetChar.id,
                    text: aiReplyText,
                    timestamp: Date.now()
                };
                if (asyncJobId) comment.asyncJobId = asyncJobId;
                targetMoment.comments.push(comment);
                this.showMomentReplyNotice(targetChar.id);
            }
            this.saveAndRenderMoments();
        } catch (e) {
            if (e.isAsyncBackendPending) {
                this.scheduleAsyncBackendResumeCheck(1200);
                return;
            }
            console.error("回复失败:", e);
            alert(`${targetChar.name} 的回复失败，请检查API配置或网络。`);
        }
    },


    // ===========================================
    // ★★★ 新增：【聊天中】生成朋友圈上下文 Prompt ★★★
    // ===========================================
    getMomentsContextForChat(contactId, currentTurnId = null) {
        // 1. 找到该角色“本轮该看”的朋友圈：剩余轮次 > 0，或已经绑定到当前用户消息轮次。
        // 重 roll 会复用同一个 currentTurnId，所以不会因为反复生成而提前耗尽。
        const relevantMoments = STATE.moments
            .filter(m => {
                const remainingTurns = Number(m.chatInjectionStatus?.[contactId]) || 0;
                const activeTurnId = m.chatInjectionActiveTurn?.[contactId] || null;
                return remainingTurns > 0 || (currentTurnId && activeTurnId === currentTurnId);
            })
            .sort((a, b) => b.timestamp - a.timestamp) // 倒序，最新的在前
            .slice(0, 3); // 限制只处理最近3条，避免token爆炸

        if (relevantMoments.length === 0) return null;

        let contextText = "【近期朋友圈同步(System Info)】\n以下是与你有关的新动态（包含你和用户在评论区的互动）。请将其作为当前对话的背景知识，**无需刻意复述**，但在回复时请保持对此事的记忆。\n";
        let idsToUpdate = [];

        relevantMoments.forEach((m, index) => {
            idsToUpdate.push(m.id); // 记录下ID，等会发送成功了要扣次数

            // 提取该角色相关的评论
            // 规则：只包含“该角色发的”和“用户回复该角色的”
            // 或者是“用户发的且没有明确回复对象的”（可选，这里暂时只取对话流）
            // 提取该角色相关的评论
            const chatThread = m.comments.filter(c => {
                if (c.senderId === contactId) return true;
                if (c.senderId === 'user') {
                    // ★★★ 新优雅逻辑：直接看 ID
                    if (c.replyToId) {
                        return c.replyToId === contactId;
                    }
                    
                    // ★ 兼容老数据
                    if (!c.text.startsWith('回复 ')) return true; // 普通评论算相关
                    const contactName = STATE.contacts.find(ct => ct.id === contactId)?.name || "未知";
                    if (c.text.startsWith(`回复 ${contactName}:`)) return true;
                    return false;
                }
                return false;
            }).map(c => {
                const name = c.senderId === 'user' ? '用户' : '你';
                let cleanText = c.text;

                // 兼容老数据的文本清理
                if (c.senderId === 'user' && !c.replyToId && cleanText.startsWith('回复 ')) {
                    const contactName = STATE.contacts.find(ct => ct.id === contactId)?.name || "未知";
                    cleanText = cleanText.replace(`回复 ${contactName}: `, '').replace(`回复 ${contactName}:`, '');
                }
                
                if (c.senderId !== 'user') {
                    cleanText = cleanText.replace(/<(?:think|thinking|thought)[^>]*>[\s\S]*?(?:<\/(?:think|thinking|thought)>|$)/gi, '').trim();
                }
                return `${name}: ${cleanText}`;
            }).join('\n');

            const hasImage = m.image ? "[附带了一张图片]" : "";
            const isCharacterOwnMoment = String(m.authorId || 'user') === String(contactId);
            const momentDescription = isCharacterOwnMoment
                ? `这是你自己此前发布的动态：“${m.text}”`
                : `用户此前发布的动态：“${m.text}”`;

            // ★ 角色动态与用户动态共用注入计数，但明确作者身份，避免模型把自己的帖子认成用户发言。
            contextText += `\n--- 动态 ${index + 1} ---\n${momentDescription} ${hasImage}\n`;
            if (chatThread) {
                contextText += `[评论区互动]:\n${chatThread}\n`;
            } else {
                contextText += `(暂无评论互动)\n`;
            }
        });

        return { 
            prompt: contextText, 
            momentIds: idsToUpdate,
            turnId: currentTurnId 
        };
    },








    /* ----------------------- 朋友圈结束 --------------- */






    

    bindEvents() {
        // --- Tab 切换 (便签切换小工具) ---
        // 移到这里是为了确保 DOM 元素已经存在，并且逻辑统一管理
        document.querySelectorAll('.tab-item').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                item.classList.add('active');
                const pane = document.getElementById(target);
                if(pane) pane.classList.add('active');
            });
        });

        // --- 输入与发送 ---
        if(UI.els.input) {
            UI.els.input.style.overflowY = 'hidden'; 
            UI.els.input.addEventListener('input', function() {
                this.style.height = 'auto'; 
                this.style.height = (this.scrollHeight) + 'px';
                if (this.value === '') this.style.height = '38px';
            });
            UI.els.input.onkeydown = (e) => {
                const isMobile = window.innerWidth < 800;
                if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                    e.preventDefault(); 
                    App.handleSend(false);
                }
            };
        }

        if(UI.els.sendBtn) UI.els.sendBtn.onclick = () => this.handleSend(false);
        if(UI.els.rerollBtn) UI.els.rerollBtn.onclick = () => this.handleSend(true);

        // ★★★★★ 后台回复接收：切回前台自动补查 START ★★★★★
        // 手机浏览器切后台后，JS 定时器/fetch 经常会被暂停或中断；
        // 切回页面时主动查一次 pending job，避免回复已经生成但聊天页还停在旧状态。
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.scheduleAsyncBackendResumeCheck(300);
            }
        });
        window.addEventListener('pageshow', () => {
            this.scheduleAsyncBackendResumeCheck(300);
            this.maybeGenerateCharacterMoment('pageshow');
        });
        // ★★★★★ 后台回复接收：切回前台自动补查 END ★★★★★

        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            // 1. 先解绑之前的事件 (防止重复绑定，虽不是必须但为了保险)
            backBtn.onclick = null; 
            
            // 2. 重新绑定
            backBtn.addEventListener('click', () => {
                console.log("[调试] 点击了聊天返回按钮");
                // ★ 桌面也能直进聊天：从哪里进来，就回哪里。
                safeSwitchView(this.getReturnView('chat', 'contact-list')); 
            });
        };

        // --- 主设置弹窗 ---
        const mainSetBtn = document.getElementById('main-settings-btn');
        if(mainSetBtn) mainSetBtn.onclick = () => this.openSettings();
        const mainCancel = document.getElementById('main-cancel');
        if(mainCancel) mainCancel.onclick = () => UI.els.mainModal.classList.add('hidden');
        const mainConfirm = document.getElementById('main-confirm');
        if(mainConfirm) mainConfirm.onclick = () => this.saveSettingsFromUI();
        if(UI.els.fetchBtn) UI.els.fetchBtn.onclick = () => this.fetchModelsForUI();

        // ==================== 拉取模型后的选择弹窗 ====================
        // 搜索框只负责本次弹窗内的筛选，不复用主设置里的已选模型值。
        const modelPickerOverlay = document.getElementById('model-picker-modal-overlay');
        const modelPickerInput = document.getElementById('model-picker-input');
        const modelPickerClose = document.getElementById('model-picker-close');
        const modelPickerUseInput = document.getElementById('model-picker-use-input');

        if (modelPickerInput) {
            modelPickerInput.addEventListener('input', () => {
                this.renderModelPickerList(modelPickerInput.value);
            });

            modelPickerInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.useModelPickerInput();
                } else if (event.key === 'Escape') {
                    this.closeModelPicker();
                }
            });
        }

        if (modelPickerUseInput) {
            modelPickerUseInput.addEventListener('click', () => this.useModelPickerInput());
        }

        if (modelPickerClose) {
            modelPickerClose.addEventListener('click', () => this.closeModelPicker());
        }

        if (modelPickerOverlay) {
            modelPickerOverlay.addEventListener('click', (event) => {
                if (event.target === modelPickerOverlay) this.closeModelPicker();
            });
        }
        // ==================== 拉取模型后的选择弹窗结束 ====================

        // =========== 【新增】测试API按钮事件 ===========
        const testApiBtn = document.getElementById('test-api-btn');
        if (testApiBtn) {
            testApiBtn.onclick = () => this.handleTestConnection();
        }

        // =============================================

        // --- ★★★ 世界书弹窗事件绑定 ★★★ --
        const wiClose = document.getElementById('wi-close-btn');
        if(wiClose) wiClose.onclick = () => UI.els.wiModal.classList.add('hidden');
        
        const wiSave = document.getElementById('wi-save-btn');
        if(wiSave) wiSave.onclick = () => this.saveWorldInfoEntry();
        
        const wiDel = document.getElementById('wi-delete-btn');
        if(wiDel) wiDel.onclick = () => this.deleteWorldInfoEntry();

        const wiAdd = document.getElementById('wi-add-btn');
        if(wiAdd) wiAdd.onclick = () => this.clearWorldInfoEditor();

        // 书本操作
        const wiBookSel = document.getElementById('wi-book-select');
        if(wiBookSel) wiBookSel.onchange = (e) => this.switchWorldInfoBook(e.target.value);
        
        const wiBookScopeBtn = document.getElementById('wi-book-scope-btn');
        if(wiBookScopeBtn) wiBookScopeBtn.onclick = () => this.openWorldbookScopeModal();

        const wiScopeSave = document.getElementById('wi-scope-save-btn');
        if(wiScopeSave) wiScopeSave.onclick = () => this.saveWorldbookScopeModal();

        const wiScopeCancel = document.getElementById('wi-scope-cancel-btn');
        if(wiScopeCancel) wiScopeCancel.onclick = () => document.getElementById('modal-worldbook-scope')?.classList.add('hidden');

        const wiScopeModal = document.getElementById('modal-worldbook-scope');
        if(wiScopeModal) {
            wiScopeModal.addEventListener('click', (e) => {
                if (e.target === wiScopeModal) wiScopeModal.classList.add('hidden');
            });
        }

        const wiNewBook = document.getElementById('wi-new-book-btn');
        if(wiNewBook) wiNewBook.onclick = () => this.createNewBook();

        const wiRenameBook = document.getElementById('wi-rename-book-btn');
        if(wiRenameBook) wiRenameBook.onclick = () => this.renameCurrentBook();

        const wiDelBook = document.getElementById('wi-delete-book-btn');
        if(wiDelBook) wiDelBook.onclick = () => this.deleteCurrentBook();
        
        const wiExportBook = document.getElementById('wi-export-book-btn');
        if(wiExportBook) wiExportBook.onclick = () => this.exportCurrentBook();

        const wiImportBtn = document.getElementById('wi-import-btn');
        const wiFileInput = document.getElementById('wi-file-input');
        if (wiImportBtn && wiFileInput) {
            wiImportBtn.onclick = () => wiFileInput.click();
            wiFileInput.onchange = (e) => this.handleImportWorldInfo(e.target.files[0]);
        }

        // 日夜模式
        if (UI.els.themeLight) UI.els.themeLight.addEventListener('change', () => UI.toggleTheme('light'));
        if (UI.els.themeDark) UI.els.themeDark.addEventListener('change', () => UI.toggleTheme('dark'));

        // 壁纸
        const wpInput = document.getElementById('wallpaper-file-input');
        if(wpInput) {
            wpInput.onchange = async (e) => {
                if(e.target.files[0]) {
                    const base64 = await this.readFile(e.target.files[0]);
                    document.getElementById('wallpaper-preview-img').src = base64;
                    document.getElementById('wallpaper-preview').classList.remove('hidden');
                }
            };
        }

        // 角色编辑
        const addBtn = document.getElementById('add-contact-btn');
        if(addBtn) addBtn.onclick = () => this.openEditModal(null);
        const chatSetBtn = document.getElementById('chat-settings-btn');
        if(chatSetBtn) chatSetBtn.onclick = () => this.openEditModal(STATE.currentContactId);
        
        const modalCancel = document.getElementById('modal-cancel');
        if(modalCancel) modalCancel.onclick = () => document.getElementById('modal-overlay').classList.add('hidden');
        const modalSave = document.getElementById('modal-save');
        if(modalSave) modalSave.onclick = () => { this.saveContactFromModal(); document.getElementById('modal-overlay').classList.add('hidden'); };
        
        // 找到原来写 modalDel.onclick 的地方，整个替换成下面这一段：

        const modalDel = document.getElementById('modal-delete');
        if (modalDel) {
            // 先解绑可能存在的旧事件（可选，视具体逻辑而定，但加上更保险）
            modalDel.onclick = null; 

            modalDel.onclick = async () => {
                if (confirm('删除角色？')) {
                    // 1. 从数据中过滤掉该角色
                    STATE.contacts = STATE.contacts.filter(c => c.id !== this.editingId);
                    await Storage.saveContacts();

                    // 2. 隐藏弹窗
                    document.getElementById('modal-overlay').classList.add('hidden');
                    
                    // 3. 判断逻辑
                    // 如果删除的是当前正在聊的人，就模拟点击“返回”按钮回到列表
                    if (STATE.currentContactId === this.editingId) {
                        const backBtn = document.getElementById('back-btn');
                        if (backBtn) {
                            backBtn.click(); // 这会自动触发你之前绑定的 safeSwitchView('contact-list')
                        } else {
                            // 如果万一没找到按钮，就直接强制切换视图
                            if (typeof safeSwitchView === 'function') safeSwitchView(this.getReturnView('chat', 'contact-list'));
                            else if (typeof UI.switchView === 'function') UI.switchView('contact-list');
                        }
                    } else {
                        // 如果删除的不是当前聊的人，只需要刷新一下列表即可
                        // 兼容两种写法：
                        if (typeof this.renderContacts === 'function') {
                            this.renderContacts();
                        } else if (typeof UI !== 'undefined' && typeof UI.renderContacts === 'function') {
                            UI.renderContacts();
                        }
                    }
                }
            };
        }

        
        const modalClear = document.getElementById('modal-clear-history');
        if(modalClear) modalClear.onclick = async () => {
            if(confirm('清空聊天记录？')) {
                const c = STATE.contacts.find(x => x.id === this.editingId);
                if(c) { c.history = []; await Storage.saveContacts(); }
                document.getElementById('modal-overlay').classList.add('hidden');
                if(STATE.currentContactId === this.editingId) UI.renderChatHistory(c);
            }
        };

        // 头像上传
        this.bindImageUpload('edit-avatar-file', 'edit-avatar-preview', 'edit-avatar'); 
        this.bindImageUpload('user-avatar-file', 'user-avatar-preview', null, async (base64) => {
            STATE.settings.USER_AVATAR = base64;
            await Storage.saveSettings();
            if(STATE.currentContactId) {
                const c = STATE.contacts.find(x => x.id === STATE.currentContactId);
                if(c) UI.renderChatHistory(c);
            }
        });
        const editUpBtn = document.getElementById('edit-avatar-upload-btn');
        if(editUpBtn) editUpBtn.onclick = () => document.getElementById('edit-avatar-file').click();
        const userUpBtn = document.getElementById('user-avatar-upload-btn');
        if(userUpBtn) userUpBtn.onclick = () => document.getElementById('user-avatar-file').click();

        // ============================================================
        // ★★★★★ 联系人列表长按 + 上下箭头排序 START ★★★★★
        // 这一段是事件入口：
        // - click：处理“完成”和上下箭头；
        // - touchstart/touchmove/touchend：手机端长按弹菜单，手指滑动则取消长按；
        // - mousedown/mouseup：电脑端也能按住鼠标触发同一个菜单。
        // 只绑定一次，避免每次打开设置/刷新列表后重复注册事件。
        // ============================================================
        if (UI.els.contactContainer && !UI.els.contactContainer.dataset.contactActionsBound) {
            UI.els.contactContainer.dataset.contactActionsBound = 'true';
            let contactLongPressTimer = null;
            let contactStartX = 0;
            let contactStartY = 0;
            const CONTACT_LONG_PRESS_DURATION = 380;

            // 联系人列表自己有长按菜单，所以先拦掉浏览器原生的复制/保存菜单
            UI.els.contactContainer.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });

            const clearContactLongPress = () => {
                if (contactLongPressTimer) {
                    clearTimeout(contactLongPressTimer);
                    contactLongPressTimer = null;
                }
            };

            UI.els.contactContainer.addEventListener('click', (event) => {
                // 排序模式顶部的“完成”：退出排序，回到普通联系人列表
                const doneBtn = event.target.closest('.contact-sort-done-btn');
                if (doneBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    STATE.isContactSortMode = false;
                    UI.renderContacts();
                    return;
                }

                // 上下箭头：只移动一格，移动逻辑交给 moveContactInList 统一处理
                const sortBtn = event.target.closest('.contact-sort-btn');
                if (!sortBtn) return;

                event.preventDefault();
                event.stopPropagation();
                this.moveContactInList(sortBtn.dataset.id, sortBtn.dataset.action === 'move-up' ? 'up' : 'down');
            });

            UI.els.contactContainer.addEventListener('touchstart', (event) => {
                const item = event.target.closest('.contact-item');
                if (!item || event.target.closest('.contact-sort-btn')) return;

                // 记录起点，用来判断用户是在“长按”还是在“滚动列表”
                contactStartX = event.touches[0].clientX;
                contactStartY = event.touches[0].clientY;
                contactLongPressTimer = setTimeout(() => {
                    event.preventDefault();
                    STATE.contactClickLocked = true;
                    this.showContactActionMenu(item.dataset.id);
                }, CONTACT_LONG_PRESS_DURATION);
            }, { passive: false });

            UI.els.contactContainer.addEventListener('touchmove', (event) => {
                if (!contactLongPressTimer) return;
                const dx = Math.abs(event.touches[0].clientX - contactStartX);
                const dy = Math.abs(event.touches[0].clientY - contactStartY);
                // 手指移动超过 10px 就当作滚动，不弹菜单
                if (dx > 10 || dy > 10) clearContactLongPress();
            }, { passive: true });

            UI.els.contactContainer.addEventListener('touchend', clearContactLongPress);
            UI.els.contactContainer.addEventListener('touchcancel', clearContactLongPress);

            UI.els.contactContainer.addEventListener('mousedown', (event) => {
                if (event.button !== 0) return;
                const item = event.target.closest('.contact-item');
                if (!item || event.target.closest('.contact-sort-btn')) return;

                // PC 端按住鼠标左键，也沿用同一个长按菜单
                contactLongPressTimer = setTimeout(() => {
                    STATE.contactClickLocked = true;
                    this.showContactActionMenu(item.dataset.id);
                }, CONTACT_LONG_PRESS_DURATION);
            });

            UI.els.contactContainer.addEventListener('mouseup', clearContactLongPress);
            UI.els.contactContainer.addEventListener('mouseleave', clearContactLongPress);
        }
        // ★★★★★ 联系人列表长按 + 上下箭头排序 END ★★★★★


        // --- 长按相关变量 (优化版) ---
        let longPressTimer = null;
        let startX = 0;
        let startY = 0;
        const LONG_PRESS_DURATION = 380;

        // 1. 触摸开始
        UI.els.chatMsgs.addEventListener('touchstart', e => {
            // 点击代码复制按钮时不启动消息长按菜单
            if (e.target.closest('.code-copy-btn')) return;

            // ★★★ 核心修改：同时获取 group 和 bubble ★★★
            const bubble = e.target.closest('.message-bubble'); // 用于定位
            const group = e.target.closest('.message-group');   // 用于获取索引

            // 如果点的不是一个消息组，或者用户正在选词，则不触发
            if (!group || window.getSelection().toString().length > 0) return;
            
            // 从 group 获取索引
            const msgIndex = parseInt(group.dataset.msgIndex);
            if (isNaN(msgIndex)) return;

            // 记录起始坐标
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            
            longPressTimer = setTimeout(() => {
                e.preventDefault();
                if (window.getSelection().toString().length > 0) return;
                
                // ★★★ 使用 bubble 的位置来弹出菜单，如果 bubble 存在的话 ★★★
                // 这样即使用户按在分割线上，也能在 group 的位置弹出菜单
                const rect = bubble ? bubble.getBoundingClientRect() : group.getBoundingClientRect();
                App.showMessageContextMenu(msgIndex, rect);

            }, LONG_PRESS_DURATION);

        }, { passive: false });

        // 2. 触摸移动 (这段逻辑不用改)
        UI.els.chatMsgs.addEventListener('touchmove', e => {
            if (!longPressTimer) return;
            const moveX = e.touches[0].clientX;
            const moveY = e.touches[0].clientY;
            if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }, { passive: true });

        // 3. 触摸结束 (这段逻辑不用改)
        UI.els.chatMsgs.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }, { passive: true });

        // 4. 桌面端鼠标长按 (应用相同的修改逻辑)
        UI.els.chatMsgs.addEventListener('mousedown', e => {
            if (e.button !== 0) return; 
            // 点击代码复制按钮时不启动消息长按菜单
            if (e.target.closest('.code-copy-btn')) return;

            // ★★★ 核心修改：同时获取 group 和 bubble ★★★
            const bubble = e.target.closest('.message-bubble'); // 用于定位
            const group = e.target.closest('.message-group');   // 用于获取索引

            if (!group) return;
            
            const msgIndex = parseInt(group.dataset.msgIndex);
            if (isNaN(msgIndex)) return;

            longPressTimer = setTimeout(() => {
                if (window.getSelection().toString().length > 0) return;
                
                // ★★★ 使用 bubble 或 group 的位置来弹出菜单 ★★★
                const rect = bubble ? bubble.getBoundingClientRect() : group.getBoundingClientRect();
                App.showMessageContextMenu(msgIndex, rect);
            }, LONG_PRESS_DURATION);
        });

        // 这两行不用改
        UI.els.chatMsgs.addEventListener('mouseup', () => clearTimeout(longPressTimer));
        UI.els.chatMsgs.addEventListener('mouseleave', () => clearTimeout(longPressTimer));


        // 日志
        // 1. 打开日志弹窗的按钮
        // 日志
        // 1. 打开日志弹窗的按钮
        document.getElementById('btn-show-log').addEventListener('click', async () => {
            const logModal = document.getElementById('log-display-modal');
            const logContent = document.getElementById('log-content');
            const logToken = document.getElementById('log-token-count');
            const escapeLogValue = value => App.escapeHtml(String(value ?? ''));
            const renderCacheDebugLog = debug => {
                if (!debug) return '';

                const historyWindow = debug.history_window || {};
                const triggeredNames = Array.isArray(debug.triggered_world_info) && debug.triggered_world_info.length
                    ? debug.triggered_world_info.map(entry => `${entry.book || '未命名世界书'} / ${entry.comment || '未命名条目'}`).join('；')
                    : '无';
                const constantNames = Array.isArray(debug.constant_world_info) && debug.constant_world_info.length
                    ? debug.constant_world_info.map(entry => `${entry.book || '未命名世界书'} / ${entry.comment || '未命名条目'}`).join('；')
                    : '无';
                const messageLines = Array.isArray(debug.message_summaries)
                    ? debug.message_summaries.map(item => `#${item.index} ${item.role} chars=${item.chars} hash=${item.hash}`).join('\n')
                    : '';

                return `
                    <details class="log-cache-debug">
                        <summary>缓存调试指纹</summary>
                        <div class="log-cache-debug-grid">
                            <div>稳定前缀：${escapeLogValue(debug.stable_prefix_hash)}（${escapeLogValue(debug.stable_message_count)} 条 message）</div>
                            <div>完整消息：${escapeLogValue(debug.full_messages_hash)}</div>
                            <div>本轮背景：${escapeLogValue(debug.dynamic_context_hash)}（${escapeLogValue(debug.dynamic_context_chars)} 字）</div>
                            <div>当前用户：${escapeLogValue(debug.original_user_hash)} / 最终 user：${escapeLogValue(debug.final_user_hash)}</div>
                            <div>插入方式：${escapeLogValue(debug.insert_mode)}</div>
                            <div>窗口范围：${escapeLogValue(historyWindow.startSeq ?? '未记录')} → ${escapeLogValue(historyWindow.latestSeq ?? '未记录')}</div>
                            <div>上下文窗口：${escapeLogValue(historyWindow.minContext ?? '未记录')} / ${escapeLogValue(historyWindow.maxContext ?? '未记录')}</div>
                            <div>附加请求体：${escapeLogValue(debug.extra_body_hash)}</div>
                            <div>常驻世界书：${escapeLogValue(constantNames)}</div>
                            <div>本轮世界书：${escapeLogValue(triggeredNames)}</div>
                        </div>
                        <pre class="log-cache-message-list">${escapeLogValue(messageLines || '无 message 摘要')}</pre>
                    </details>
                `;
            };
            
            // 从全局变量读取刚才 API 存进去的数据
            const latestMainLog = typeof API !== 'undefined' && typeof API.getLatestMainContextLog === 'function'
                ? await API.getLatestMainContextLog()
                : window.LAST_API_LOG;
            if (latestMainLog) {
                window.LAST_API_LOG = latestMainLog;
                const promptTokens = window.LAST_API_LOG.prompt_tokens ?? window.LAST_API_LOG.tokens ?? 0;
                const completionTokens = window.LAST_API_LOG.completion_tokens ?? 0;
                const totalTokens = window.LAST_API_LOG.total_tokens ?? promptTokens + completionTokens;
                const tokenSource = window.LAST_API_LOG.isEstimated ? '估算' : '真实';
                const apiSource = window.LAST_API_LOG.source === 'async-backend' ? '后台' : '直连';
                const hasPromptCacheUsage = window.LAST_API_LOG.has_prompt_cache_usage === true;
                const promptCacheHitTokens = window.LAST_API_LOG.prompt_cache_hit_tokens ?? 0;
                const promptCacheMissTokens = window.LAST_API_LOG.prompt_cache_miss_tokens ?? 0;
                const promptCacheHitRate = window.LAST_API_LOG.prompt_cache_hit_rate;
                const promptCacheRateText = Number.isFinite(promptCacheHitRate)
                    ? `${(promptCacheHitRate * 100).toFixed(2)}%`
                    : '暂无比例';
                const promptCacheText = hasPromptCacheUsage
                    ? `${promptCacheHitTokens} 命中 / ${promptCacheMissTokens} 未命中（${promptCacheRateText}）`
                    : '未返回';
                const historyWindow = window.LAST_API_LOG.history_window || {};
                const historyWindowStrategy = historyWindow.strategy || '未记录';
                const historyWindowStart = historyWindow.startIndex ? `第 ${historyWindow.startIndex} 条消息` : '未记录';
                const historyWindowCount = Number.isFinite(historyWindow.sentCount) ? historyWindow.sentCount : 0;
                const cacheDebugHtml = renderCacheDebugLog(window.LAST_API_LOG.request_cache_debug);

                logContent.innerText = window.LAST_API_LOG.content;

                // ★ 日志底部信息分栏：Token/缓存放左边，历史窗口放右边，减少竖向占用。
                logToken.innerHTML = `
                    <div class="log-token-grid">
                        <div class="log-token-column">
                            <div>来源：${apiSource}（${tokenSource} Token）</div>
                            <div>输入 Token：${promptTokens}</div>
                            <div>输出 Token：${completionTokens}</div>
                            <div>总 Token：${totalTokens}</div>
                            <div>缓存命中：${promptCacheText}</div>
                        </div>
                        <div class="log-token-column">
                            <div>历史窗口：${historyWindowStrategy}</div>
                            <div>窗口起点：${historyWindowStart}</div>
                            <div>发送历史：${historyWindowCount} 条</div>
                        </div>
                    </div>
                    ${cacheDebugHtml}
                `;
            } else {
                logContent.innerText = "本次会话尚未发送过消息，暂无日志。";

                logToken.innerHTML = `
                    <div class="log-token-grid">
                        <div class="log-token-column">
                            <div>输入 Token：0</div>
                            <div>输出 Token：0</div>
                            <div>总 Token：0</div>
                            <div>缓存命中：未返回</div>
                        </div>
                        <div class="log-token-column">
                            <div>历史窗口：未记录</div>
                            <div>窗口起点：未记录</div>
                            <div>发送历史：0 条</div>
                        </div>
                    </div>
                `;
            }
            
            logModal.classList.remove('hidden');
        });

        // 2. 关闭日志弹窗的按钮 (右上角 X)
        document.getElementById('btn-close-log').addEventListener('click', () => {
            document.getElementById('log-display-modal').classList.add('hidden');
        });

        // 3. (可选) 点击遮罩层也可以关闭
        document.getElementById('log-display-modal').addEventListener('click', (e) => {
            if (e.target.id === 'log-display-modal') {
                e.target.classList.add('hidden');
            }
        });




        // Gist Events
        const gistFind = document.getElementById('gist-find');
        if(gistFind) gistFind.onclick = () => CloudSync.findBackup();
        const gistCreate = document.getElementById('gist-create-and-backup');
        if(gistCreate) gistCreate.onclick = () => CloudSync.createBackup();
        const gistBackup = document.getElementById('gist-backup');
        if(gistBackup) gistBackup.onclick = () => CloudSync.updateBackup();
        const gistRestore = document.getElementById('gist-restore');
        if(gistRestore) gistRestore.onclick = () => CloudSync.restoreBackup();
        const gistIdInput = document.getElementById('gist-id-input');
        if(gistIdInput) gistIdInput.onchange = (e) => CloudSync.updateGistId(e.target.value);

        // =========================================
        // ★★★ 新增：导出聊天记录 (调试版) ★★★
        // =========================================
        const btnExportHistory = document.getElementById('btn-export-history');

        if (btnExportHistory) {
            btnExportHistory.addEventListener('click', () => {
                // --- 调试步骤 1: 检查当前是否有正在编辑的角色 ID ---
                // 使用 App.editingId 或 this.editingId，取决于你的代码结构
                const currentEditingId = App.editingId; 
                
                if (!currentEditingId) {
                    alert("导出失败：没有找到当前角色的 ID。请确保弹窗已正确打开。");
                    console.error("Export Error: this.editingId is", currentEditingId);
                    return;
                }
                console.log("准备导出，角色 ID:", currentEditingId);

                // --- 调试步骤 2: 尝试根据 ID 查找角色 ---
                const contact = STATE.contacts.find(c => c.id === currentEditingId);
                if (!contact) {
                    alert(`导出失败：在数据中找不到 ID 为 ${currentEditingId} 的角色。`);
                    console.error("Export Error: Contact not found for ID", currentEditingId);
                    return;
                }
                console.log("找到角色:", contact.name);

                try {
                    // 1. 准备数据 (确保 history 存在，如果不存在则使用空数组)
                    const historyData = contact.history || [];
                    const jsonStr = JSON.stringify(historyData, null, 2); // 格式化 JSON
                    
                    // 2. 创建下载链接
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${contact.name}_history_${new Date().toISOString().slice(0,10)}.json`;
                    
                    // 3. 触发下载
                    document.body.appendChild(a);
                    a.click();
                    
                    // 4. 清理
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    console.log("导出成功！");

                } catch (error) {
                    alert("导出时发生错误：" + error.message);
                    console.error("Export processing error:", error);
                }
            });
        }

        // =========================================
        // ★★★ 最终版：导入聊天记录 (触发文件选择) ★★★
        // =========================================
        const btnImportHistory = document.getElementById('btn-import-history');
        const fileInputHistory = document.getElementById('file-import-history');

        if (btnImportHistory && fileInputHistory) {
            // 点击“导入”按钮，就去触发隐藏的文件选择框
            btnImportHistory.addEventListener('click', () => {
                fileInputHistory.value = ''; // 清空，确保每次都能触发 change 事件
                fileInputHistory.click();
            });

            // 当用户选择了文件后
            fileInputHistory.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // 弹出确认框
                if (!confirm("⚠️ 警告：导入操作将【完全覆盖】当前角色的所有聊天记录，且无法撤销。\n\n确定要继续吗？")) {
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (event) => { // ★★★ 改为 async 异步函数 ★★★
                    try {
                        const jsonContent = JSON.parse(event.target.result);
                        
                        if (!Array.isArray(jsonContent)) {
                            throw new Error("文件格式错误：内容必须是JSON数组格式");
                        }

                        // 找到当前正在编辑的角色
                        // 使用 this.editingId 或 App.editingId
                        const contact = STATE.contacts.find(c => c.id === this.editingId);
                        
                        if (contact) {
                            // 1. 覆盖历史记录
                            contact.history = jsonContent;
                            
                            // 2. 保存到数据库
                            await Storage.saveContacts();
                            
                            // 3. 弹出成功提示
                            alert(`成功为角色 [${contact.name}] 导入 ${jsonContent.length} 条消息！`);
                            
                            // ===============================================
                            // ★★★【关键新增】刷新界面并关闭弹窗 ★★★
                            // ===============================================

                            // 4. 关闭弹窗
                            const modal = document.getElementById('modal-overlay');
                            if (modal) {
                                modal.classList.add('hidden');
                            }

                            // 5. 如果当前正在聊天的就是这个角色，则刷新聊天界面
                            if (STATE.currentContactId === this.editingId) {
                                // 调用你自己的渲染函数，把更新后的 contact 数据传进去
                                UI.renderChatHistory(contact); 
                                // 滚动到底部，显示最新的消息
                                UI.scrollToBottom();
                            }
                        } else {
                            throw new Error("找不到当前正在编辑的角色，导入失败。");
                        }
                    } catch (err) {
                        alert("导入失败：" + err.message);
                        console.error("Import Error:", err);
                    }
                };
                reader.readAsText(file);
            });
        }




        // --- 新增：外观相关事件监听 ---
        
        // (1) 监听主题 Radio 切换 (日间/夜间/自定义)
        const themeRadios = document.querySelectorAll('input[name="theme-select"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                UI.toggleTheme(e.target.value);
            });
        });

        // 模型页图片处理方式切换时立即显隐视觉设置，尚未点“确定”前不改已保存配置。
        const imageApiModeRadios = document.querySelectorAll('input[name="image-api-mode"]');
        imageApiModeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.syncImageApiModeUI());
        });

        // (2) 监听自定义模式底座切换：只切 body 类名，不影响用户输入的 CSS。
        const customBaseRadios = document.querySelectorAll('input[name="custom-base-theme"]');
        customBaseRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                STATE.settings.CUSTOM_BASE_THEME = e.target.value === 'light' ? 'light' : 'dark';
                // 选项本身只在自定义面板里，直接重应用外观才能像日间/夜间一样实时预览。
                UI.applyAppearance();
                Storage.saveSettings();
            });
        });

        // (3) 监听 CSS 输入框 (实时预览)
        const cssInput = document.getElementById('custom-css-input');
        if (cssInput) {
            cssInput.addEventListener('input', (e) => {
                const val = e.target.value;
                STATE.settings.CUSTOM_CSS = val; // 更新状态
                
                // 如果当前是自定义模式，实时注入样式
                if (STATE.settings.THEME === 'custom') {
                    const styleTag = document.getElementById('user-custom-css');
                    if (styleTag) {styleTag.textContent = this.prefixUserCss(val)};
                }
            });
            // 输入框失去焦点时保存，避免频繁写入数据库
            cssInput.addEventListener('blur', () => {
                Storage.saveSettings();
            });
        }

        // (4) 监听主题色 HSL 滑条：实时写 CSS 变量，失焦时再保存，避免拖动时频繁写库。
        const themeColorSliders = [
            document.getElementById('theme-color-h'),
            document.getElementById('theme-color-s'),
            document.getElementById('theme-color-l')
        ].filter(Boolean);

        themeColorSliders.forEach(slider => {
            slider.addEventListener('input', () => {
                STATE.settings.THEME_COLOR_H = parseInt(document.getElementById('theme-color-h')?.value, 10);
                STATE.settings.THEME_COLOR_S = parseInt(document.getElementById('theme-color-s')?.value, 10);
                STATE.settings.THEME_COLOR_L = parseInt(document.getElementById('theme-color-l')?.value, 10);
                UI.syncThemeColorControls(UI.getThemeColorSettings(STATE.settings));
            });

            slider.addEventListener('change', () => {
                Storage.saveSettings();
            });
        });

        // (4) 按钮事件：保存、删除、加载预设
        const saveCssBtn = document.getElementById('save-css-btn');
        if (saveCssBtn) saveCssBtn.addEventListener('click', () => this.handleSaveCssPreset());

        const delCssBtn = document.getElementById('del-css-btn');
        if (delCssBtn) delCssBtn.addEventListener('click', () => this.handleDeleteCssPreset());

        const cssSelect = document.getElementById('css-preset-select');
        if (cssSelect) {
            cssSelect.addEventListener('change', (e) => {
                if (e.target.value !== "") this.handleLoadCssPreset(e.target.value);
            });
        }
        
        // 别忘了在 init 或者打开设置弹窗时调用一次 UI.renderCssPresetMenu()
        // 建议加在 openSettings 函数里，或者 App.init 的最后



        /* ============================================================
        发图
        ============================================================ */
            
        // 1. 点击图标触发文件选择
        UI.els.uploadBtn.addEventListener('click', () => {
            UI.els.uploadInput.click();
        });

        // 2. 监听文件选择
        UI.els.uploadInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                // 压缩图片逻辑 (为了节省 Token 和 存储) - 这里先直接读 base64
                // 实际建议这里加一个压缩步骤，把图片压到 1024px 以下
                const base64 = await this.readFile(file);
                
                STATE.pendingImage = base64; // 存入状态
                
                // 显示预览
                UI.els.previewImg.src = base64;
                UI.els.previewContainer.style.display = 'block';
                UI.els.input.focus();
            }
        });

        // 3. 清除图片
        UI.els.clearImgBtn.addEventListener('click', () => {
            STATE.pendingImage = null;
            UI.els.uploadInput.value = ''; // 清空 input 防止选同一张不触发 change
            UI.els.previewContainer.style.display = 'none';
        });

        // --- 新增：绑定视觉设置区域的按钮 ---
        // 1. 测试视觉连接按钮
        if (UI.els.testVisionBtn) {
            UI.els.testVisionBtn.addEventListener('click', () => {
                this.handleVisionTestConnection();
            });
        }

        // 2. 拉取视觉模型按钮
        if (UI.els.fetchVisionBtn) {
            UI.els.fetchVisionBtn.addEventListener('click', () => {
                this.fetchVisionModelsForUI();
            });
        }

        // ★ 输入框自动增高已在 bindEvents 开头统一绑定，这里不能重复监听，否则每次输入都会强制布局两遍。

        // ★★★ 在这里加上视觉预设的按钮监听 ★★★
        if(UI.els.saveVisionPresetBtn) {
            UI.els.saveVisionPresetBtn.addEventListener('click', () => this.handleSaveVisionPreset());
        }
        if(UI.els.delVisionPresetBtn) {
            UI.els.delVisionPresetBtn.addEventListener('click', () => this.handleDeleteVisionPreset());
        }
        if(UI.els.visionPresetSelect) {
            UI.els.visionPresetSelect.addEventListener('change', () => this.handleLoadVisionPreset());
        }

        /* ==================结束发图============= */


        // ==========================================
        // 探索与朋友圈 (Moments) 相关事件绑定
        // ==========================================

        // 请把这段代码放在你的 bindEvents 函数里

        // 定义一个安全的辅助函数来调用你的 switchView
        // 假设你的 switchView 是写在全局，或者写在 App 对象里的
        const safeSwitchView = (viewName) => {
            console.log(`[调试] 准备切换到视图: ${viewName}`);
            // 如果你的 switchView 在 App 对象中，就用 UI.switchView
            // 如果在当前对象中，就用 UI.switchView
            // 如果是全局函数，直接用 switchView
            if (typeof UI.switchView === 'function') {
                UI.switchView(viewName);
            } else if (typeof App !== 'undefined' && typeof UI.switchView === 'function') {
                UI.switchView(viewName);
            } else if (typeof switchView === 'function') {
                switchView(viewName);
            } else {
                console.error("找不到 switchView 函数！请检查它的名字或位置。");
            }
        };

        this.bindEdgeSwipeBack?.();

        // ================= 1. 底部导航栏切换 =================
        document.getElementById('tab-desktop')?.addEventListener('click', () => {
            safeSwitchView('desktop');
        });

        document.getElementById('tab-chat')?.addEventListener('click', () => {
            safeSwitchView('contact-list');
        });

        document.getElementById('tab-explore')?.addEventListener('click', () => {
            safeSwitchView('explore');
        });

        // ★★★★★ 桌面 START：小组件点击与开关事件 ★★★★★
        document.getElementById('desktop-countdown-card')?.addEventListener('click', () => {
            safeSwitchView('countdown');
        });

        document.getElementById('desktop-signature-card')?.addEventListener('click', () => {
            this.saveDesktopSignature();
        });

        document.getElementById('desktop-todo-card')?.addEventListener('click', (event) => {
            if (event.target.closest('input[type="checkbox"]')) return;
            safeSwitchView('todo-plan');
        });

        document.getElementById('desktop-todo-list')?.addEventListener('change', (event) => {
            const checkbox = event.target.closest('input[type="checkbox"][data-id]');
            if (!checkbox) return;
            event.stopPropagation();
            this.toggleDesktopTodo(checkbox.dataset.id);
        });

        document.getElementById('desktop-recent-contacts')?.addEventListener('click', (event) => {
            const avatarBtn = event.target.closest('.desktop-recent-avatar[data-id]');
            if (!avatarBtn) return;
            this.enterChat(avatarBtn.dataset.id);
        });

        document.getElementById('desktop-recent-contacts-card')?.addEventListener('click', (event) => {
            // 头像本身仍然直达聊天；卡片空白处作为“联系人列表”入口。
            if (event.target.closest('.desktop-recent-avatar[data-id]')) return;
            safeSwitchView('contact-list');
        });

        document.getElementById('desktop-settings-card')?.addEventListener('click', () => {
            this.openSettings();
        });

        document.getElementById('desktop-sync-card')?.addEventListener('click', () => {
            this.handleDesktopCloudSync();
        });

        // ★★★★★ 桌面 START：互动日志热力图点击浮窗 ★★★★★
        document.getElementById('desktop-activity-grid')?.addEventListener('click', (event) => {
            const cell = event.target.closest('.desktop-activity-cell');
            if (!cell) return;
            event.stopPropagation();
            this.showDesktopActivityTip(cell);
        });

        document.addEventListener('click', (event) => {
            // 热力图浮窗只靠点击触发；点到别的小组件时顺手收起，手机端不会残留挡视线。
            if (!event.target.closest('.desktop-activity-card')) this.hideDesktopActivityTip();
        });
        // ★★★★★ 桌面 END：互动日志热力图点击浮窗 ★★★★★

        document.querySelector('.desktop-async-card')?.addEventListener('click', () => {
            safeSwitchView('async-backend');
        });

        document.getElementById('desktop-switch-world-sense')?.addEventListener('change', (event) => {
            this.toggleWorldSenseEnabled(event.target.checked).then(() => this.renderDesktopSwitches());
        });

        document.getElementById('desktop-switch-todo')?.addEventListener('change', (event) => {
            this.toggleTodoPlanInjectEnabled(event.target.checked).then(() => this.renderDesktopSwitches());
        });

        document.getElementById('desktop-switch-countdown')?.addEventListener('change', (event) => {
            this.toggleCountdownInjectEnabled(event.target.checked).then(() => this.renderDesktopSwitches());
        });

        document.getElementById('desktop-switch-async')?.addEventListener('change', (event) => {
            this.toggleAsyncBackendEnabled(event.target.checked).then(() => this.renderDesktopAsyncStatus());
        });

        document.getElementById('desktop-async-clear')?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.clearDesktopAsyncStatus();
        });
        // ★★★★★ 桌面 END：小组件点击与开关事件 ★★★★★

        // ================= 2. 探索页面 -> 点击进入朋友圈 =================
        const exploreMomentsBtn = document.getElementById('explore-moments-btn');
        if (exploreMomentsBtn) {
            exploreMomentsBtn.addEventListener('click', () => {
                console.log("[调试] 点击了朋友圈入口！");
                safeSwitchView('moments');
            });
        } else {
            console.warn("未找到 #explore-moments-btn 元素");
        }

        // ★★★★★ Agent：探索页入口 + 设置事件 START ★★★★★
        document.getElementById('explore-agent-btn')?.addEventListener('click', () => {
            safeSwitchView('agent');
        });

        document.getElementById('agent-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('agent', 'explore'));
        });

        document.getElementById('agent-settings-btn')?.addEventListener('click', () => {
            this.openAgentSettings();
        });

        document.getElementById('agent-list')?.addEventListener('change', (event) => {
            const input = event.target.closest('#agent-todo-manager-toggle');
            if (input) {
                this.toggleAgentTodoManagerEnabled(input.checked === true);
                return;
            }
            const heartNoteInput = event.target.closest('#agent-heart-note-manager-toggle');
            if (heartNoteInput) this.toggleAgentHeartNoteManagerEnabled(heartNoteInput.checked === true);
        });

        document.getElementById('agent-list')?.addEventListener('click', (event) => {
            if (!event.target.closest('[data-agent-log="context"]')) return;
            this.openAgentContextLogModal();
        });

        document.getElementById('agent-settings-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('modal-agent-settings')?.classList.add('hidden');
        });

        document.getElementById('agent-settings-save-btn')?.addEventListener('click', () => {
            this.saveAgentSettings();
        });

        document.getElementById('modal-agent-settings')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-agent-settings')) {
                document.getElementById('modal-agent-settings')?.classList.add('hidden');
            }
        });
        // ★★★★★ Agent：探索页入口 + 设置事件 END ★★★★★

        // ================= 3. 探索页面 -> 返回桌面 =================
        // ================= 后台运行服务与切屏回复接收：探索页入口 =================
        document.getElementById('explore-async-backend-btn')?.addEventListener('click', (event) => {
            safeSwitchView('async-backend');
        });
        document.getElementById('explore-async-reply-btn')?.addEventListener('click', (event) => {
            if (event.target.closest('.async-backend-switch')) return;
            safeSwitchView('async-reply');
        });
        // ★ 能力行整行可进入详情；开关本身仍只切换状态，不触发页面跳转。
        document.querySelectorAll('.async-backend-capability-row').forEach(row => {
            const openSettings = () => {
                safeSwitchView(row.dataset.targetView);
                STATE.returnViewByPage = STATE.returnViewByPage || {};
                STATE.returnViewByPage[row.dataset.targetView] = 'async-backend';
            };
            row.addEventListener('click', (event) => {
                if (!event.target.closest('.async-backend-switch')) openSettings();
            });
            row.addEventListener('keydown', (event) => {
                if (event.target === row && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openSettings();
                }
            });
        });

        // ★★★★★ 世界书：探索页 -> 独立世界书页面 START ★★★★★
        document.getElementById('explore-worldbook-btn')?.addEventListener('click', () => {
            safeSwitchView('worldbook');
        });

        document.getElementById('worldbook-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('worldbook', 'explore'));
        });
        // ★★★★★ 世界书：探索页 -> 独立世界书页面 END ★★★★★

        // ★★★★★ 世界感知：探索页入口 + 开关事件 START ★★★★★
        // 这里管两件事：
        // 1. 探索页点击“世界感知”这一行，进入详情页
        // 2. 探索页右侧总开关，直接控制是否启用第 4 段 system prompt
        document.getElementById('explore-world-sense-btn')?.addEventListener('click', (event) => {
            if (event.target.closest('.world-sense-menu-switch')) return;
            safeSwitchView('world-sense');
        });

        document.getElementById('async-backend-enable-toggle')?.addEventListener('change', (event) => {
            this.toggleAsyncBackendEnabled(event.target.checked);
        });

        document.getElementById('async-backend-reply-capability-toggle')?.addEventListener('change', (event) => {
            this.toggleAsyncBackendEnabled(event.target.checked);
        });

        document.getElementById('world-sense-enable-toggle')?.addEventListener('change', (event) => {
            this.toggleWorldSenseEnabled(event.target.checked);
        });
        // ★★★★★ 世界感知：探索页入口 + 开关事件 END ★★★★★

        // ★★★★★ 探索 TO DO / 倒数日：入口 + 开关事件 START ★★★★★
        document.getElementById('explore-todo-plan-btn')?.addEventListener('click', (event) => {
            if (event.target.closest('.todo-menu-switch')) return;
            safeSwitchView('todo-plan');
        });

        document.getElementById('explore-countdown-btn')?.addEventListener('click', (event) => {
            if (event.target.closest('.todo-menu-switch')) return;
            safeSwitchView('countdown');
        });

        document.getElementById('explore-character-schedule-btn')?.addEventListener('click', () => {
            safeSwitchView('character-schedule');
        });

        document.getElementById('explore-character-memory-btn')?.addEventListener('click', () => {
            safeSwitchView('character-memory');
        });

        document.getElementById('explore-heart-note-btn')?.addEventListener('click', (event) => {
            if (event.target.closest('.heart-note-menu-switch')) return;
            safeSwitchView('heart-note');
        });

        document.getElementById('heart-note-enable-toggle')?.addEventListener('change', (event) => {
            this.toggleAgentHeartNoteManagerEnabled(event.target.checked === true);
        });

        document.getElementById('todo-plan-enable-toggle')?.addEventListener('change', (event) => {
            this.toggleTodoPlanInjectEnabled(event.target.checked);
        });

        document.getElementById('countdown-enable-toggle')?.addEventListener('change', (event) => {
            this.toggleCountdownInjectEnabled(event.target.checked);
        });

        document.getElementById('todo-plan-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('todo-plan', 'explore'));
        });

        document.getElementById('countdown-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('countdown', 'explore'));
        });

        document.getElementById('character-schedule-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('character-schedule', 'explore'));
        });

        document.getElementById('character-schedule-detail-back-btn')?.addEventListener('click', () => {
            safeSwitchView('character-schedule');
        });

        document.getElementById('character-memory-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('character-memory', 'explore'));
        });

        document.getElementById('character-memory-detail-back-btn')?.addEventListener('click', () => {
            safeSwitchView('character-memory');
        });

        document.getElementById('heart-note-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('heart-note', 'explore'));
        });

        document.getElementById('heart-note-detail-back-btn')?.addEventListener('click', () => {
            safeSwitchView('heart-note');
        });

        document.getElementById('heart-note-contact-list')?.addEventListener('click', (event) => {
            const item = event.target.closest('.heart-note-contact');
            if (item?.dataset.id) this.openHeartNoteDetail(item.dataset.id);
        });

        document.querySelectorAll('.heart-note-tab').forEach(btn => {
            btn.addEventListener('click', () => this.setHeartNoteViewMode(btn.dataset.mode));
        });

        document.getElementById('heart-note-add-btn')?.addEventListener('click', () => this.openHeartNoteModal());
        document.getElementById('heart-note-inject-days')?.addEventListener('change', () => this.saveHeartNoteInjectDays());
        document.getElementById('heart-note-detail-list')?.addEventListener('click', (event) => {
            const action = event.target.closest('[data-action]');
            const card = action?.closest('.heart-note-card');
            if (!action || !card?.dataset.id) return;
            if (action.dataset.action === 'toggle-heart-note-star') this.toggleHeartNoteStar(card.dataset.id);
            if (action.dataset.action === 'edit-heart-note') this.openHeartNoteModal(card.dataset.id);
            if (action.dataset.action === 'cancel-heart-note') this.toggleHeartNoteCancelled(card.dataset.id);
            if (action.dataset.action === 'delete-heart-note') this.deleteHeartNoteItem(card.dataset.id);
        });
        document.getElementById('heart-note-item-cancel-btn')?.addEventListener('click', () => this.closeHeartNoteModal());
        document.getElementById('heart-note-item-save-btn')?.addEventListener('click', () => this.saveHeartNoteItem());
        document.getElementById('modal-heart-note-item')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-heart-note-item')) this.closeHeartNoteModal();
        });

        document.getElementById('character-schedule-settings-btn')?.addEventListener('click', () => {
            this.openCharacterScheduleSettings();
        });

        document.getElementById('character-memory-settings-btn')?.addEventListener('click', () => {
            this.openCharacterMemorySettings();
        });

        document.getElementById('character-schedule-settings-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('modal-character-schedule-settings')?.classList.add('hidden');
        });

        document.getElementById('character-memory-settings-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('modal-character-memory-settings')?.classList.add('hidden');
        });

        document.getElementById('character-schedule-settings-save-btn')?.addEventListener('click', () => {
            this.saveCharacterScheduleSettings();
        });

        document.getElementById('character-memory-settings-save-btn')?.addEventListener('click', () => {
            this.saveCharacterMemorySettings();
        });

        document.getElementById('modal-character-schedule-settings')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-character-schedule-settings')) {
                document.getElementById('modal-character-schedule-settings')?.classList.add('hidden');
            }
        });

        document.getElementById('modal-character-memory-settings')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-character-memory-settings')) {
                document.getElementById('modal-character-memory-settings')?.classList.add('hidden');
            }
        });

        document.getElementById('todo-plan-add-btn')?.addEventListener('click', () => {
            this.openTodoPlanModal();
        });

        document.getElementById('countdown-add-btn')?.addEventListener('click', () => {
            this.openCountdownModal();
        });

        document.getElementById('todo-plan-cancel-btn')?.addEventListener('click', () => {
            this.closeTodoPlanModal();
        });

        document.getElementById('countdown-cancel-btn')?.addEventListener('click', () => {
            this.closeCountdownModal();
        });

        // 点击弹窗外部空白处，相当于点“取消”。
        // 和朋友圈操作菜单一样，只在点到遮罩层本身时关闭，点弹窗内容不受影响。
        document.getElementById('modal-todo-plan')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-todo-plan')) {
                this.closeTodoPlanModal();
            }
        });

        document.getElementById('modal-todo-time')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-todo-time')) {
                this.closeTodoTimeModal();
            }
        });

        document.getElementById('modal-countdown')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-countdown')) {
                this.closeCountdownModal();
            }
        });

        document.getElementById('todo-plan-save-btn')?.addEventListener('click', () => {
            this.saveTodoPlanFromModal();
        });

        document.getElementById('todo-time-save-btn')?.addEventListener('click', () => {
            this.saveTodoTimeFromModal();
        });

        document.getElementById('todo-time-cancel-btn')?.addEventListener('click', () => {
            this.closeTodoTimeModal();
        });

        document.getElementById('todo-time-clear-btn')?.addEventListener('click', () => {
            this.clearTodoTimeFromModal();
        });

        // ★★★ TODO 时间输入：手写胶囊 + 系统时间控件同步 START ★★★
        // 可见的是 text 输入框，手机上可以手动敲；隐藏的 time input 只负责呼出系统时间面板。
        [
            { textId: 'todo-time-start', pickerId: 'todo-time-start-picker' },
            { textId: 'todo-time-end', pickerId: 'todo-time-end-picker' }
        ].forEach(pair => {
            const textInput = document.getElementById(pair.textId);
            const pickerInput = document.getElementById(pair.pickerId);
            const pickerLabel = document.querySelector(`.todo-time-picker-btn[for="${pair.pickerId}"]`);
            if (!textInput || !pickerInput) return;

            textInput.addEventListener('input', () => {
                // 边输入边清理成数字/冒号，最多保留 HH:mm 的 5 位长度
                textInput.value = textInput.value.replace(/[^\d:]/g, '').slice(0, 5);
            });

            textInput.addEventListener('blur', () => {
                const normalized = this.normalizeTodoTimeValue(textInput.value);
                if (normalized) {
                    textInput.value = normalized;
                    pickerInput.value = normalized;
                }
            });

            pickerInput.addEventListener('change', () => {
                textInput.value = pickerInput.value;
            });

            pickerLabel?.addEventListener('click', () => {
                // 支持 showPicker 的浏览器直接弹系统时间盘；不支持时继续走 label 的原生触发。
                try {
                    pickerInput.showPicker?.();
                } catch (error) {
                    // 个别浏览器只允许用户手势触发，失败时交给 label 默认行为兜底。
                }
            });
        });
        // ★★★ TODO 时间输入：手写胶囊 + 系统时间控件同步 END ★★★

        document.getElementById('countdown-save-btn')?.addEventListener('click', () => {
            this.saveCountdownFromModal();
        });

        document.getElementById('todo-plan-prev-week')?.addEventListener('click', () => {
            STATE.todoPlanDraftDateOffset -= 7;
            this.renderTodoDatePicker('todo');
        });

        document.getElementById('todo-plan-next-week')?.addEventListener('click', () => {
            STATE.todoPlanDraftDateOffset += 7;
            this.renderTodoDatePicker('todo');
        });

        document.getElementById('countdown-prev-week')?.addEventListener('click', () => {
            STATE.countdownDraftDateOffset -= 7;
            this.renderTodoDatePicker('countdown');
        });

        document.getElementById('countdown-next-week')?.addEventListener('click', () => {
            STATE.countdownDraftDateOffset += 7;
            this.renderTodoDatePicker('countdown');
        });

        document.getElementById('todo-plan-month-label')?.addEventListener('click', () => {
            this.toggleTodoMonthPanel('todo');
        });

        document.getElementById('countdown-month-label')?.addEventListener('click', () => {
            this.toggleTodoMonthPanel('countdown');
        });

        document.getElementById('todo-plan-month-panel')?.addEventListener('click', (event) => {
            const yearBtn = event.target.closest('.todo-year-btn');
            const monthBtn = event.target.closest('.todo-month-option');
            if (yearBtn) this.shiftTodoMonthPanelYear('todo', yearBtn.dataset.action === 'next-year' ? 1 : -1);
            if (monthBtn) this.chooseTodoMonth('todo', Number(monthBtn.dataset.month));
        });

        document.getElementById('countdown-month-panel')?.addEventListener('click', (event) => {
            const yearBtn = event.target.closest('.todo-year-btn');
            const monthBtn = event.target.closest('.todo-month-option');
            if (yearBtn) this.shiftTodoMonthPanelYear('countdown', yearBtn.dataset.action === 'next-year' ? 1 : -1);
            if (monthBtn) this.chooseTodoMonth('countdown', Number(monthBtn.dataset.month));
        });

        document.getElementById('todo-plan-date-input')?.addEventListener('change', (event) => {
            STATE.todoPlanDraftDateOffset = Math.floor(TodoContext.diffDays(event.target.value) / 7) * 7;
            this.renderTodoDatePicker('todo');
        });

        document.getElementById('countdown-date-input')?.addEventListener('change', (event) => {
            STATE.countdownDraftDateOffset = Math.floor(TodoContext.diffDays(event.target.value) / 7) * 7;
            this.renderTodoDatePicker('countdown');
        });

        document.getElementById('todo-plan-week-row')?.addEventListener('click', (event) => {
            const chip = event.target.closest('.todo-date-chip');
            if (!chip) return;
            document.getElementById('todo-plan-date-input').value = chip.dataset.dateKey;
            this.renderTodoDatePicker('todo');
        });

        document.getElementById('countdown-week-row')?.addEventListener('click', (event) => {
            const chip = event.target.closest('.todo-date-chip');
            if (!chip) return;
            document.getElementById('countdown-date-input').value = chip.dataset.dateKey;
            this.renderTodoDatePicker('countdown');
        });

        document.getElementById('todo-plan-list')?.addEventListener('click', (event) => {
            const actionEl = event.target.closest('[data-action]');
            if (!actionEl) {
                const itemEl = event.target.closest('.todo-item');
                if (itemEl?.dataset.id) this.openTodoTimeModal(itemEl.dataset.id);
                return;
            }
            const groupEl = actionEl.closest('.todo-date-group');
            const itemEl = actionEl.closest('.todo-item');
            this.handleTodoPlanAction(actionEl.dataset.action, itemEl?.dataset.id, groupEl);
        });

        document.getElementById('character-schedule-list')?.addEventListener('click', (event) => {
            const itemEl = event.target.closest('.character-schedule-contact');
            if (!itemEl?.dataset.id) return;

            if (event.target.closest('.character-schedule-switch')) return;

            this.openCharacterScheduleDetail(itemEl.dataset.id);
        });

        document.getElementById('character-schedule-list')?.addEventListener('change', (event) => {
            const input = event.target.closest('.character-schedule-switch input');
            const itemEl = event.target.closest('.character-schedule-contact');
            if (!input || !itemEl?.dataset.id) return;
            this.toggleCharacterScheduleEnabled(itemEl.dataset.id, input.checked === true);
        });

        document.getElementById('character-memory-list')?.addEventListener('click', (event) => {
            const itemEl = event.target.closest('.character-memory-contact');
            if (!itemEl?.dataset.id) return;

            if (event.target.closest('.character-memory-switch')) return;

            this.openCharacterMemoryDetail(itemEl.dataset.id);
        });

        document.getElementById('character-memory-list')?.addEventListener('change', (event) => {
            const input = event.target.closest('.character-memory-switch input');
            const itemEl = event.target.closest('.character-memory-contact');
            if (!input || !itemEl?.dataset.id) return;
            this.toggleCharacterMemoryEnabled(itemEl.dataset.id, input.checked === true);
        });

        document.getElementById('character-memory-inject-days')?.addEventListener('input', (event) => {
            event.target.value = event.target.value.replace(/[^\d]/g, '');
        });

        document.getElementById('character-memory-inject-days')?.addEventListener('change', () => {
            this.saveCharacterMemoryInjectDays();
        });

        document.getElementById('character-schedule-detail-list')?.addEventListener('click', (event) => {
            const actionEl = event.target.closest('[data-action="edit-schedule-entry"]');
            const itemEl = event.target.closest('.character-schedule-entry');
            if (actionEl && itemEl?.dataset.id) this.openScheduleEntryModal(itemEl.dataset.id);
        });

        document.querySelectorAll('.character-memory-tab').forEach(btn => {
            btn.addEventListener('click', () => this.setCharacterMemoryViewMode(btn.dataset.mode));
        });

        document.getElementById('character-memory-detail-list')?.addEventListener('click', (event) => {
            const actionEl = event.target.closest('[data-action]');
            if (!actionEl) return;
            const cardEl = actionEl.closest('.character-memory-card');
            const itemEl = actionEl.closest('.character-memory-item');
            const dateKey = cardEl?.dataset.dateKey;
            if (!dateKey) return;

            if (actionEl.dataset.action === 'reroll-memory-day') {
                this.rerollCharacterMemoryDay(dateKey);
            } else if (actionEl.dataset.action === 'add-memory-item') {
                this.openAddMemoryItemModal(dateKey);
            } else if (actionEl.dataset.action === 'toggle-memory-pin' && itemEl?.dataset.id) {
                this.toggleMemoryItemPin(dateKey, itemEl.dataset.id);
            } else if (actionEl.dataset.action === 'edit-memory-item' && itemEl?.dataset.id) {
                this.openMemoryItemModal(dateKey, itemEl.dataset.id);
            } else if (actionEl.dataset.action === 'delete-memory-item' && itemEl?.dataset.id) {
                this.deleteMemoryItem(dateKey, itemEl.dataset.id);
            }
        });

        document.getElementById('character-schedule-refresh-btn')?.addEventListener('click', () => {
            if (!STATE.currentScheduleContactId) return;
            // ★ 手动刷新会覆盖今天现有的日程，先确认，避免用户误触后内容悄悄变化。
            if (!confirm('重新生成当日日程？')) return;
            this.generateCharacterSchedule(STATE.currentScheduleContactId, { silent: false });
        });

        document.getElementById('character-schedule-entry-cancel-btn')?.addEventListener('click', () => {
            this.closeScheduleEntryModal();
        });

        document.getElementById('character-schedule-entry-save-btn')?.addEventListener('click', () => {
            this.saveScheduleEntryFromModal();
        });

        document.getElementById('character-memory-item-cancel-btn')?.addEventListener('click', () => {
            this.closeMemoryItemModal();
        });

        document.getElementById('character-memory-item-save-btn')?.addEventListener('click', () => {
            this.saveMemoryItemFromModal();
        });

        document.getElementById('modal-character-schedule-entry')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-character-schedule-entry')) {
                this.closeScheduleEntryModal();
            }
        });

        document.getElementById('modal-character-memory-item')?.addEventListener('click', (event) => {
            if (event.target === document.getElementById('modal-character-memory-item')) {
                this.closeMemoryItemModal();
            }
        });

        document.getElementById('countdown-list')?.addEventListener('click', (event) => {
            const actionEl = event.target.closest('[data-action]');
            if (!actionEl) return;
            const itemEl = actionEl.closest('.countdown-item');
            this.handleCountdownAction(actionEl.dataset.action, itemEl?.dataset.id);
        });

        document.querySelectorAll('.countdown-tab').forEach(btn => {
            btn.addEventListener('click', () => this.setCountdownMode(btn.dataset.mode));
        });

        document.querySelectorAll('.countdown-modal-tab').forEach(btn => {
            btn.addEventListener('click', () => this.setCountdownModalMode(btn.dataset.mode));
        });
        // ★★★★★ 探索 TO DO / 倒数日：入口 + 开关事件 END ★★★★★

        document.getElementById('async-backend-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('async-backend', 'explore'));
        });
        document.getElementById('async-reply-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('async-reply', 'explore'));
        });
        document.getElementById('async-reply-save-btn')?.addEventListener('click', async () => {
            await this.saveAsyncReplySettings();
            safeSwitchView(this.getReturnView('async-reply', 'explore'));
        });
        document.getElementById('async-reply-cancel-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('async-reply', 'explore'));
        });

        // 保存：写入 STATE.settings，并通过 Storage.saveSettings() 存进 IndexedDB。
        document.getElementById('async-backend-save-btn')?.addEventListener('click', async () => {
            // ★ 保存后按来源返回：
            // 后台运行服务保存会写入 IndexedDB，这里把“保存 + 返回”合成一次点击。
            await this.saveAsyncBackendSettings();
            safeSwitchView(this.getReturnView('async-backend', 'explore'));
        });

        document.getElementById('async-backend-test-btn')?.addEventListener('click', () => {
            this.testAsyncBackendSettings();
        });

        document.getElementById('async-backend-clear-jobs-btn')?.addEventListener('click', () => {
            this.clearAsyncBackendPendingJobs();
        });

        // 取消：按来源返回，不保存输入框里尚未保存的内容。
        document.getElementById('async-backend-cancel-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('async-backend', 'explore'));
        });
        // ================= 后台回复接收：事件绑定结束 =================

        // ★★★★★ 世界感知：详情页事件绑定 START ★★★★★
        // 注意：
        // - 测试天气成功后会直接写入 IndexedDB
        // - 天气/节日两个分开关会即时保存，不再要求多点一次总保存
        // - 总保存只做兜底入库，天气状态栏不再显示“已保存”
        document.getElementById('world-sense-back-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('world-sense', 'explore'));
        });

        document.getElementById('world-sense-weather-test-btn')?.addEventListener('click', () => {
            this.testWorldSenseWeather();
        });

        document.getElementById('world-sense-weather-search-btn')?.addEventListener('click', () => {
            this.searchWorldSenseWeatherLocation();
        });

        document.getElementById('world-sense-weather-toggle')?.addEventListener('change', (event) => {
            if (!STATE.worldSenseDraft) STATE.worldSenseDraft = WorldSense.cloneDraftFromSettings();
            STATE.worldSenseDraft.weather.enabled = event.target.checked;
            this.persistWorldSenseDraft();
        });

        document.getElementById('world-sense-weather-city')?.addEventListener('input', (event) => {
            if (!STATE.worldSenseDraft) STATE.worldSenseDraft = WorldSense.cloneDraftFromSettings();
            const previousCity = WorldSense.normalizeCity(STATE.worldSenseDraft.weather.city);
            STATE.worldSenseDraft.weather.city = event.target.value;
            if (WorldSense.normalizeCity(event.target.value) !== previousCity) {
                // 城市文本一旦改动，旧候选地点就不能继续沿用，避免“输入上海、坐标还是成都”。
                STATE.worldSenseDraft.weather.location = null;
                STATE.worldSenseDraft.weather.cache = null;
                const hint = document.getElementById('world-sense-weather-location-hint');
                if (hint) hint.textContent = '城市已修改，请重新搜索并选择具体地点。';
            }
        });

        document.getElementById('world-sense-qweather-host')?.addEventListener('input', (event) => {
            if (!STATE.worldSenseDraft) STATE.worldSenseDraft = WorldSense.cloneDraftFromSettings();
            STATE.worldSenseDraft.weather.apiHost = event.target.value;
        });

        document.getElementById('world-sense-qweather-key')?.addEventListener('input', (event) => {
            if (!STATE.worldSenseDraft) STATE.worldSenseDraft = WorldSense.cloneDraftFromSettings();
            STATE.worldSenseDraft.weather.apiKey = event.target.value;
        });

        document.getElementById('world-sense-qweather-help-btn')?.addEventListener('click', () => {
            document.getElementById('qweather-tutorial-modal')?.classList.remove('hidden');
        });

        document.getElementById('qweather-tutorial-close-btn')?.addEventListener('click', () => {
            document.getElementById('qweather-tutorial-modal')?.classList.add('hidden');
        });

        document.getElementById('qweather-tutorial-modal')?.addEventListener('click', (event) => {
            if (event.target === event.currentTarget) event.currentTarget.classList.add('hidden');
        });

        document.getElementById('world-sense-location-cancel-btn')?.addEventListener('click', () => {
            this.closeWorldSenseLocationModal();
        });

        document.getElementById('world-sense-location-modal')?.addEventListener('click', (event) => {
            if (event.target === event.currentTarget) this.closeWorldSenseLocationModal();
        });

        document.getElementById('world-sense-location-candidates')?.addEventListener('click', (event) => {
            const button = event.target.closest('.world-sense-location-candidate');
            if (!button) return;
            this.selectWorldSenseLocation(Number(button.dataset.index));
        });

        document.getElementById('world-sense-festival-toggle')?.addEventListener('change', (event) => {
            if (!STATE.worldSenseDraft) STATE.worldSenseDraft = WorldSense.cloneDraftFromSettings();
            STATE.worldSenseDraft.festival.enabled = event.target.checked;
            this.persistWorldSenseDraft();
        });

        document.getElementById('world-sense-save-btn')?.addEventListener('click', async () => {
            // ★ 保存后按来源返回：
            // 世界感知的开关已经能即时保存，这里保留总保存按钮做兜底，并顺手收起详情页。
            await this.saveWorldSenseSettings();
            safeSwitchView(this.getReturnView('world-sense', 'explore'));
        });

        document.getElementById('world-sense-cancel-btn')?.addEventListener('click', () => {
            safeSwitchView(this.getReturnView('world-sense', 'explore'));
        });
        // ★★★★★ 世界感知：详情页事件绑定 END ★★★★★

        document.getElementById('explore-back-btn')?.addEventListener('click', () => {
            safeSwitchView('desktop');
        });

        // ================= 3. 朋友圈页面 -> 返回探索 =================
        document.getElementById('moments-back-btn')?.addEventListener('click', () => {
            if (STATE.momentsViewMode === 'profile') {
                this.showMomentsFeed();
                return;
            }
            safeSwitchView(this.getReturnView('moments', 'explore'));
        });

        // ================= 4. 朋友圈弹窗和交互 =================

        // 图片 先不要
        document.getElementById('btn-write-moment')?.addEventListener('click', () => {
            const modal = document.getElementById('modal-write-moment');
            if(modal) modal.classList.remove('hidden');
        });

        document.getElementById('btn-close-m-write')?.addEventListener('click', () => {
            const modal = document.getElementById('modal-write-moment');
            if(modal) modal.classList.add('hidden');
        });

        // ★★★ 修改后 (一定要改这里！) ★★★
        document.getElementById('moments-settings-btn')?.addEventListener('click', () => {
            // 调用 App.openMomentsSettings() 来填充数据并显示弹窗
            if (typeof this.openMomentsSettings === 'function') {
                this.openMomentsSettings(); 
            } else if (typeof App.openMomentsSettings === 'function') {
                App.openMomentsSettings();
            }
        });

        
        // ★★★ 确保保存按钮也绑定对了 ★★★
        document.getElementById('btn-save-m-settings')?.addEventListener('click', () => {
            if (typeof this.saveMomentsSettings === 'function') {
                this.saveMomentsSettings();
            } else if (typeof App.saveMomentsSettings === 'function') {
                App.saveMomentsSettings();
            }
        });


        // ★★★ 确保发布按钮绑定对了 ★★★
        document.getElementById('btn-publish-m-write')?.addEventListener('click', () => {
            if (typeof this.publishMoment === 'function') {
                this.publishMoment();
            } else if (typeof App.publishMoment === 'function') {
                App.publishMoment();
            }
        });

        document.getElementById('btn-close-m-settings')?.addEventListener('click', () => {
            const modal = document.getElementById('modal-moments-settings');
            if(modal) modal.classList.add('hidden');
        });

        // ★ 发帖和点赞概率共用同一套滑块/数字框同步逻辑，保存时再做最终夹取。
        const bindMomentProbabilityPair = (rangeId, inputId) => {
            const range = document.getElementById(rangeId);
            const input = document.getElementById(inputId);
            range?.addEventListener('input', () => {
                if (input) input.value = range.value;
            });
            input?.addEventListener('input', () => {
                const value = Math.max(0, Math.min(100, parseInt(input.value, 10) || 0));
                if (range) range.value = value;
            });
        };
        bindMomentProbabilityPair('m-setting-auto-probability-range', 'm-setting-auto-probability');
        bindMomentProbabilityPair('m-setting-auto-like-probability-range', 'm-setting-auto-like-probability');

        // ==========================================
        // 朋友圈头部交互 (修改背景、头像、签名)
        // ==========================================

        // 1. 点击背景图 -> 触发隐藏的文件选择框
        document.getElementById('moments-bg')?.addEventListener('click', () => {
            if (String(STATE.momentsProfileAuthorId || 'user') !== 'user') return;
            console.log("[调试] 点击了背景图");
            document.getElementById('m-bg-upload-input').click();
        });

        // 2. 监听背景图文件选择完成 -> 读取并替换图片
        document.getElementById('m-bg-upload-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                // 复用你原系统里的 readFile 函数 (将文件转为 Base64)
                const base64 = await this.readFile(file); 
                document.getElementById('moments-bg').src = base64;
                
                // 保存到 STATE 和 Storage
                STATE.momentsSettings.bgImage = base64;
                if(typeof Storage !== 'undefined' && Storage.saveMomentsSettings) {
                    Storage.saveMomentsSettings();
                }
            } catch (err) {
                console.error("读取背景图失败:", err);
            }
            // 清空 input，方便下次选同一张图
            e.target.value = ''; 
        });

        // 3. 公屏大头像进入我的主页；在我的主页内再点击才更换头像。
        document.getElementById('moments-avatar-button')?.addEventListener('click', () => {
            if (STATE.momentsViewMode !== 'profile') {
                this.openMomentProfile('user');
                return;
            }
            if (String(STATE.momentsProfileAuthorId || 'user') !== 'user') return;
            console.log("[调试] 点击了头像");
            document.getElementById('m-avatar-upload-input')?.click();
        });

        // 4. 监听头像文件选择完成 -> 读取并替换图片
        document.getElementById('m-avatar-upload-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const base64 = await this.readFile(file); 
                document.getElementById('moments-avatar').src = base64;
                
                // 保存到 STATE 和 Storage
                STATE.momentsSettings.avatar = base64;
                if(typeof Storage !== 'undefined' && Storage.saveMomentsSettings) {
                    Storage.saveMomentsSettings();
                }
            } catch (err) {
                console.error("读取头像图失败:", err);
            }
            e.target.value = ''; 
        });

        // 5. 点击个性签名 -> 弹出浏览器原生输入框修改
        document.getElementById('moments-signature')?.addEventListener('click', () => {
            if (String(STATE.momentsProfileAuthorId || 'user') !== 'user') return;
            console.log("[调试] 点击了签名");
            const currentSig = STATE.momentsSettings.signature || "写下你的个性签名...";
            const newSig = prompt("请输入新的个性签名：", currentSig);
            
            // 如果用户点了取消，或者输入为空，则不修改
            if (newSig !== null && newSig.trim() !== "") {
                document.getElementById('moments-signature').innerText = newSig.trim();
                STATE.momentsSettings.signature = newSig.trim();
                
                if(typeof Storage !== 'undefined' && Storage.saveMomentsSettings) {
                    Storage.saveMomentsSettings();
                }
            }
        });

        // 5-2. 点击用户名 -> 弹出修改框
        document.getElementById('moments-username')?.addEventListener('click', () => {
            if (String(STATE.momentsProfileAuthorId || 'user') !== 'user') return;
            console.log("[调试] 点击了用户名");
            // 获取当前名字，如果没有则用默认值
            const currentName = STATE.momentsSettings.username || "你的名字";
            const newName = prompt("请输入新的名字：", currentName);
            
            // 校验：不为空且用户没点取消
            if (newName !== null && newName.trim() !== "") {
                const trimmedName = newName.trim();
                // 1. 同步到 UI
                document.getElementById('moments-username').innerText = trimmedName;
                // 2. 同步到内存状态
                STATE.momentsSettings.username = trimmedName;
                
                // 3. 保存到本地存储
                if(typeof Storage !== 'undefined' && Storage.saveMomentsSettings) {
                    Storage.saveMomentsSettings();
                }
            }
        });

        // ==========================================
        // 发布朋友圈弹窗：上传图片与预览
        // ==========================================

        // 点击"添加图片"按钮 -> 触发隐藏的文件框
        document.getElementById('btn-m-upload-img')?.addEventListener('click', () => {
            document.getElementById('m-write-img-input').click();
        });

        // 监听文件选择完成 -> 显示预览图
        document.getElementById('m-write-img-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const base64 = await this.readFile(file); 
                const previewImg = document.getElementById('m-write-img-preview');
                previewImg.src = base64;
                previewImg.style.display = 'block'; // 显示图片
                
                // 可选：把按钮文字改成“重新选择图片”
                document.getElementById('btn-m-upload-img').innerText = "重新选择图片";
            } catch (err) {
                console.error("读取撰写图片失败:", err);
            }
        });

        // 点击取消时，清空输入框和预览图
        document.getElementById('btn-close-m-write')?.addEventListener('click', () => {
            const modal = document.getElementById('modal-write-moment');
            if(modal) modal.classList.add('hidden');
            
            // 清空数据，干干净净
            document.getElementById('m-write-text').value = '';
            document.getElementById('m-write-img-input').value = '';
            const previewImg = document.getElementById('m-write-img-preview');
            previewImg.src = '';
            previewImg.style.display = 'none';
            document.getElementById('btn-m-upload-img').innerText = "添加图片";
        });

        // ================= 5. 加载更多朋友圈 =================
        const loadMoreBtn = document.getElementById('btn-load-more-moments');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                console.log("[调试] 点击了加载更多！");
                
                // 改变一下按钮文字，给用户一个“正在加载”的反馈
                const originalText = loadMoreBtn.innerText;
                loadMoreBtn.innerText = "加载中...";
                loadMoreBtn.disabled = true; // 防止连续狂点

                // 调用你代码里的“加载更多”函数
                // ⚠️ 注意：请把 loadMoreMoments 换成你实际写好的函数名
                try {
                    if (typeof this.loadMoreMoments === 'function') {
                        this.loadMoreMoments();
                    } else if (typeof App !== 'undefined' && typeof App.loadMoreMoments === 'function') {
                        App.loadMoreMoments();
                    } else {
                        console.warn("找不到加载更多的函数！请检查函数名。");
                    }
                } finally {
                    // 假设你的加载是异步的，最好在你的 loadMoreMoments 函数执行完后再恢复按钮
                    // 这里做一个简单的延时恢复兜底
                    setTimeout(() => {
                        loadMoreBtn.innerText = originalText;
                        loadMoreBtn.disabled = false;
                    }, 1000); 
                }
            });
        }


        // ================= 6. 点击评论区角色名字打开菜单 =================
        const momentsFeed = document.getElementById('moments-feed');
        if (momentsFeed) {
            // ★ 核心替换：改为存入上下文并弹出菜单
            momentsFeed.addEventListener('click', (e) => {
                const momentAction = e.target.closest('[data-moment-action]');
                if (momentAction) {
                    const action = momentAction.dataset.momentAction;
                    if (action === 'profile') this.openMomentProfile(momentAction.dataset.authorId);
                    if (action === 'like') this.toggleMomentLike(momentAction.dataset.momentId);
                    if (action === 'comment') this.openMomentCommentComposer(momentAction.dataset.momentId);
                    return;
                }

                const senderButton = e.target.closest('.comment-sender-name');
                if (senderButton) {
                    const momentId = senderButton.getAttribute('data-moment-id');
                    const commentId = senderButton.getAttribute('data-comment-id');
                    const charId = senderButton.getAttribute('data-char-id');
                    const charName = senderButton.getAttribute('data-char-name');

                    console.log(`[调试] 点击了评论者: ${charName} (ID: ${charId})`);

                    // 记录当前点击的上下文信息
                    STATE.selectedCommentContext = { momentId, commentId, charId, charName };

                    // 弹出评论操作菜单
                    const actionModal = document.getElementById('modal-comment-actions');
                    if (actionModal) actionModal.classList.remove('hidden');
                }
            });
        }

        // ================= 新增：评论操作菜单的事件绑定 =================
        const commentActionModal = document.getElementById('modal-comment-actions');
        
        document.getElementById('btn-c-action-reply')?.addEventListener('click', () => {
            if (typeof this.openReplyModal === 'function') this.openReplyModal();
            else if (typeof App !== 'undefined' && typeof App.openReplyModal === 'function') App.openReplyModal();
        });
        document.getElementById('btn-c-action-copy')?.addEventListener('click', () => {
            if (typeof this.handleCommentAction === 'function') this.handleCommentAction('copy');
            else if (typeof App !== 'undefined' && typeof App.handleCommentAction === 'function') App.handleCommentAction('copy');
        });
        document.getElementById('btn-c-action-edit')?.addEventListener('click', () => {
            if (typeof this.handleCommentAction === 'function') this.handleCommentAction('edit');
            else if (typeof App !== 'undefined' && typeof App.handleCommentAction === 'function') App.handleCommentAction('edit');
        });
        document.getElementById('btn-c-action-regen')?.addEventListener('click', () => {
            if (typeof this.handleCommentAction === 'function') this.handleCommentAction('regen');
            else if (typeof App !== 'undefined' && typeof App.handleCommentAction === 'function') App.handleCommentAction('regen');
        });

        // ★★★ 新增：删除按钮的事件绑定 ★★★
        document.getElementById('btn-c-action-delete')?.addEventListener('click', () => {
            if (typeof this.handleCommentAction === 'function') this.handleCommentAction('delete');
            else if (typeof App !== 'undefined' && typeof App.handleCommentAction === 'function') App.handleCommentAction('delete');
        });
        
        // 取消按钮
        document.getElementById('btn-c-action-cancel')?.addEventListener('click', () => {
            if (commentActionModal) commentActionModal.classList.add('hidden');
        });

        // 点击菜单外部空白处关闭菜单
        if (commentActionModal) {
            commentActionModal.addEventListener('click', (e) => {
                if (e.target === commentActionModal) commentActionModal.classList.add('hidden');
            });
        }

        // ================= 新增：回复输入框的事件绑定 =================
        document.getElementById('btn-close-m-reply')?.addEventListener('click', () => {
            document.getElementById('modal-reply-comment').classList.add('hidden');
        });

        document.getElementById('btn-publish-m-reply')?.addEventListener('click', () => {
            // 调用发送逻辑
            if (typeof this.executeCommentReply === 'function') this.executeCommentReply();
            else if (typeof App !== 'undefined' && typeof App.executeCommentReply === 'function') App.executeCommentReply();
        });

        document.getElementById('btn-close-m-comment')?.addEventListener('click', () => {
            document.getElementById('modal-write-moment-comment')?.classList.add('hidden');
            STATE.composingMomentCommentId = null;
        });
        document.getElementById('btn-publish-m-comment')?.addEventListener('click', () => {
            this.publishMomentComment();
        });


        // ================= 7. 朋友圈内容长按操作 (编辑/复制/删除) =================
        let momentPressTimer = null;

        const clearMomentPressTimer = () => {
            if (momentPressTimer) {
                clearTimeout(momentPressTimer);
                momentPressTimer = null;
            }
        };

        if (momentsFeed) { // momentsFeed 是之前 document.getElementById('moments-feed')
            
            // 处理长按开始
            const handleTouchStart = (e) => {
                // 确保点击的是“朋友圈内容区域”，而不是评论区
                const contentEl = e.target.closest('.moment-content');
                if (!contentEl) return;

                // 向上找到这条朋友圈的父级卡片，提取 ID (假设渲染时带有 id="m-xxxxx")
                const cardEl = contentEl.closest('.moment-card');
                if (!cardEl) return;
                
                const momentId = cardEl.id.replace('m-', '');

                // 开启长按计时
                momentPressTimer = setTimeout(() => {
                    momentPressTimer = null; // 清空定时器
                    
                    // 1. 触发震动反馈（如果浏览器/手机支持）
                    // if (navigator.vibrate) navigator.vibrate(50);
                    
                    // 2. 记录当前被选中的朋友圈ID到全局状态
                    STATE.selectedMomentId = momentId;

                    // ★ 用户对自己和角色动态都使用同一套编辑/复制/删除面板。
                    document.getElementById('btn-m-action-edit')?.classList.remove('hidden');
                    document.getElementById('btn-m-action-delete')?.classList.remove('hidden');
                    
                    // 3. 弹出操作菜单
                    const actionModal = document.getElementById('modal-moment-actions');
                    if (actionModal) actionModal.classList.remove('hidden');

                }, 600); // 600毫秒算作长按
            };

            // 监听按下事件 (同时兼容移动端触摸和 PC 端鼠标)
            momentsFeed.addEventListener('touchstart', handleTouchStart, { passive: true });
            momentsFeed.addEventListener('mousedown', handleTouchStart);

            // 监听松开/移动事件，打断长按计时
            momentsFeed.addEventListener('touchend', clearMomentPressTimer);
            momentsFeed.addEventListener('touchmove', clearMomentPressTimer, { passive: true });
            momentsFeed.addEventListener('mouseup', clearMomentPressTimer);
            momentsFeed.addEventListener('mouseleave', clearMomentPressTimer);
            // ★ 卡片长按统一交给自定义操作面板，屏蔽浏览器自己的选中/复制菜单。
            momentsFeed.addEventListener('contextmenu', (event) => {
                if (event.target.closest('.moment-card')) event.preventDefault();
            });
            momentsFeed.addEventListener('selectstart', (event) => {
                if (event.target.closest('.moment-card')) event.preventDefault();
            });
        }

        // ================= 操作菜单的按钮点击事件 =================
        const actionModal = document.getElementById('modal-moment-actions');
        
        document.getElementById('btn-m-action-copy')?.addEventListener('click', () => {
            if (typeof this.handleMomentAction === 'function') this.handleMomentAction('copy');
        });
        document.getElementById('btn-m-action-edit')?.addEventListener('click', () => {
            if (typeof this.handleMomentAction === 'function') this.handleMomentAction('edit');
        });
        document.getElementById('btn-m-action-delete')?.addEventListener('click', () => {
            if (typeof this.handleMomentAction === 'function') this.handleMomentAction('delete');
        });
        
        // 取消按钮
        document.getElementById('btn-m-action-cancel')?.addEventListener('click', () => {
            if (actionModal) actionModal.classList.add('hidden');
        });



        // ================= 8. 点击空白处关闭长按操作菜单 =================
        const actionModalOverlay = document.getElementById('modal-moment-actions');
        if (actionModalOverlay) {
            actionModalOverlay.addEventListener('click', (e) => {
                // 判断点击的目标是不是遮罩层本身 (而不是里面的面板或按钮)
                if (e.target === actionModalOverlay) {
                    actionModalOverlay.classList.add('hidden');
                }
            });
        };



        /* ==================结束朋友圈============= */



        /* ==========搜索聊天记录 ===============*/
        const searchModalOverlay = document.getElementById('search-modal-overlay');

        // ★ 搜索弹窗也跟 message action 一样：只点外层遮罩时，当成点了“关闭/取消”。
        const closeSearchModal = () => {
            searchModalOverlay?.classList.add('hidden');
        };

        // 1. 打开搜索弹窗
        document.getElementById('btn-open-search').onclick = () => {
            searchModalOverlay?.classList.remove('hidden');
            document.getElementById('search-results-list').innerHTML = '<div style="text-align:center; color:gray; padding:20px;">请输入关键字或选择日期进行查找</div>';
            // 顺便关掉底层的设置弹窗，让视野更清晰
            document.getElementById('modal-overlay').classList.add('hidden'); 
        };

        // 2. 关闭搜索弹窗
        document.getElementById('btn-close-search').onclick = () => {
            closeSearchModal();
        };

        searchModalOverlay?.addEventListener('click', (event) => {
            if (event.target === searchModalOverlay) closeSearchModal();
        });

        // 3. 关键字搜索
        document.getElementById('btn-search-keyword').onclick = () => {
            const keyword = document.getElementById('search-keyword-input').value.trim().toLowerCase();
            const contact = STATE.contacts.find(c => c.id === STATE.currentContactId);
            const resultsContainer = document.getElementById('search-results-list');
            
            if (!contact || !keyword) return;
            
            resultsContainer.innerHTML = '';
            let found = false;

            contact.history.forEach((msg, index) => {
                // 过滤系统提示词，匹配用户或助手的消息
                if (msg.role !== 'system' && msg.content.toLowerCase().includes(keyword)) {
                    found = true;
                    
                    // ★ 1. 剔除用户搜索结果里的时间戳标记
                    let cleanMsgText = msg.content;
                    if (msg.role === 'user') {
                        cleanMsgText = cleanMsgText.replace(/^\[(?:[A-Z][a-z]{2}\.\d{1,2}|\d{4}-\d{2}-\d{2})\s\d{2}:\d{2}\]\s/, '');
                    }

                    // ★ 2. 把列表显示的 timestamp 转换为优雅格式
                    let displayTime = msg.timestamp || '未知时间';
                    
                    // 判断是不是旧格式 (例如 Dec.14 01:06)
                    const oldTimeMatch = displayTime.match(/^([A-Z][a-z]{2})\.(\d{1,2})\s(\d{2}:\d{2})$/);
                    if (oldTimeMatch) {
                        const monthMap = { 
                            "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", 
                            "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", 
                            "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12" 
                        };
                        const mm = monthMap[oldTimeMatch[1]];
                        const dd = String(oldTimeMatch[2]).padStart(2, '0');
                        const time = oldTimeMatch[3];

                        // ★★★ 修改这里：不补年份，直接显示 12-14 01:06 (当做旧记录的标志)
                        displayTime = `${mm}-${dd} ${time}`;
                    }

                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    const safeDisplayTime = this.escapeHtml(displayTime);
                    const safeCleanMsgText = this.escapeHtml(cleanMsgText);
                    div.innerHTML = `
                        <div class="search-result-date">${safeDisplayTime} - ${msg.role === 'user' ? '我' : 'TA'}</div>
                        <div class="search-result-text">${safeCleanMsgText}</div>
                    `;
                    
                    // 点击结果，触发跳转
                    div.onclick = () => executeJump(index, contact);
                    resultsContainer.appendChild(div);
                }
            });

            if (!found) resultsContainer.innerHTML = '<div style="text-align:center; color:gray; padding:20px;">未找到匹配的消息</div>';
        };

        // 替换原来的按日期查找逻辑
        document.getElementById('btn-search-date').onclick = () => {
            const dateVal = document.getElementById('search-date-input').value; // 格式本身就是 YYYY-MM-DD
            if (!dateVal) return;

            const contact = STATE.contacts.find(c => c.id === STATE.currentContactId);
            if (!contact) return;
            
            // 为了兼容你以前的旧记录，我们把 dateVal 转换成 Dec.14 格式作为备选项
            const dateObj = new Date(dateVal);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const oldFormatStr = `${months[dateObj.getMonth()]}.${String(dateObj.getDate()).padStart(2, '0')}`;



            // ★★★ 核心修复：按优先级查找 ★★★
            // 第1步：优先精确匹配新格式 (如 2027-04-01)
            let targetIndex = contact.history.findIndex(msg => 
                msg.timestamp && msg.timestamp.startsWith(dateVal)
            );

            // 第2步：如果新格式没找到，才去历史记录里找对应的老格式 (如 Apr.01)
            if (targetIndex === -1) {
                targetIndex = contact.history.findIndex(msg => 
                    msg.timestamp && msg.timestamp.startsWith(oldFormatStr)
                );
            }

            if (targetIndex !== -1) {
                executeJump(targetIndex, contact);
            } else {
                alert(`未找到 ${dateVal} 的聊天记录`);
            }
        };

        // 5. 执行跳转的核心方法 (加在代码某处)
        function executeJump(targetIndex, contact) {
            // 隐藏搜索弹窗
            closeSearchModal();
            
            // 进入跳转模式
            STATE.chatMode = 'jump';
            STATE.targetHighlightIndex = targetIndex;
            
            // 关键逻辑：往前后各加载 15 条，防止 DOM 卡顿
            STATE.jumpStartIndex = Math.max(0, targetIndex - CONFIG.CHAT_PAGE_SIZE);
            STATE.jumpEndIndex = Math.min(contact.history.length, targetIndex + CONFIG.CHAT_PAGE_SIZE);
            
            // 重新渲染聊天记录
            UI.renderChatHistory(contact);
            
            // 滚动到特定消息并高亮
            setTimeout(() => {
                const targetBubble = document.getElementById(`msg-bubble-${targetIndex}`);
                if (targetBubble) {
                    targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetBubble.classList.add('highlight-message');
                    // 高亮结束后移除类名
                    setTimeout(() => targetBubble.classList.remove('highlight-message'), 1500);
                }
            }, 100); // 稍微延迟等待DOM渲染完成
        }


        /* ============ 搜索聊天记录结束 ============*/




/* ============== 小眼睛key密码睁眼闭眼隐藏显示（通用版） ============*/
        // ==========================================
        // 插入到 App.bindEvents() 函数内部
        // ==========================================

        // 选中页面里所有的眼睛图标。
        // 以后新增密码框时，只要套上 .input-wrapper，并给 input 加 has-eye-icon，就会自动拥有显示/隐藏能力。
        const eyeIcons = document.querySelectorAll('.eye-icon');

        eyeIcons.forEach(icon => {
            icon.addEventListener('click', function() {
                // 找到当前被点击的图标所在的父容器
                const wrapper = this.closest('.input-wrapper');
                if (!wrapper) return;

                // 在父容器里找到对应的输入框和睁闭眼图标
                const input = wrapper.querySelector('input');
                const iconClosed = this.querySelector('.svg-eye-closed');
                const iconOpen = this.querySelector('.svg-eye-open');

                if (input && iconClosed && iconOpen) {
                    if (input.type === 'password') {
                        // 切换为明文
                        input.type = 'text';
                        // 隐藏闭眼，显示睁眼
                        iconClosed.style.display = 'none';
                        iconOpen.style.display = 'inline-block';
                    } else {
                        // 切换回密码
                        input.type = 'password';
                        // 显示闭眼，隐藏睁眼
                        iconClosed.style.display = 'inline-block';
                        iconOpen.style.display = 'none';
                    }
                }
            });
        });

        /* ===================小眼睛 key密码睁眼闭眼隐藏显示结束 ============*/













    },




    readFile(file) {
        return new Promise((r, j) => {
            const reader = new FileReader();
            reader.onload = e => r(e.target.result);
            reader.onerror = j;
            reader.readAsDataURL(file);
        });
    },

    // 这里我们直接从 input 输入框取值
    async handleTestConnection() {
        // 1. 获取 DOM 元素
        const urlInput = UI.els.settingUrl; // 假设你在 UI.els 里存了这个 input
        const keyInput = UI.els.settingKey;
        const modelInput = UI.els.settingModel;
        const statusEl = document.getElementById('test-api-status');
        const btn = document.getElementById('test-api-btn');

        if (!statusEl) return;

        // 2. 简单的校验
        const url = urlInput.value.trim();
        const key = keyInput.value.trim();
        const model = modelInput.value.trim();

        if (!url || !key) {
            statusEl.textContent = '请先填写地址和密钥';
            statusEl.className = 'status-failure';
            return;
        }

        // 3. 设置 UI 为“连接中”
        statusEl.textContent = '连接中...';
        statusEl.className = 'status-pending';
        btn.disabled = true;

        try {
            // 4. 调用 API 测试
            await API.testConnection(url, key, model);

            // 5. 成功
            statusEl.textContent = '已连接！';
            statusEl.className = 'status-success';
        } catch (err) {
            // 6. 失败
            console.error("API测试失败:", err);
            // 显示具体的错误代码，比如 "连接失败: 401 Unauthorized"
            statusEl.textContent = `连接失败: ${err.message}`;
            statusEl.className = 'status-failure';
        } finally {
            btn.disabled = false;
        }
    },

    // ==================== 拉取模型后的选择弹窗 ====================
    openModelPicker(models, targetInput, title) {
        const overlay = document.getElementById('model-picker-modal-overlay');
        const input = document.getElementById('model-picker-input');
        const titleEl = document.getElementById('model-picker-title');
        if (!overlay || !input || !targetInput) return;

        // 接口偶尔会返回重复项或空 id，这里先清洗，避免列表出现无效行。
        this.modelPickerModels = [...new Set(
            models
                .map(model => typeof model === 'string' ? model.trim() : '')
                .filter(Boolean)
        )];
        this.modelPickerTargetInput = targetInput;

        if (titleEl) titleEl.textContent = title || '选择模型';

        // ★ 核心：每次打开都清空搜索词，所以默认永远展示完整模型列表。
        input.value = '';
        this.renderModelPickerList('');
        overlay.classList.remove('hidden');

        requestAnimationFrame(() => input.focus());
    },

    closeModelPicker() {
        document.getElementById('model-picker-modal-overlay')?.classList.add('hidden');
    },

    renderModelPickerList(keyword = '') {
        const resultsEl = document.getElementById('model-picker-results');
        const countEl = document.getElementById('model-picker-count');
        if (!resultsEl) return;

        const allModels = Array.isArray(this.modelPickerModels) ? this.modelPickerModels : [];
        const normalizedKeyword = keyword.trim().toLowerCase();
        const filteredModels = normalizedKeyword
            ? allModels.filter(model => model.toLowerCase().includes(normalizedKeyword))
            : allModels;

        resultsEl.replaceChildren();
        if (countEl) {
            countEl.textContent = normalizedKeyword
                ? `${filteredModels.length} / ${allModels.length} 个模型`
                : `${allModels.length} 个模型`;
        }

        if (filteredModels.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'model-picker-empty';
            emptyEl.textContent = normalizedKeyword
                ? '返回列表中没有匹配项，可以直接使用上方输入的模型名称。'
                : '接口没有返回模型，可以在上方手动输入模型名称。';
            resultsEl.appendChild(emptyEl);
            return;
        }

        const currentModel = this.modelPickerTargetInput?.value?.trim();
        filteredModels.forEach(model => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'model-picker-result-item';

            const nameEl = document.createElement('span');
            nameEl.className = 'model-picker-result-name';
            nameEl.textContent = model;
            item.appendChild(nameEl);

            // 当前模型仍然显示在完整列表中，只做标记，不再拿它当筛选条件。
            if (model === currentModel) {
                const badge = document.createElement('span');
                badge.className = 'model-picker-current-badge';
                badge.textContent = '当前';
                item.appendChild(badge);
            }

            item.addEventListener('click', () => this.selectModelFromPicker(model));
            resultsEl.appendChild(item);
        });
    },

    selectModelFromPicker(model) {
        if (!this.modelPickerTargetInput || !model) return;

        this.modelPickerTargetInput.value = model;
        // 同时派发事件，兼容以后给模型输入框增加的联动逻辑。
        this.modelPickerTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
        this.modelPickerTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
        this.closeModelPicker();
    },

    useModelPickerInput() {
        const input = document.getElementById('model-picker-input');
        const model = input?.value.trim();
        if (!model) {
            input?.focus();
            return;
        }
        this.selectModelFromPicker(model);
    },
    // ==================== 拉取模型后的选择弹窗结束 ====================

    async fetchModelsForUI() {
        const url = UI.els.settingUrl.value.trim();
        const key = UI.els.settingKey.value.trim();
        if(!url || !key) return alert('请先填写地址和密钥');
        const btn = UI.els.fetchBtn;
        btn.textContent = '获取中...';
        btn.disabled = true;
        try {
            const data = await API.fetchModels(url, key);
            if (data.data && Array.isArray(data.data)) {
                const models = data.data.map(model => model?.id).filter(Boolean);
                this.openModelPicker(models, UI.els.settingModel, '选择文字模型');
            } else {
                alert('连接成功，但对方没有返回有效的模型列表，请手动输入。');
            }
        } catch (e) {
            console.error(e);
            alert('拉取失败，请手动输入模型名。');
        } finally {
            btn.textContent = '拉取模型';
            btn.disabled = false;
        }
    },

    // ============================================
    // ★ 新增函数 1：处理视觉 API 测试
    // ============================================
    async handleVisionTestConnection() {
        // 1. 获取输入值
        const urlInput = UI.els.settingVisionUrl;
        const keyInput = UI.els.settingVisionKey;
        const modelInput = UI.els.settingVisionModel;
        const statusEl = UI.els.visionStatus;
        const btn = UI.els.testVisionBtn;

        // 2. 智能获取参数
        // 如果视觉URL没填，通常不能测试，报错
        const url = urlInput.value.trim(); 
        // ★ 关键逻辑：如果视觉Key没填，自动使用主API的Key
        const key = keyInput.value.trim() || UI.els.settingKey.value.trim(); 
        const model = modelInput.value.trim();

        if (!url || !key) {
            statusEl.textContent = '请检查地址或密钥 (Key留空则尝试共用主Key)';
            statusEl.className = 'api-status-text status-error'; // 样式类名请根据你的CSS调整
            return;
        }

        // 3. UI 变更为“连接中”
        statusEl.textContent = '连接中...';
        statusEl.className = 'api-status-text status-pending';
        btn.disabled = true;

        try {
            // 4. ★直接复用你现有的 API.testConnection★
            await API.testConnection(url, key, model);

            statusEl.textContent = '视觉 API 连接成功！';
            statusEl.className = 'api-status-text status-success';
        } catch (err) {
            console.error("视觉API测试失败:", err);
            statusEl.textContent = `连接失败: ${err.message}`;
            statusEl.className = 'api-status-text status-error';
        } finally {
            btn.disabled = false;
        }
    },

    // ============================================
    // ★ 新增函数 2：处理视觉模型列表拉取
    // ============================================
    async fetchVisionModelsForUI() {
        // 1. 获取视觉部分的输入
        const url = UI.els.settingVisionUrl.value.trim();
        // 这里的 Key 做了一个小优化：如果视觉Key没填，就借用主Key
        const key = UI.els.settingVisionKey.value.trim() || UI.els.settingKey.value.trim();

        if(!url) return alert('请先填写视觉 API 地址');
        
        const btn = UI.els.fetchVisionBtn;
        // 记录一下按钮原来的字（虽然你下面直接写死 '拉取模型' 也行）
        btn.textContent = '获取中...';
        btn.disabled = true;

        try {
            // 2. 调用同一个 API 函数
            const data = await API.fetchModels(url, key);
            
            // 3. 文字和视觉模型共用选择弹窗，最终写回各自的模型输入框。
            if (data.data && Array.isArray(data.data)) {
                const models = data.data.map(model => model?.id).filter(Boolean);
                this.openModelPicker(models, UI.els.settingVisionModel, '选择视觉模型');
            } else {
                // 如果格式不对或者列表为空
                alert('连接成功，但对方没有返回有效的模型列表，请手动输入。');
            }

        } catch (e) {
            console.error(e);
            alert('拉取失败，请手动输入模型名。');
        } finally {
            // 4. 恢复按钮
            btn.textContent = '拉取模型';
            btn.disabled = false;
        }
    },


    bindImageUpload(inputId, imgId, inputUrlId, callback) {
        const el = document.getElementById(inputId);
        if(!el) return;
        el.onchange = async (e) => {
            if(e.target.files[0]) {
                const base64 = await this.readFile(e.target.files[0]);
                document.getElementById(imgId).src = base64;
                if(inputUrlId) document.getElementById(inputUrlId).value = base64;
                if(callback) callback(base64);
            }
        };
    },



    // ... fetchVisionModelsForUI() { ... } 结束的大括号后面, 

    // ============================================
    // ★ 新增函数 A：保存视觉预设
    // ============================================
    handleSaveVisionPreset() {
        // 1. 获取输入框的值
        const currentConfig = {
            url: UI.els.settingVisionUrl.value.trim(),
            key: UI.els.settingVisionKey.value.trim(),
            model: UI.els.settingVisionModel.value.trim(),
            prompt: UI.els.settingVisionPrompt.value.trim() // 把提示词也存进去
        };

        // 2. 校验
        if (!currentConfig.url) {
            return alert('请至少填写 API 地址');
        }

        // 3. 输入名称
        const name = prompt("请输入视觉预设名称：", "我的视觉配置 " + ((STATE.settings.VISION_PRESETS || []).length + 1));
        if (!name) return;

        // 4. 初始化数组（防止报错）
        if (!STATE.settings.VISION_PRESETS) STATE.settings.VISION_PRESETS = [];

        // 5. 检查重名覆盖
        const existingIndex = STATE.settings.VISION_PRESETS.findIndex(p => p.name === name);
        const newPreset = { name, ...currentConfig };

        if (existingIndex !== -1) {
            if(!confirm(`预设 "${name}" 已存在，是否覆盖？`)) return;
            STATE.settings.VISION_PRESETS[existingIndex] = newPreset;
        } else {
            STATE.settings.VISION_PRESETS.push(newPreset);
        }

        // 6. 保存设置并刷新UI
        Storage.saveSettings();
        UI.renderVisionPresetMenu(); // 调用刚才在UI里加的函数
        
        // 自动选中刚才保存的
        const newIndex = STATE.settings.VISION_PRESETS.findIndex(p => p.name === name);
        UI.els.visionPresetSelect.value = newIndex;
        
        alert('视觉预设已保存！');
    },

    // ============================================
    // ★ 新增函数 B：加载视觉预设
    // ============================================
    handleLoadVisionPreset() {
        const index = UI.els.visionPresetSelect.value;
        if (index === "") return; 

        const preset = STATE.settings.VISION_PRESETS[index];
        if (preset) {
            UI.els.settingVisionUrl.value = preset.url || '';
            UI.els.settingVisionKey.value = preset.key || '';
            UI.els.settingVisionModel.value = preset.model || '';
            UI.els.settingVisionPrompt.value = preset.prompt || ''; // 加载提示词
            
            // 简单的视觉反馈
            UI.els.settingVisionModel.style.transition = "background 0.3s";
            UI.els.settingVisionModel.style.background = "#e8f5e9";
            setTimeout(() => UI.els.settingVisionModel.style.background = "", 300);
        }
    },

    // ============================================
    // ★ 新增函数 C：删除发图视觉预设
    // ============================================
    handleDeleteVisionPreset() {
        const index = UI.els.visionPresetSelect.value;
        if (index === "") {
            return alert("请先选择一个要删除的预设");
        }

        const presetName = STATE.settings.VISION_PRESETS[index].name;
        if (confirm(`确定要删除视觉预设 "${presetName}" 吗？`)) {
            STATE.settings.VISION_PRESETS.splice(index, 1);
            Storage.saveSettings();
            UI.renderVisionPresetMenu();
            UI.els.visionPresetSelect.value = ""; // 重置为空
        }
    },

    // =============== 结束=====================



    
    
    openEditModal(id) {
        this.editingId = id;
        const modal = document.getElementById('modal-overlay');
        modal.classList.remove('hidden');

        // === 获取元素 ===
        const title = document.getElementById('modal-title');
        const iName = document.getElementById('edit-name');
        const iPrompt = document.getElementById('edit-prompt');
        const preview = document.getElementById('edit-avatar-preview');
        const userPreview = document.getElementById('user-avatar-preview');
        const presetSelect = document.getElementById('edit-char-preset');
        const systemPresetSelect = document.getElementById('edit-char-system-preset');
        
        // 【保留】：你的日志区域
        const logSection = document.getElementById('log-section');
        
        // 【新增】：聊天记录管理区域 (记得在 HTML 里加上 id="history-manager-section")
        const historySection = document.getElementById('history-manager-section');

        // 用户头像预览
        if(userPreview) userPreview.src = STATE.settings.USER_AVATAR || CONFIG.DEFAULT.USER_AVATAR;

        // === 预设下拉框填充 (保留原逻辑) ===
        presetSelect.innerHTML = '<option value="">-- 跟随全局默认设置 --</option>';
        const presets = STATE.settings.API_PRESETS || []; 
        presets.forEach(p => {
            const option = document.createElement('option');
            option.value = p.name; 
            option.textContent = `${p.name} (${p.model})`; 
            presetSelect.appendChild(option);
        });

        // === System Prompt 预设下拉框填充 ===
        // 空值代表“跟随主设置当前全局内容”，不绑定任何固定预设。
        if (systemPresetSelect) {
            systemPresetSelect.innerHTML = '<option value="">-- 跟随全局默认设置 --</option>';
            const systemPresets = STATE.settings.SYSTEM_PROMPT_PRESETS || [];
            systemPresets.forEach(p => {
                const option = document.createElement('option');
                option.value = p.name;
                option.textContent = p.name;
                systemPresetSelect.appendChild(option);
            });
        }

        if (id) {
            // ===========================
            //  编辑模式 (修改现有角色)
            // ===========================
            const c = STATE.contacts.find(x => x.id === id);
            
            title.innerText = '聊天菜单'; 
            iName.value = c.name;
            iPrompt.value = c.prompt || "";
            
            preview.src = c.avatar || './assets/images/char.jpg';
            presetSelect.value = c.linkedPresetName || "";
            if (systemPresetSelect) systemPresetSelect.value = c.linkedSystemPromptPresetName || "";
            
            // 显示危险按钮
            const btnDelete = document.getElementById('modal-delete');
            const btnClear = document.getElementById('modal-clear-history');
            if(btnDelete) btnDelete.style.display = 'block';
            if(btnClear) btnClear.style.display = 'block';

            // 显示日志按钮
            if (logSection) logSection.style.display = 'block';

            // 显示导入/导出按钮
            if (historySection) historySection.style.display = 'block';

            // 【新增】：只有在聊天界面点进来的编辑，才显示搜索按钮
            const searchSection = document.getElementById('search-history-section');
            if (searchSection) {
                searchSection.style.display = STATE.currentContactId ? 'block' : 'none';
            }

        } else {
            // ===========================
            //  新建模式 (创建新角色)
            // ===========================
            title.innerText = '新建角色';
            iName.value = '';
            iPrompt.value = '你是一个...';
            
            preview.src = './assets/images/char.jpg'; 
            presetSelect.value = "";
            if (systemPresetSelect) systemPresetSelect.value = "";
            
            // 隐藏危险按钮
            const btnDelete = document.getElementById('modal-delete');
            const btnClear = document.getElementById('modal-clear-history');
            if(btnDelete) btnDelete.style.display = 'none';
            if(btnClear) btnClear.style.display = 'none';

            // 隐藏日志按钮 
            if (logSection) logSection.style.display = 'none';

            // 隐藏导入/导出按钮
            if (historySection) historySection.style.display = 'none';

            // 【新增】：新建模式不显示搜索
            const searchSection = document.getElementById('search-history-section');
            if (searchSection) searchSection.style.display = 'none';
        }
    },

    async saveContactFromModal() {
        const name = document.getElementById('edit-name').value.trim() || '未命名';
        const prompt = document.getElementById('edit-prompt').value.trim();
        
        // 【关键修改】：不再找 edit-avatar 输入框，而是直接拿图片的 src
        // 这样无论是你上传的本地图片(Base64)，还是网络图片，都在这里面
        const avatar = document.getElementById('edit-avatar-preview').src;

        // 【保留】：获取下拉框选中的预设
        const linkedPresetName = document.getElementById('edit-char-preset').value;
        const linkedSystemPromptPresetName = document.getElementById('edit-char-system-preset')?.value || "";

        if (this.editingId) {
            // === 更新现有角色 ===
            const c = STATE.contacts.find(x => x.id === this.editingId);
            if (c) { 
                c.name = name; 
                c.avatar = avatar; 
                c.prompt = prompt; 
                
                // 保存预设绑定
                c.linkedPresetName = linkedPresetName; 
                c.linkedSystemPromptPresetName = linkedSystemPromptPresetName;
            }
        } else {
            // === 创建新角色 ===
            STATE.contacts.push({ 
                id: Date.now().toString(), 
                name, 
                avatar, 
                prompt, 
                history: [],
                presenceLastActiveAt: Date.now(),
                linkedPresetName: linkedPresetName,
                linkedSystemPromptPresetName: linkedSystemPromptPresetName
            });
        }

        // 保存到数据库
        await Storage.saveContacts();
        UI.renderContacts();
        
        // 如果当前正好在聊这个角色，刷新一下界面
        if (STATE.currentContactId === this.editingId) {
            const c = STATE.contacts.find(x => x.id === this.editingId);
            UI.updateChatHeader(c);
            UI.renderChatHistory(c);
        }

        // 关闭弹窗
        document.getElementById('modal-overlay').classList.add('hidden');
    },



    // ====================自定义请求体参数请求头参数预设请求体预设 ===========================

    async handleSaveRequestBodyPreset() {
        const name = prompt("请为当前请求体附加参数输入一个预设名称，例如：DeepSeek 高推理 / 空白");
        if (!name) return;

        const input = document.getElementById('custom-request-body-json');
        if (!input) return alert("找不到请求体附加参数输入框。");

        const rawJson = input.value.trim();

        // 允许保存空白预设
        // 只有不为空时才校验 JSON
        if (rawJson) {
            try {
                JSON.parse(rawJson);
            } catch (err) {
                alert("请求体附加参数不是合法 JSON，请检查格式。");
                console.error("请求体附加参数 JSON 解析失败:", err);
                return;
            }
        }

        if (!STATE.settings.REQUEST_BODY_PRESETS) {
            STATE.settings.REQUEST_BODY_PRESETS = [];
        }

        const preset = {
            name: name,
            body_json: rawJson
        };

        const existingIndex = STATE.settings.REQUEST_BODY_PRESETS.findIndex(p => p.name === name);

        if (existingIndex >= 0) {
            if (confirm(`请求体参数预设 "${name}" 已存在，确定要覆盖吗？`)) {
                STATE.settings.REQUEST_BODY_PRESETS[existingIndex] = preset;
            } else {
                return;
            }
        } else {
            STATE.settings.REQUEST_BODY_PRESETS.push(preset);
        }

        await Storage.saveSettings();

        if (typeof UI.renderRequestBodyPresetMenu === 'function') {
            UI.renderRequestBodyPresetMenu();
        }

        alert(`请求体参数预设 "${name}" 已保存`);
    },






    handleLoadRequestBodyPreset(value) {
        const input = document.getElementById('custom-request-body-json');
        if (!input) return;

        if (value === "") return;

        const presets = STATE.settings.REQUEST_BODY_PRESETS || [];
        const preset = presets[value];

        if (!preset) {
            console.warn("[Request Body Preset] 未找到对应预设:", value);
            return;
        }

        input.value = preset.body_json || "";

        console.log("[Request Body Preset] 已加载请求体参数预设:", {
            name: preset.name,
            body_json: preset.body_json || ""
        });
    },

    async handleDeleteRequestBodyPreset() {
        const select = document.getElementById('request-body-preset-select');
        if (!select) return;

        const index = select.value;

        if (index === "") {
            return alert("请先选择一个请求体参数预设。");
        }

        const presets = STATE.settings.REQUEST_BODY_PRESETS || [];
        const preset = presets[index];

        if (!preset) {
            return alert("没有找到这个请求体参数预设。");
        }

        if (confirm(`确定删除请求体参数预设 "${preset.name}" 吗？`)) {
            presets.splice(index, 1);
            STATE.settings.REQUEST_BODY_PRESETS = presets;

            await Storage.saveSettings();

            if (typeof UI.renderRequestBodyPresetMenu === 'function') {
                UI.renderRequestBodyPresetMenu();
            }

            alert(`请求体参数预设 "${preset.name}" 已删除`);
        }
    },


    // ====================自定义请求体参数请求头参数预设请求体预设结束 ===========================








    // ======================自定义css=============================

    // 1. 保存预设 (改为弹窗输入)
    handleSaveCssPreset() {
        const cssInput = document.getElementById('custom-css-input');
        const css = cssInput.value;

        if (!css) return alert('CSS 内容为空，无需保存');

        // ★★★ 这里改为弹窗输入 ★★★
        const name = prompt("请为当前样式起个名字 (如: 可爱小猫)");
        if (!name) return; // 用户点击取消或没输入

        // 确保数组存在
        if (!STATE.settings.CSS_PRESETS) STATE.settings.CSS_PRESETS = [];

        // 查重逻辑
        const existingIndex = STATE.settings.CSS_PRESETS.findIndex(p => p.name === name);
        if (existingIndex >= 0) {
            if(!confirm(`预设 "${name}" 已存在，要覆盖吗？`)) return;
            STATE.settings.CSS_PRESETS[existingIndex].css = css;
        } else {
            STATE.settings.CSS_PRESETS.push({ name: name, css: css });
        }

        Storage.saveSettings();
        UI.renderCssPresetMenu(); // 刷新下拉框
        alert(`样式预设 "${name}" 已保存！`);
    },

    // 2. 加载预设 (删除了对旧输入框的操作)
    handleLoadCssPreset(index) {
        const presets = STATE.settings.CSS_PRESETS;
        const preset = presets[index];
        
        if (preset) {
            // 填入 CSS 编辑框
            const cssInput = document.getElementById('custom-css-input');
            if(cssInput) cssInput.value = preset.css;

            // ★★★ 注意：我删除了原来填入 nameInput 的那行代码，因为 input 已经被删了 ★★★

            // 更新状态
            STATE.settings.CUSTOM_CSS = preset.css;
            
            // 立即生效
            if (STATE.settings.THEME === 'custom') {
                const styleTag = document.getElementById('user-custom-css');
                if (styleTag) styleTag.textContent = this.prefixUserCss(preset.css);
            }
            Storage.saveSettings();
        }
    },

    // 3. 删除预设 (删除了对旧输入框的操作)
    handleDeleteCssPreset() {
        const select = document.getElementById('css-preset-select');
        const index = select.value;

        if (index === "") return alert("请先选择一个要删除的预设");

        if (confirm("确定要删除这个样式预设吗？")) {
            STATE.settings.CSS_PRESETS.splice(index, 1);
            Storage.saveSettings();
            UI.renderCssPresetMenu();
            
            // 清空选择框
            select.value = "";
            
            // ★★★ 注意：我删除了原来清空 nameInput 的那行代码 ★★★
        }
    },

    /**
     * 为用户输入的CSS规则自动添加 'body.custom-mode' 前缀以提高权重
     * @param {string} rawCss 用户输入的原始CSS字符串
     * @returns {string} 处理后带前缀的CSS字符串
     */
    prefixUserCss(rawCss) {
        if (!rawCss || typeof rawCss !== 'string') return '';

        const prefix = 'body.custom-mode ';
        
        // 简单的CSS解析：按 '}' 分割成块，然后处理每个块的头部
        return rawCss.split('}').map(ruleBlock => {
            if (!ruleBlock.trim()) return ''; // 忽略空块

            const parts = ruleBlock.split('{');
            if (parts.length < 2) return ruleBlock + '}'; // 如果不是标准的 "选择器 { 属性" 结构，直接返回

            const selectors = parts[0];
            const declarations = '{' + parts.slice(1).join('{'); // 重新拼接属性部分

            // 处理组合选择器，如 h1, h2, .main-title
            const prefixedSelectors = selectors.split(',')
                .map(selector => {
                    const trimmedSelector = selector.trim();
                    if (trimmedSelector) {
                        // 忽略 @keyframes, @font-face 等 @ 规则
                        if (trimmedSelector.startsWith('@')) {
                            return trimmedSelector;
                        }
                        return prefix + trimmedSelector;
                    }
                    return '';
                })
                .join(', '); // 用逗号和空格重新连接

            return prefixedSelectors + declarations + '}';
        }).join('\n'); // 最终用换行符合并所有规则
    },
    
};

// =========================================
// 8. UTILS & EXPORTS (工具与启动)
// =========================================


// =========================================
// 专门给【聊天】用的时间格式化函数
// ========================================
function formatTimestamp() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    // 输出: 2025-10-16 13:00
    return `${yyyy}-${MM}-${dd} ${HH}:${mm}`;
}

// =========================================
// 专门给朋友圈（朋友圈）用的时间格式化函数
// 它接受一个参数 ts (timestamp)
// =========================================
function formatTimeForMoments(ts) {
    
    // 如果没有传时间戳，或者时间戳无效，才退化到当前时间
    const date = ts ? new Date(ts) : new Date();
    
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    const month = months[date.getMonth()];
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    // 保持和你聊天界面一致的风格：Jan.20 14:30
    return `${month}${day}日 ${hours}:${minutes}`;
}


// 供HTML按钮直接调用的全局函数
window.exportData = async () => {
    try {
        console.group("🧪 手动导出调试");

        console.log("正在导出数据...");

        // 1. 一定要 await，等 IndexedDB 数据读完
        const rawData = await Storage.exportAllForBackup();

        console.log("导出的 rawData:", rawData);
        console.log(
            "导出的 keys:",
            rawData && typeof rawData === "object" ? Object.keys(rawData) : null
        );

        // 2. 防止导出空备份
        if (!rawData || typeof rawData !== "object") {
            throw new Error("导出失败：导出的数据不是有效对象");
        }

        const keys = Object.keys(rawData);

        if (keys.length === 0) {
            throw new Error("导出失败：导出的数据为空，已阻止下载");
        }

        const rawText = JSON.stringify(rawData);

        if (rawText === "{}" || rawText === "[]" || rawText.length < 50) {
            throw new Error("导出失败：备份疑似为空，已阻止下载");
        }

        // 3. 可选：检查关键 key 是否存在
        const expectedKeys = [
            CONFIG.STORAGE_KEY,
            CONFIG.SETTINGS_KEY,
            CONFIG.WORLD_INFO_KEY,
            CONFIG.MOMENTS_KEY,
            CONFIG.MOMENTS_SETTINGS_KEY
        ].filter(Boolean);

        const missingKeys = expectedKeys.filter(key => !keys.includes(key));

        if (missingKeys.length > 0) {
            console.warn("⚠️ 导出数据缺少这些关键 key:", missingKeys);
            console.warn("当前导出 keys:", keys);
        }

        // 4. 转成漂亮 JSON
        const data = JSON.stringify(rawData, null, 2);

        const sizeMB = new Blob([data]).size / 1024 / 1024;
        console.log(`备份文件大小: ${sizeMB.toFixed(2)} MB`);

        // 5. 创建下载
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;

        const now = new Date();
        const ts =
            `${now.getFullYear()}` +
            `${String(now.getMonth() + 1).padStart(2, "0")}` +
            `${String(now.getDate()).padStart(2, "0")}` +
            `-${String(now.getHours()).padStart(2, "0")}` +
            `${String(now.getMinutes()).padStart(2, "0")}`;

        a.download = `TeleWindy-Backup-${ts}.json`;
        a.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        console.log("✅ 导出成功！");
        console.groupEnd();

    } catch (e) {
        console.error("❌ 导出失败", e);
        console.groupEnd();
        alert("导出失败：\n" + e.message);
    }
};



window.importData = (input) => {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    
    if (!confirm('【警告】\n恢复将清空当前所有数据！\n\n确定继续吗？')) {
        input.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            console.group('🧪 手动导入调试：window.importData');

            const jsonStr = e.target.result;

            console.log('文件名:', file.name);
            console.log('文件大小:', file.size);
            console.log('文件字符数:', jsonStr.length);
            console.log('原始文本前 300 字:', jsonStr.slice(0, 300));

            const json = JSON.parse(jsonStr);

            console.log('JSON 顶层 keys:', Object.keys(json));
            console.log('是否云同步外壳:', json?.app === 'TeleWindy' && !!json?.data);
            console.log(
                'json.data keys:',
                json?.data && typeof json.data === 'object'
                    ? Object.keys(json.data)
                    : null
            );

            // 这里按备份文件体积判断是否提醒；IndexedDB 没有 localStorage 的 5MB 硬限制。
            // jsonStr.length * 2 只是 JS 字符串内存粗估，留给调试大文件导入时参考。
            const backupSize = file.size || new Blob([jsonStr]).size;
            const estimatedMemorySize = jsonStr.length * 2;
            const largeBackupLimit = 30 * 1024 * 1024;

            console.log(`备份文件体积: ${(backupSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`预计 JS 字符串内存占用: ${(estimatedMemorySize / 1024 / 1024).toFixed(2)} MB`);

            if (backupSize > largeBackupLimit) {
                alert(
                    `【提示】\n备份文件约 ${(backupSize / 1024 / 1024).toFixed(2)} MB。\n` +
                    `数据会写入 IndexedDB，但手机浏览器仍可能因为内存或存储配额恢复失败。\n\n将继续尝试导入。`
                );
            }

            // 关键：不要在这里 localStorage.clear()
            // 关键：必须 await，等 IndexedDB 真写完再刷新
            await Storage.importFromBackup(json);

            console.log('✅ Storage.importFromBackup 调用完成');

            const after = await DB.exportAll();
            console.log('📦 导入后 IndexedDB keys:', Object.keys(after));
            console.log('📦 导入后 IndexedDB 全量:', after);

            console.groupEnd();

            alert('✅ 恢复成功！页面将刷新');
            input.value = '';
            location.reload();

        } catch (err) {
            console.error('❌ 手动导入失败:', err);
            console.groupEnd();

            if (err.name === 'QuotaExceededError' || err.message.toLowerCase().includes('quota')) {
                alert(
                    '❌ 恢复失败：存储空间不足！\n\n' +
                    '原因：你的备份数据可能太大。\n\n' +
                    '解决方法：\n' +
                    '1. 请在电脑端导入此备份。\n' +
                    '2. 删除一些带图片的对话或长对话。\n' +
                    '3. 重新导出后再发给手机。'
                );
            } else {
                alert('❌ 恢复失败：\n' + err.message);
            }

            input.value = '';
        }
    };

    reader.onerror = () => {
        alert('❌ 文件读取失败');
        input.value = '';
    };

    reader.readAsText(file);
};




// ============== markdown  全局配置 =================

/**
 * 只处理围栏代码块外的文本，防止引用和数学公式预处理改坏代码原文。
 */
function transformOutsideFencedCode(text, transform) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const outputChunks = [];
    let plainLines = [];
    let codeLines = [];
    let fence = null;

    const flushPlainLines = () => {
        if (plainLines.length > 0) outputChunks.push(transform(plainLines.join('\n')));
        plainLines = [];
    };

    const flushCodeLines = () => {
        if (codeLines.length > 0) outputChunks.push(codeLines.join('\n'));
        codeLines = [];
    };

    lines.forEach(line => {
        if (fence) {
            codeLines.push(line);
            const closingMatch = line.match(/^ {0,3}(`+|~+)\s*$/);
            if (closingMatch && closingMatch[1][0] === fence.char && closingMatch[1].length >= fence.length) {
                fence = null;
                flushCodeLines();
            }
            return;
        }

        const openingMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (openingMatch) {
            flushPlainLines();
            fence = {
                char: openingMatch[1][0],
                length: openingMatch[1].length
            };
            codeLines.push(line);
            return;
        }

        plainLines.push(line);
    });

    // AI 偶尔漏掉结束围栏，此时也要原样保留剩余代码
    flushCodeLines();
    flushPlainLines();
    return outputChunks.join('\n');
}

/**
 * 延续原有“引用开头另起气泡”的规则，但代码中的 > 必须保持原样。
 */
function normalizeChatQuoteBreaks(text) {
    return transformOutsideFencedCode(text, plainText => plainText.replace(/(^|\n)>\s*/g, '\n\n'));
}

/**
 * 按双换行切分聊天气泡，但围栏代码块内部的空行必须完整保留。
 * 同时支持反引号、波浪线和未闭合代码块，保证渲染、复制、删除共用同一套索引。
 */
function splitMessageIntoBubbleParts(text) {
    if (!text) return [];

    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const parts = [];
    let currentLines = [];
    let fence = null;

    const pushCurrentPart = () => {
        const part = currentLines.join('\n').trim();
        if (part) parts.push(part);
        currentLines = [];
    };

    lines.forEach(line => {
        if (fence) {
            currentLines.push(line);

            // 结束围栏必须使用相同字符，长度也不能短于开始围栏
            const closingMatch = line.match(/^ {0,3}(`+|~+)\s*$/);
            if (closingMatch && closingMatch[1][0] === fence.char && closingMatch[1].length >= fence.length) {
                fence = null;
            }
            return;
        }

        const openingMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (openingMatch) {
            fence = {
                char: openingMatch[1][0],
                length: openingMatch[1].length
            };
            currentLines.push(line);
            return;
        }

        if (line.trim() === '') {
            // 连续空行在代码块外仍沿用原有逻辑：结束当前气泡
            pushCurrentPart();
            return;
        }

        currentLines.push(line);
    });

    pushCurrentPart();
    return parts;
}

/**
 * 根据待显示气泡的可见文字长度计算瀑布流等待时间。
 * 这里集中保留最短、最长、满速字数和随机浮动，后续测试手感时只需要调整这几个值。
 */
function getWaterfallBubbleDelayMs(text) {
    const minDelayMs = 600;
    const maxDelayMs = 2800;
    const maxLengthChars = 120;
    const jitterMs = 120;

    // 只统计用户大致能看到的内容，避免 Markdown 链接地址和格式符号把等待时间明显拉长。
    const visibleText = String(text || '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/[`*_>#~|\[\]()]/g, '')
        .replace(/\s+/g, '');

    const visibleLength = Array.from(visibleText).length;
    const lengthRatio = Math.min(visibleLength / maxLengthChars, 1);
    const baseDelayMs = minDelayMs + (maxDelayMs - minDelayMs) * lengthRatio;
    const randomOffsetMs = (Math.random() * 2 - 1) * jitterMs;

    // 最终结果始终限制在 0.5～2.5 秒，随机浮动也不能突破边界。
    return Math.round(Math.min(maxDelayMs, Math.max(minDelayMs, baseDelayMs + randomOffsetMs)));
}

/**
 * 复制纯文本。安全上下文优先使用 Clipboard API，本地文件等环境使用旧接口兜底。
 */
async function copyPlainText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('浏览器拒绝了剪贴板写入');
}

/**
 * 切换代码复制按钮图标。SVG 为固定模板，不接收消息内容，避免引入不可信 HTML。
 */
function setCodeCopyButtonIcon(button, copied) {
    if (copied) {
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
        button.setAttribute('aria-label', '已复制');
        return;
    }

    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    button.setAttribute('aria-label', '复制代码');
}

/**
 * 终极无敌版 Markdown 解析器 (修复表格 object 报错版)
 */
function parseCustomMarkdown(text) {
    if (!text) return '';

    // 预处理：处理引用换行，但代码块中的 > 必须保持原样
    let processedText = normalizeChatQuoteBreaks(text);

    // 暂存数学公式的数组
    const mathBlocks = [];

    // 数学公式只在普通 Markdown 中解析，代码里的 $、$$ 必须作为代码原文保留
    processedText = transformOutsideFencedCode(processedText, plainText => {
        // 1. 提取块级公式 $$ ... $$
        let mathProcessedText = plainText.replace(/\$\$([\s\S]*?)\$\$/g, (match, mathCode) => {
            const placeholder = `%%%MATH_BLOCK_${mathBlocks.length}%%%`;
            try {
                const html = katex.renderToString(mathCode, { displayMode: true, throwOnError: false });
                mathBlocks.push({ placeholder, html });
                return placeholder;
            } catch (e) { return match; }
        });

        // 2. 提取行内公式 $ ... $
        mathProcessedText = mathProcessedText.replace(/\$([^\$\n]+?)\$/g, (match, mathCode) => {
            const placeholder = `%%%MATH_INLINE_${mathBlocks.length}%%%`;
            try {
                const html = katex.renderToString(mathCode, { displayMode: false, throwOnError: false });
                mathBlocks.push({ placeholder, html });
                return placeholder;
            } catch (e) { return match; }
        });

        return mathProcessedText;
    });

    // 3. 配置 marked.js（注意：这里删除了原来惹祸的 renderer）
    marked.setOptions({
        gfm: true,
        breaks: true, 
        mangle: false,
        headerIds: false
    });

    let rawHtml = marked.parse(processedText);

    // 【新增黑科技】：完美给表格套上滚动条 div，无视 marked.js 版本
    // 把 <table> 替换为 <div class="table-container"><table>
    rawHtml = rawHtml.replace(/<table/g, '<div class="table-container"><table');
    // 把 </table> 替换为 </table></div>
    rawHtml = rawHtml.replace(/<\/table>/g, '</table></div>');

    // 4. 塞回咱们漂亮的数学公式
    mathBlocks.forEach(block => {
        rawHtml = rawHtml.replace(block.placeholder, block.html);
    });

    // 5. 安检员 DOMPurify 配置
    const purifyConfig = {
        ADD_TAGS: [
            'div', 'span',
            'math', 'semantics', 'annotation', 'annotation-xml', 'mi', 'mn', 'mo', 
            'mrow', 'mspace', 'msqrt', 'mstyle', 'msub', 'msup', 'msubsup', 
            'mfrac', 'munder', 'mover', 'munderover', 'mpadded', 'mphantom', 
            'mtable', 'mtr', 'mtd', 'mlabeledtr', 'mtext'
        ],
        ADD_ATTR: [
            'class', 'style', 'aria-hidden',
            'mathvariant', 'encoding', 'display', 'xmlns'
        ]
    };

    let sanitizedHtml = DOMPurify.sanitize(rawHtml, purifyConfig);

    // marked 已经生成 <pre><code>，这里仅补上 AI 聊天常见的标题栏和复制按钮
    const markdownTemplate = document.createElement('template');
    markdownTemplate.innerHTML = sanitizedHtml;

    markdownTemplate.content.querySelectorAll('pre > code').forEach(codeElement => {
        const preElement = codeElement.parentElement;
        const languageClass = Array.from(codeElement.classList)
            .find(className => className.startsWith('language-'));
        const languageName = languageClass ? languageClass.slice('language-'.length) : '代码';

        const codeBlock = document.createElement('div');
        codeBlock.className = 'code-block';

        const toolbar = document.createElement('div');
        toolbar.className = 'code-block-toolbar';

        const languageLabel = document.createElement('span');
        languageLabel.className = 'code-block-language';
        languageLabel.textContent = languageName || '代码';

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'code-copy-btn';
        setCodeCopyButtonIcon(copyButton, false);

        preElement.replaceWith(codeBlock);
        toolbar.append(languageLabel, copyButton);
        codeBlock.append(toolbar, preElement);
    });

    sanitizedHtml = markdownTemplate.innerHTML;

    return sanitizedHtml;
}

/**
 * 纯文本清洗器 (用于复制)
 */
function cleanMarkdownForCopy(text) {
    if (!text) return '';
    let clean = text;
    clean = clean.replace(/^>\s*/gm, '');      
    clean = clean.replace(/^#+\s+/gm, '');     
    clean = clean.replace(/^\*\s+/gm, '');     
    clean = clean.replace(/[*_~`#|]/g, '');    
    
    // 去除数学公式的 $ 符号
    clean = clean.replace(/\$/g, '');
    clean = clean.replace(/\|/g, '  ');

    return clean;
}
// ============== Markdown 结束 =================

// 启动应用
window.onload = () => App.init();

