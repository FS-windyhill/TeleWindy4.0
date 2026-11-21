// ★ 电话生命周期：用可控的语音/模型返回验证挂断竞态，不调用真实付费 API。
// 运行：node --test tests/phone-call.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { value: '', textContent: '', hidden: false, disabled: false, children: [],
            replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, scrollIntoView() {} });
        return elements.get(id);
    };
    const state = { contacts: [], settings: {}, typingContactId: null };
    const toasts = [], requests = [];
    let saves = 0;
    const context = { module: { exports: {} }, console, Blob, Uint8Array, Float32Array, ArrayBuffer, DataView,
        AbortController, setInterval, clearInterval, setTimeout, clearTimeout, performance,
        requestAnimationFrame: callback => callback(),
        STATE: state, formatTimestamp: () => '2026-11-15 12:00',
        Storage: { async saveContacts() { saves++; } },
        Toast: { show(message) { toasts.push(message); } },
        document: { getElementById: element, createElement: () => ({ scrollIntoView() {} }) },
        OfflineChat: { buildBridgeMessages: records => (records || []).slice(-6) },
        API: { async chat(messages) { requests.push(messages); return '电话总结'; } }
    };
    vm.runInNewContext(fs.readFileSync('js/phone-call.js', 'utf8'), context);
    return { phone: context.module.exports, state, element, context, toasts, requests, get saves() { return saves; } };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; }

// ★ 模拟系统收回亮屏和主动释放，验证真实生命周期，不申请设备权限或调用付费接口。
function screenLock() {
    const listeners = [];
    return { released: false, releases: 0,
        addEventListener(name, listener) { assert.equal(name, 'release'); listeners.push(listener); },
        revoke() { this.released = true; listeners.forEach(listener => listener()); },
        async release() { this.releases++; this.revoke(); }
    };
}

test('仅拨打后申请亮屏，不阻塞音频解锁，多轮状态复用同一把锁，挂断释放', async () => {
    const h = harness(), lock = screenLock(), audio = deferred(), events = [];
    h.context.navigator = { wakeLock: { async request(type) { events.push(type); return lock; } } };
    h.phone.open({ id: 'a' }); const s = h.phone.session;
    assert.equal(events.length, 0); assert.equal(h.element('phone-wake-hint').hidden, true);
    h.phone.buildModelSettings = () => ({ API_KEY: 'test', API_URL: 'https://example.test' });
    h.phone.validateTts = () => {};
    h.state.settings.PHONE_STT_PROVIDER = 'deepseek';
    h.state.settings.PHONE_STT_KEY = 'test';
    h.phone.unlockAudio = () => { events.push('unlock'); return audio.promise; };
    const dialing = h.phone.dial();
    assert.deepEqual(events, ['screen', 'unlock']);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(s.wakeLock, lock);
    for (const phase of ['thinking', 'speaking', 'listening', 'recognizing']) {
        h.phone.setPhase(s, phase, '通话中');
        await h.phone.acquireWakeLock(s);
        assert.equal(s.wakeLock, lock);
    }
    assert.deepEqual(events, ['screen', 'unlock']);
    await h.phone.hangup();
    assert.equal(lock.releases, 1); assert.equal(s.wakeLock, null);
    assert.equal(h.element('phone-wake-hint').hidden, true);
    audio.resolve(); await dialing;
});

test('常亮不支持、申请拒绝或已被释放时持续提示，通话仍可进行，重申请成功清除提示', async () => {
    for (const mode of ['unsupported', 'rejected', 'throw', 'released']) {
        const h = harness(), lock = screenLock();
        if (mode === 'released') lock.revoke();
        h.context.navigator = mode === 'unsupported' ? {} : { wakeLock: { request() {
            if (mode === 'throw') throw Error('系统拒绝');
            return mode === 'rejected' ? Promise.reject(Error('系统拒绝')) : Promise.resolve(lock);
        } } };
        h.phone.open({ id: 'a' }); const s = h.phone.session;
        h.phone.setPhase(s, 'listening', '已接通');
        await h.phone.acquireWakeLock(s);
        assert.equal(s.phase, 'listening'); assert.equal(s.controller.signal.aborted, false);
        assert.equal(h.element('phone-wake-hint').hidden, false);
        assert.match(h.element('phone-wake-hint').textContent, /常亮未生效.*自动锁屏/);
        h.phone.setPhase(s, 'speaking', '对方说话');
        assert.equal(h.element('phone-wake-hint').hidden, false);
        const working = screenLock();
        h.context.navigator = { wakeLock: { async request() { return working; } } };
        await h.phone.acquireWakeLock(s);
        assert.equal(s.wakeLock, working); assert.equal(h.element('phone-wake-hint').hidden, true);
        await h.phone.hangup();
        assert.equal(working.releases, 1);
    }
});

