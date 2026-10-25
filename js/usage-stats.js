// ★ 独立 API 用量账本：只存站点、模型和 token 数，不保存请求正文、响应或密钥。
const UsageStats = {
    key: 'TW_USAGE_V1', entryKey: 'TW_USAGE_V2:entry:', selected: null, mode: 'count', metric: 'input', queue: Promise.resolve(),
    workerCache: new Map(), workerPending: new Map(), workerSupport: null, workerNotice: '',
    date(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    id() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; },
    site(url) { try { const u = new URL(url); return u.origin + u.pathname; } catch { return '未知站点'; } },
    meta(settings, model) { return { model: String(model || settings.MODEL || '未知模型'), site: this.site(settings.API_URL), reroll: settings.USAGE_REROLL === true, chat: settings.USAGE_CHAT === true || settings.PROACTIVE_CONTEXT_LOG === true }; },
    async read(date = this.selected || this.date()) {
        const legacy = await DB.get(`${this.key}:day:${date}`) || {};
        const entries = DB.getByPrefix ? await DB.getByPrefix(`${this.entryKey}${date}:`) : {};
        return { days: { [date]: { ...legacy, ...entries } }, prices: await DB.get(`${this.key}:prices`) || {} };
    },
    // ★ 先探测一次 Worker 能力；旧 Worker 没有 usage 路由时，不再对每个角色发无效请求。
    async supportsWorkerUsage() {
        const signature = `${STATE.settings.ASYNC_BACKEND_URL}|${STATE.settings.ASYNC_BACKEND_TOKEN}`;
        if (this.workerSupport?.signature === signature && Date.now() - this.workerSupport.at < 300000) {
            return this.workerSupport.enabled;
        }
        let enabled = false;
        try {
            const url = `${String(STATE.settings.ASYNC_BACKEND_URL).replace(/\/+$/, '')}/meta`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            let response;
            try { response = await fetch(url, { headers: ProactiveMessages.workerHeaders(), signal: controller.signal }); }
            finally { clearTimeout(timeout); }
            const metadata = response.ok ? await response.json() : null;
            // ★ 2026.10.24.1 已有 /usage；后来才补的 feature 标记不能把已部署的 .1 误判为旧版。
            const release = /^2026\.10\.24\.(\d+)$/.exec(String(metadata?.version || ''));
            enabled = metadata?.features?.proactiveUsage === true || !!(release && Number(release[1]) >= 1);
            this.workerNotice = enabled ? '' : '当前 Worker 尚未支持主动消息用量读取；本地统计已正常显示。';
        } catch {
            this.workerNotice = 'Worker 用量暂不可读（连接或跨域限制）；本地统计已正常显示。';
        }
        this.workerSupport = { signature, at: Date.now(), enabled };
        return enabled;
    },
    // ★ Worker 的 Alarm 可能在页面关闭时运行；读取结果只补进当前日期的显示，不阻塞本地账本。
    async workerRows(date) {
        if (typeof ProactiveMessages === 'undefined' || typeof STATE === 'undefined'
            || !STATE.settings?.ASYNC_BACKEND_URL || !STATE.settings?.ASYNC_BACKEND_TOKEN) return {};
        const cached = this.workerCache.get(date);
        if (cached && Date.now() - cached.at < 60000) return cached.rows;
        if (!await this.supportsWorkerUsage()) {
            this.workerCache.set(date, { at: Date.now(), rows: {} });
            return {};
        }
        const contacts = STATE.contacts || [];
        const results = await Promise.allSettled(contacts.map(async contact => {
            const url = `${ProactiveMessages.workerBaseUrl(contact.id)}/usage?date=${encodeURIComponent(date)}`;
            // ★ Worker 不在线时最多等三秒，统计页仍先能显示本地账本。
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            let response;
            try { response = await fetch(url, { headers: ProactiveMessages.workerHeaders(), signal: controller.signal }); }
            finally { clearTimeout(timeout); }
            if (!response.ok) return {};
            const rows = (await response.json()).rows || {};
            return Object.fromEntries(Object.entries(rows).map(([id, row]) => {
                const usage = this.usage(row.usage);
                return [`worker:${contact.id}:${id}`, { site: row.site, model: row.model, status: row.status,
                    chat: false, reroll: false, input: usage?.input ?? null, output: usage?.output ?? null,
                    cached: usage?.cached ?? null, cacheWrite: usage?.cacheWrite ?? 0 }];
            }));
        }));
        if (results.some(result => result.status === 'rejected')) {
            this.workerNotice = '部分 Worker 用量暂不可读；本地统计已正常显示。';
        } else {
            this.workerNotice = '';
        }
        const rows = Object.assign({}, ...results.filter(result => result.status === 'fulfilled').map(result => result.value));
        this.workerCache.set(date, { at: Date.now(), rows });
        if (this.workerCache.size > 7) this.workerCache.delete(this.workerCache.keys().next().value);
        return rows;
    },
    refreshWorkerRows(date) {
        if (typeof ProactiveMessages === 'undefined' || typeof STATE === 'undefined'
            || !STATE.settings?.ASYNC_BACKEND_URL || !STATE.settings?.ASYNC_BACKEND_TOKEN) return;
        const cached = this.workerCache.get(date);
        if (cached && Date.now() - cached.at < 60000) return;
        if (this.workerPending.has(date)) return;
        const pending = this.workerRows(date).then(() => {
            if (this.selected === date && this.visible()) return this.render();
        }).catch(error => console.warn('[Usage] Worker 用量读取失败:', error)).finally(() => {
            this.workerPending.delete(date);
        });
        this.workerPending.set(date, pending);
    },
    visible() { return document.getElementById('view-usage')?.style.display === 'flex'; },
    // ★ 新请求各占一个 IndexedDB 键；旧版整日记录仍可读，历史日期不丢。
    start(meta, id = this.id(), date = this.date()) {
        const ref = { id, date };
        this.queue = this.queue.then(async () => {
            const key = `${this.entryKey}${date}:${id}`;
            if (!await DB.get(key)) await DB.set(key, { ...meta, status: 'pending', input: null, output: null, cached: null });
            if (this.visible()) await this.render();
        }).catch(console.warn);
        return ref;
    },
    // ★ 各厂商缓存字段不同；缺字段保持 null，不能把“未上报”当成“零命中”。
    usage(usage) {
        if (!usage || typeof usage !== 'object') return null;
        const number = value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
        const details = usage.prompt_tokens_details || usage.input_tokens_details || {};
        const read = number(usage.prompt_cache_hit_tokens ?? details.cached_tokens ?? usage.cache_read_input_tokens ?? usage.cache_read_tokens ?? usage.cachedContentTokenCount);
        const create = number(usage.cache_creation_input_tokens ?? usage.cache_creation_tokens);
        const rawInput = number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount)
            ?? (read !== null && number(usage.prompt_cache_miss_tokens) !== null ? read + number(usage.prompt_cache_miss_tokens) : null);
        // ★ Claude 的 input_tokens 不含缓存读取/写入 token；其它接口通常已经包含。
        const input = usage.input_tokens != null && (read !== null || create !== null)
            ? (rawInput ?? 0) + (read ?? 0) + (create ?? 0) : rawInput;
        return { input, output: number(usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount),
            cached: read === null ? null : Math.min(read, input ?? read), cacheWrite: create ?? 0 };
    },
    finish(ref, payload, status = 'done') {
        this.queue = this.queue.then(async () => {
            const key = `${this.entryKey}${ref.date}:${ref.id}`;
            const row = await DB.get(key);
            if (!row) return;
            row.status = status;
            const usage = this.usage(payload?.usage || payload?.usageMetadata);
            if (usage) Object.assign(row, usage);
            await DB.set(key, row);
            if (this.visible()) await this.render();
        }).catch(console.warn);
    },
    async fetch(url, options, settings, purpose = '') {
        let body; try { body = JSON.parse(options.body); } catch { body = {}; }
        const ref = this.start({ ...this.meta(settings, body.model), purpose });
        try { const response = await fetch(url, options); try { const data = await response.clone().json(); this.finish(ref, data, response.ok ? 'done' : 'failed'); } catch { this.finish(ref, null, response.ok ? 'done' : 'failed'); } return response; }
        catch (e) { this.finish(ref, null, 'unknown'); throw e; }
    },
    jobStart(job, settings) { const ref = this.start(this.meta(settings), `job:${job.jobId}`); this.queue = this.queue.then(() => DB.set(`${this.key}:job:${job.jobId}`, ref)).catch(console.warn); return ref; },
    jobFinish(job) { if (!['done','failed'].includes(job.status)) return; this.queue = this.queue.then(async () => { const ref = await DB.get(`${this.key}:job:${job.jobId}`); if (!ref) return; const key = `${this.entryKey}${ref.date}:${ref.id}`; const row = await DB.get(key); if (!row) return; row.status = job.status; const usage = this.usage(job.usage); if (usage) Object.assign(row, usage); await DB.set(key, row);
        // ★ Agent 路由和执行器是独立调用；固定 job ID 使重复轮询只覆盖原记录。
        for (const [index, agent] of (job.agent_usages || []).entries()) {
            const agentKey = `${this.entryKey}${ref.date}:${ref.id}:agent:${index}`;
            const agentUsage = this.usage(agent.usage);
            await DB.set(agentKey, { site: agent.site, model: agent.model, status: 'done', purpose: 'Worker Agent',
                chat: false, reroll: false, input: agentUsage?.input ?? null, output: agentUsage?.output ?? null,
                cached: agentUsage?.cached ?? null, cacheWrite: agentUsage?.cacheWrite ?? 0 });
        }
        if (job.vision_usage) {
            const vision = job.vision_usage;
            const visionUsage = this.usage(vision.usage);
            await DB.set(`${this.entryKey}${ref.date}:${ref.id}:vision`, {
                site: vision.site, model: vision.model, status: 'done', purpose: 'Worker 识图',
                chat: false, reroll: false, input: visionUsage?.input ?? null,
                output: visionUsage?.output ?? null, cached: visionUsage?.cached ?? null,
                cacheWrite: visionUsage?.cacheWrite ?? 0
            });
        }
        if(this.visible()) await this.render(); }).catch(console.warn); },
    esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    groups(data) {
        const groups = new Map();
        for (const row of Object.values(data.days[this.selected] || {})) {
            const key = JSON.stringify([row.site, row.model]);
            if (!groups.has(key)) groups.set(key, { key, model: row.model, site: row.site,
                input: 0, output: 0, cached: 0, cacheWrite: 0, cacheInput: 0,
                count: 0, reroll: 0, chat: 0, unknown: 0, cacheUnknown: 0, failed: 0 });
            const group = groups.get(key);
            group.input += Number(row.input) || 0;
            group.output += Number(row.output) || 0;
            group.cacheWrite += Number(row.cacheWrite) || 0;
            group.count++;
            if (row.input == null || row.output == null) group.unknown++;
            // ★ 未上报缓存字段的输入只参与普通输入费用暂估，不稀释命中率。
            if (row.input != null && row.cached != null) {
                group.cacheInput += Number(row.input);
                group.cached += Math.min(Number(row.cached), Number(row.input));
            } else if (row.input != null) group.cacheUnknown++;
            if (row.status === 'failed') group.failed++;
            if (row.chat) {
                group.chat++;
                if (row.reroll) group.reroll++;
            }
        }
        return [...groups.values()];
    },
    async open() { this.selected ||= this.date(); this.workerCache.delete(this.selected); UI.switchView('usage'); await this.render(); },
    // ★ 环形图与图例共用同一组颜色；占比只按当前指标的实际数值计算。
    donut(groups, field, chart, unit, showChat = false) {
        const entries = groups.slice().sort((a, b) => b[field] - a[field]);
        const total = entries.reduce((sum, group) => sum + group[field], 0);
        const palette = ['#8b75df', '#70b9d2', '#efad78', '#80bf9d', '#d39ab9', '#b6a16d', '#81a2da', '#bf91cc'];
        const colors = entries.map((_, index) => palette[index % palette.length]);
        const visibleSlices = entries.filter(group => group[field] > 0).length;
        let offset = 0;
        const slices = entries.map((group, index) => {
            if (!group[field] || !total) return '';
            const share = group[field] / total * 100;
            // ★ 参考存储管理图：用描边空段做清晰的扇区间距，极小扇区仍保留可见宽度。
            const gap = visibleSlices > 1 ? Math.min(1.2, share * 0.45) : 0;
            const drawnShare = share - gap;
            const circle = `<circle cx="110" cy="110" r="82" fill="none" stroke="${colors[index]}" stroke-width="34" stroke-dasharray="${drawnShare} ${100 - drawnShare}" stroke-dashoffset="${-(offset + gap / 2)}" pathLength="100" transform="rotate(-90 110 110)" data-usage-chart="${chart}" data-usage-slice="${index}" />`;
            offset += share;
            return circle;
        }).join('');
        const chartHtml = total
            ? `<svg viewBox="0 0 220 220" aria-hidden="true">${slices}</svg>`
            : '<span class="usage-donut-empty">当天暂无记录</span>';
        const legend = entries.map((group, index) => {
            const amount = showChat
                ? `${this.number(group.reroll)} / ${this.number(group.chat)} 次`
                : `${this.number(group[field])} ${unit}`;
            const share = showChat
                ? (group.chat ? `${Math.round(group.reroll / group.chat * 100)}%` : '—')
                : (total ? `${Math.round(group[field] / total * 100)}%` : '—');
            return `<button type="button" class="usage-donut-legend-item" data-usage-chart="${chart}" data-usage-slice="${index}" aria-pressed="false"><span class="usage-donut-swatch" style="background:${colors[index]}"></span><span class="usage-donut-name"><strong>${this.esc(group.model)}</strong><small>${this.esc(group.site)}</small></span><span class="usage-donut-value">${amount}<small>${share}</small></span></button>`;
        }).join('') || '<p class="usage-donut-no-data">当天暂无记录</p>';
        return `<div class="usage-donut" data-usage-chart="${chart}" role="group" aria-label="按模型统计的环形图">${chartHtml}</div><div class="usage-donut-legend">${legend}</div>`;
    },
    number(value) { return Number(value).toLocaleString(); },
    highlightChart(chart, index) {
        const root = document.getElementById('usage-body');
        root?.querySelectorAll(`[data-usage-chart="${chart}"][data-usage-slice]`).forEach(item => {
            const active = index === Number(item.dataset.usageSlice);
            item.classList.toggle('usage-donut-selected', active);
            item.classList.toggle('usage-donut-muted', index !== null && !active);
            if (item.tagName === 'BUTTON') item.setAttribute('aria-pressed', String(active));
        });
    },
    async render() {
        const selectedDate = this.selected;
        const data = await this.read(selectedDate);
        Object.assign(data.days[selectedDate], this.workerCache.get(selectedDate)?.rows || {});
        const groups = this.groups(data);
        const root = document.getElementById('usage-body');
        if (!root) return;
        const e = value => this.esc(value);
        const n = value => this.number(value);
        const pct = (value, total) => total ? `${Math.round(value / total * 100)}%` : '—';
        const selected = new Date(`${this.selected}T12:00:00`);
        const monday = new Date(selected);
        monday.setDate(selected.getDate() - (selected.getDay() + 6) % 7);
        const week = Array.from({ length: 7 }, (_, index) => {
            const day = new Date(monday);
            day.setDate(day.getDate() + index);
            const key = this.date(day);
            return `<button class="usage-day ${key === this.selected ? 'usage-selected' : ''}" data-date="${key}" aria-pressed="${key === this.selected}"><small>${['一', '二', '三', '四', '五', '六', '日'][index]}</small>${day.getDate()}</button>`;
        }).join('');
        const metricOptions = [
            ['input', '输入 token', 'tokens'],
            ['output', '输出 token', 'tokens'],
            ['count', '请求次数', '次']
        ];
        if (!metricOptions.some(([field]) => field === this.metric)) this.metric = 'input';
        const [field, label, unit] = metricOptions.find(([name]) => name === this.metric);
        const total = groups.reduce((sum, group) => sum + group[field], 0);
        const totalLabel = this.selected === this.date() ? '今日总计' : '当日总计';
        const metricTabs = metricOptions.map(([name, title]) =>
            `<button type="button" role="tab" data-metric="${name}" aria-selected="${this.metric === name}" class="${this.metric === name ? 'active' : ''}">${title}</button>`
        ).join('');
        const chats = groups.reduce((sum, group) => sum + group.chat, 0);
        const rerolls = groups.reduce((sum, group) => sum + group.reroll, 0);
        const unknown = groups.reduce((sum, group) => sum + group.unknown, 0);
        const failed = groups.reduce((sum, group) => sum + group.failed, 0);
        const cacheInput = groups.reduce((sum, group) => sum + group.cacheInput, 0);
        const cached = groups.reduce((sum, group) => sum + group.cached, 0);
        const cacheUnknown = groups.reduce((sum, group) => sum + group.cacheUnknown, 0);
        // ★ 统计范围和 Worker 状态都跟随日期选择，统一收在日期卡片内。
        const dateCard = `<section class="usage-card"><div class="usage-date-header"><button data-shift="-7" aria-label="上一周">‹</button><input id="usage-date" type="date" value="${this.selected}" aria-label="统计日期"><button data-shift="7" aria-label="下一周">›</button><button data-today>今天</button></div><div class="usage-week">${week}</div><p class="usage-hint">仅统计本功能启用后的调用。${unknown} 次用量未知；${failed} 次请求失败。请求数包含实际发送的重试，失败是否收费以站点账单为准。</p>${this.workerNotice ? `<p class="usage-hint">${e(this.workerNotice)}</p>` : ''}</section>`;
        // ★ 指标切换和对应图表放在同一卡片内，位置与费用计算器的切换保持一致。
        const metricCard = `<section class="usage-card usage-metric-card"><h2>${label}</h2><div class="usage-metric-tabs usage-metric-${this.metric}" role="tablist" aria-label="用量指标">${metricTabs}</div><p>${totalLabel}：<strong>${n(total)}</strong> ${unit}</p>${this.donut(groups, field, 'metric', unit)}</section>`;
        const rerollCard = `<section class="usage-card"><h2>Reroll 比例</h2><p>当日 reroll：${n(rerolls)} / ${n(chats)} 次（${pct(rerolls, chats)}）</p>${this.donut(groups.filter(group => group.chat), 'reroll', 'reroll', '次', true)}<p class="usage-hint">仅计算聊天回答；图例显示该模型 reroll 请求 / 全部聊天请求。</p></section>`;
        // ★ 命中率按 token 加权；每个模型只拿“缓存字段已上报”的输入参与分母。
        const cacheRows = groups.map(group => `<div class="usage-cache-row"><span><strong>${e(group.model)}</strong><small>${e(group.site)}</small></span><span>${group.cacheInput ? pct(group.cached, group.cacheInput) : '—'}<small>${n(group.cached)} / ${n(group.cacheInput)} tokens${group.cacheUnknown ? ` · ${n(group.cacheUnknown)} 次未上报` : ''}</small></span></div>`).join('') || '<p>当天暂无用量</p>';
        const cacheCard = `<section class="usage-card"><h2>缓存命中率</h2><p>当日命中：<strong>${pct(cached, cacheInput)}</strong> · ${n(cached)} / ${n(cacheInput)} 输入 tokens</p><div class="usage-cache-list">${cacheRows}</div><p class="usage-hint">按实际命中 token 加权统计；${n(cacheUnknown)} 次有输入用量的请求未上报缓存命中，不参与命中率。</p></section>`;
        const priceRows = groups.map((group, index) => {
            const price = data.prices[group.key] || {};
            const fields = this.mode === 'count'
                ? [['count', '每次价格']]
                : [['input', '普通输入价格 / 百万 tokens'], ['cached', '缓存命中价格 / 百万 tokens'],
                    ...(group.cacheWrite ? [['cacheWrite', '缓存写入价格 / 百万 tokens']] : []),
                    ['output', '输出价格 / 百万 tokens']];
            const inputs = fields.map(([priceField, title]) =>
                `<label>${title}<input type="number" min="0" step="any" inputmode="decimal" data-price="${index}" data-field="${priceField}" value="${e(price[priceField] ?? '')}" placeholder="未设置"></label>`
            ).join('');
            return `<div class="usage-price-row"><strong>${e(group.model)}</strong><small>${e(group.site)}</small>${inputs}</div>`;
        }).join('') || '<p>当天暂无用量</p>';
        const priceCard = `<section class="usage-card"><h2>费用计算器</h2><div class="usage-tabs ${this.mode === 'tokens' ? 'usage-token-mode' : ''}" role="tablist"><button role="tab" aria-selected="${this.mode === 'count'}" data-mode="count">按次计费</button><button role="tab" aria-selected="${this.mode === 'tokens'}" data-mode="tokens">按量计费</button></div><p class="usage-hint">按所选日期自动带入用量。请使用相同币种；两种计费模式分别估算，不叠加。</p><div id="usage-prices">${priceRows}</div><p id="usage-cost" aria-live="polite"></p><p class="usage-hint">缓存用量未知的输入暂按普通输入价估算；未上报的独立调用无法计入。实际账单以站点为准。</p></section>`;
        root.innerHTML = `${dateCard}${metricCard}${rerollCard}${cacheCard}${priceCard}`;
        root.onclick = event => {
            const slice = event.target.closest('[data-usage-slice]');
            if (slice) {
                this.highlightChart(slice.dataset.usageChart || slice.closest('[data-usage-chart]')?.dataset.usageChart, Number(slice.dataset.usageSlice));
                return;
            }
            const donut = event.target.closest('.usage-donut');
            if (donut) {
                this.highlightChart(donut.dataset.usageChart, null);
                return;
            }
            const button = event.target.closest('button');
            if (!button) {
                this.highlightChart('metric', null);
                this.highlightChart('reroll', null);
                return;
            }
            if (button.dataset.date) this.selected = button.dataset.date;
            else if (button.dataset.shift) {
                selected.setDate(selected.getDate() + Number(button.dataset.shift));
                this.selected = this.date(selected);
            } else if (button.hasAttribute('data-today')) this.selected = this.date();
            else if (button.dataset.metric) this.metric = button.dataset.metric;
            else if (button.dataset.mode) this.mode = button.dataset.mode;
            else {
                this.highlightChart('metric', null);
                this.highlightChart('reroll', null);
                return;
            }
            this.render();
        };
        root.querySelector('#usage-date').onchange = event => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
                this.selected = event.target.value;
                this.render();
            }
        };
        root.oninput = event => {
            const input = event.target;
            if (!input.hasAttribute('data-price')) return;
            const group = groups[Number(input.dataset.price)];
            const price = data.prices[group.key] ||= {};
            price[input.dataset.field] = input.value === '' ? null : Math.max(0, Number(input.value) || 0);
            this.cost(data, groups);
            this.queue = this.queue.then(async () => {
                const latest = await this.read();
                latest.prices[group.key] = price;
                await DB.set(`${this.key}:prices`, latest.prices);
            }).catch(console.warn);
        };
        this.cost(data, groups);
        // ★ 第一屏绘制结束后才补查 Worker；失败或三秒超时都不会让统计页白屏。
        if (this.visible()) this.refreshWorkerRows(selectedDate);
    },
    cost(data, groups) {
        let total = 0, missing = 0;
        for (const group of groups) {
            const price = data.prices[group.key] || {};
            // ★ 缓存写入可能另有单价；未上报缓存用量的输入仍按普通价暂估。
            const amounts = this.mode === 'count' ? { count: group.count } : {
                input: Math.max(0, group.input - group.cached - group.cacheWrite),
                cached: group.cached, cacheWrite: group.cacheWrite, output: group.output
            };
            for (const [field, amount] of Object.entries(amounts)) {
                if (amount && (price[field] == null || price[field] === '')) missing++;
                else total += amount * Number(price[field] || 0) / (field === 'count' ? 1 : 1000000);
            }
        }
        const el = document.getElementById('usage-cost');
        if (el) el.textContent = `预估费用：${total.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
            + `${missing ? `（${missing} 项单价未设置，暂未计入）` : ''}`
            + `${this.mode === 'tokens' && groups.some(group => group.unknown) ? ' · 含用量未知请求，费用不完整' : ''}`
            + `${this.mode === 'tokens' && groups.some(group => group.cacheUnknown) ? ' · 未上报缓存的输入按普通价估算' : ''}`;
    }
};
