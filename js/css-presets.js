// =========================================
// 初始自定义主题（绿泡泡）
// 这份 CSS 同时是类名速查表：用户把它复制给 AI，AI 就能看到
// 现有选择器和常用类名，再按需求改。
//
// ★ 这里只维护“最初那份”原文；用户保存的预设仍然在 settings.CSS_PRESETS。
// ★ 不要把它塞进 CONFIG.DEFAULT.CUSTOM_CSS：空 CSS 的兜底在
//   UI.applyAppearance() 里单独处理，避免影响已有用户的自定义 CSS。
// =========================================
CONFIG.INITIAL_CUSTOM_CSS = String.raw`/* =========================================================
   绿泡泡· 初始自定义主题 & 类名速查
   ---------------------------------------------------------
   常用类名：
   消息行：.message-wrapper（整行）、.message-wrapper.user / .ai
   气泡：.message-content、.message-bubble
   头像：.avatar-container、.avatar-img、.avatar-text
   时间戳：.msg-time（本主题里选择隐藏；想显示可以删掉 display:none）
   头部：.app-header、.chat-header、.chat-header-profile、
         .chat-header-avatar、.chat-header-meta、#chat-title、
         #typing-status、.presence-dot、.presence-text
         默认布局：头像 + 名字 + 在线状态圆点，横排；
         不想显示头像或圆点，去文件末尾「聊天页 Header」
         那段把对应规则取消注释即可。
   底栏：.app-footer、#chat-messages、#task-input、#send-button、
         #upload-image-btn、#reroll-footer-btn
   主题变量：--message-bg-user、--message-border-user、
             --message-bg-ai、--message-border-ai、
             --primary-btn-text、--app-font-size
   ---------------------------------------------------------
   主题色（就是设置里那三个 HSL 滑条，改滑条这里会自动跟着变）：
     hsl(var(--theme-color-h) var(--theme-color-s) var(--theme-color-l))        （原色）
     hsl(var(--theme-color-h) var(--theme-color-s) var(--theme-color-l) / 0.2)  （再带透明度）
   - --theme-color-h：色相 0–360，不带单位
   - --theme-color-s、--theme-color-l：已经自带 %，自己不用再写 %
   例：background: hsl(var(--theme-color-h) var(--theme-color-s) var(--theme-color-l) / 0.15);
   想整体跟随主题色，优先改 var(--primary-btn-text) 这类现成变量；
   想单独给某个元素上主题色，就直接用上面的 hsl(...) 写法。
   ---------------------------------------------------------
   想改成别样子？把整段 CSS 复制给 AI，描述你想要的效果，
   让 AI 改完再粘回编辑框即可。
   选择器会自动加上 body.custom-mode 前缀，不用自己写。
   支持普通 CSS、@media、@keyframes；:root / html 不会自动加前缀。
   ========================================================= */

/* =========================================
   1. 基础布局容器 (Wrapper)
   ========================================= */
.message-wrapper {
    display: flex;
    width: 100%;
    margin-bottom: 10px;      /* 消息间距 */
    align-items: flex-start;  /* 顶部对齐 */
}


/* =========================================
   2. 内容包裹层 (Content)
   ========================================= */
.message-wrapper .message-content {
    max-width: 73%;           /* 限制气泡最大宽度 */
    display: flex;
    flex-direction: column;
    overflow: visible !important; /* 关键：允许小尾巴溢出显示 */
}

/* AI 的内容对齐设置 */
.message-wrapper.ai .message-content {
    align-items: flex-start;  /* 内容左对齐 */
    margin-left: 5px;        /* 隔开左侧头像 */
}

/* User 的内容对齐设置 */
.message-wrapper.user .message-content {
    align-items: flex-end;    /* 内容右对齐 */
    margin-right: 5px;       /* 隔开右侧头像 */
}

/* =========================================
   3. 气泡通用样式 (Bubble)
   ========================================= */
.message-wrapper .message-bubble {
    position: relative;
    padding: 10px 12px;       /* 内部留白 */
    border-radius: 6px;       /* 圆角 */
    font-size: 1.1rem;
    line-height: 1.3;

    /* 视觉属性 */
    border: none;

    /* 修复尾巴显示的属性 */
    overflow: visible !important;
    z-index: 1;
}

/* =========================================
   4. AI (Char) 特定样式 & 尾巴
   ========================================= */
.message-wrapper.ai .message-bubble {
    background-color: #2C2C2C; /* 深色背景 */
    color: #ffffff;            /* 白色文字 */
}

/* AI 左侧小三角 */
.message-wrapper.ai .message-bubble::before {
    content: '';
    position: absolute;
    top: 14px;
    left: -6px;                /* 向左突出 */
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-right: 6px solid #2C2C2C; /* 颜色与背景一致 */
    z-index: 2;
}

/* =========================================
   5. User (用户) 特定样式 & 尾巴
   ========================================= */
.message-wrapper.user .message-bubble {
    background-color: #29B461; /* 绿泡泡主题绿背景 */
    color: #000000;            /* 黑色文字 */
}

/* User 右侧小三角 */
.message-wrapper.user .message-bubble::after {
    content: '';
    position: absolute;
    top: 14px;
    right: -6px;               /* 向右突出 */
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 6px solid #29B461; /* 颜色与背景一致 */
    z-index: 2;
}

/* =========================================
   6. 其他元素 (头像与时间)
   ========================================= */
.avatar-img {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0; /* 防止头像被压缩 */
    box-shadow: none;
}

/* 时间戳：本主题选择隐藏；想显示可以把 display 改成 block 或 inline */
.msg-time {
    display: none;
}


/* =========================================
   夜间模式主题
   ========================================= */

.app-header {
    border-bottom: none;
    text-align: center;
    flex-shrink: 0;
    background: #111312;
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(10px) saturate(180%);
}

.app-header h1 {
    color: #ffffff;
}

.contact-info h3 {
    margin: 0 0 5px 0;
    font-size: 1rem;
    color: #ffffff;
    font-weight: 600;
}

.contact-info p {
    margin: 0;
    font-size: 0.8rem;
    color: #adadad;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.header-icon-btn .icon {
    width: 20px;
    height: 20px;
    display: block;
    overflow: visible;
}

.header-icon-btn.left {
    color: #ffffff;
    border: transparent;
    background: rgba(236, 236, 236, 0);
}

.header-icon-btn.right {
    color: #ffffff;
    border: transparent;
    background: rgba(236, 236, 236, 0);
}

.app-footer {
    border-top: none;
    background: #1c1c1c;
}

#reroll-footer-btn {
    border: transparent;
    background: rgba(251, 251, 251, 0);
    color: rgb(198, 198, 198, 0.8);
    font-size: 1.2rem;
}

#send-button {
    border: transparent;
    background: rgba(251, 251, 251, 0);
    color: rgb(198, 198, 198, 0.8);
    font-size: 1.2rem;
}

#task-input {
    border: transparent;
    background: #2C2C2C !important;
    font-size: 1rem;
    color: #ffffff;
    border-radius: 6px;
}

#upload-image-btn {
    border: transparent;
    color: rgb(198, 198, 198, 0.8);
    background: transparent;
    font-size: 1.2rem;
}

/* =========================================
   聊天页 Header：保持默认样式
   -----------------------------------------
   默认就是「头像 + 名字 + 在线状态圆点」横排，
   本主题不再覆盖，基础样式直接生效。
   不想要头像或圆点？把下面两条规则两边的
   注释符号删掉即可（也就是取消注释）。
   ========================================= */

/* 取消注释即可隐藏头像 */
/* .chat-header-avatar { display: none; } */

/* 取消注释即可隐藏在线状态小圆点 */
/* .chat-header .presence-dot { display: none; } */
`;

CONFIG.INITIAL_CUSTOM_CSS_PRESET_NAME = '绿泡泡';
