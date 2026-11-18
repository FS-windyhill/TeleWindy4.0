// =========================================
// PHONE CALL (临时电话通讯)
// ★ 不把 phone 写进 contact.chatMode；音频只驻留内存，文字回顾独立保存。
//   每次请求携带回顾 ID 快照，旧请求/旧总结不会消费或覆盖新通话。
// =========================================
const PhoneCall = {
    session: null,
    preview: null,
    fields: {
        PHONE_STT_PROVIDER: 'phone-stt-provider', PHONE_STT_URL: 'phone-stt-url', PHONE_STT_KEY: 'phone-stt-key'
    },
    defaults: { PHONE_TTS_KEY: '', PHONE_TTS_MODEL: 'speech-2.8-turbo', PHONE_STT_PROVIDER: 'deepseek',
        PHONE_STT_URL: 'https://api.deepseek.com/v1/tools/asr', PHONE_STT_KEY: '' },
    ttsProviders: {
        'minimax-cn': { name: 'MiniMax 国内版', model: 'speech-2.8-turbo', voiceParam: 'voice_id' },
        'minimax-global': { name: 'MiniMax 国际版', model: 'speech-2.8-turbo', voiceParam: 'voice_id' },
        elevenlabs: { name: 'ElevenLabs', model: 'eleven_flash_v2_5', voiceParam: 'voice_id' },
        'fish-audio': { name: 'Fish Audio', model: 's2.1-pro', voiceParam: 'reference_id' }
    },
    // ★ 旧版只存国际版密钥、模型和音色，读旧档时按国际版取值。
    ttsProvider(settings) {
        return Object.hasOwn(this.ttsProviders, settings.PHONE_TTS_PROVIDER) ? settings.PHONE_TTS_PROVIDER : 'minimax-global';
    },
    ttsConfig(settings, provider = this.ttsProvider(settings)) {
        const legacy = provider === 'minimax-global' ? { key: settings.PHONE_TTS_KEY, model: settings.PHONE_TTS_MODEL } : {};
        const saved = settings.PHONE_TTS_CONFIGS?.[provider] || legacy;
        return { key: saved.key ?? '', model: saved.model ?? this.ttsProviders[provider].model, groupId: saved.groupId ?? '' };
    },
    // ★ 设置页草稿与已保存配置分开。来回切换服务商时保留尚未保存的填写内容。
    showTtsConfig(provider) {
        const definition = this.ttsProviders[provider];
        const config = this.ttsDrafts[provider];
        const key = document.getElementById('phone-tts-key');
        if (key.type === 'text') document.getElementById('toggle-phone-tts-key').click();
        key.value = config.key;
        key.placeholder = `${definition.name} API Key`;
        const model = document.getElementById('phone-tts-model');
        model.value = config.model;
        model.placeholder = `例如 ${definition.model}`;
        document.getElementById('phone-tts-group-fields').hidden = provider !== 'minimax-cn';
        document.getElementById('phone-tts-group-id').value = config.groupId;
        this.ttsDraftProvider = provider;
    },
    readTtsDraft() {
        this.ttsDrafts[this.ttsDraftProvider] = {
            key: document.getElementById('phone-tts-key').value.trim(),
            model: document.getElementById('phone-tts-model').value.trim(),
            groupId: document.getElementById('phone-tts-group-id').value.trim()
        };
    },
    voiceFor(contact, provider) {
        return contact?.phoneVoiceIds?.[provider] ?? (provider === 'minimax-global' ? contact?.phoneVoiceId : '') ?? '';
    },
    fillVoice(contact) {
        const provider = this.ttsProvider(STATE.settings);
        const definition = this.ttsProviders[provider];
        document.getElementById('edit-phone-voice-label').textContent = `${definition.name} 音色 ID（${definition.voiceParam}）`;
        document.getElementById('edit-phone-voice').value = this.voiceFor(contact, provider);
    },
    saveVoice(contact) {
        const provider = this.ttsProvider(STATE.settings);
        const voice = document.getElementById('edit-phone-voice').value.trim();
        contact.phoneVoiceIds = { ...contact.phoneVoiceIds, [provider]: voice };
        if (provider === 'minimax-global') contact.phoneVoiceId = voice;
    },
    // ★ 沿用聊天的 think/thinking/thought 口径，额外兼容 reasoning/analysis 标签。
    //   先统一标签再按层级剔除；未闭合推理块直接丢弃到末尾，不能作为台词兜底。
    cleanText(content) {
        const text = String(content || '').replace(/<\s*(\/?)\s*(?:think|thinking|thought|reasoning|analysis)\b[^>]*>/gi,
            (_, close) => close ? '</think>' : '<think>');
        const tags = /<think>|<\/think>/g;
        let depth = 0, cursor = 0, output = '', match;
        while ((match = tags.exec(text))) {
            if (!depth) output += text.slice(cursor, match.index);
            if (match[0] === '<think>') depth++;
            else if (depth) depth--;
            else output = ''; // ★ 只有闭合标签的截断结果：前缀也可能是推理，保守丢弃。
            cursor = tags.lastIndex;
        }
        if (!depth) output += text.slice(cursor);
        return output.trim();
    },
    cleanMessages(messages) {
        return (messages || []).map(message => ({ ...message, content: this.cleanText(message.content) }))
            .filter(message => message.content);
    },
    fillSettings(settings) {
        for (const [key, id] of Object.entries(this.fields)) document.getElementById(id).value = settings[key] ?? this.defaults[key];
        const provider = this.ttsProvider(settings);
        this.ttsDrafts = Object.fromEntries(Object.keys(this.ttsProviders).map(id => [id, this.ttsConfig(settings, id)]));
        document.getElementById('phone-tts-provider').value = provider;
        this.showTtsConfig(provider);
        this.fillPresetSelect('phone-summary-preset', settings.PHONE_SUMMARY_PRESET || '', '-- 跟随通话对话模型 --');
        this.syncProvider();
    },
    saveSettings(settings) {
        for (const [key, id] of Object.entries(this.fields)) settings[key] = document.getElementById(id).value.trim();
        this.readTtsDraft();
        settings.PHONE_TTS_PROVIDER = this.ttsDraftProvider;
        settings.PHONE_TTS_CONFIGS = { ...this.ttsDrafts };
        // ★ 同步国际版旧字段，既有备份和旧版仍可读取。
        settings.PHONE_TTS_KEY = this.ttsDrafts['minimax-global'].key;
        settings.PHONE_TTS_MODEL = this.ttsDrafts['minimax-global'].model;
        settings.PHONE_SUMMARY_PRESET = document.getElementById('phone-summary-preset').value;
    },
    // ================ 独立文字模型：按预设名称绑定，列表重排不会选错模型 ================
    fillPresetSelect(id, selected, fallbackLabel) {
        const select = document.getElementById(id);
        if (!select) return;
        select.replaceChildren();
        const add = (value, label) => {
            const option = document.createElement('option');
            option.value = value; option.textContent = label; select.append(option);
        };
        add('', fallbackLabel);
        const presets = STATE.settings.API_PRESETS || [];
        presets.forEach(preset => add(preset.name, `${preset.name} (${preset.model})`));
        // ★ 保留失效绑定供用户重新选择，不静默改用价格可能更高的默认模型。
        if (selected && !presets.some(preset => preset.name === selected)) add(selected, `${selected}（预设已删除，请重新选择）`);
        select.value = selected || '';
    },
    buildModelSettings(contact, presetName, fallback) {
        if (!presetName && fallback) return { ...fallback };
        if (presetName && !(STATE.settings.API_PRESETS || []).some(preset => preset.name === presetName)) {
            throw new Error(`文字模型预设「${presetName}」已删除，请重新选择`);
        }
        // ★ 复用主聊天的整套预设参数（地址/密钥/模型/温度/附加请求体），只用副本覆盖绑定。
        const settings = App.buildChatRequestSettings(presetName ? { ...contact, linkedPresetName: presetName } : contact);
        if (!settings) throw new Error('文字模型配置不完整，请检查所选预设');
        if (!settings.API_KEY || !settings.API_URL) throw new Error('电话通讯需要配置所选文字模型的 API 地址和密钥');
        return { ...settings, ASYNC_BACKEND_ENABLED: false };
    },
    syncProvider() {
        document.getElementById('phone-deepseek-fields').hidden = document.getElementById('phone-stt-provider').value !== 'deepseek';
        document.getElementById('phone-browser-hint').hidden = document.getElementById('phone-stt-provider').value !== 'browser';
    },
    // ================ 回顾：立即原文兜底，后台总结只替换正文 ================
    capture(contact, roundId) {
        // ★ 与朋友圈一样，已扣过的用户消息轮次在 reroll 时仍需注入，包括最后一轮。
        return (contact.phoneRecaps || []).filter(r => r.roundsLeft > 0 || (roundId && r.consumed.includes(roundId))).map(r => r.id);
    },
    buildRecapPrompt(contact, ids = this.capture(contact)) {
        // ★ 旧版本已经存下来的回顾同样清洗，不能从回顾路径重新带回 CoT。
        return (contact.phoneRecaps || []).filter(r => ids.includes(r.id)).map(r => {
            const content = this.cleanText(r.summary) || this.cleanText(r.fallback);
            return content ? `[电话通讯回顾 ${r.timestamp}]\n${content}\n[电话通讯回顾 END]` : '';
        }).filter(Boolean).join('\n\n');
    },
    consume(contact, ids, roundId) {
        if (!roundId) return;
        for (const recap of contact.phoneRecaps || []) {
            // ★ 保存全部已消费轮次，重生成更早的一轮也不能再次扣减。
            if (!ids?.includes(recap.id) || recap.roundsLeft <= 0 || recap.consumed.includes(roundId)) continue;
            recap.consumed.push(roundId);
            recap.roundsLeft--;
        }
    },
    transcript(messages, { forSummary = false } = {}) {
        // ★ 总结原文的说话人标签与提示词一致；原文回顾仍使用中文标签。
        const labels = forSummary ? { assistant: 'char', user: 'user' } : { assistant: '角色', user: '用户' };
        return this.cleanMessages(messages).map(m => {
            const isCharacter = m.role === 'assistant';
            const label = isCharacter ? labels.assistant : labels.user;
            return `${label}：${m.content}${isCharacter && !m.heard ? '（未完整播放）' : ''}`;
        }).join('\n');
    },
    armRecap(contact, session) {
        const messages = this.cleanMessages(session.messages);
        if (!messages.length) return null;
        const recap = { id: session.id, timestamp: formatTimestamp(), roundsLeft: 2, consumed: [],
            fallback: this.transcript(messages.slice(-6)), summary: '' };
        // ★ 只保留最近 20 通文字回顾；仍待注入的条目不因裁剪丢失。
        const old = contact.phoneRecaps || [];
        contact.phoneRecaps = [...old.filter((r, i) => r.roundsLeft > 0 || i >= old.length - 19), recap];
        return recap;
    },
    async summarize(contact, session, recap) {
        try {
            const summarySettings = this.buildModelSettings(contact, session.summaryPresetName, session.settings);
            const text = await API.chat([
                { role: 'system', content: '以下是user和char的通话，请总结通话内容，以便让人理解两人的刚才聊了什么。格式要求：分为两点，“- user：”和“- char：”。user那边，总结user从头到尾说了啥；char那边，总结char从头到尾说了啥。不用主观评论，只需客观描述即可。总共不超过400字。' },
                { role: 'user', content: this.transcript(session.messages, { forSummary: true }) }
            ], { ...summarySettings, COUNT_AS_INTERACTION: false, REQUEST_SIGNAL: undefined, MAX_TOKENS: 800 });
            if (!STATE.contacts.includes(contact) || !contact.phoneRecaps?.includes(recap)) return;
            const summary = this.cleanText(text);
            if (summary) recap.summary = summary;
            await Storage.saveContacts();
        } catch (error) { console.warn('[PhoneCall] 总结失败，继续使用电话原文回顾'); }
    },
    // ================ 页面和会话生命周期 ================
    open(contact) {
        if (this.session || STATE.chatRequestActive || STATE.typingContactId) { Toast.show('请先结束当前通话或等待回复完成'); return; }
        globalThis.ChatVoiceInput?.cancel();
        this.stopPreview();
        const source = contact.chatMode === 'offline' ? contact.offlineHistory : contact.history;
        this.session = { id: `phone_${Date.now()}_${Math.random().toString(36).slice(2)}`, contact,
            messages: [], bridge: this.cleanMessages(OfflineChat.buildBridgeMessages(source)), phase: 'ready',
            originalAudioSessionType: this.getAudioSessionType(), controller: new AbortController() };
        const s = this.session;
        const avatar = document.getElementById('phone-avatar');
        // ★ 旧角色可能没有可用图片；回退到本地矢量头像，避免通话页出现破图。
        const fallbackAvatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#666666"/><circle cx="50" cy="38" r="17" fill="#eeeeee"/><path d="M18 95c0-38 64-38 64 0" fill="#eeeeee"/></svg>');
        avatar.onerror = () => { avatar.onerror = null; avatar.src = fallbackAvatar; };
        avatar.src = contact.avatar || fallbackAvatar;
        document.getElementById('phone-name').textContent = contact.name;
        document.getElementById('phone-transcript').replaceChildren();
        document.getElementById('phone-page').hidden = false;
        // ★ 覆盖层打开时阻止 Tab/快捷键落到下面的聊天输入框。
        s.previousFocus = document.activeElement;
        if (document.getElementById('app-container')) document.getElementById('app-container').inert = true;
        document.getElementById('phone-close').focus?.();
        this.setPhase(this.session, 'ready', '准备拨打');
    },
    alive(s) { return this.session === s && !s.controller.signal.aborted; },
    setPhase(s, phase, label) {
        if (!this.alive(s)) return;
        s.phase = phase;
        document.getElementById('phone-status').textContent = label;
        document.getElementById('phone-dial').hidden = phase !== 'ready';
        document.getElementById('phone-done').hidden = phase !== 'listening';
        document.getElementById('phone-retry').hidden = phase !== 'error';
    },
    addText(s, message) {
        const bubble = document.createElement('div');
        bubble.className = `phone-bubble ${message.role}`;
        bubble.textContent = this.cleanText(message.content);
        const transcript = document.getElementById('phone-transcript');
        transcript.append(bubble);
        // ★ 直接滚动文字列表到底部，长气泡也展示末尾；不让外层聊天页跟着滚动。
        transcript.scrollTop = transcript.scrollHeight;
        // ★ 等本轮状态按钮切换完成后再对齐一次，避免底部操作区改变列表高度。
        requestAnimationFrame(() => {
            if (this.alive(s)) transcript.scrollTop = transcript.scrollHeight;
        });
    },
    async dial() {
        const s = this.session;
        if (!s || s.phase !== 'ready') return;
        try {
            const settings = this.buildModelSettings(s.contact, s.contact.phonePresetName);
            // ★ 电话不创建可恢复聊天 job，否则刷新后可能把电话台词误存为普通聊天。
            //   第一版语音通话使用直连；服务端托管密钥模式仍可继续用于原来的文字聊天。
            if (!settings.API_KEY || !settings.API_URL) throw new Error('电话通讯需要配置角色对话模型的 API 地址和密钥');
            s.settings = { ...settings, ASYNC_BACKEND_ENABLED: false };
            // ★ 本通电话记录总结选择，挂断等待时继续聊天不改变其模型路由。
            s.summaryPresetName = STATE.settings.PHONE_SUMMARY_PRESET || '';
            s.voice = this.voiceFor(s.contact, this.ttsProvider(STATE.settings));
            s.audioSettings = { ...this.defaults, ...STATE.settings };
            this.validateTts(s.voice, s.audioSettings);
            if (s.audioSettings.PHONE_STT_PROVIDER === 'browser') {
                if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) throw new Error('当前浏览器不支持语音识别，请选择 DeepSeek');
            } else if (!s.audioSettings.PHONE_STT_KEY || !s.audioSettings.PHONE_STT_URL) throw new Error('请先填写 DeepSeek 识别地址和密钥');
            this.setPhase(s, 'dialing', '正在拨打中');
            // ★ 必须在「拨打」点击的同步调用栈解锁；等接口返回再 new Audio 会被 Safari 拦截。
            await this.unlockAudio(s);
            if (!this.alive(s) || !await this.acquireMicrophone(s)) return;
            s.micApproved = true;
            // ★ 首次只检查权限，立即彻底停止音轨；disabled 的活音轨仍可能占用 iOS 通话通道。
            this.stopListening(s);
            await this.reply(s);
        } catch (error) { this.fail(s, error); }
    },
    async reply(s) {
        if (!this.alive(s)) return;
        this.stopListening(s);
        this.setPhase(s, s.messages.length ? 'thinking' : 'dialing', s.messages.length ? '对方思考中' : '正在拨打中');
        const messages = [
            { role: 'system', content: `你是${s.contact.name}，正在和用户进行电话通讯。请遵守人设，用自然、简短的口语回答，每次一到三句。不要输出Markdown、动作描写、聊天工具指令或解释。` },
            ...(s.contact.prompt?.trim() ? [{ role: 'system', content: s.contact.prompt.trim() }] : []),
            ...this.cleanMessages(s.bridge), ...this.cleanMessages(s.messages).map(m => ({ role: m.role, content: m.content }))
        ];
        // ★ 让角色先开口的指令只在接通时发送，后续按通话记录继续。
        if (!s.messages.length) messages.push({ role: 'user', content: '【电话已拨出，请接听并先说第一句话】' });
        const text = this.cleanText(await API.chat(messages, { ...s.settings, REQUEST_SIGNAL: s.controller.signal }));
        if (!this.alive(s)) return;
        if (!text) throw new Error('模型只返回了思考或空内容，没有可播放的台词，请重试');
        const message = { role: 'assistant', content: text, heard: false };
        s.messages.push(message);
        this.addText(s, message);
        this.setPhase(s, 'speaking', '已接通 · 正在准备语音');
        await this.speak(s, message);
    },
    async speak(s, message) {
        message.content = this.cleanText(message.content);
        if (!message.content) throw new Error('没有可播放的台词，请重试');
        // ★ 播放受限后的重试复用同一份音频，不再次付费合成同一句台词。
        const blob = s.pendingSpeech?.message === message ? s.pendingSpeech.blob
            : await this.synthesize(message.content, s.voice, s.audioSettings, s.controller.signal);
        if (!this.alive(s)) return;
        s.pendingSpeech = { message, blob };
        this.setPhase(s, 'speaking', '已接通 · 对方正在说话');
        await this.play(s, blob);
        if (!this.alive(s)) return;
        s.pendingSpeech = null;
        message.heard = true;
        await this.listen(s);
    },
    async retry() {
        const s = this.session;
        if (!s || s.phase !== 'error') return;
        try {
            // ★ 重试点击也同步恢复同一个 AudioContext，不能在网络请求之后才申请播放。
            await this.unlockAudio(s);
            if (!this.alive(s)) return;
            const last = s.messages.at(-1);
            if (!s.micApproved) { this.setPhase(s, 'ready', '准备拨打'); return; }
            this.setPhase(s, 'thinking', '正在重试');
            if (last?.role === 'assistant' && !last.heard) await this.speak(s, last);
            else if (last?.role === 'assistant') await this.listen(s);
            else await this.reply(s);
        } catch (error) { this.fail(s, error); }
    },
    fail(s, error) {
        if (!this.alive(s)) return;
        this.stopListening(s);
        this.setPhase(s, 'error', '通话暂停');
        Toast.show(this.reason(error));
    },
    async hangup() {
        const s = this.session;
        if (!s) return;
        this.session = null;
        s.controller.abort();
        this.stopListening(s);
        s.cancelPlayback?.();
        s.pendingSpeech = null;
        this.setAudioSessionType(s.originalAudioSessionType || 'auto');
        document.getElementById('phone-page').hidden = true;
        if (document.getElementById('app-container')) document.getElementById('app-container').inert = false;
        s.previousFocus?.focus?.();
        const recap = this.armRecap(s.contact, s);
        if (recap) {
            try { await Storage.saveContacts(); }
            catch (error) { Toast.show('电话回顾保存失败，请勿刷新页面'); }
            // ★ 回顾已立即可用；总结不阻塞用户返回线上/线下继续说话。
            void this.summarize(s.contact, s, recap);
        }
    },
    // ================ 音频：每段播放结束/取消都释放 Blob URL ================
    reason(error) {
        const message = String(error?.message || error || '未知错误');
        if (error?.phoneStage === 'playback') return 'Safari 暂停了音频播放，请点击「重试」恢复声音';
        if (error?.phoneStage === 'microphone' && error?.name === 'NotAllowedError') return '麦克风权限未开启，请在 Safari 网站设置中允许麦克风';
        if (/NotAllowedError|权限|Permission denied/i.test(`${error?.name} ${message}`)) return '请允许麦克风或音频播放权限';
        if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return '网络请求失败，请检查网络或接口跨域支持';
        if (error?.name === 'TimeoutError') return '语音接口响应超时，请稍后重试';
        // ★ 服务端原文可能含密钥或整段请求，不在 toast 中照搬。
        return message.replace(/Bearer\s+\S+|sk-[\w-]+/gi, '[已隐藏]').slice(0, 95);
    },
    validateTts(voice, settings) {
        const provider = this.ttsProvider(settings);
        const config = this.ttsConfig(settings, provider);
        const name = this.ttsProviders[provider].name;
        if (!config.key || !config.model) throw new Error(`请先在通话模型设置中保存 ${name} 的密钥和模型名称`);
        if (!voice) throw new Error(`请先在聊天选项填写 ${name} 音色 ID`);
        return config;
    },
    async synthesize(text, voice, settings, signal) {
        // ★ 最后一道防线：任何调用入口（包括重试）都不能把推理发给语音供应商。
        text = this.cleanText(text);
        if (!text) throw new Error('没有可播放的台词，请重试');
        const provider = this.ttsProvider(settings);
        const { key, model, groupId } = this.validateTts(voice, settings);
        const headers = { 'Content-Type': 'application/json' };
        let url, body;
        // ★ 两个 MiniMax 地区返回 hex；ElevenLabs/Fish Audio 直接返回 MP3 字节。
        const isMiniMax = provider === 'minimax-cn' || provider === 'minimax-global';
        if (provider === 'elevenlabs') {
            url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`;
            headers['xi-api-key'] = key;
            body = { text, model_id: model };
        } else {
            headers.Authorization = `Bearer ${key}`;
            if (isMiniMax) {
                url = provider === 'minimax-cn' ? 'https://api.minimaxi.com/v1/t2a_v2' : 'https://api.minimax.io/v1/t2a_v2';
                if (provider === 'minimax-cn' && groupId) url += `?GroupId=${encodeURIComponent(groupId)}`;
                body = { model, text, stream: false, output_format: 'hex',
                    voice_setting: { voice_id: voice }, audio_setting: { format: 'mp3', sample_rate: 24000, channel: 1 } };
            } else {
                url = 'https://api.fish.audio/v1/tts';
                headers.model = model;
                body = { text, reference_id: voice, format: 'mp3' };
            }
        }
        const response = await fetch(url, { method: 'POST', signal: this.requestSignal(signal), headers, body: JSON.stringify(body) });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error('语音生成失败：密钥无效或无权限');
            if (response.status === 402) throw new Error('语音生成失败：请检查账户余额或套餐');
            if (response.status === 429) throw new Error('语音生成失败：请求过多或达到额度上限');
            if (response.status === 400 || response.status === 404 || response.status === 422) throw new Error(`语音生成失败：请检查模型名称和音色 ID（HTTP ${response.status}）`);
            throw new Error(`语音生成失败：接口错误 ${response.status}`);
        }
        if (!isMiniMax) {
            const audio = await response.blob();
            if (!audio.size || /json|text\//i.test(audio.type)) throw new Error('语音生成失败：接口未返回有效音频');
            return audio.slice(0, audio.size, 'audio/mpeg');
        }
        const data = await response.json().catch(() => ({}));
        if (Number(data.base_resp?.status_code || 0) !== 0) {
            // ★ 部分鉴权错误会回显请求密钥；通话和试听共用这条错误路径。
            const detail = String(data.base_resp.status_msg || `接口错误 ${data.base_resp.status_code}`);
            throw new Error(`语音生成失败：${detail.split(key).join('[已隐藏]')}`);
        }
        const hex = data.data?.audio;
        if (typeof hex !== 'string' || !hex || hex.length % 2 || !/^[\da-f]+$/i.test(hex)) throw new Error('语音生成失败：接口未返回有效音频');
        return new Blob([Uint8Array.from(hex.match(/../g), pair => parseInt(pair, 16))], { type: 'audio/mpeg' });
    },
    // ================ Safari 音频路由与用户手势解锁 ================
    getAudioSessionType() {
        return typeof navigator !== 'undefined' ? navigator.audioSession?.type : undefined;
    },
    setAudioSessionType(type) {
        // ★ Audio Session API 并非所有浏览器都有；不支持时仍靠停止音轨释放录音路由。
        try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = type; }
        catch (error) { console.warn('[PhoneCall] 浏览器未接受音频会话切换'); }
    },
    waitForAudio(s, promise) {
        // ★ Safari 被系统中断时 resume 可能一直不返回；允许挂断，也允许用户手动恢复。
        return new Promise((resolve, reject) => {
            let timer;
            const finish = (error, value) => {
                clearTimeout(timer); s.controller.signal.removeEventListener('abort', aborted);
                error ? reject(error) : resolve(value);
            };
            const aborted = () => finish(new Error('通话已结束'));
            timer = setTimeout(() => {
                const error = new Error('音频播放等待恢复'); error.phoneStage = 'playback'; finish(error);
            }, 5000);
            s.controller.signal.addEventListener('abort', aborted, { once: true });
            if (s.controller.signal.aborted) { aborted(); return; }
            Promise.resolve(promise).then(value => finish(null, value), error => {
                if (error.name === 'NotAllowedError') error.phoneStage = 'playback';
                finish(error);
            });
        });
    },
    unlockAudio(s) {
        this.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        const context = this.audioContext;
        const resumed = context.resume();
        // ★ 播一个单帧静音缓冲，建立与本次点击关联的播放通道；以后只换缓冲，不换播放器。
        const source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 1, context.sampleRate);
        source.connect(context.destination);
        source.onended = () => { source.disconnect(); source.buffer = null; source.onended = null; };
        source.start(0);
        return this.waitForAudio(s, resumed);
    },
    async acquireMicrophone(s) {
        // ★ playback 会与录音冲突，必须先回 auto，再请求录音权限。
        this.setAudioSessionType('auto');
        const generation = s.listenGeneration || 0;
        let stream;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
        catch (error) { error.phoneStage = 'microphone'; throw error; }
        // ★ 等待系统权限时可能已挂断/退出收音；迟到的音轨必须立即停止。
        if (!this.alive(s) || generation !== (s.listenGeneration || 0)) {
            stream.getTracks().forEach(track => track.stop()); return false;
        }
        s.stream = stream;
        return true;
    },
    async playCallAudio(s, blob) {
        this.setAudioSessionType('playback');
        const context = this.audioContext;
        let buffer;
        try {
            buffer = await context.decodeAudioData(await blob.arrayBuffer());
            if (!this.alive(s)) return;
            await this.waitForAudio(s, context.resume());
            if (context.state && context.state !== 'running') {
                const error = new Error('音频通道已被系统暂停'); error.phoneStage = 'playback'; throw error;
            }
        } catch (error) {
            if (error.name === 'NotAllowedError') error.phoneStage = 'playback';
            throw error;
        }
        if (!this.alive(s)) return;
        return new Promise((resolve, reject) => {
            const source = context.createBufferSource();
            let ended = false;
            const finish = error => {
                if (ended) return;
                ended = true; source.onended = null;
                try { source.stop(); } catch (_) { /* ★ 尚未启动或已经结束的音源无需再次停止。 */ }
                source.disconnect(); source.buffer = null; buffer = null;
                s.cancelPlayback = null;
                error ? reject(error) : resolve();
            };
            s.cancelPlayback = () => finish();
            source.buffer = buffer; source.connect(context.destination);
            source.onended = () => finish();
            try { source.start(0); }
            catch (error) { if (error.name === 'NotAllowedError') error.phoneStage = 'playback'; finish(error); }
        });
    },
    play(owner, blob) {
        // ★ 通话用已解锁的 Web Audio 通道；试听沿用原来可正常工作的媒体播放器。
        if (owner === this.session) return this.playCallAudio(owner, blob);
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            let ended = false;
            const finish = error => {
                if (ended) return;
                ended = true;
                audio.onended = audio.onerror = null;
                audio.pause(); audio.removeAttribute('src'); audio.load();
                URL.revokeObjectURL(url);
                owner.cancelPlayback = null;
                error ? reject(error) : resolve();
            };
            owner.cancelPlayback = () => finish();
            audio.onended = () => finish();
            audio.onerror = () => finish(new Error('音频播放失败，请重试'));
            audio.play().catch(error => finish(error));
        });
    },
    stopPreview() {
        if (!this.preview) return;
        this.preview.controller.abort();
        this.preview.cancelPlayback?.();
        this.preview = null;
        const button = document.getElementById('phone-audition');
        button.disabled = false;
        document.getElementById('phone-audition-label').textContent = '试听';
    },
    // ★ 短语音超过一分钟仍无响应就允许重试，挂断信号始终保留。
    requestSignal(signal) {
        return typeof AbortSignal !== 'undefined' && AbortSignal.any && AbortSignal.timeout
            ? AbortSignal.any([signal, AbortSignal.timeout(60000)].filter(Boolean)) : signal;
    },
    async audition() {
        if (this.session) { Toast.show('请先结束电话通讯'); return; }
        this.stopPreview();
        const owner = { controller: new AbortController() };
        this.preview = owner;
        const button = document.getElementById('phone-audition');
        // ★ 试听只替换文字，耳机图标在生成和播放时继续保留。
        const label = document.getElementById('phone-audition-label');
        button.disabled = true;
        label.textContent = '生成中…';
        try {
            const voice = document.getElementById('edit-phone-voice').value.trim();
            if (!voice) throw new Error('请先填写音色 ID');
            const settings = { ...this.defaults, ...STATE.settings };
            this.validateTts(voice, settings);
            const blob = await this.synthesize('你好呀，可以听到我的声音吗？', voice, settings, owner.controller.signal);
            if (this.preview !== owner) return;
            label.textContent = '播放中…';
            await this.play(owner, blob);
        } catch (error) {
            if (this.preview === owner && !owner.controller.signal.aborted) Toast.show(this.reason(error));
        } finally {
            if (this.preview === owner) {
                this.preview = null;
                button.disabled = false;
                label.textContent = '试听';
            }
        }
    },
    // ================ 用户收音：只在 listening 阶段创建录音/识别器 ================
    stopListening(s) {
        s.listenGeneration = (s.listenGeneration || 0) + 1;
        clearInterval(s.listenTimer); s.listenTimer = null;
        if (s.recognition) { s.recognition.onend = s.recognition.onerror = s.recognition.onresult = null; s.recognition.abort(); s.recognition = null; }
        if (s.processor) { s.processor.onaudioprocess = null; s.processor.disconnect(); s.processor = null; }
        s.source?.disconnect(); s.source = null;
        s.mute?.disconnect(); s.mute = null;
        s.stream?.getTracks().forEach(t => { t.enabled = false; t.stop(); });
        s.stream = null;
        // ★ 不只静音：彻底释放麦克风后再切回媒体播放音量和扬声器路由。
        if (!this.session || this.session === s) this.setAudioSessionType('playback');
        s.chunks = [];
    },
    async listen(s) {
        if (!this.alive(s)) return;
        this.stopListening(s);
        // ★ 系统权限/路由尚未准备好时，不显示「说完了」，防止提交上一轮残留状态。
        this.setPhase(s, 'preparing', '已接通 · 正在开启麦克风');
        if (s.audioSettings.PHONE_STT_PROVIDER === 'browser') {
            this.setAudioSessionType('auto');
            this.setPhase(s, 'listening', '已接通 · 正在聆听');
            this.listenBrowser(s); return;
        }
        if (!await this.acquireMicrophone(s)) return;
        await this.waitForAudio(s, this.audioContext.resume());
        if (!this.alive(s)) return;
        this.setPhase(s, 'listening', '已接通 · 正在聆听');
        s.chunks = []; s.sampleCount = 0; s.hasSpeech = false; s.listenStarted = performance.now(); s.lastVoice = s.listenStarted;
        // ★ 使用 PCM WAV，兼容 DeepSeek；不依赖各浏览器 MediaRecorder 的 WebM/AAC 默认格式。
        s.source = this.audioContext.createMediaStreamSource(s.stream);
        s.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        s.mute = this.audioContext.createGain(); s.mute.gain.value = 0;
        s.source.connect(s.processor); s.processor.connect(s.mute); s.mute.connect(this.audioContext.destination);
        s.processor.onaudioprocess = event => {
            if (!this.alive(s) || s.phase !== 'listening') return;
            const input = event.inputBuffer.getChannelData(0);
            let sum = 0;
            for (const value of input) sum += value * value;
            if (Math.sqrt(sum / input.length) > 0.018) { s.hasSpeech = true; s.lastVoice = performance.now(); }
            s.chunks.push(new Float32Array(input)); s.sampleCount += input.length;
        };
        s.listenTimer = setInterval(() => {
            if (!this.alive(s) || s.phase !== 'listening') return;
            const now = performance.now();
            if ((s.hasSpeech && now - s.lastVoice > 1300) || now - s.listenStarted > 110000) void this.done();
        }, 100);
    },
    // ★ 重采样到单声道 16kHz/16bit WAV：110 秒约 3.5MB，低于识别接口 8MiB 上限。
    wav(chunks, sampleRate) {
        const length = chunks.reduce((n, chunk) => n + chunk.length, 0);
        const pcm = new Float32Array(length);
        let offset = 0;
        for (const chunk of chunks) { pcm.set(chunk, offset); offset += chunk.length; }
        const count = Math.floor(length * 16000 / sampleRate);
        const buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer);
        const write = (at, str) => [...str].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
        write(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        write(36, 'data'); view.setUint32(40, count * 2, true);
        for (let i = 0; i < count; i++) {
            const start = Math.floor(i * sampleRate / 16000), end = Math.min(length, Math.max(start + 1, Math.floor((i + 1) * sampleRate / 16000)));
            let sum = 0;
            for (let j = start; j < end; j++) sum += pcm[j];
            const value = Math.max(-1, Math.min(1, sum / (end - start)));
            view.setInt16(44 + i * 2, value * (value < 0 ? 32768 : 32767), true);
        }
        return new Blob([buffer], { type: 'audio/wav' });
    },
    listenBrowser(s) {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = s.recognition = new Recognition();
        recognition.lang = navigator.language || 'zh-CN';
        recognition.continuous = true; recognition.interimResults = true;
        s.browserText = ''; s.browserFinal = ''; s.browserLast = performance.now();
        recognition.onresult = event => {
            if (!this.alive(s) || s.phase !== 'listening') return;
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) s.browserFinal += event.results[i][0].transcript;
                else interim += event.results[i][0].transcript;
            }
            s.browserText = s.browserFinal + interim; s.browserLast = performance.now();
        };
        recognition.onerror = event => {
            if (event.error === 'no-speech') return;
            this.fail(s, new Error(`浏览器识别失败：${event.error}`));
        };
        recognition.onend = () => {
            if (!this.alive(s) || s.phase !== 'listening') return;
            if (s.browserText.trim()) void this.done();
            else { try { recognition.start(); } catch (error) { this.fail(s, error); } }
        };
        recognition.start();
        s.listenTimer = setInterval(() => {
            if (s.browserText.trim() && performance.now() - s.browserLast > 1300) void this.done();
        }, 100);
    },
    // ★ 通话和聊天语音输入共用同一个识别请求，沿用设置里的地址和密钥。
    async transcribeWav(blob, settings, signal) {
        const form = new FormData();
        form.append('file', blob, 'speech.wav');
        const response = await fetch(settings.PHONE_STT_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${settings.PHONE_STT_KEY}` },
            body: form,
            signal: this.requestSignal(signal)
        });
        if (!response.ok) throw new Error(`语音识别失败：${response.status === 401 ? '密钥无效' : response.status === 429 ? '额度不足或请求过多' : `接口错误 ${response.status}`}`);
        const data = await response.json();
        return data.text;
    },
    async done() {
        const s = this.session;
        if (!s || s.phase !== 'listening') return;
        this.setPhase(s, 'recognizing', '已接通 · 识别中');
        try {
            let text;
            if (s.audioSettings.PHONE_STT_PROVIDER === 'browser') {
                text = s.browserText;
                this.stopListening(s);
            } else {
                const hasSpeech = s.hasSpeech;
                const blob = hasSpeech ? this.wav(s.chunks, this.audioContext.sampleRate) : null;
                this.stopListening(s);
                if (!hasSpeech) { await this.listen(s); return; }
                text = await this.transcribeWav(blob, s.audioSettings, s.controller.signal);
            }
            if (!this.alive(s)) return;
            if (!String(text || '').trim()) { Toast.show('未识别到说话内容，请再说一次'); await this.listen(s); return; }
            const message = { role: 'user', content: String(text).trim() };
            s.messages.push(message); this.addText(s, message);
            await this.reply(s);
        } catch (error) { this.fail(s, error); }
    },
    init() {
        document.getElementById('phone-tts-provider').addEventListener('change', event => {
            this.readTtsDraft();
            this.showTtsConfig(event.target.value);
        });
        document.getElementById('phone-stt-provider').addEventListener('change', () => this.syncProvider());
        document.getElementById('phone-audition').addEventListener('click', () => void this.audition());
        document.getElementById('phone-dial').addEventListener('click', () => void this.dial());
        document.getElementById('phone-done').addEventListener('click', () => void this.done());
        document.getElementById('phone-retry').addEventListener('click', () => void this.retry());
        document.getElementById('phone-hangup').addEventListener('click', () => void this.hangup());
        document.getElementById('phone-close').addEventListener('click', () => void this.hangup());
        // ★ 页面切后台就结束通话，避免移动端暂停音频后仍收音；刷新后不恢复电话。
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { this.stopPreview(); void this.hangup(); }
        });
        window.addEventListener('pagehide', () => { this.stopPreview(); void this.hangup(); });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.session) { event.preventDefault(); void this.hangup(); }
        });
        // ★ 关闭角色编辑弹窗即停止试听；不让不可见的旧试听继续响。
        new MutationObserver(() => {
            if (document.getElementById('modal-overlay').classList.contains('hidden')) this.stopPreview();
        }).observe(document.getElementById('modal-overlay'), { attributes: true, attributeFilter: ['class'] });
    }
};
if (typeof window !== 'undefined') {
    window.PhoneCall = PhoneCall;
    if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => PhoneCall.init());
}
if (typeof module !== 'undefined') module.exports = PhoneCall;