test('系统中途收回亮屏时提示且不循环争抢，暂停释放，重试同步重新申请', async () => {
    const h = harness(), locks = [screenLock(), screenLock(), screenLock()]; let requests = 0;
    h.context.navigator = { wakeLock: { async request() { return locks[requests++]; } } };
    h.phone.open({ id: 'a' }); const s = h.phone.session;
    h.phone.setPhase(s, 'listening', '已接通');
    await h.phone.acquireWakeLock(s);
    locks[0].revoke();
    assert.equal(s.wakeLock, null); assert.equal(requests, 1);
    assert.equal(h.element('phone-wake-hint').hidden, false);
    h.phone.fail(s, Error('网络失败'));
    assert.equal(s.phase, 'error'); assert.equal(h.element('phone-wake-hint').hidden, true);
    s.micApproved = true;
    h.phone.unlockAudio = async () => {}; h.phone.reply = async () => {};
    const retry = h.phone.retry();
    assert.equal(requests, 2);
    await retry;
    assert.equal(s.wakeLock, locks[1]);
    h.phone.fail(s, Error('再次失败'));
    assert.equal(locks[1].releases, 1);
    assert.equal(h.element('phone-wake-hint').hidden, true);
    await h.phone.retry();
    assert.equal(s.wakeLock, locks[2]);
    await h.phone.hangup();
    assert.equal(locks[2].releases, 1);
});

test('挂断或暂停后迟到的亮屏申请立即释放，不能占用设备', async () => {
    for (const action of ['hangup', 'fail']) {
        const h = harness(), pending = deferred(), lock = screenLock();
        h.context.navigator = { wakeLock: { request() { return pending.promise; } } };
        h.phone.open({ id: 'a' }); const s = h.phone.session;
        h.phone.setPhase(s, 'thinking', '等待回复');
        const work = h.phone.acquireWakeLock(s);
        if (action === 'hangup') await h.phone.hangup();
        else h.phone.fail(s, Error('暂停'));
        pending.resolve(lock); await work;
        assert.equal(lock.releases, 1); assert.equal(s.wakeLock, null);
        assert.equal(h.element('phone-wake-hint').hidden, true);
    }
});

test('旧申请迟到成功或失败，都不能覆盖新通话或重试获得的亮屏锁和提示', async () => {
    for (const next of ['retry', 'new-call']) for (const result of ['success', 'failure']) {
        const h = harness(), oldLock = screenLock(), newLock = screenLock(); let rejectOld;
        const pending = deferred();
        const oldPromise = new Promise((resolve, reject) => { pending.promise.then(resolve); rejectOld = reject; });
        let requests = 0;
        h.context.navigator = { wakeLock: { request() { return requests++ ? Promise.resolve(newLock) : oldPromise; } } };
        h.phone.open({ id: 'a' }); const oldSession = h.phone.session;
        h.phone.setPhase(oldSession, 'listening', '已接通');
        const oldWork = h.phone.acquireWakeLock(oldSession);
        // ★ 同一申请未完成时重复调用不会再占一把锁。
        await h.phone.acquireWakeLock(oldSession); assert.equal(requests, 1);
        if (next === 'new-call') {
            await h.phone.hangup(); h.phone.open({ id: 'b' });
            h.phone.setPhase(h.phone.session, 'dialing', '拨打中');
            await h.phone.acquireWakeLock(h.phone.session);
        } else {
            h.phone.fail(oldSession, Error('暂停'));
            oldSession.micApproved = true;
            h.phone.unlockAudio = async () => {}; h.phone.reply = async () => {};
            await h.phone.retry();
        }
        if (result === 'success') pending.resolve(oldLock);
        else rejectOld(Error('旧申请失败'));
        await oldWork;
        assert.equal(h.phone.session.wakeLock, newLock); assert.equal(newLock.releases, 0);
        assert.equal(oldLock.releases, result === 'success' ? 1 : 0);
        assert.equal(h.element('phone-wake-hint').hidden, true);
        await h.phone.hangup(); assert.equal(newLock.releases, 1);
    }
});

