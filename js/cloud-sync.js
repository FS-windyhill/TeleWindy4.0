// =========================================
// 云同步独立服务：自定义服务器 / GitHub Gist 备份恢复
// 这里只负责同步流程，真正的数据导入导出交给 Storage 处理
// =========================================

// =========================================
// 5. CLOUD SYNC (终极混合版 - 含安全防御)
// =========================================
//   - _deriveBackupKey(): 用同步主密码派生 AES-GCM 密钥
//   - _askBackupPassphrase(): 用站内弹窗索取/复用同步主密码
//   - forgetRememberedPassphrase(): 清掉本浏览器记住的同步主密码
//   - _encryptBackupPayload(): 上传前加密整个备份 data，保护 API Key / Token
//   - _decryptBackupIfNeeded(): 恢复时识别加密备份，并用同步主密码解开
//   - _validateBackupBeforeUpload(): 上传前检查明文/密文备份结构，避免空备份覆盖云端
const CloudSync = {
    rememberPassphraseKey: 'TW_SYNC_BACKUP_PASSPHRASE_V1',
    gistSingleFileName: 'telewindy-backup.json',
    gistManifestFileName: 'telewindy-backup-manifest.json',
    gistChunkFilePrefix: 'telewindy-backup-part-',
    gistChunkSize: 4 * 1024 * 1024,

    els: {
        provider: document.getElementById('sync-provider'),
        urlInput: document.getElementById('custom-url'),
        gistIdInput: document.getElementById('gist-id-input'),
        token: document.getElementById('gist-token'), // 这里填密码/Token
        status: document.getElementById('gist-status'),
        groupUrl: document.getElementById('group-custom-url'),
        groupGistId: document.getElementById('group-gist-id'),
        groupGistTutorial: document.getElementById('group-gist-tutorial'),
        authLabel: document.getElementById('auth-label'),
        forgetPassphraseBtn: document.getElementById('sync-forget-passphrase'),
        passphraseModal: document.getElementById('sync-passphrase-modal'),
        passphraseTitle: document.getElementById('sync-passphrase-title'),
        passphraseDesc: document.getElementById('sync-passphrase-desc'),
        passphraseInput: document.getElementById('sync-passphrase-input'),
        passphraseConfirmWrap: document.getElementById('sync-passphrase-confirm-wrap'),
        passphraseConfirm: document.getElementById('sync-passphrase-confirm'),
        passphraseRemember: document.getElementById('sync-passphrase-remember'),
        passphraseError: document.getElementById('sync-passphrase-error'),
        passphraseForget: document.getElementById('sync-passphrase-forget'),
        passphraseCancel: document.getElementById('sync-passphrase-cancel'),
        passphraseConfirmBtn: document.getElementById('sync-passphrase-confirm-btn')
    },

    init() {
        // 恢复上次的选择
        const savedMode = localStorage.getItem('SYNC_MODE') || 'gist';
        if(this.els.provider) this.els.provider.value = savedMode;

        const savedUrl = localStorage.getItem('SYNC_CUSTOM_URL');
        if(savedUrl && this.els.urlInput) this.els.urlInput.value = savedUrl;

        const savedGistId = localStorage.getItem(CONFIG.GIST_ID_KEY);
        if(savedGistId && this.els.gistIdInput) this.els.gistIdInput.value = savedGistId;

        this.toggleMode();

        // 这个按钮只清本浏览器 localStorage，不会碰云端备份。
        this.els.forgetPassphraseBtn?.addEventListener('click', () => this.forgetRememberedPassphrase(true));
    },

    toggleMode() {
        const mode = this.els.provider.value;
        localStorage.setItem('SYNC_MODE', mode);

        if (mode === 'custom') {
            this.els.groupUrl.style.display = 'flex';
            if (this.els.groupGistTutorial) this.els.groupGistTutorial.style.display = 'none';
            this.els.groupGistId.style.display = 'none';
            this.els.authLabel.textContent = '服务器访问密码 (Secret Key)';
        } else {
            this.els.groupUrl.style.display = 'none';
            if (this.els.groupGistTutorial) this.els.groupGistTutorial.style.display = 'block';
            this.els.groupGistId.style.display = 'flex';
            this.els.authLabel.textContent = 'GitHub Token';
        }
    },

    openGistTutorial() {
        document.getElementById('gist-tutorial-modal')?.classList.remove('hidden');
    },

    closeGistTutorial(event = null) {
        // 允许点击遮罩关闭；按钮调用时没有 event，也直接关闭。
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('gist-tutorial-modal')?.classList.add('hidden');
    },
    showStatus(msg, isError = false) {
        if(!this.els.status) return;
        this.els.status.textContent = msg;
        this.els.status.style.color = isError ? '#f92f2fff' : '#3ec444ff';
        // 桌面云同步卡片只做快捷显示；主状态一变，就顺手同步过去。
        if (typeof App !== 'undefined' && typeof App.renderDesktopCloudSyncStatus === 'function') {
            App.renderDesktopCloudSyncStatus();
        }
    },

    _getCrypto() {
        return window.crypto && window.crypto.subtle ? window.crypto : null;
    },

    _bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        const chunks = [];
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            chunks.push(String.fromCharCode.apply(null, chunk));
        }
        return btoa(chunks.join(''));
    },

    _base64ToBuffer(text) {
        const binary = atob(text);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    },

    async _compressBackupBytes(bytes) {
        // ★ 压缩放在加密前：云端只看到 AES-GCM 密文，不会看到明文压缩包。
        if (typeof CompressionStream !== 'function') {
            return { bytes, compression: 'none' };
        }

        try {
            const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
            const buffer = await new Response(stream).arrayBuffer();
            return { bytes: new Uint8Array(buffer), compression: 'gzip' };
        } catch (e) {
            console.warn('[CloudSync] gzip compress failed, fallback to plain encrypted backup:', e);
            return { bytes, compression: 'none' };
        }
    },

    async _decompressBackupBytes(bytes, compression) {
        if (!compression || compression === 'none') return bytes;
        if (compression !== 'gzip') throw new Error('加密备份压缩格式不受支持');
        if (typeof DecompressionStream !== 'function') throw new Error('当前浏览器不支持解压这份云备份');

        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
    },

    async _deriveBackupKey(passphrase, saltBuffer) {
        const cryptoApi = this._getCrypto();
        if (!cryptoApi) throw new Error('当前浏览器不支持安全加密，无法加密云备份');

        const encoder = new TextEncoder();
        const baseKey = await cryptoApi.subtle.importKey(
            'raw',
            encoder.encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        // 云同步主密码不落库；这里用较高迭代次数，把弱密码暴力破解成本抬高一点。
        return await cryptoApi.subtle.deriveKey(
            { name: 'PBKDF2', salt: saltBuffer, iterations: 250000, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    forgetRememberedPassphrase(showMessage = false) {
        localStorage.removeItem(this.rememberPassphraseKey);
        if (this.els.passphraseRemember) this.els.passphraseRemember.checked = false;
        if (showMessage) this.showStatus('已忘记本设备保存的同步主密码');
    },

    async _askBackupPassphrase(actionText, confirmTwice = false) {
        // 即使本设备记住了，也照样打开弹窗；只是预填密码，给用户一个确认/忘记的机会。
        return await this._openPassphraseModal(actionText, confirmTwice);
    },

    _openPassphraseModal(actionText, confirmTwice = false) {
        const modal = this.els.passphraseModal;
        if (!modal) throw new Error('同步主密码窗口没有加载完成');

        return new Promise((resolve, reject) => {
            const input = this.els.passphraseInput;
            const confirmInput = this.els.passphraseConfirm;
            const rememberInput = this.els.passphraseRemember;
            const errorBox = this.els.passphraseError;
            const confirmWrap = this.els.passphraseConfirmWrap;
            const remembered = localStorage.getItem(this.rememberPassphraseKey) || '';

            // 默认不记住；如果本浏览器已经保存过，就像网页登录框一样自动带出来。
            input.value = remembered;
            input.type = 'password';
            if (confirmInput) confirmInput.value = remembered && confirmTwice ? remembered : '';
            if (confirmInput) confirmInput.type = 'password';
            modal.querySelectorAll('.sync-passphrase-eye').forEach((icon) => {
                const iconClosed = icon.querySelector('.svg-eye-closed');
                const iconOpen = icon.querySelector('.svg-eye-open');
                if (iconClosed) iconClosed.style.display = 'inline-block';
                if (iconOpen) iconOpen.style.display = 'none';
            });
            if (rememberInput) rememberInput.checked = Boolean(remembered);
            if (errorBox) errorBox.textContent = '';
            if (confirmWrap) confirmWrap.style.display = confirmTwice ? 'flex' : 'none';
            if (this.els.passphraseTitle) this.els.passphraseTitle.textContent = actionText + '：同步主密码';
            if (this.els.passphraseDesc) {
                this.els.passphraseDesc.textContent = confirmTwice
                    ? '请输入同步主密码，本次云备份会用它加密。其他设备恢复时也要输入同一个密码。'
                    : '请输入这份云备份当时使用的同步主密码。';
            }

            const setError = (msg) => {
                if (errorBox) errorBox.textContent = msg;
            };

            const close = () => {
                modal.classList.add('hidden');
                this.els.passphraseCancel?.removeEventListener('click', onCancel);
                this.els.passphraseConfirmBtn?.removeEventListener('click', onConfirm);
                this.els.passphraseForget?.removeEventListener('click', onForget);
                modal.removeEventListener('click', onOverlayClick);
                document.removeEventListener('keydown', onKeydown);
            };

            const onCancel = () => {
                close();
                reject(new Error('已取消：未填写同步主密码'));
            };

            const onForget = () => {
                this.forgetRememberedPassphrase(false);
                input.value = '';
                if (confirmInput) confirmInput.value = '';
                setError('已忘记本设备保存的同步主密码');
                input.focus();
            };

            const onConfirm = () => {
                const passphrase = input.value || '';
                const repeated = confirmInput ? confirmInput.value || '' : '';
                if (!passphrase) {
                    setError('请填写同步主密码');
                    input.focus();
                    return;
                }
                if (confirmTwice && repeated !== passphrase) {
                    setError('两次同步主密码不一致');
                    confirmInput.focus();
                    return;
                }

                if (rememberInput?.checked) {
                    localStorage.setItem(this.rememberPassphraseKey, passphrase);
                } else {
                    localStorage.removeItem(this.rememberPassphraseKey);
                }

                close();
                resolve(passphrase);
            };

            const onOverlayClick = (event) => {
                if (event.target === modal) onCancel();
            };

            const onKeydown = (event) => {
                if (event.key === 'Escape') onCancel();
                if (event.key === 'Enter') onConfirm();
            };

            this.els.passphraseCancel?.addEventListener('click', onCancel);
            this.els.passphraseConfirmBtn?.addEventListener('click', onConfirm);
            this.els.passphraseForget?.addEventListener('click', onForget);
            modal.addEventListener('click', onOverlayClick);
            document.addEventListener('keydown', onKeydown);

            modal.classList.remove('hidden');
            setTimeout(() => input.focus(), 0);
        });
    },

    async _encryptBackupPayload(payload) {
        const cryptoApi = this._getCrypto();
        if (!cryptoApi) throw new Error('当前浏览器不支持安全加密，无法加密云备份');

        const passphrase = await this._askBackupPassphrase('上传云备份', true);
        const salt = cryptoApi.getRandomValues(new Uint8Array(16));
        const iv = cryptoApi.getRandomValues(new Uint8Array(12));
        const key = await this._deriveBackupKey(passphrase, salt.buffer);
        const sourceBytes = new TextEncoder().encode(JSON.stringify(payload.data));
        const packed = await this._compressBackupBytes(sourceBytes);
        const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed.bytes);

        return {
            backup_at: payload.backup_at,
            app: 'TeleWindy',
            encrypted: true,
            crypto: {
                scheme: 'PBKDF2-SHA256-AES-GCM',
                version: 2,
                iterations: 250000,
                compression: packed.compression,
                source_bytes: sourceBytes.length,
                compressed_bytes: packed.bytes.length,
                salt: this._bufferToBase64(salt.buffer),
                iv: this._bufferToBase64(iv.buffer),
                ciphertext: this._bufferToBase64(ciphertext)
            }
        };
    },

    async _decryptBackupIfNeeded(json) {
        if (!json || json.encrypted !== true) return json;
        if (!json.crypto || json.crypto.scheme !== 'PBKDF2-SHA256-AES-GCM') {
            throw new Error('加密备份格式不受支持');
        }

        const passphrase = await this._askBackupPassphrase('恢复云备份');
        const saltBuffer = this._base64ToBuffer(json.crypto.salt);
        const iv = new Uint8Array(this._base64ToBuffer(json.crypto.iv));
        const ciphertext = this._base64ToBuffer(json.crypto.ciphertext);
        const key = await this._deriveBackupKey(passphrase, saltBuffer);

        try {
            const plaintext = await this._getCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            const unpacked = await this._decompressBackupBytes(new Uint8Array(plaintext), json.crypto.compression || 'none');
            const data = JSON.parse(new TextDecoder().decode(unpacked));
            return {
                backup_at: json.backup_at,
                app: 'TeleWindy',
                data
            };
        } catch (e) {
            if (e.message && (e.message.includes('解压') || e.message.includes('压缩格式'))) {
                throw e;
            }
            throw new Error('同步主密码错误，或备份内容已损坏');
        }
    },

    getAuth() {
        // 1. 优先读取输入框里当前填写的密码
        let val = this.els.token ? this.els.token.value.trim() : '';

        // 2. 如果输入框是空的，再去读取之前保存的设置
        if (!val) {
            val = STATE.settings.GIST_TOKEN || '';
        }

        // 3. 还是空的？那就报错
        if (!val) {
            this.showStatus('请填写访问密码 (Secret Key)', true);
            return null;
        }
        
        // --- 兼容旧版加密 Token (保持不变) ---
        if (val.startsWith('ENC_')) {
            try { val = atob(val.slice(4)); } catch (e) { return null; }
        }
        return val;
    },


    // --- 备份格式兼容：兼容“云同步格式”和“手动导出格式” ---
    _unwrapBackup(json) {
        // 云同步格式：
        // {
        //   backup_at: "...",
        //   app: "TeleWindy",
        //   data: { 真正的数据 }
        // }
        if (
            json &&
            typeof json === 'object' &&
            json.app === 'TeleWindy' &&
            json.data &&
            typeof json.data === 'object'
        ) {
            return json.data;
        }

        // 手动导出格式：本身就是真正的数据
        return json;
    },

    // --- 空备份保护：防止把 {} 或很小的空数据上传到云端 ---
    _validateBackupBeforeUpload(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('备份对象无效，已阻止上传');
        }

        if (payload.encrypted === true) {
            const cryptoInfo = payload.crypto || {};
            if (cryptoInfo.scheme && cryptoInfo.salt && cryptoInfo.iv && cryptoInfo.ciphertext) {
                return true;
            }
            throw new Error('加密备份结构无效，已阻止上传');
        }

        const data = this._unwrapBackup(payload);

        if (!data || typeof data !== 'object') {
            throw new Error('备份内容无效，已阻止上传');
        }

        const text = JSON.stringify(data);

        if (text === '{}' || text === '[]' || text.length < 1000) {
            throw new Error('备份疑似为空，已阻止上传，避免覆盖云端备份');
        }

        const values = Object.values(data);

        const hasUsefulContent = values.some(v => {
            if (Array.isArray(v)) return v.length > 0;
            if (v && typeof v === 'object') return Object.keys(v).length > 0;
            if (typeof v === 'string') return v.trim().length > 0;
            return false;
        });

        if (!hasUsefulContent) {
            throw new Error('备份没有有效内容，已阻止上传');
        }

        return true;
    },

    _formatBackupSize(byteLength) {
        // ★ 上传前把备份体积露出来，方便判断是不是“大包同步”把私有云链路顶断。
        const size = Number(byteLength) || 0;
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / 1024 / 1024).toFixed(2)} MB`;
    },

    _formatBackupUploadStatus(payload, payloadText) {
        const uploadSize = this._formatBackupSize(new Blob([payloadText]).size);
        const cryptoInfo = payload?.crypto || {};
        if (cryptoInfo.compression === 'gzip' && cryptoInfo.source_bytes && cryptoInfo.compressed_bytes) {
            const sourceSize = this._formatBackupSize(cryptoInfo.source_bytes);
            const packedSize = this._formatBackupSize(cryptoInfo.compressed_bytes);
            return `${uploadSize}（原始 ${sourceSize}，压缩后 ${packedSize}）`;
        }
        return uploadSize;
    },

    // --- 逻辑补充：混淆工具 (防GitHub扫描) ---
    _maskToken(token) {
        if (!token) return token;
        try { return btoa(token.split('').reverse().join('')); } catch (e) { return token; }
    },

    _unmaskToken(maskedToken) {
        if (!maskedToken) return maskedToken;
        if (maskedToken.startsWith('ghp_') || maskedToken.startsWith('github_pat_')) return maskedToken;
        try { return atob(maskedToken).split('').reverse().join(''); } catch (e) { return maskedToken; }
    },
    // ---------------------------------------

    // 辅助：准备上传的数据
    async _preparePayload() {
        const originalData = await Storage.exportAllForBackup();
        const dataToUpload = JSON.parse(JSON.stringify(originalData));

        const payload = {
            backup_at: new Date().toISOString(),
            app: "TeleWindy",
            data: dataToUpload
        };

        return await this._encryptBackupPayload(payload);
    },

    // --- 主入口 ---
    async updateBackup() {
        const mode = this.els.provider.value;
        if (mode === 'custom') await this._uploadToCustom();
        else await this._uploadToGist();
    },

    // ==========================================
    // 🔍 伟大的自动查找功能 (Gist 专用)
    // ==========================================
    async findBackup() {
        // 1. 获取 Token (复用现有的安全获取逻辑)
        const token = this.getAuth();
        if (!token) return; // 如果没填 Token，getAuth 会自动提示

        this.showStatus('🔍 正在去 GitHub 翻箱倒柜...');
        
        try {
            // 2. 请求 Gist 列表
            const res = await fetch('https://api.github.com/gists', {
                headers: { Authorization: `token ${token}` }
            });
            
            if (!res.ok) throw new Error(`连接 GitHub 失败 (${res.status})`);

            const gists = await res.json();
            
            // 3. 匹配描述 (这是识别是不是 TeleWindy 备份的关键)
            const backup = gists.find(g => g.description === "TeleWindy Backup");

            if (backup) {
                // 4. 找到了！填入 ID 并保存
                this.els.gistIdInput.value = backup.id;
                localStorage.setItem(CONFIG.GIST_ID_KEY, backup.id);
                this.showStatus(`✅ 找到啦！ID: ${backup.id.slice(0, 8)}...`);
            } else {
                // 5. 没找到
                this.showStatus('⚠️ 没找到名为 "TeleWindy..." 的备份', true);
            }
        } catch (e) {
            this.showStatus('❌ 查找出错: ' + e.message, true);
        }
    },

    async restoreBackup() {

        // --- 1. 在这里插入防手抖代码 ---
        if (!confirm('即将从云端拉取旧数据覆盖当前数据，确认覆盖吗？')) {
            this.showStatus('操作已取消');
            return;
        }
        // -----------------------------

        // 恢复前先尝试获取密码，避免空密码去请求
        const auth = this.getAuth();
        if(!auth) return;

        const mode = this.els.provider.value;
        let backupDataJSON = null;

        try {
            if (mode === 'custom') {
                backupDataJSON = await this._fetchFromCustom(auth);
            } else {
                backupDataJSON = await this._fetchFromGist(auth);
            }

            const unlockedBackup = await this._decryptBackupIfNeeded(backupDataJSON);
            const data = this._unwrapBackup(unlockedBackup);

            if (data && typeof data === 'object') {
                await this._safeRestore(data);
            } else {
                throw new Error('数据格式不正确');
            }
        } catch (e) {
            this.showStatus('恢复出错: ' + e.message, true);
        }
    },

    // --- 逻辑补充：安全恢复 (防内存溢出) ---
    async _safeRestore(data) {
        // 1. 解密配置里的 Token
        if (data.settings && data.settings.GIST_TOKEN) {
            data.settings.GIST_TOKEN = this._unmaskToken(data.settings.GIST_TOKEN);
        }

        // 2. 临时备份关键设置 (因为下面要清空 LocalStorage)
        const savedMode = localStorage.getItem('SYNC_MODE');
        const savedUrl = localStorage.getItem('SYNC_CUSTOM_URL');
        const savedGistId = localStorage.getItem(CONFIG.GIST_ID_KEY);

        try {
            console.log('执行清空策略...');
            // localStorage.clear(); // 不再需要清空 LocalStorage (除非你想删配置)

            // 3. 恢复关键设置 (否则刷新页面后就忘了连哪里了)
            if(savedMode) localStorage.setItem('SYNC_MODE', savedMode);
            if(savedUrl) localStorage.setItem('SYNC_CUSTOM_URL', savedUrl);
            if(savedGistId) localStorage.setItem(CONFIG.GIST_ID_KEY, savedGistId);

            // 4. 写入数据
            await Storage.importFromBackup(data);
            
            this.showStatus('恢复成功！3秒后刷新');
            setTimeout(() => location.reload(), 3000);

        } catch (e) {
            console.error(e);
            if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                alert('❌ 空间不足：即使清空了本地数据，备份文件依然太大，无法写入手机浏览器。');
            } else {
                alert('恢复时发生未知错误: ' + e.message);
            }
        }
    },

    // ==========================================
    // 具体的网络请求逻辑
    // ==========================================
    
    // 1. 自定义服务器上传
    async _uploadToCustom() {
        const password = this.getAuth();
        const url = this.els.urlInput.value.trim();
        if (!url) return this.showStatus('请输入服务器地址', true);

        localStorage.setItem('SYNC_CUSTOM_URL', url);
        this.showStatus('正在上传到私有云...');

        try {
            const payload = await this._preparePayload();
            this._validateBackupBeforeUpload(payload);
            const payloadText = JSON.stringify(payload);
            const payloadSize = this._formatBackupUploadStatus(payload, payloadText);
            this.showStatus(`正在上传到私有云... 备份体积 ${payloadSize}`);

            const res = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${password}`, 
                    'Content-Type': 'application/json' 
                },
                body: payloadText
            });

            if (res.ok) {
                this.showStatus('私有云同步成功！' + new Date().toLocaleTimeString());
            } else {
                throw new Error((await res.json()).error || '上传失败');
            }
        } catch (e) {
            this.showStatus(e.message, true);
        }
    },

    // 2. 自定义服务器下载
    async _fetchFromCustom(password) {
        const url = this.els.urlInput.value.trim();
        this.showStatus('正在从私有云拉取...');
        const startedAt = Date.now();
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${password}` }
        });
        if (!res.ok) throw new Error('拉取失败');

        // ★ 恢复卡住时先分清是下载慢，还是下载完以后手机解析大 JSON 慢。
        const text = await res.text();
        const sizeText = this._formatBackupSize(new Blob([text]).size);
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        this.showStatus(`私有云已下载 ${sizeText}，耗时 ${seconds}s，正在解析...`);
        return JSON.parse(text);
    },

    _readGistFileContent(file, token = '') {
        // Gist API 大文件会 truncated；分片恢复和旧版单文件恢复统一从这里兜底读取 raw_url。
        if (!file) throw new Error('Gist 备份文件不存在');
        if (file.truncated && file.raw_url) {
            return fetch(file.raw_url).then(res => {
                if (!res.ok) throw new Error('读取 Gist 原始文件失败');
                return res.text();
            });
        }
        return Promise.resolve(file.content || '');
    },

    _isTeleWindyGistBackupFile(fileName) {
        return fileName === this.gistSingleFileName
            || fileName === this.gistManifestFileName
            || fileName.startsWith(this.gistChunkFilePrefix);
    },

    _buildGistBackupFiles(contentText, currentFiles = {}) {
        const files = {};
        const contentSize = new Blob([contentText]).size;
        const currentNames = Object.keys(currentFiles || {});

        // 小备份继续用老格式，避免普通用户的 Gist 里突然多出一堆分片文件。
        if (contentSize <= this.gistChunkSize) {
            files[this.gistSingleFileName] = { content: contentText };
            currentNames
                .filter(name => name === this.gistManifestFileName || name.startsWith(this.gistChunkFilePrefix))
                .forEach(name => { files[name] = null; });
            return { files, chunked: false, chunkCount: 1 };
        }

        const chunks = [];
        for (let i = 0; i < contentText.length; i += this.gistChunkSize) {
            chunks.push(contentText.slice(i, i + this.gistChunkSize));
        }

        const chunkFileNames = chunks.map((_, index) => {
            return `${this.gistChunkFilePrefix}${String(index + 1).padStart(3, '0')}.txt`;
        });
        const manifest = {
            app: 'TeleWindy',
            format: 'chunked-gist-backup',
            version: 1,
            created_at: new Date().toISOString(),
            total_size: contentSize,
            total_length: contentText.length,
            chunk_size: this.gistChunkSize,
            files: chunkFileNames
        };

        files[this.gistManifestFileName] = { content: JSON.stringify(manifest, null, 2) };
        chunks.forEach((chunk, index) => {
            files[chunkFileNames[index]] = { content: chunk };
        });

        // 新分片上传时删除旧单文件和多余旧分片，防止恢复读到过期残片。
        currentNames
            .filter(name => this._isTeleWindyGistBackupFile(name) && !chunkFileNames.includes(name) && name !== this.gistManifestFileName)
            .forEach(name => { files[name] = null; });

        return { files, chunked: true, chunkCount: chunks.length };
    },

    async _fetchGist(token, gistId) {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { Authorization: `token ${token}` }
        });
        if (!res.ok) throw new Error('Gist 未找到');
        return await res.json();
    },

    async _parseChunkedGistBackup(gist, token) {
        const manifestText = await this._readGistFileContent(gist.files[this.gistManifestFileName], token);
        const manifest = JSON.parse(manifestText);
        if (manifest.app !== 'TeleWindy' || manifest.format !== 'chunked-gist-backup' || !Array.isArray(manifest.files)) {
            throw new Error('Gist 分片备份清单格式不正确');
        }

        const parts = [];
        for (const fileName of manifest.files) {
            const partFile = gist.files[fileName];
            if (!partFile) throw new Error(`Gist 备份分片缺失：${fileName}`);
            parts.push(await this._readGistFileContent(partFile, token));
        }

        const contentText = parts.join('');
        const contentSize = new Blob([contentText]).size;
        if (manifest.total_length && contentText.length !== manifest.total_length) {
            throw new Error('Gist 分片长度校验失败');
        }
        if (manifest.total_size && contentSize !== manifest.total_size) {
            throw new Error('Gist 分片体积校验失败');
        }
        return JSON.parse(contentText);
    },
    // 3. Gist 上传
    async _uploadToGist() {
        const token = this.getAuth();
        const gistId = this.els.gistIdInput.value.trim();
        this.showStatus('正在连接 GitHub...');

        try {
            const currentGist = gistId ? await this._fetchGist(token, gistId) : null;
            const contentData = await this._preparePayload();
            this._validateBackupBeforeUpload(contentData);
            const contentText = JSON.stringify(contentData);
            const gistFiles = this._buildGistBackupFiles(contentText, currentGist?.files || {});
            const chunkText = gistFiles.chunked ? `，分片 ${gistFiles.chunkCount} 个` : '';
            this.showStatus(`正在上传到 GitHub... 备份体积 ${this._formatBackupUploadStatus(contentData, contentText)}${chunkText}`);

            const payload = {
                description: "TeleWindy Backup", 
                files: gistFiles.files
            };

            let url = 'https://api.github.com/gists';
            let method = 'POST';
            if (gistId) {
                url += `/${gistId}`;
                method = 'PATCH';
            }

            const gistPayloadText = JSON.stringify(payload);
            const res = await fetch(url, {
                method: method,
                headers: { 
                    Authorization: `token ${token}`, 
                    'Content-Type': 'application/json' 
                },
                body: gistPayloadText
            });

            if (res.ok) {
                const json = await res.json();
                if (json.id) {
                    this.els.gistIdInput.value = json.id;
                    localStorage.setItem(CONFIG.GIST_ID_KEY, json.id);
                }
                this.showStatus(`GitHub 同步成功！${chunkText} ` + new Date().toLocaleTimeString());
            } else {
                throw new Error('Gist 请求失败');
            }
        } catch (e) {
            this.showStatus(e.message, true);
        }
    },
    // 4. Gist 下载
    async _fetchFromGist(token) {
        const gistId = this.els.gistIdInput.value.trim();
        if (!gistId) throw new Error('需填写 Gist ID');
        
        this.showStatus('正在从 GitHub 拉取...');
        const json = await this._fetchGist(token, gistId);

        if (json.files[this.gistManifestFileName]) {
            this.showStatus('正在拼合 GitHub 分片备份...');
            return await this._parseChunkedGistBackup(json, token);
        }

        const file = json.files[this.gistSingleFileName];
        const content = await this._readGistFileContent(file, token);
        return JSON.parse(content);
    }
};

// 启动初始化
setTimeout(() => CloudSync.init(), 500);



// 核心修复：HTML 里的 onclick="CloudSync.xxx()" 需要能从 window 找到云同步对象
window.CloudSync = CloudSync;
