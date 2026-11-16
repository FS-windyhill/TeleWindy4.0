// ★ 聊天语音输入：线上/线下共用一轮录音，只把识别结果回填到当前输入框。
const ChatVoiceInput = {
    session: null,
    microphoneGranted: false,

    isCurrent(s) {
        return this.session === s && !document.hidden
            && STATE.currentContactId === s.contactId && s.input.offsetParent !== null;
    },

    setPhase(s, phase) {
        s.phase = phase;
        const recording = phase === 'recording';
        const busy = phase === 'preparing' || phase === 'recognizing';
        s.button.setAttribute('aria-pressed', String(recording));
        s.button.setAttribute('aria-busy', String(busy));
        s.button.title = recording ? '结束录音' : phase === 'recognizing' ? '正在转文字…'
            : phase === 'preparing' ? '正在开启麦克风…'
            : phase === 'armed' ? '再点一次开始录音' : '语音输入';
    },

    // ★ 先判断是否需要提示用户授权；实际录音由后续的按钮状态决定。
    async microphonePermission() {
        try {
            return (await navigator.permissions?.query({ name: 'microphone' }))?.state;
        } catch {
            // 有些浏览器不支持查询麦克风权限，改用本页最近一次授权结果。
            return undefined;
        }
    },

    async toggle(button, input) {
        const active = this.session;
        if (active) {
            if (active.button !== button) return;
            if (active.phase === 'armed') {
                await this.startAuthorizedWav(active);
                return;
            }
            if (active.phase === 'preparing') this.cancel();
            if (active.phase === 'recording') await this.finish(active);
            return;
        }
        if (PhoneCall.session) {
            Toast.show('请先结束电话通讯');
            return;
        }
        const contactId = STATE.currentContactId;
        if (!contactId || input.offsetParent === null) return;
        const settings = { ...PhoneCall.defaults, ...STATE.settings };
        const browser = settings.PHONE_STT_PROVIDER === 'browser';
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (browser && !Recognition) {
            Toast.show('当前浏览器不支持系统语音识别，请切换识别服务');
            return;
        }
        if (!browser && (!settings.PHONE_STT_URL || !settings.PHONE_STT_KEY)) {
            Toast.show('请先在通话模型中填写语音识别地址和密钥');
            return;
        }
        const s = this.session = {
            button, input, contactId, settings, browser,
            controller: new AbortController(), chunks: [], transcripts: []
        };
        this.setPhase(s, 'preparing');
        try {
            // ★ 在点击回调里解锁 Web Audio，避免等完异步权限后失去移动端的手势授权。
            if (!browser) this.prepareWav(s);
            const permission = await this.microphonePermission();
            if (!this.isCurrent(s)) return;
            if (permission === 'denied') {
                this.microphoneGranted = false;
                throw new Error('麦克风权限已关闭，请在浏览器设置里开启');
            }
            // ★ 有些浏览器的临时授权仍显示 prompt，本页成功取过音轨后就可以开始录音。
            const needsPermission = permission !== 'granted' && !this.microphoneGranted;
            if (needsPermission || !browser) {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前页面无法访问麦克风，请使用 HTTPS 打开');
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true }
                });
                this.microphoneGranted = true;
                if (!this.isCurrent(s)) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                if (needsPermission) {
                    if (browser) stream.getTracks().forEach(track => track.stop());
                    else this.armWav(s, stream);
                    Toast.show('麦克风已授权，再点一次开始录音');
                    return;
                }
                s.stream = stream;
            }
            await this.startCapture(s, Recognition);
        } catch (error) {
            this.fail(s, error);
        } finally {
            if (this.session === s && !this.isCurrent(s)) this.cancel();
            if (this.session === s && s.phase === 'preparing' && !s.startTimer) this.cancel();
        }
    },

    // ★ 本地文件可能每次申请都弹窗。短暂保留已授权的禁用音轨，第二次点击直接使用它。
    armWav(s, stream) {
        this.releaseWav(s);
        s.stream = stream;
        stream.getAudioTracks().forEach(track => { track.enabled = false; });
        this.setPhase(s, 'armed');
        s.armTimer = setTimeout(() => {
            if (this.session === s) this.cancel();
        }, 15000);
    },

    async startAuthorizedWav(s) {
        clearTimeout(s.armTimer);
        this.setPhase(s, 'preparing');
        try {
            const tracks = s.stream.getAudioTracks().filter(track => track.readyState === 'live');
            if (!tracks.length) throw new Error('麦克风已断开，请再点一次重试');
            this.prepareWav(s);
            tracks.forEach(track => { track.enabled = true; });
            await this.startCapture(s);
        } catch (error) {
            this.fail(s, error);
        }
    },

    async startCapture(s, Recognition) {
        // ★ 权限弹窗等用户选择；已拿到权限但音频没启动时，释放麦克风并提示重试。
        s.startTimer = setTimeout(() => this.fail(s, new Error('麦克风未能启动，请再点一次重试')), 8000);
        if (s.browser) this.startBrowser(s, Recognition);
        else await this.startWav(s);
    },

    beginRecording(s) {
        if (s.phase === 'recording') return;
        clearTimeout(s.startTimer);
        s.startTimer = null;
        this.setPhase(s, 'recording');
        // ★ 与通话一样限制 WAV 大小，录音期间的停顿不触发提交。
        s.limit = setTimeout(() => {
            if (!this.isCurrent(s)) return;
            Toast.show('已达到录音时长上限');
            void this.finish(s);
        }, 110000);
    },

    prepareWav(s) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error('当前浏览器不支持录音');
        s.context = new AudioContext();
        // ★ 先接住错误，等权限通过后再提示；授权探测这一轮会直接释放音频通道。
        s.resumeError = s.context.resume().then(() => null, error => error);
    },

    async startWav(s) {
        const error = await s.resumeError;
        if (!this.isCurrent(s)) return;
        if (error) throw error;
        const context = s.context;
        if (context.state !== 'running') throw new Error('音频通道未启动，请重新录音');
        // ★ 沿用通话的 PCM WAV 格式；录音节点静音接出，避免麦克风声音外放。
        s.source = context.createMediaStreamSource(s.stream);
        s.processor = context.createScriptProcessor(4096, 1, 1);
        s.mute = context.createGain();
        s.mute.gain.value = 0;
        s.source.connect(s.processor);
        s.processor.connect(s.mute);
        s.mute.connect(context.destination);
        s.processor.onaudioprocess = event => {
            if (s.phase === 'recording') s.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        };
        s.stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
            if (s.phase === 'recording') this.fail(s, new Error('麦克风已断开'));
        }));
        this.beginRecording(s);
    },

    startBrowser(s, Recognition) {
        const recognition = s.recognition = new Recognition();
        recognition.lang = navigator.language || 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onaudiostart = () => {
            if (this.isCurrent(s) && s.phase === 'preparing') this.beginRecording(s);
        };
        recognition.onresult = event => {
            // ★ 点停止后系统还可能返回最后一段结果，等 onend 再一起回填。
            s.browserText = Array.from(event.results, result => result[0].transcript).join('');
        };
        recognition.onerror = event => {
            if (event.error === 'not-allowed' && this.session === s) this.microphoneGranted = false;
            if (event.error !== 'no-speech') this.fail(s, new Error(`系统语音识别失败：${event.error}`));
        };
        recognition.onend = () => {
            if (!this.isCurrent(s)) return;
            if (s.browserText?.trim()) s.transcripts.push(s.browserText.trim());
            s.browserText = '';
            if (s.phase === 'recognizing') {
                s.finishBrowser?.();
            } else if (s.phase === 'recording') {
                // ★ 有些系统会在停顿后结束这一段，用户没点停止时继续下一段。
                try { recognition.start(); }
                catch (error) { this.fail(s, error); }
            } else {
                this.fail(s, new Error('未能开启系统语音识别，请重试'));
            }
        };
        recognition.start();
    },

    async finish(s) {
        if (!this.isCurrent(s) || s.phase !== 'recording') return;
        this.setPhase(s, 'recognizing');
        clearTimeout(s.limit);
        Toast.show('正在转文字…', { icon: 'loader' });
        try {
            let text;
            if (s.browser) {
                await new Promise(resolve => {
                    s.finishBrowser = resolve;
                    s.finishTimer = setTimeout(resolve, 3000);
                    s.recognition.stop();
                });
                text = [...s.transcripts, s.browserText].filter(Boolean).join(' ');
            } else {
                const sampleRate = s.context.sampleRate;
                this.releaseWav(s);
                if (s.chunks.length) {
                    const blob = PhoneCall.wav(s.chunks, sampleRate);
                    s.chunks.length = 0;
                    text = await PhoneCall.transcribeWav(blob, s.settings, s.controller.signal);
                }
            }
            if (!this.isCurrent(s)) return;
            text = String(text || '').trim();
            if (!text) {
                Toast.show('没有识别到语音，请重试', { icon: 'triangle-exclamation-point' });
                return;
            }
            // ★ 插在当前选区末尾，保留原稿；触发原有 input 事件重新计算高度。
            const end = s.input.selectionEnd;
            s.input.setRangeText(text, end, end, 'end');
            s.input.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (error) {
            this.fail(s, error);
        } finally {
            if (this.session === s) this.cancel();
        }
    },

    releaseWav(s) {
        s.stream?.getTracks().forEach(track => track.stop());
        s.stream = null;
        if (s.processor) {
            s.processor.onaudioprocess = null;
            s.processor.disconnect();
            s.processor = null;
        }
        s.source?.disconnect();
        s.mute?.disconnect();
        s.source = s.mute = null;
        if (s.context && s.context.state !== 'closed') void s.context.close().catch(() => {});
        s.context = null;
    },

    fail(s, error) {
        if (this.session !== s) return;
        const shouldNotify = this.isCurrent(s);
        if (error.name === 'NotAllowedError') this.microphoneGranted = false;
        this.cancel();
        if (shouldNotify) {
            Toast.show(error.name === 'NotAllowedError' ? '无法访问麦克风，请检查浏览器权限' : error.message || '语音输入失败，请重试');
        }
    },

    cancel() {
        const s = this.session;
        if (!s) return;
        this.session = null;
        clearTimeout(s.armTimer);
        clearTimeout(s.startTimer);
        clearTimeout(s.limit);
        clearTimeout(s.finishTimer);
        s.finishBrowser?.();
        s.controller.abort();
        if (s.recognition) {
            s.recognition.onaudiostart = s.recognition.onresult = s.recognition.onerror = s.recognition.onend = null;
            s.recognition.abort();
        }
        this.releaseWav(s);
        s.chunks.length = 0;
        this.setPhase(s, 'idle');
    },

    init() {
        document.querySelectorAll('[data-voice-input]').forEach(button => {
            const input = document.getElementById(button.dataset.voiceInput);
            // ★ 鼠标点图标时保留文本光标，也支持 Tab 后按键触发按钮。
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', () => void this.toggle(button, input));
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.cancel();
        });
        window.addEventListener('pagehide', () => this.cancel());
    }
};

window.ChatVoiceInput = ChatVoiceInput;
document.addEventListener('DOMContentLoaded', () => ChatVoiceInput.init());