test('锁屏/切后台及离开页面仍挂断并释放亮屏，不在返回页面时偷偷恢复电话', async () => {
    for (const event of ['visibilitychange', 'pagehide']) {
        const h = harness(), handlers = {}, lock = screenLock(); let requests = 0;
        h.context.navigator = { wakeLock: { async request() { requests++; return lock; } } };
        // ★ 注册真实页面事件；仅替换浏览器外壳，验证原挂断路径仍清理亮屏资源。
        h.context.document.addEventListener = (name, listener) => { handlers[name] = listener; };
        h.context.window = { addEventListener(name, listener) { handlers[name] = listener; } };
        h.context.MutationObserver = class { observe() {} };
        for (const id of ['phone-tts-provider', 'phone-stt-provider', 'phone-audition', 'phone-dial',
            'phone-done', 'phone-retry', 'phone-hangup', 'phone-close']) h.element(id).addEventListener = () => {};
        h.phone.init(); h.phone.open({ id: 'a' }); const s = h.phone.session;
        h.phone.setPhase(s, 'listening', '已接通');
        await h.phone.acquireWakeLock(s);
        h.context.document.hidden = true;
        handlers[event]();
        assert.equal(h.phone.session, null); assert.equal(s.controller.signal.aborted, true);
        assert.equal(lock.releases, 1); assert.equal(h.element('phone-wake-hint').hidden, true);
        h.context.document.hidden = false;
        handlers.visibilitychange();
        assert.equal(h.phone.session, null); assert.equal(requests, 1);
    }
});

test('服务商切换保留各自的表单草稿和角色音色，旧国际版配置继续可用', () => {
    const h = harness(), { phone, element } = h;
    const settings = h.state.settings = { PHONE_TTS_KEY: 'old-key', PHONE_TTS_MODEL: 'old-model' };
    const contact = { phoneVoiceId: 'old-voice' };
    phone.fillSettings(settings);
    phone.fillVoice(contact);
    assert.equal(element('phone-tts-key').value, 'old-key');
    assert.equal(element('edit-phone-voice').value, 'old-voice');
    phone.readTtsDraft();
    phone.showTtsConfig('minimax-cn');
    assert.equal(element('phone-tts-group-fields').hidden, false);
    element('phone-tts-key').value = 'cn-key';
    element('phone-tts-group-id').value = '1234';
    phone.readTtsDraft();
    phone.showTtsConfig('fish-audio');
    assert.equal(element('phone-tts-group-fields').hidden, true);
    assert.equal(element('phone-tts-key').value, '');
    element('phone-tts-key').value = 'fish-key';
    phone.saveSettings(settings);
    phone.fillVoice(contact);
    assert.match(element('edit-phone-voice-label').textContent, /reference_id/);
    assert.equal(element('edit-phone-voice').value, '');
    element('edit-phone-voice').value = 'fish-voice';
    phone.saveVoice(contact);
    assert.equal(phone.voiceFor(contact, 'fish-audio'), 'fish-voice');
    assert.equal(phone.voiceFor(contact, 'minimax-global'), 'old-voice');
    assert.equal(phone.ttsConfig(settings, 'minimax-cn').groupId, '1234');
    assert.equal(phone.ttsConfig(settings).key, 'fish-key');
    assert.equal(settings.PHONE_TTS_KEY, 'old-key');
});

test('四家语音接口各用自己的鉴权、模型和音色参数，统一返回可播放的音频', async () => {
    const h = harness(), { phone, context } = h;
    for (const [provider, host] of [
        ['minimax-global', 'api.minimax.io'], ['minimax-cn', 'api.minimaxi.com'],
        ['elevenlabs', 'api.elevenlabs.io'], ['fish-audio', 'api.fish.audio']
    ]) {
        const isMiniMax = provider.startsWith('minimax');
        context.fetch = async (url, options) => {
            const endpoint = new URL(url);
            const body = JSON.parse(options.body);
            assert.equal(endpoint.hostname, host);
            assert.equal(body.text, '你好');
            if (isMiniMax) {
                assert.equal(endpoint.searchParams.get('GroupId'), provider === 'minimax-cn' ? 'group+id' : null);
                assert.equal(body.voice_setting.voice_id, 'voice/id');
                assert.equal(body.model, 'model-for-' + provider);
                assert.equal(options.headers.Authorization, 'Bearer key-for-' + provider);
            } else if (provider === 'elevenlabs') {
                assert.match(endpoint.pathname, /voice%2Fid$/);
                assert.equal(body.model_id, 'model-for-' + provider);
                assert.equal(options.headers['xi-api-key'], 'key-for-' + provider);
            } else {
                assert.equal(body.reference_id, 'voice/id');
                assert.equal(options.headers.model, 'model-for-' + provider);
                assert.equal(options.headers.Authorization, 'Bearer key-for-' + provider);
            }
            return { ok: true, json: async () => ({ data: { audio: '494433' } }), blob: async () => new Blob(['ID3']) };
        };
        const result = await phone.synthesize('<think>不朗读</think>你好', 'voice/id', {
            PHONE_TTS_PROVIDER: provider,
            PHONE_TTS_CONFIGS: { [provider]: { key: 'key-for-' + provider, model: 'model-for-' + provider, groupId: 'group+id' } }
        });
        assert.equal(result.type, 'audio/mpeg');
        assert.equal(await result.text(), 'ID3');
    }
});

