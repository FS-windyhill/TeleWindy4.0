/* Independent API ledger. No prompts, responses, keys or URL query strings are persisted. */
const UsageStats = {
    key: 'TW_USAGE_V1', selected: null, mode: 'count', metric: 'input', queue: Promise.resolve(),
    date(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    id() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; },
    site(url) { try { const u = new URL(url); return u.origin + u.pathname; } catch { return '未知站点'; } },
    meta(settings, model) { return { model: String(model || settings.MODEL || '未知模型'), site: this.site(settings.API_URL), reroll: settings.USAGE_REROLL === true, chat: settings.USAGE_CHAT === true || settings.PROACTIVE_CONTEXT_LOG === true }; },
    async read(date = this.selected || this.date()) { return { days: { [date]: await DB.get(`${this.key}:day:${date}`) || {} }, prices: await DB.get(`${this.key}:prices`) || {} }; },
    change(fn, date = this.date()) {
        this.queue = this.queue.then(async () => { const data = await this.read(date); fn(data); await DB.set(`${this.key}:day:${date}`, data.days[date]); if (this.visible()) await this.render(); }).catch(e => { console.warn('[Usage]', e); const el = document.getElementById('usage-status'); if (el) el.textContent = '统计保存失败，请检查浏览器存储空间'; });
        return this.queue;
    },
    visible() { return document.getElementById('view-usage')?.style.display === 'flex'; },
    start(meta, id = this.id(), date = this.date()) { this.change(data => { const day = data.days[date] ||= {}; day[id] ||= { ...meta, status: 'pending', input: null, output: null }; }, date); return { id, date }; },
    finish(ref, payload, status = 'done') {
        this.change(data => { const row = data.days[ref.date]?.[ref.id]; if (!row) return; const u = payload?.usage || payload?.usageMetadata; row.status = status; if (u) { const number = x => x != null && Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : null; row.input = number(u.prompt_tokens ?? u.input_tokens ?? u.promptTokenCount); row.output = number(u.completion_tokens ?? u.output_tokens ?? u.candidatesTokenCount); row.cached = number(u.prompt_tokens_details?.cached_tokens ?? u.cache_read_input_tokens ?? u.prompt_cache_hit_tokens); } }, ref.date);
    },
    async fetch(url, options, settings, purpose = '') {
        let body; try { body = JSON.parse(options.body); } catch { body = {}; }
        const ref = this.start({ ...this.meta(settings, body.model), purpose });
        try { const response = await fetch(url, options); try { const data = await response.clone().json(); this.finish(ref, data, response.ok ? 'done' : 'failed'); } catch { this.finish(ref, null, response.ok ? 'done' : 'failed'); } return response; }
        catch (e) { this.finish(ref, null, 'unknown'); throw e; }
    },
    jobStart(job, settings) { const ref = this.start(this.meta(settings), `job:${job.jobId}`); this.queue = this.queue.then(() => DB.set(`${this.key}:job:${job.jobId}`, ref)).catch(console.warn); return ref; },
    jobFinish(job) { if (!['done','failed'].includes(job.status)) return; this.queue = this.queue.then(async () => { const ref = await DB.get(`${this.key}:job:${job.jobId}`); if (!ref) return; const data = await this.read(ref.date); const row = data.days[ref.date]?.[ref.id]; if (!row) return; row.status = job.status; const u = job.usage; if (u) { row.input = u.prompt_tokens ?? u.input_tokens ?? null; row.output = u.completion_tokens ?? u.output_tokens ?? null; } await DB.set(`${this.key}:day:${ref.date}`,data.days[ref.date]); if(this.visible()) await this.render(); }).catch(console.warn); },
    esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    groups(data) { const groups = new Map(); for (const row of Object.values(data.days[this.selected] || {})) { const key = JSON.stringify([row.site,row.model]); if (!groups.has(key)) groups.set(key, { key, model: row.model, site: row.site, input:0, output:0, count:0, reroll:0, chat:0, unknown:0, failed:0 }); const g = groups.get(key); g.input += Number(row.input)||0; g.output += Number(row.output)||0; g.count++; if (row.input === null || row.output === null) g.unknown++; if (row.status === 'failed') g.failed++; if (row.chat) { g.chat++; if (row.reroll) g.reroll++; } } return [...groups.values()]; },
    async open() { this.selected ||= this.date(); UI.switchView('usage'); await this.render(); },
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
        const data = await this.read();
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
        // ★ 日期和费用计算器保持原统计口径，只替换中间两块的呈现方式。
        const dateCard = `<section class="usage-card"><div class="usage-date-header"><button data-shift="-7" aria-label="上一周">‹</button><input id="usage-date" type="date" value="${this.selected}" aria-label="统计日期"><button data-shift="7" aria-label="下一周">›</button><button data-today>今天</button></div><div class="usage-week">${week}</div></section>`;
        const metricCard = `<div class="usage-metric-tabs usage-metric-${this.metric}" role="tablist" aria-label="用量指标">${metricTabs}</div><section class="usage-card usage-metric-card"><h2>${label}</h2><p>${totalLabel}：<strong>${n(total)}</strong> ${unit}</p>${this.donut(groups, field, 'metric', unit)}</section>`;
        const rerollCard = `<section class="usage-card"><h2>Reroll 比例</h2><p>当日 reroll：${n(rerolls)} / ${n(chats)} 次（${pct(rerolls, chats)}）</p>${this.donut(groups.filter(group => group.chat), 'reroll', 'reroll', '次', true)}<p class="usage-hint">仅计算聊天回答；图例显示该模型 reroll 请求 / 全部聊天请求。</p></section>`;
        const priceRows = groups.map((group, index) => {
            const price = data.prices[group.key] || {};
            const fields = this.mode === 'count'
                ? [['count', '每次价格']]
                : [['input', '输入价格 / 百万 tokens'], ['output', '输出价格 / 百万 tokens']];
            const inputs = fields.map(([priceField, title]) =>
                `<label>${title}<input type="number" min="0" step="any" inputmode="decimal" data-price="${index}" data-field="${priceField}" value="${e(price[priceField] ?? '')}" placeholder="未设置"></label>`
            ).join('');
            return `<div class="usage-price-row"><strong>${e(group.model)}</strong><small>${e(group.site)}</small>${inputs}</div>`;
        }).join('') || '<p>当天暂无用量</p>';
        const priceCard = `<section class="usage-card"><h2>费用计算器</h2><div class="usage-tabs ${this.mode === 'tokens' ? 'usage-token-mode' : ''}" role="tablist"><button role="tab" aria-selected="${this.mode === 'count'}" data-mode="count">按次计费</button><button role="tab" aria-selected="${this.mode === 'tokens'}" data-mode="tokens">按量计费</button></div><p class="usage-hint">按所选日期自动带入用量。请使用相同币种；两种计费模式分别估算，不叠加。</p><div id="usage-prices">${priceRows}</div><p id="usage-cost" aria-live="polite"></p><p class="usage-hint">普通输入/输出价格预估，未扣缓存优惠。后台未上报的独立调用无法计入。</p></section>`;
        root.innerHTML = `${dateCard}<p class="usage-hint">仅统计本功能启用后的调用。${unknown} 次用量未知；${failed} 次请求失败。请求数包含实际发送的重试，失败是否收费以站点账单为准。</p>${metricCard}${rerollCard}${priceCard}`;
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
    },
    cost(data,groups) { let total=0, missing=0; for(const g of groups) { const p=data.prices[g.key]||{}; const fields=this.mode==='count'?['count']:['input','output']; for (const f of fields) { if(g[f] && (p[f] == null || p[f] === '')) missing++; else total+=g[f]*Number(p[f]||0)/(f==='count'?1:1000000); } } const el=document.getElementById('usage-cost'); if(el) el.textContent=`预估费用：${total.toLocaleString(undefined,{maximumFractionDigits:6})}${missing ? `（${missing} 项单价未设置，暂未计入）` : ''}${this.mode==='tokens' && groups.some(g=>g.unknown)?' · 含用量未知请求，费用不完整':''}`; }
};
