// =========================================
// MEMORY IMPRESSION (记忆印象)
// 每个角色一段长期印象，和每日记忆一起保存；请求锁、队列与编辑状态只留在运行时。
// 首次/重生成读取当前全部每日记忆，增量归纳累计五个非空新记忆日，不按自然日空跑。
// =========================================

// ★★★★★ 记忆印象 START：归纳、进度与面板 ★★★★★
const MemoryImpression = {
    updateDays: 5,
    materialLimit: 10000,
    jobs: new Map(),
    autoAttempts: new Map(),
    queue: Promise.resolve(),
    contactId: null,
    editing: false,
    returnFocus: null,

    ensure(memory) {
        // ★ 老数据懒补字段，不改普通记忆开关；没有正文时不会自动开始首次全量请求。
        if (!memory.impression || typeof memory.impression !== 'object') memory.impression = {};
        const value = memory.impression;
        if (typeof value.enabled !== 'boolean') value.enabled = true;
        if (typeof value.text !== 'string') value.text = '';
        if (!value.processed || typeof value.processed !== 'object' || Array.isArray(value.processed)) value.processed = {};
        return value;
    },

    snapshot(memory, now = new Date()) {
        const today = CharacterMemory.getTodayKey(now);
        const dates = new Map();
        (memory.records || []).forEach(record => {
            const date = record?.dateKey;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date >= today
                || CharacterMemory.toDateKey(CharacterMemory.fromDateKey(date)) !== date) return;
            const texts = (Array.isArray(record.memories) ? record.memories : [])
                .map(item => CharacterMemory.normalizeMemoryText(typeof item === 'string' ? item : item?.text || ''))
                .filter(Boolean);
            if (texts.length) dates.set(date, [...(dates.get(date) || []), ...texts]);
        });
        // ★ 保存实际文本快照，生成期间新增/修改的内容不会被一次日期游标误标为已处理。
        return [...dates.entries()].sort(([a], [b]) => a.localeCompare(b))
            .map(([dateKey, texts]) => ({ dateKey, texts, fingerprint: JSON.stringify(texts) }));
    },

    pending(memory, now = new Date()) {
        const value = this.ensure(memory);
        return this.snapshot(memory, now).filter(record => value.processed[record.dateKey] !== record.fingerprint);
    },

    buildChatText(memory) {
        // ★ 印象单独控制注入；每日记忆总开关关闭时，整套记忆仍一同停用。
        const value = memory?.impression;
        return memory?.enabled === true && value?.enabled === true
            ? CharacterMemory.normalizeMemoryText(value.text || '') : '';
    },

    buildMessages(contact, material, oldText = '', evidence = false) {
        const rules = [
            '你在整理自己的长期记忆。下面会给你提供你的记忆。只返回 JSON，不要 Markdown 或解释。',
            'JSON 字符串内的换行写成 \\n，制表符写成 \\t；双引号与反斜杠正确转义，不要在字符串内直接换行。',
            '角色人设决定你如何理解经历；每日记忆提供实际发生的事情。不得把人设当作已经发生的事件。',
            evidence
                ? '这是分批提炼阶段：以客观材料写明重要事实、反复出现的模式及变化，保留关键日期和不确定性，不写抒情独白。返回 {"evidence":"约500字以内的材料"}。'
                : '最终正文使用第一人称，你作为这个角色，根据你们的这些天的记忆，写一段你这些日子来形成的自然记忆印象（类似一段心声或日记），约50-150字为软目标。',
            !evidence && oldText
                ? '判断这几天的新记忆是否改变了你的记忆印象。无需改变时，返回 {"changed":false}；需要改变时，返回 {"changed":true,"text":"完整的新印象"}，完整新印象类似一段心声或日记，字数也以50-150字为软目标。'
                : (!evidence ? '根据提供的你的人设，和你与对方这些日子的记忆，撰写一段你这些日子自然形成的记忆印象（类似一段心声或日记），返回 {"changed":true,"text":"完整印象"}。' : ''),
            '【你的角色设定】', `角色名：${contact.name || '未知角色'}`, contact.prompt || '暂无角色设定。',
            // ★ 朋友圈昵称不代表聊天中的身份；称呼只沿用人设与记忆，不额外猜测姓名。
            '称呼沿用角色人设或记忆中已有的表达；没有明确姓名时使用自然代称，不自行起名。'
        ].filter(Boolean).join('\n');
        const input = [oldText && !evidence ? `【当前记忆印象】\n${oldText}` : '',
            `【${oldText ? '尚未处理的新记忆材料' : '截至本次操作的全部记忆材料'}】\n${material}`].filter(Boolean).join('\n\n');
        return [{ role: 'system', content: rules }, { role: 'user', content: input }];
    },

    escapeJsonControls(text) {
        let inString = false;
        let output = '';
        // ★ 仅修复引号内的真实控制字符；引号外的排版空白以及已有的合法 JSON 转义原样保留。
        for (let index = 0; index < text.length; index++) {
            const char = text[index];
            if (inString && char === '\\') {
                const next = text[index + 1];
                // ★ 反斜杠后接真实换行也不是合法 JSON，按真实字符编码，避免多加一层转义。
                if (next !== undefined && next.charCodeAt(0) < 32) {
                    output += JSON.stringify(next).slice(1, -1);
                    index++;
                } else {
                    output += char;
                    if (next !== undefined) { output += next; index++; }
                }
                continue;
            }
            if (char === '"') inString = !inString;
            output += inString && char.charCodeAt(0) < 32 ? JSON.stringify(char).slice(1, -1) : char;
        }
        return output;
    },

    parseJson(raw) {
        // ★ 和每日总结共用思考块清理，后面的多行 JSON 兼容仍按印象原有流程处理。
        const text = CharacterMemory.stripLeadingThought(raw);
        try {
            return CharacterMemory.extractJson(text);
        } catch (error) {
            // ★ 模型写成多行字符串时做无损转义后重试；缺括号、多个对象、未转义引号仍交给严格解析报错。
            const escaped = this.escapeJsonControls(text);
            if (escaped === text) throw error;
            const parsed = CharacterMemory.extractJson(escaped);
            console.info('[记忆印象] 已兼容 JSON 字符串内的真实换行或控制字符');
            return parsed;
        }
    },

    parseResult(raw, hasOldText) {
        const result = this.parseJson(raw);
        if (result.changed === false && hasOldText) return { changed: false };
        const text = typeof result.text === 'string' ? CharacterMemory.normalizeMemoryText(result.text) : '';
        if (result.changed !== true || !text) throw new Error('AI 没有返回有效的记忆印象');
        return { changed: true, text };
    },

    async requestParsed(messages, settings, details, parse) {
        // ★ 日志只记录阶段与模型，不展开 settings/messages，避免把 API Key 和全部输入记忆打印出来。
        const context = { ...details, model: settings.MODEL,
            inputChars: messages.reduce((sum, message) => sum + String(message.content || '').length, 0) };
        console.info('[记忆印象] 请求开始', context);
        let raw;
        try {
            raw = await API.chat(messages, settings);
        } catch (error) {
            // ★ 这里还没拿到模型正文；可区分接口响应解析失败与后面的模型 JSON 解析失败。
            console.error('[记忆印象] API 请求失败（尚未取得模型正文）', context, error);
            throw error;
        }
        try {
            const result = parse(raw);
            console.info('[记忆印象] 返回解析成功', { ...context, responseChars: String(raw || '').length });
            return result;
        } catch (error) {
            // ★ 保留完整原文供 F12 排查多余解释、多个 JSON、引号未转义或输出截断；不做猜测性修复。
            console.error('[记忆印象] 模型返回解析失败', { ...context,
                responseType: typeof raw, responseChars: String(raw || '').length }, error);
            console.log('[记忆印象] 模型原始返回（完整文本）:\n', raw);
            throw new Error(`${details.stage}返回格式错误：${error.message || error}。请在 F12 控制台搜索“记忆印象”，查看模型原始返回。`);
        }
    },

    async condense(contact, records, settings, isCurrent) {
        let material = records.map(record => `[${record.dateKey}]\n${record.texts.map(text => `- ${text}`).join('\n')}`).join('\n\n');
        // ★ 长资料分批覆盖全部内容，先提炼事实再写印象；不从末尾截断，不只读最近几天。
        for (let level = 0; material.length > this.materialLimit; level++) {
            if (level >= 8) throw new Error('记忆材料压缩后仍过长，请调整记忆生成模型后重试');
            const parts = [];
            for (let offset = 0; offset < material.length; offset += this.materialLimit) {
                if (!isCurrent()) throw new Error('角色资料已变化，请重新操作');
                const data = await this.requestParsed(
                    this.buildMessages(contact, material.slice(offset, offset + this.materialLimit), '', true), settings,
                    { contactId: contact.id, stage: '分批提炼', level: level + 1,
                        batch: Math.floor(offset / this.materialLimit) + 1, batches: Math.ceil(material.length / this.materialLimit) },
                    raw => {
                        const parsed = this.parseJson(raw);
                        if (!parsed || typeof parsed.evidence !== 'string' || !parsed.evidence.trim()) throw new Error('AI 没有返回有效的分批记忆材料');
                        return parsed;
                    });
                parts.push(data.evidence.trim());
            }
            const next = parts.join('\n\n');
            if (next.length >= material.length) throw new Error('模型没有压缩记忆材料，请更换模型后重试');
            material = next;
        }
        return material;
    },

    schedule(contactId) {
        const memory = CharacterMemory.getMemory(contactId);
        if (!memory || memory.enabled !== true) return;
        const value = this.ensure(memory);
        if (!value.enabled || !value.text || this.jobs.has(contactId) || (this.contactId === contactId && this.editing)) return;
        const pending = this.pending(memory);
        if (pending.length < this.updateDays) return;
        const signature = JSON.stringify([value.text, pending]);
        // ★ 同一批失败资料在本次打开期间不反复重试；手动更新不受此限制。
        if (this.autoAttempts.get(contactId) === signature) return;
        this.autoAttempts.set(contactId, signature);
        this.queue = this.queue.catch(() => {}).then(() => this.generate(contactId, { automatic: true }));
    },

    async generate(contactId, { full = false, automatic = false } = {}) {
        const contact = STATE.contacts.find(item => item.id === contactId);
        const memory = CharacterMemory.getMemory(contactId);
        if (!contact || !memory || this.jobs.has(contactId)) return false;
        const value = this.ensure(memory);
        if (automatic && (!memory.enabled || !value.enabled || !value.text || (this.contactId === contactId && this.editing))) return false;
        const rebuild = full || !value.text;
        const records = rebuild ? this.snapshot(memory) : this.pending(memory);
        if (automatic && records.length < this.updateDays) return false;
        if (!records.length) {
            if (!automatic) alert(rebuild ? '暂无可归纳的每日记忆（仅使用今天以前的非空记忆）。' : '暂无新记忆。');
            return false;
        }
        const settings = App.buildMemoryRequestSettings(contact);
        if (!settings.API_URL || !settings.API_KEY || !settings.MODEL) {
            if (!automatic) alert('API 配置缺失，请检查角色记忆设置。');
            return false;
        }
        const token = {};
        this.jobs.set(contactId, token);
        value.error = '';
        // ★ 固定本轮输入；全量重生成不带旧印象，后续新增内容留到下一轮。
        const oldText = rebuild ? '' : value.text;
        const isCurrent = () => CharacterMemory.getMemory(contactId) === memory && memory.impression === value
            && STATE.contacts.find(item => item.id === contactId) === contact;
        this.render();
        try {
            const material = await this.condense(contact, records, settings, isCurrent);
            if (!isCurrent()) throw new Error('角色资料已变化，请重新操作');
            const result = await this.requestParsed(this.buildMessages(contact, material, oldText), settings,
                { contactId, stage: '最终归纳', mode: rebuild ? '全量生成' : '增量更新',
                    memoryDays: records.length, firstDate: records[0].dateKey, lastDate: records[records.length - 1].dateKey },
                raw => this.parseResult(raw, !!oldText));
            if (!isCurrent()) throw new Error('角色资料已变化，请重新操作');
            // ★ 用户在后台归纳期间关闭开关，自动结果不再覆盖；手动请求可以在关闭状态下使用。
            if (automatic && (!memory.enabled || !value.enabled)) return false;
            const before = JSON.parse(JSON.stringify(value));
            if (result.changed && result.text !== value.text) {
                value.previous = value.text ? { text: value.text, updatedAt: value.updatedAt || null } : null;
                value.text = result.text;
                value.updatedAt = new Date().toISOString();
            }
            if (rebuild) value.processed = {};
            records.forEach(record => { value.processed[record.dateKey] = record.fingerprint; });
            value.checkedAt = new Date().toISOString();
            value.lastResult = result.changed ? '已归纳本次记忆' : '已检查新记忆，保留原有印象';
            try {
                await Storage.saveCharacterMemories();
            } catch (error) {
                // ★ 保存失败也回到原正文与原进度，不能显示成功却在刷新后丢失这一轮。
                Object.keys(value).forEach(key => delete value[key]);
                Object.assign(value, before);
                throw error;
            }
            return true;
        } catch (error) {
            console.warn('[记忆印象] 归纳失败:', error);
            if (isCurrent()) value.error = error.message || String(error);
            if (!automatic) alert(`记忆印象生成失败：${error.message || error}`);
            return false;
        } finally {
            this.jobs.delete(contactId);
            this.render();
        }
    },

    open(contactId) {
        if (!STATE.contacts.some(item => item.id === contactId)) return;
        CharacterMemory.ensureMemory(contactId);
        this.contactId = contactId;
        this.editing = false;
        this.returnFocus = document.activeElement;
        // ★ 背景页单独模糊，避免“全部记忆”卡片较多时，遮罩的 backdrop-filter 合成失效。
        document.getElementById('view-character-memory-detail')?.classList.add('memory-impression-open');
        document.getElementById('modal-memory-impression').classList.remove('hidden');
        document.getElementById('memory-impression-more').open = false;
        this.render();
        document.getElementById('memory-impression-close').focus();
    },

    close() {
        if (this.editing && !confirm('放弃尚未保存的修改？')) return;
        document.getElementById('modal-memory-impression').classList.add('hidden');
        document.getElementById('view-character-memory-detail')?.classList.remove('memory-impression-open');
        this.contactId = null;
        this.editing = false;
        this.returnFocus?.focus();
    },

    render() {
        const memory = CharacterMemory.getMemory(this.contactId);
        if (!memory) return;
        const value = this.ensure(memory);
        const busy = this.jobs.has(this.contactId);
        const pending = this.pending(memory).length;
        const get = id => document.getElementById(`memory-impression-${id}`);
        get('enabled').checked = value.enabled;
        get('body').textContent = value.text || '过去的相处，会在这里慢慢留下印象。生成时会读取今天以前已有的全部每日记忆。';
        get('body').hidden = this.editing;
        get('editor').hidden = !this.editing;
        const updated = value.updatedAt ? new Date(value.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '';
        get('meta').textContent = [updated ? `更新于 ${updated}` : '尚未生成',
            value.text ? `待处理 ${pending} 个记忆日 / 累计 ${this.updateDays} 日自动检查` : '',
            !value.enabled ? '已暂停注入和自动更新' : (!memory.enabled ? '角色记忆未开启，暂不注入和自动更新' : ''),
            busy ? '正在归纳，请稍候…' : value.lastResult, value.error ? `上次失败：${value.error}` : ''].filter(Boolean).join(' · ');
        get('update').textContent = value.text ? '立即更新' : '生成记忆印象';
        get('update').hidden = this.editing;
        get('update').disabled = busy || this.editing || (value.text ? !pending : !this.snapshot(memory).length);
        get('edit').hidden = this.editing || !value.text;
        get('edit').disabled = busy;
        get('save').hidden = !this.editing;
        get('cancel').hidden = !this.editing;
        get('save').disabled = busy;
        get('cancel').disabled = busy;
        get('regenerate').disabled = busy || this.editing || !this.snapshot(memory).length;
        get('restore').disabled = busy || this.editing || !value.previous?.text;
        get('update').title = value.text && !pending ? '暂无新记忆' : '';
    },

    async saveEdit(restore = false) {
        const contactId = this.contactId;
        const memory = CharacterMemory.getMemory(contactId);
        if (!memory || this.jobs.has(contactId)) return;
        const value = this.ensure(memory);
        const text = restore ? value.previous?.text : document.getElementById('memory-impression-editor').value;
        if (!text?.trim()) { alert('请写下记忆印象。'); return; }
        const before = JSON.parse(JSON.stringify(value));
        this.jobs.set(contactId, {});
        value.previous = value.text ? { text: value.text, updatedAt: value.updatedAt || null } : null;
        value.text = CharacterMemory.normalizeMemoryText(text);
        value.updatedAt = new Date().toISOString();
        value.error = '';
        value.lastResult = restore ? '已恢复上一版' : '已手动编辑';
        // ★ 编辑/恢复只改正文，保留已处理进度，不把旧批次重新当成新经历。
        this.render();
        try {
            await Storage.saveCharacterMemories();
            if (this.contactId === contactId) this.editing = false;
        } catch (error) {
            Object.keys(value).forEach(key => delete value[key]);
            Object.assign(value, before);
            alert(`保存失败：${error.message || error}`);
        } finally {
            this.jobs.delete(contactId);
        }
        this.render();
    },

    bindEvents() {
        const get = id => document.getElementById(`memory-impression-${id}`);
        get('open')?.addEventListener('click', () => this.open(STATE.currentMemoryContactId));
        get('close').addEventListener('click', () => this.close());
        get('update').addEventListener('click', () => this.generate(this.contactId));
        get('regenerate').addEventListener('click', () => {
            get('more').open = false;
            this.generate(this.contactId, { full: true });
        });
        get('restore').addEventListener('click', () => { get('more').open = false; this.saveEdit(true); });
        get('edit').addEventListener('click', () => {
            const memory = CharacterMemory.getMemory(this.contactId);
            if (!memory || this.jobs.has(this.contactId)) return;
            this.editing = true;
            get('editor').value = this.ensure(memory).text;
            this.render();
            get('editor').focus();
        });
        get('cancel').addEventListener('click', () => { this.editing = false; this.render(); });
        get('save').addEventListener('click', () => this.saveEdit());
        get('enabled').addEventListener('change', async event => {
            const contactId = this.contactId;
            const memory = CharacterMemory.getMemory(contactId);
            if (!memory) return;
            const value = this.ensure(memory);
            const previous = value.enabled;
            value.enabled = event.target.checked;
            try {
                await Storage.saveCharacterMemories();
                if (value.enabled) this.schedule(contactId);
            } catch (error) {
                value.enabled = previous;
                alert(`保存失败：${error.message || error}`);
            }
            this.render();
        });
        const modal = document.getElementById('modal-memory-impression');
        modal.addEventListener('click', event => { if (event.target === modal) this.close(); });
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
            // ★ 底部面板保留键盘焦点，避免 Tab 跑到遮罩下面的记忆列表。
            if (event.key === 'Tab') {
                const controls = [...modal.querySelectorAll('button, input, textarea, summary')]
                    .filter(element => !element.disabled && element.getClientRects().length);
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        });
    }
};
// ★★★★★ 记忆印象 END：归纳、进度与面板 ★★★★★