test('停止收音真正停止音轨，再请求媒体播放路由，不只禁用麦克风', () => {
    const h = harness(), events = [];
    const audioSession = {};
    Object.defineProperty(audioSession, 'type', { set(value) { events.push(value); } });
    h.context.navigator = { audioSession };
    const track = { enabled: true, stop() { events.push('track-stop'); } };
    const s = { stream: { getTracks: () => [track] }, chunks: [new Float32Array(10)] };
    h.phone.session = s;
    h.phone.stopListening(s);
    assert.deepEqual(events, ['track-stop', 'playback']);
    assert.equal(s.stream, null); assert.equal(track.enabled, false); assert.equal(s.chunks.length, 0);
});

test('麦克风在auto路由重新申请，挂断后迟到的授权立即释放', async () => {
    const h = harness(), pending = deferred(), events = [];
    h.phone.open({ id: 'a' }); const s = h.phone.session;
    const audioSession = {};
    Object.defineProperty(audioSession, 'type', { set(value) { events.push(value); } });
    h.context.navigator = { audioSession, mediaDevices: { getUserMedia() { events.push('capture'); return pending.promise; } } };
    const work = h.phone.acquireMicrophone(s);
    assert.deepEqual(events, ['auto', 'capture']);
    await h.phone.hangup();
    const track = { stop() { events.push('late-track-stop'); } };
    pending.resolve({ getTracks: () => [track] });
    assert.equal(await work, false); assert.ok(events.includes('late-track-stop'));
    assert.equal(s.stream, null);
});

test('拨打手势同步解锁AudioContext，不等待模型或音频下载', async () => {
    const h = harness(), resumed = deferred(), events = [];
    const context = { sampleRate: 48000, destination: {}, resume() { events.push('resume'); return resumed.promise; },
        createBuffer: () => ({}), createBufferSource: () => ({ connect() {}, disconnect() {}, start() { events.push('start'); } }) };
    h.phone.audioContext = context; h.phone.open({ id: 'a' });
    const work = h.phone.unlockAudio(h.phone.session);
    assert.deepEqual(events, ['resume', 'start']);
    resumed.resolve(); await work;
});

test('多轮通话播放复用已解锁的WebAudio，不再新建HTMLAudio，结束释放缓冲', async () => {
    const h = harness(), nodes = [], route = { type: 'auto' };
    h.context.navigator = { audioSession: route };
    h.context.Audio = function() { throw Error('电话不应新建HTMLAudio'); };
    h.phone.open({ id: 'a' }); const s = h.phone.session;
    h.phone.audioContext = { state: 'running', destination: {},
        async resume() {}, async decodeAudioData() { return {}; }, createBufferSource() {
            const node = { connect() {}, disconnect() { this.disconnected = true; }, start() {}, stop() {} };
            nodes.push(node); return node;
        } };
    for (let i = 0; i < 2; i++) {
        const work = h.phone.play(s, new Blob(['audio']));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(route.type, 'playback');
        const node = nodes.at(-1); assert.ok(node.buffer);
        node.onended(); await work;
        assert.equal(node.buffer, null); assert.equal(node.disconnected, true); assert.equal(s.cancelPlayback, null);
    }
    assert.equal(nodes.length, 2);
});

test('播放受限重试复用音频、不再次合成，错误提示区分播放和麦克风', async () => {
    const h = harness(); h.phone.open({ id: 'a' }); const s = h.phone.session;
    s.micApproved = true; s.audioSettings = {}; s.messages = [{ role: 'assistant', content: '你好', heard: false }];
    let synthesis = 0, playback = 0;
    h.phone.synthesize = async () => { synthesis++; return new Blob(['audio']); };
    h.phone.play = async () => {
        if (!playback++) { const error = new Error('autoplay denied'); error.name = 'NotAllowedError'; error.phoneStage = 'playback'; throw error; }
    };
    h.phone.unlockAudio = async () => {}; h.phone.listen = async () => {};
    try { await h.phone.speak(s, s.messages[0]); } catch (error) { h.phone.fail(s, error); }
    assert.match(h.toasts[0], /暂停了音频播放/); assert.ok(!h.toasts[0].includes('权限'));
    await h.phone.retry();
    assert.equal(synthesis, 1); assert.equal(playback, 2); assert.equal(s.pendingSpeech, null);
    assert.equal(s.messages[0].heard, true);
    assert.match(h.phone.reason({ name: 'NotAllowedError', phoneStage: 'microphone', message: 'denied' }), /麦克风/);
});

