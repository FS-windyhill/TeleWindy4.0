// =========================================
// WORLD SENSE (世界感知)
// 从 script.js 拆出的独立工具层。
// 这里只负责天气、星期、节日和 system prompt 拼装；页面按钮和 DOM 渲染仍留在 App 里。
// =========================================
// ★★★★★ 世界感知 START：独立工具层 ★★★★★
// 这一层只负责“算”和“拼”：
// 1. 算天气缓存是不是当前 0/12 点刷新时段的
// 2. 算节日文案
// 3. 最后拼出要注入 system prompt 的第四段
// 不直接碰页面按钮，方便后面单独维护。
// =========================================
const WorldSense = {
    lunarFormatter: new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
        month: 'long',
        day: 'numeric'
    }),

    weatherCodeMap: {
        0: '晴',
        1: '基本晴朗',
        2: '多云',
        3: '阴',
        45: '雾',
        48: '雾凇',
        51: '毛毛雨',
        53: '细雨',
        55: '小雨',
        56: '冻毛毛雨',
        57: '冻雨',
        61: '小雨',
        63: '中雨',
        65: '大雨',
        66: '冻雨',
        67: '强冻雨',
        71: '小雪',
        73: '中雪',
        75: '大雪',
        77: '雪粒',
        80: '阵雨',
        81: '强阵雨',
        82: '暴雨',
        85: '阵雪',
        86: '强阵雪',
        95: '雷暴',
        96: '雷暴伴冰雹',
        99: '强雷暴伴冰雹'
    },

    lunarMonthMap: {
        '正月': 1,
        '一月': 1,
        '二月': 2,
        '三月': 3,
        '四月': 4,
        '五月': 5,
        '六月': 6,
        '七月': 7,
        '八月': 8,
        '九月': 9,
        '十月': 10,
        '十一月': 11,
        '冬月': 11,
        '十二月': 12,
        '腊月': 12
    },

    festivalDefs: [
        { type: 'solar', month: 1, day: 1, name: '元旦' },
        { type: 'lunar', month: 1, day: 1, name: '春节' },
        { type: 'lunar', month: 1, day: 15, name: '元宵节' },
        { type: 'solar', month: 2, day: 14, name: '情人节' },
        { type: 'solar', month: 3, day: 8, name: '妇女节' },
        { type: 'solar', month: 3, day: 14, name: '白色情人节' },
        { type: 'solar', month: 4, day: 1, name: '愚人节' },
        { type: 'easter', name: '复活节' },
        { type: 'solar', month: 5, day: 1, name: '劳动节' },
        { type: 'weekday', month: 5, week: 2, weekday: 0, name: '母亲节' },
        { type: 'solar', month: 5, day: 20, name: '520' },
        { type: 'solar', month: 6, day: 1, name: '六一儿童节' },
        { type: 'solar', month: 6, day: 18, name: '618' },
        { type: 'weekday', month: 6, week: 3, weekday: 0, name: '父亲节' },
        { type: 'lunar', month: 5, day: 5, name: '端午节' },
        { type: 'lunar', month: 7, day: 7, name: '七夕' },
        { type: 'lunar', month: 8, day: 15, name: '中秋节' },
        { type: 'lunar', month: 9, day: 9, name: '重阳节' },
        { type: 'solar', month: 10, day: 1, name: '国庆节' },
        { type: 'solar', month: 10, day: 31, name: '万圣夜' },
        { type: 'solar', month: 11, day: 11, name: '双十一' },
        { type: 'weekday', month: 11, week: 4, weekday: 4, name: '感恩节' },
        { type: 'weekdayOffset', month: 11, week: 4, weekday: 4, offset: 1, name: '黑色星期五' },
        { type: 'solar', month: 12, day: 24, name: '平安夜' },
        { type: 'lunar', month: 12, day: 8, name: '腊八节' },
        { type: 'solar', month: 12, day: 25, name: '圣诞节' }
    ],

    weekNameMap: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],

    cloneDraftFromSettings(settings = STATE.settings) {
        return {
            enabled: settings.WORLD_SENSE_ENABLED === true,
            weather: {
                enabled: settings.WORLD_SENSE_WEATHER_ENABLED === true,
                city: settings.WORLD_SENSE_WEATHER_CITY || '',
                location: settings.WORLD_SENSE_WEATHER_LOCATION
                    ? JSON.parse(JSON.stringify(settings.WORLD_SENSE_WEATHER_LOCATION))
                    : null,
                apiHost: settings.WORLD_SENSE_WEATHER_API_HOST || '',
                apiKey: settings.WORLD_SENSE_WEATHER_API_KEY || '',
                cache: settings.WORLD_SENSE_WEATHER_CACHE
                    ? JSON.parse(JSON.stringify(settings.WORLD_SENSE_WEATHER_CACHE))
                    : null
            },
            festival: {
                enabled: settings.WORLD_SENSE_FESTIVAL_ENABLED === true
            }
        };
    },

    normalizeCity(city) {
        return (city || '').trim();
    },

    buildDateKey(date = new Date()) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    },

    buildWeatherRefreshSlotKey(date = new Date()) {
        // ★ 天气每天只分两个刷新时段：
        // 00:00—11:59 算上午档，12:00—23:59 算下午档；网页错过整点时，首次使用会补刷当前档。
        const slot = date.getHours() < 12 ? '00' : '12';
        return `${this.buildDateKey(date)}-${slot}`;
    },

    formatShortDateTime(input) {
        if (!input) return '';
        const date = new Date(input);
        if (Number.isNaN(date.getTime())) return '';
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${mm}-${dd} ${hh}:${min}`;
    },

    formatWeatherSummary(cache) {
        if (!cache) return '';
        return `${cache.weatherText}，${cache.tempMin}~${cache.tempMax}℃`;
    },

    formatLunarText(date = new Date()) {
        // ★ 桌面农历显示兜底：
        // Intl 在不同浏览器里可能把“廿二”显示成 22，这里只借它取月份，
        // 农历日期改由我们自己拼成中文口语格式。
        const parts = this.lunarFormatter.formatToParts(date);
        const rawMonth = (parts.find(part => part.type === 'month')?.value || '').replace(/^闰/, '');
        const dayValue = Number(parts.find(part => part.type === 'day')?.value || 0);
        return `${rawMonth || '农历'}${this.formatLunarDayText(dayValue)}`;
    },

    formatLunarDayText(day) {
        const dayNum = Number(day);
        const ones = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
        if (!Number.isFinite(dayNum) || dayNum <= 0) return '';
        if (dayNum <= 9) return `初${ones[dayNum]}`;
        if (dayNum === 10) return '初十';
        if (dayNum < 20) return `十${ones[dayNum - 10]}`;
        if (dayNum === 20) return '二十';
        if (dayNum < 30) return `廿${ones[dayNum - 20]}`;
        if (dayNum === 30) return '三十';
        return String(dayNum);
    },

    isWeatherCacheValid(cache, city, now = new Date()) {
        if (!cache) return false;
        const normalizedCity = this.normalizeCity(city);
        if (!normalizedCity) return false;
        if (this.normalizeCity(cache.cityQuery) !== normalizedCity) return false;
        return cache.refreshSlotKey === this.buildWeatherRefreshSlotKey(now);
    },

    weatherCodeToText(code) {
        if (this.weatherCodeMap[code] !== undefined) return this.weatherCodeMap[code];
        return '天气变化';
    },

    formatResolvedCity(result) {
        if (!result) return '';
        return result.name || '';
    },

    normalizeApiHost(host) {
        return String(host || '')
            .trim()
            .replace(/^https?:\/\//i, '')
            .split('/')[0]
            .replace(/\/+$/, '');
    },

    hasQWeatherConfig(apiHost, apiKey) {
        return !!(this.normalizeApiHost(apiHost) && String(apiKey || '').trim());
    },

    buildLocationDisplayName(location) {
        if (!location) return '';
        const parts = [location.country, location.admin1, location.admin2, location.name]
            .map(item => String(item || '').trim())
            .filter(Boolean);
        return [...new Set(parts)].join(' · ');
    },

    async searchOpenMeteoLocations(city) {
        const normalizedCity = this.normalizeCity(city);
        if (!normalizedCity) {
            throw new Error('请先填写城市');
        }

        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedCity)}&count=10&language=zh&format=json`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) {
            throw new Error(`城市查询失败（${geoRes.status}）`);
        }

        const geoData = await geoRes.json();
        const results = Array.isArray(geoData.results) ? geoData.results : [];
        if (results.length === 0) {
            throw new Error('没有找到这个城市');
        }

        return results.map(result => {
            const location = {
                name: result.name || normalizedCity,
                country: result.country || '',
                admin1: result.admin1 || '',
                admin2: result.admin2 || '',
                latitude: Number(result.latitude),
                longitude: Number(result.longitude),
                timezone: result.timezone || '',
                source: 'open_meteo'
            };
            location.displayName = this.buildLocationDisplayName(location) || location.name;
            return location;
        });
    },

    async searchQWeatherLocations(city, apiHost, apiKey) {
        const normalizedCity = this.normalizeCity(city);
        if (!normalizedCity) throw new Error('请先填写城市');

        const host = this.normalizeApiHost(apiHost);
        const key = String(apiKey || '').trim();
        const url = `https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(normalizedCity)}&number=10&lang=zh&key=${encodeURIComponent(key)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`和风城市查询失败（${response.status}）`);

        const data = await response.json();
        if (String(data.code) !== '200') throw new Error(`和风城市查询失败（${data.code || '未知错误'}）`);
        const results = Array.isArray(data.location) ? data.location : [];
        if (results.length === 0) throw new Error('和风天气没有找到这个城市');

        return results.map(result => {
            const location = {
                name: result.name || normalizedCity,
                country: result.country || '',
                admin1: result.adm1 || '',
                admin2: result.adm2 || '',
                latitude: Number(result.lat),
                longitude: Number(result.lon),
                timezone: result.tz || '',
                qweatherId: result.id || '',
                source: 'qweather'
            };
            location.displayName = this.buildLocationDisplayName(location) || location.name;
            return location;
        });
    },

    async searchLocationCandidates(city, options = {}) {
        const { apiHost = '', apiKey = '' } = options;
        if (this.hasQWeatherConfig(apiHost, apiKey)) {
            try {
                return {
                    source: 'qweather',
                    sourceLabel: '和风天气',
                    candidates: await this.searchQWeatherLocations(city, apiHost, apiKey),
                    fallbackReason: ''
                };
            } catch (error) {
                return {
                    source: 'open_meteo',
                    sourceLabel: 'Open-Meteo',
                    candidates: await this.searchOpenMeteoLocations(city),
                    fallbackReason: error.message || String(error)
                };
            }
        }

        return {
            source: 'open_meteo',
            sourceLabel: 'Open-Meteo',
            candidates: await this.searchOpenMeteoLocations(city),
            fallbackReason: ''
        };
    },

    async fetchOpenMeteoWeather(city, location, now = new Date()) {
        const normalizedCity = this.normalizeCity(city);
        let resolvedLocation = location;
        if (!resolvedLocation) {
            // ★ 旧版用户只有城市文本，没有保存候选地点：
            // 自动刷新时仍取第一条以兼容旧行为；用户下次进入设置页可重新搜索并明确选择。
            resolvedLocation = (await this.searchOpenMeteoLocations(normalizedCity))[0];
        }

        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${resolvedLocation.latitude}&longitude=${resolvedLocation.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
        const forecastRes = await fetch(forecastUrl);
        if (!forecastRes.ok) {
            throw new Error(`天气获取失败（${forecastRes.status}）`);
        }

        const forecastData = await forecastRes.json();
        const daily = forecastData.daily || {};
        const weatherCode = daily.weather_code?.[0];
        const tempMax = daily.temperature_2m_max?.[0];
        const tempMin = daily.temperature_2m_min?.[0];
        const dateKey = daily.time?.[0] || this.buildDateKey();

        if (weatherCode === undefined || tempMax === undefined || tempMin === undefined) {
            throw new Error('天气数据不完整');
        }

        return {
            dateKey,
            cityQuery: normalizedCity,
            cityName: resolvedLocation.name || normalizedCity,
            cityDisplayName: resolvedLocation.displayName || resolvedLocation.name || normalizedCity,
            latitude: resolvedLocation.latitude,
            longitude: resolvedLocation.longitude,
            weatherCode,
            weatherText: this.weatherCodeToText(weatherCode),
            tempMin: Math.round(tempMin),
            tempMax: Math.round(tempMax),
            source: 'open_meteo',
            sourceLabel: 'Open-Meteo',
            refreshSlotKey: this.buildWeatherRefreshSlotKey(now),
            updatedAt: new Date().toISOString()
        };
    },

    async fetchQWeather(city, location, apiHost, apiKey, now = new Date()) {
        if (!location) throw new Error('请先搜索并选择具体地点');

        const host = this.normalizeApiHost(apiHost);
        const key = String(apiKey || '').trim();
        const coordinate = `${Number(location.longitude).toFixed(2)},${Number(location.latitude).toFixed(2)}`;
        const locationValue = location.qweatherId || coordinate;
        const url = `https://${host}/v7/weather/3d?location=${encodeURIComponent(locationValue)}&lang=zh&unit=m&key=${encodeURIComponent(key)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`和风天气获取失败（${response.status}）`);

        const data = await response.json();
        if (String(data.code) !== '200') throw new Error(`和风天气获取失败（${data.code || '未知错误'}）`);
        const daily = Array.isArray(data.daily) ? data.daily[0] : null;
        if (!daily || daily.tempMax === undefined || daily.tempMin === undefined) {
            throw new Error('和风天气数据不完整');
        }

        const textDay = String(daily.textDay || '').trim();
        const textNight = String(daily.textNight || '').trim();
        const weatherText = textDay && textNight && textDay !== textNight
            ? `${textDay}转${textNight}`
            : (textDay || textNight || '天气变化');

        return {
            dateKey: daily.fxDate || this.buildDateKey(now),
            cityQuery: this.normalizeCity(city),
            cityName: location.name || this.normalizeCity(city),
            cityDisplayName: location.displayName || location.name || this.normalizeCity(city),
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            weatherCode: daily.iconDay || '',
            weatherText,
            tempMin: Math.round(Number(daily.tempMin)),
            tempMax: Math.round(Number(daily.tempMax)),
            source: 'qweather',
            sourceLabel: '和风天气',
            refreshSlotKey: this.buildWeatherRefreshSlotKey(now),
            updatedAt: data.updateTime || new Date().toISOString()
        };
    },

    async fetchWeather(city, options = {}) {
        const normalizedCity = this.normalizeCity(city);
        if (!normalizedCity) throw new Error('请先填写城市');

        const { location = null, apiHost = '', apiKey = '', now = new Date() } = options;
        if (this.hasQWeatherConfig(apiHost, apiKey)) {
            try {
                return await this.fetchQWeather(normalizedCity, location, apiHost, apiKey, now);
            } catch (error) {
                const fallback = await this.fetchOpenMeteoWeather(normalizedCity, location, now);
                fallback.fallbackReason = error.message || String(error);
                return fallback;
            }
        }

        const result = await this.fetchOpenMeteoWeather(normalizedCity, location, now);
        if (this.normalizeApiHost(apiHost) || String(apiKey || '').trim()) {
            result.fallbackReason = '和风天气配置不完整';
        }
        return result;
    },

    getLunarParts(date) {
        const parts = this.lunarFormatter.formatToParts(date);
        const monthText = (parts.find(part => part.type === 'month')?.value || '').replace(/^闰/, '');
        const dayValue = Number(parts.find(part => part.type === 'day')?.value || 0);
        return {
            month: this.lunarMonthMap[monthText] || 0,
            day: dayValue
        };
    },

    getNthWeekdayDate(year, month, week, weekday) {
        // ★ 浮动星期节日：
        // 例如“5 月第 2 个周日”就是母亲节，“11 月第 4 个周四”就是感恩节。
        const firstDay = new Date(year, month - 1, 1);
        const firstWeekdayOffset = (weekday - firstDay.getDay() + 7) % 7;
        return new Date(year, month - 1, 1 + firstWeekdayOffset + (week - 1) * 7);
    },

    isSameDay(left, right) {
        return left.getFullYear() === right.getFullYear() &&
            left.getMonth() === right.getMonth() &&
            left.getDate() === right.getDate();
    },

    getEasterDate(year) {
        // ★ 复活节不能写死日期：
        // 这里用西方公历复活节常用算法（Computus），纯本地计算，不额外请求 API。
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    },

    isFestivalDefHit(def, date, lunar) {
        const month = date.getMonth() + 1;
        const day = date.getDate();

        if (def.type === 'solar') {
            return def.month === month && def.day === day;
        }
        if (def.type === 'lunar') {
            return def.month === lunar.month && def.day === lunar.day;
        }
        if (def.type === 'weekday') {
            return this.isSameDay(date, this.getNthWeekdayDate(date.getFullYear(), def.month, def.week, def.weekday));
        }
        if (def.type === 'weekdayOffset') {
            const baseDate = this.getNthWeekdayDate(date.getFullYear(), def.month, def.week, def.weekday);
            baseDate.setDate(baseDate.getDate() + def.offset);
            return this.isSameDay(date, baseDate);
        }
        if (def.type === 'easter') {
            return this.isSameDay(date, this.getEasterDate(date.getFullYear()));
        }

        return false;
    },

    getFestivalHits(date) {
        const lunar = this.getLunarParts(date);

        return this.festivalDefs.filter(def => this.isFestivalDefHit(def, date, lunar));
    },

    findAdjacentFestival(date, direction) {
        const probe = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        for (let offset = 1; offset <= 400; offset++) {
            probe.setDate(probe.getDate() + direction);
            const hits = this.getFestivalHits(probe);
            if (hits.length > 0) {
                return {
                    days: offset,
                    names: hits.map(item => item.name),
                    nameText: hits.map(item => item.name).join('、')
                };
            }
        }

        return null;
    },

    buildFestivalText(date = new Date()) {
        const todayHits = this.getFestivalHits(date);
        const prev = this.findAdjacentFestival(date, -1);
        const next = this.findAdjacentFestival(date, 1);
        const segments = [];

        if (todayHits.length > 0) {
            segments.push(`当前是“${todayHits.map(item => item.name).join('、')}”`);
        }
        if (prev) {
            segments.push(`距离上一个节日“${prev.nameText}”已经过去${prev.days}天`);
        }
        if (next) {
            segments.push(`距离下一个节日“${next.nameText}”还有${next.days}天`);
        }

        return segments.join('，');
    },

    buildWeekText(date = new Date()) {
        return this.weekNameMap[date.getDay()] || '';
    },

    buildPromptFromSettings(settings = STATE.settings, now = new Date()) {
        if (settings.WORLD_SENSE_ENABLED !== true) return '';

        const lines = [];
        const weatherCity = this.normalizeCity(settings.WORLD_SENSE_WEATHER_CITY);
        const weatherCache = settings.WORLD_SENSE_WEATHER_CACHE;

        if (
            settings.WORLD_SENSE_WEATHER_ENABLED === true &&
            this.isWeatherCacheValid(weatherCache, weatherCity, now)
        ) {
            lines.push(`- 城市：${weatherCache.cityName || weatherCity}`);
            lines.push(`- 天气：${this.formatWeatherSummary(weatherCache)}`);
        }

        // ★ 星期和节日共用同一个开关：
        // 字段名仍沿用 WORLD_SENSE_FESTIVAL_ENABLED，避免破坏旧数据；
        // 但开启后会同时注入“星期”和“节日”两行。
        if (settings.WORLD_SENSE_FESTIVAL_ENABLED === true) {
            const weekText = this.buildWeekText(now);
            if (weekText) {
                lines.push(`- 星期：${weekText}`);
            }

            const festivalText = this.buildFestivalText(now);
            if (festivalText) {
                lines.push(`- 节日：${festivalText}`);
            }
        }

        if (lines.length === 0) return '';
        return ['# 世界感知', '', ...lines].join('\n');
    }
};
// ★★★★★ 世界感知 END：独立工具层 ★★★★★