test('通话专用预设完整复用参数，不改变普通聊天绑定，留空时沿用角色设置', () => {
    const h = harness(), contact = { id: 'a', linkedPresetName: '昂贵模型', phonePresetName: '快速模型' };
    h.state.settings.API_PRESETS = [{ name: '快速模型' }];
    let received;
    h.context.App = { buildChatRequestSettings(c) {
        received = c;
        return { API_URL: 'https://example.test', API_KEY: 'test', MODEL: c.linkedPresetName,
            TEMPERATURE: 0.6, CUSTOM_REQUEST_BODY_JSON: '{"thinking":false}', ASYNC_BACKEND_ENABLED: true };
    } };
    const settings = h.phone.buildModelSettings(contact, contact.phonePresetName);
    assert.equal(settings.MODEL, '快速模型'); assert.equal(settings.TEMPERATURE, 0.6);
    assert.equal(settings.CUSTOM_REQUEST_BODY_JSON, '{"thinking":false}');
    assert.equal(settings.ASYNC_BACKEND_ENABLED, false);
    assert.equal(contact.linkedPresetName, '昂贵模型'); assert.notEqual(received, contact);
    assert.equal(h.phone.buildModelSettings(contact, '').MODEL, '昂贵模型');
    assert.throws(() => h.phone.buildModelSettings(contact, '已删除模型'), /已删除/);
});

test('总结使用单独预设且仍清洗CoT，留空时沿用本通电话模型', async () => {
    const h = harness(), contact = {};
    h.state.contacts.push(contact);
    h.state.settings.API_PRESETS = [{ name: '便宜总结' }];
    h.context.App = { buildChatRequestSettings: c => ({ API_URL: 'https://example.test', API_KEY: 'test', MODEL: c.linkedPresetName }) };
    let requested;
    h.context.API.chat = async (_messages, settings) => { requested = settings; return '<think>总结推理</think>双方约好明天见'; };
    const session = { id: 'call', summaryPresetName: '便宜总结', settings: { MODEL: '快速通话' }, messages: [{ role: 'user', content: '明天见' }] };
    const recap = h.phone.armRecap(contact, session);
    await h.phone.summarize(contact, session, recap);
    assert.equal(requested.MODEL, '便宜总结'); assert.equal(requested.COUNT_AS_INTERACTION, false);
    assert.equal(recap.summary, '双方约好明天见'); assert.equal(recap.roundsLeft, 2);
    session.summaryPresetName = '';
    await h.phone.summarize(contact, session, recap);
    assert.equal(requested.MODEL, '快速通话');
    assert.equal(session.settings.MODEL, '快速通话');
});

test('总结预设删除或调用失败时仍保留即时原文，不偷偷切回昂贵模型', async () => {
    const h = harness(), contact = {}; h.state.contacts.push(contact);
    const session = { id: 'call', summaryPresetName: '已删除', settings: { MODEL: '昂贵' }, messages: [{ role: 'user', content: '重要约定' }] };
    const recap = h.phone.armRecap(contact, session);
    await h.phone.summarize(contact, session, recap);
    assert.equal(h.requests.length, 0); assert.equal(recap.summary, '');
    assert.match(h.phone.buildRecapPrompt(contact), /重要约定/);
});

test('电话剔除各种推理标签，包含多个、嵌套、属性、未闭合和截断闭合块', () => {
    const { phone } = harness();
    for (const tag of ['think', 'thinking', 'thought', 'reasoning', 'analysis']) {
        assert.equal(phone.cleanText(`<${tag}>秘密推理</${tag}>你好`), '你好');
        assert.equal(phone.cleanText(`<${tag} class="cot">秘密推理</${tag}>你好`), '你好');
    }
    assert.equal(phone.cleanText('<THINK>秘密</THINK>你好<thought>秘密2</thought>呀'), '你好呀');
    assert.equal(phone.cleanText('<think>外层<thinking>内层</thinking>仍是秘密</think>你好'), '你好');
    assert.equal(phone.cleanText('你好<think>没有闭合的秘密'), '你好');
    assert.equal(phone.cleanText('截断的秘密</think>你好'), '你好');
    assert.equal(phone.cleanText('<think>纯思考'), '');
});

test('各供应商推理先统一为think，正文能完整读取，再由电话剔除', () => {
    const source = fs.readFileSync('script.js', 'utf8');
    const start = source.indexOf('    normalizeModelReply(data, provider) {');
    const end = source.indexOf('\n    },', start);
    const api = vm.runInNewContext('({' + source.slice(start, end + 7) + '})');
    const { phone } = harness();
    const cases = [
        ['openai', { choices: [{ message: { reasoning_content: '秘密推理', content: '你好' } }] }],
        ['openai', { choices: [{ message: { reasoningContent: '秘密推理', content: '你好' } }] }],
        ['claude', { content: [{ type: 'thinking', thinking: '秘密推理' }, { type: 'text', text: '你好' }] }],
        ['gemini', { candidates: [{ content: { parts: [{ thought: true, text: '秘密推理' }, { text: '你好' }] } }] }]
    ];
    for (const [provider, data] of cases) {
        const normalized = api.normalizeModelReply(data, provider);
        assert.match(normalized, /<think>/);
        assert.equal(phone.cleanText(normalized), '你好');
    }
});

test('推理不进电话显示、TTS、后续上下文，只有思考时不显示也不播放', async () => {
    const h = harness(), contact = { id: 'a', name: '角色' };
    h.phone.open(contact);
    const s = h.phone.session; s.settings = {};
    s.bridge = [{ role: 'assistant', content: '<think>桥接秘密</think>之前的正文' }];
    s.messages = [{ role: 'user', content: '你好' }, { role: 'assistant', content: '<thinking>旧秘密</thinking>旧正文' }];
    let payload, spoken;
    h.context.API.chat = async messages => { payload = messages; return '<think>当前秘密</think>电话正文'; };
    h.phone.synthesize = async text => { spoken = text; return new Blob(); };
    h.phone.play = async () => {}; h.phone.listen = async () => {};
    await h.phone.reply(s);
    assert.equal(spoken, '电话正文');
    assert.equal(s.messages.at(-1).content, '电话正文');
    assert.equal(h.element('phone-transcript').children.at(-1).textContent, '电话正文');
    assert.ok(!JSON.stringify(payload).includes('秘密'));
    h.context.API.chat = async () => '<think>只有秘密</think>';
    const length = s.messages.length; spoken = null;
    await assert.rejects(h.phone.reply(s), /没有可播放/);
    assert.equal(s.messages.length, length); assert.equal(spoken, null);
});

test('回顾原文、总结输入输出和旧回顾注入都不携带推理', async () => {
    const h = harness(), contact = {}; h.state.contacts.push(contact);
    const session = { id: 'call', settings: {}, messages: [
        { role: 'assistant', content: '<think>秘密推理</think>明天见', heard: false },
        { role: 'user', content: '后天吧' }
    ] };
    const recap = h.phone.armRecap(contact, session);
    assert.equal(recap.fallback, '角色：明天见（未完整播放）\n用户：后天吧');
    h.context.API.chat = async messages => {
        assert.ok(!JSON.stringify(messages).includes('秘密推理'));
        assert.equal(messages[1].role, 'user');
        assert.equal(messages[1].content, 'char：明天见（未完整播放）\nuser：后天吧');
        return '<thinking>总结秘密</thinking>双方约定明天见';
    };
    await h.phone.summarize(contact, session, recap);
    assert.equal(recap.summary, '双方约定明天见');
    recap.summary = '<think>旧总结秘密</think>双方约定';
    assert.ok(!h.phone.buildRecapPrompt(contact).includes('秘密'));
    recap.summary = '<think>纯推理</think>';
    assert.match(h.phone.buildRecapPrompt(contact), /明天见/);
});

test('电话是临时覆盖层，线上/线下原模式都不变化，空会话不产生回顾', async () => {
    for (const mode of ['online', 'offline']) {
        const h = harness(), contact = { id: 'a', name: '角色', chatMode: mode, history: [{ content: '线上' }], offlineHistory: [{ content: '线下' }] };
        h.state.contacts.push(contact);
        h.phone.open(contact);
        assert.equal(h.phone.session.bridge[0].content, mode === 'offline' ? '线下' : '线上');
        assert.equal(contact.chatMode, mode);
        await h.phone.hangup();
        assert.equal(h.phone.session, null);
        assert.equal(h.element('phone-page').hidden, true);
        assert.equal(contact.phoneRecaps, undefined);
        assert.equal(contact.chatMode, mode);
    }
});

test('只有接通首轮发送开场指令，后续回复沿用通话记录', async () => {
    const h = harness(), contact = { id: 'a', name: '角色' };
    h.phone.open(contact);
    const s = h.phone.session;
    s.settings = {};
    const requests = [];
    h.context.API.chat = async messages => { requests.push(messages); return '喂，你好'; };
    h.phone.speak = async () => {};

    await h.phone.reply(s);
    s.messages.push({ role: 'user', content: '你方便说话吗？' });
    await h.phone.reply(s);

    assert.doesNotMatch(requests[0][0].content, /第一句话/);
    assert.equal(requests[0].at(-1).role, 'user');
    assert.equal(requests[0].at(-1).content, '【电话已拨出，请接听并先说第一句话】');
    assert.equal(requests[1].at(-1).content, '你方便说话吗？');
    assert.ok(!requests[1].some(message => message.content.includes('第一句话')));
});

test('回顾只取最近6条；前两轮反复重生成仍注入，第三轮停止注入', () => {
    const h = harness(), c = {};
    const messages = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: `发言${i}`, heard: true }));
    h.phone.armRecap(c, { id: 'first', messages });
    assert.ok(!h.phone.buildRecapPrompt(c).includes('发言3'));
    assert.ok(h.phone.buildRecapPrompt(c).includes('发言4'));
    for (const [roundId, roundsLeft] of [['u1', 1], ['u2', 0]]) {
        // ★ 同一条用户消息反复 reroll，每次重新构建 API 上下文。
        for (let request = 0; request < 3; request++) {
            const snapshot = h.phone.capture(c, roundId);
            assert.ok(h.phone.buildRecapPrompt(c, snapshot).includes('发言9'));
            h.phone.consume(c, snapshot, roundId);
            assert.equal(c.phoneRecaps[0].roundsLeft, roundsLeft);
        }
    }
    assert.equal(h.phone.buildRecapPrompt(c, h.phone.capture(c, 'u3')), '');
});

test('旧请求的回顾快照不消费后来挂断的电话', () => {
    const h = harness(), c = {};
    const messages = [{ role: 'user', content: '你好' }];
    h.phone.armRecap(c, { id: 'first', messages });
    const snapshot = h.phone.capture(c, 'u1');
    h.phone.armRecap(c, { id: 'second', messages });
    h.phone.consume(c, snapshot, 'u1');
    assert.equal(c.phoneRecaps[0].roundsLeft, 1);
    assert.equal(c.phoneRecaps[1].roundsLeft, 2);
});

test('后台总结晚返回只替换自己的正文，不重置轮数，也不覆盖下一通电话', async () => {
    const h = harness(), c = {}, pending = deferred();
    h.state.contacts.push(c);
    const session = { id: 'first', messages: [{ role: 'user', content: '明天见' }], settings: {} };
    const recap = h.phone.armRecap(c, session);
    h.context.API.chat = () => pending.promise;
    const work = h.phone.summarize(c, session, recap);
    h.phone.consume(c, ['first'], 'u1'); h.phone.consume(c, ['first'], 'u2');
    h.phone.armRecap(c, { id: 'second', messages: [{ role: 'user', content: '后天见' }] });
    pending.resolve('双方约定明天见面'); await work;
    assert.equal(recap.roundsLeft, 0);
    assert.equal(recap.summary, '双方约定明天见面');
    assert.equal(c.phoneRecaps[1].summary, '');
    assert.ok(!h.phone.buildRecapPrompt(c).includes('双方约定明天见面'));
});

test('挂断立即禁用麦克风、中止请求和播放，迟到台词不渲染、不生成语音', async () => {
    const h = harness(), c = { id: 'a' }, pending = deferred();
    h.state.contacts.push(c); h.phone.open(c);
    const s = h.phone.session;
    s.settings = {}; s.voice = 'voice';
    let stopped = false, cancelled = false, synthesized = false;
    const track = { enabled: true, stop() { stopped = true; } };
    s.stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    s.cancelPlayback = () => { cancelled = true; };
    h.context.API.chat = () => pending.promise;
    h.phone.synthesize = async () => { synthesized = true; };
    const work = h.phone.reply(s);
    assert.equal(track.enabled, false);
    await h.phone.hangup(); pending.resolve('迟到的台词'); await work;
    assert.equal(stopped, true); assert.equal(cancelled, true);
    assert.equal(s.controller.signal.aborted, true);
    assert.equal(s.messages.length, 0); assert.equal(synthesized, false);
});

test('试听使用固定句子和已填音色，失败给Toast原因并恢复按钮', async () => {
    const h = harness();
    h.state.settings = { PHONE_TTS_KEY: 'key', PHONE_TTS_MODEL: 'model' };
    h.element('edit-phone-voice').value = 'my_voice';
    let got;
    h.phone.synthesize = async (...args) => { got = args; throw new Error('语音生成失败：音色不存在'); };
    await h.phone.audition();
    assert.equal(got[0], '你好呀，可以听到我的声音吗？'); assert.equal(got[1], 'my_voice');
    assert.equal(h.toasts[0], '语音生成失败：音色不存在');
    assert.equal(h.element('phone-audition').disabled, false);
    assert.equal(h.phone.preview, null);
});

test('PCM转换符合DeepSeek单声道16kHz/16bit WAV格式', async () => {
    const { phone } = harness();
    const blob = phone.wav([new Float32Array(48000).fill(0.5)], 48000);
    const data = new DataView(await blob.arrayBuffer());
    assert.equal(blob.size, 32044); assert.equal(blob.type, 'audio/wav');
    assert.equal(data.getUint32(24, true), 16000); assert.equal(data.getUint16(22, true), 1);
    assert.equal(data.getUint16(34, true), 16); assert.equal(data.getInt16(44, true), 16383);
});

test('角色语音播放结束才打开麦克风；挂断时的未播完内容有标记', async () => {
    const h = harness(), c = { id: 'a' }, playback = deferred();
    h.phone.open(c); const s = h.phone.session; s.audioSettings = {}; s.voice = 'voice';
    let listening = false;
    h.phone.synthesize = async () => new Blob(); h.phone.play = () => playback.promise;
    h.phone.listen = async () => { listening = true; };
    const message = { role: 'assistant', content: '你好', heard: false };
    const work = h.phone.speak(s, message);
    await new Promise(r => setImmediate(r));
    assert.equal(listening, false); assert.match(h.phone.transcript([message]), /未完整播放/);
    playback.resolve(); await work;
    assert.equal(listening, true); assert.equal(message.heard, true);
});

// ★ 新气泡和状态按钮同一轮更新：下一帧按最新高度滚底，旧通话不能影响新页面。
test('电话新气泡滚到底部，按钮布局变化后重新对齐，挂断后的回调不再滚动', () => {
    const { phone, element, context } = harness();
    const frames = [];
    context.requestAnimationFrame = callback => frames.push(callback);
    const session = { controller: new AbortController() };
    phone.session = session;
    const transcript = element('phone-transcript');
    transcript.scrollHeight = 800;
    transcript.scrollTop = 100;
    phone.addText(session, { role: 'assistant', content: '新回复' });
    assert.equal(transcript.children[0].textContent, '新回复');
    assert.equal(transcript.scrollTop, 800);
    transcript.scrollHeight = 900;
    frames.shift()();
    assert.equal(transcript.scrollTop, 900);
    phone.addText(session, { role: 'user', content: '我的回答' });
    phone.session = null;
    transcript.scrollTop = 0;
    frames.shift()();
    assert.equal(transcript.scrollTop, 0);
});

// ★ 完整历史不受回顾裁剪影响；落库只包含文本字段，不携带音频或密钥。
test('完整通话逐句保存且同一通不重复，挂断补齐时间，不受回顾裁剪影响', async () => {
    const { phone, state } = harness();
    const contact = { id: 'history-contact' };
    state.contacts.push(contact);
    const s = { id: 'call-1', contact, startedAt: Date.now() - 9000, messages: [], audioSettings: { key: 'secret' } };
    await phone.saveRecord(s);
    assert.equal(contact.phoneRecords, undefined);
    for (let i = 0; i < 10; i++) {
        s.messages.push({ role: i % 2 ? 'user' : 'assistant', content: `台词${i}`, timestamp: Date.now(), heard: false, blob: new Blob(['audio']) });
        await phone.saveRecord(s);
    }
    assert.equal(contact.phoneRecords.length, 1);
    assert.equal(contact.phoneRecords[0].messages.length, 10);
    assert.equal(contact.phoneRecords[0].endedAt, null);
    s.messages[0].heard = true;
    await phone.saveRecord(s, true);
    const record = contact.phoneRecords[0];
    assert.ok(record.endedAt >= record.startedAt);
    assert.equal(record.messages[0].heard, true);
    assert.equal(record.messages[0].blob, undefined);
    assert.equal(record.audioSettings, undefined);
    const recap = phone.armRecap(contact, s);
    assert.ok(!recap.fallback.includes('台词0'));
    assert.equal(record.messages[0].content, '台词0');
    // ★ 保存对象是台词快照，后续内存修改不会悄悄篡改旧记录。
    s.messages[0].content = '修改';
    assert.equal(record.messages[0].content, '台词0');
});

test('保存失败提示且下一句可重试，删除角色后不恢复其通话记录', async () => {
    const h = harness(), { phone, state, context } = h;
    const contact = { id: 'retry-contact' };
    state.contacts.push(contact);
    const s = { id: 'call-retry', contact, messages: [{ role: 'user', content: '你好' }] };
    context.Storage.saveContacts = async () => { throw new Error('disk full'); };
    await phone.saveRecord(s);
    assert.ok(h.toasts.includes('通话记录保存失败，请勿刷新页面'));
    let saved = false;
    context.Storage.saveContacts = async () => { saved = true; };
    await phone.saveRecord(s, true);
    assert.equal(saved, true);
    state.contacts = [];
    saved = false;
    await phone.saveRecord(s, true);
    assert.equal(saved, false);
});
