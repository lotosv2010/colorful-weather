// pages/trip/index.js
const { sevenDay, indices3d, air } = require('../../utils/api');
const { safeNum } = require('../../utils/util');
const { convert } = require('../../utils/temp');
const monitor = require('../../utils/monitor');
const { ADVICE_GRADE_MAP } = require('../../utils/tripAdvice');
const prefsBehavior = require('../../behaviors/prefsBehavior');
const outingBehavior = require('../../behaviors/outingBehavior');

// 重点展示的生活指数 type（旅游/穿衣/运动/感冒）
const KEY_INDEX_TYPES = ['6', '3', '1', '9'];

Page({
  behaviors: [prefsBehavior, outingBehavior],

  data: {
    city: null,             // { location, name, province, district }
    daily: [],              // 7天预报（带 week/dateLabel 预处理）
    selectedDateIdx: 0,     // 当前选中日期下标
    selectedDay: null,      // 当前日期展示对象（含评分）
    loading: false,
    errorMsg: '',
    selectorVisible: false,
  },

  // 内部缓存（不入 data，避免触发渲染）
  _daily: [],      // 原始 7天预报
  _indicesMap: {}, // dateStr → Map<type, item>
  _airData: null,  // 实时空气质量

  onLoad(options = {}) {
    this._loadStart = Date.now();

    // 解析可选预填城市（loc/n/p/d）
    const city = this._parseCity(options);
    if (city) {
      this.setData({ city });
      this._loadCity();
    }
  },

  onReady() {
    monitor.recordPageLoad('/pages/trip/index', this._loadStart);
  },

  // 解析 URL 城市参数
  _parseCity(options) {
    if (!options.loc) return null;
    return {
      location: options.loc,
      name: options.n ? decodeURIComponent(options.n) : '',
      province: options.p ? decodeURIComponent(options.p) : '',
      district: options.d ? decodeURIComponent(options.d) : '',
    };
  },

  // ── 数据加载 ───────────────────────────────────────────────────────────────

  async _loadCity() {
    const { city } = this.data;
    if (!city || !city.location) return;

    this.setData({ loading: true, errorMsg: '', daily: [], selectedDay: null });
    try {
      const loc = city.location;
      const [dailyRes, idxRes, airRes] = await Promise.all([
        sevenDay({ location: loc }).catch(() => null),
        indices3d({ location: loc, type: '0' }).catch(() => null),
        air(loc).catch(() => null),
      ]);

      this._daily = this._processDaily(dailyRes);
      this._indicesMap = this._processIndices(idxRes);
      this._airData = this._processAir(airRes);

      // 计算带 week/dateLabel 的日期列表（供横向选择）
      const daily = this._daily.map((d, i) => ({
        ...d,
        active: i === 0,
      }));

      this.setData({ loading: false, daily, selectedDateIdx: 0 });
      this._selectDate(0);
    } catch (e) {
      monitor.recordError('page', e?.message || '出行规划加载失败', { page: '/pages/trip/index' });
      this.setData({ loading: false, errorMsg: '加载失败，请重试' });
    }
  },

  // 7 天预报解析、生活指数解析、空气质量解析 → 见 behaviors/outingBehavior.js

  // ── 日期切换 ───────────────────────────────────────────────────────────────

  onDateTap(e) {
    const idx = safeNum(e.currentTarget.dataset.idx);
    if (idx === this.data.selectedDateIdx) return;
    // 更新 daily 中 active 状态
    const daily = this.data.daily.map((d, i) => ({ ...d, active: i === idx }));
    this.setData({ selectedDateIdx: idx, daily });
    this._selectDate(idx);
  },

  _selectDate(idx) {
    const dayRaw = this._daily[idx];
    if (!dayRaw) return;

    const dateStr = dayRaw.fxDate;
    const { tempUnit } = this.data;

    // 生活指数（仅 indices3d 覆盖的前 3 天）
    const idxForDay = this._indicesMap[dateStr];
    const indices = idxForDay
      ? KEY_INDEX_TYPES.map(type => {
        const item = idxForDay[type];
        if (!item) return null;
        return item;
      }).filter(Boolean)
      : null;

    // 综合评分
    const advice = this._calcScore(dayRaw, idxForDay, this._airData);

    const selectedDay = {
      dateStr,
      week: dayRaw.week,
      dateLabel: dayRaw.dateLabel,
      iconDay: dayRaw.iconDay,
      textDay: dayRaw.textDay,
      tempMax: convert(dayRaw.tempMax, tempUnit),
      tempMin: convert(dayRaw.tempMin, tempUnit),
      tempMaxRaw: dayRaw.tempMax,
      tempMinRaw: dayRaw.tempMin,
      humidity: dayRaw.humidity,
      pop: dayRaw.pop,
      windDirDay: dayRaw.windDirDay,
      windScaleDay: dayRaw.windScaleDay,
      uvIndex: dayRaw.uvIndex,
      vis: dayRaw.vis,
      indices,         // null 表示超出指数预报范围
      air: this._airData,
      advice,
    };

    this.setData({ selectedDay });
  },

  // ── 综合评分 ───────────────────────────────────────────────────────────────

  _calcScore(dayData, idxForDay, airData) {
    let score = 0;
    const tips = [];

    // 天气图标 code → 评分
    const ic = safeNum(dayData.iconDay);
    if (ic <= 103) {
      score += 2; // 晴/少云
    } else if (ic <= 299) {
      score += 1; // 多云/阴
    } else if (ic >= 300 && ic <= 313) {
      score -= 1; tips.push('可能有降雨，建议携带雨具');
    } else if (ic >= 314 && ic <= 349) {
      score -= 2; tips.push('降水较强，谨慎出行');
    } else if (ic >= 350 && ic <= 399) {
      score -= 3; tips.push('强对流天气，不建议外出');
    } else if (ic >= 400 && ic <= 499) {
      score -= 1; tips.push('有降雪天气，注意路况');
    } else if (ic >= 500 && ic <= 515) {
      score -= 1; tips.push('能见度较低，注意行车安全');
    } else if (ic >= 516 && ic <= 599) {
      score -= 2; tips.push('沙尘天气，注意防护');
    }

    // 降水概率
    if (dayData.pop >= 70) {
      score -= 1;
      if (!tips.some(t => t.includes('降水') || t.includes('雨'))) {
        tips.push(`降水概率 ${dayData.pop}%，建议备伞`);
      }
    }

    // 风力
    const windScale = safeNum(String(dayData.windScaleDay).split('-')[0]);
    if (windScale >= 6) {
      score -= 1; tips.push(`风力较大（${dayData.windScaleDay}级），注意出行安全`);
    }

    // 空气质量
    if (airData) {
      const level = safeNum(airData.level, 1);
      if (level >= 4) {
        score -= 2; tips.push('空气质量较差，建议佩戴口罩');
      } else if (level === 3) {
        score -= 1; tips.push('空气轻度污染，敏感人群注意防护');
      }
    }

    // 旅游指数
    if (idxForDay && idxForDay['6']) {
      const lvl = safeNum(idxForDay['6'].level, 3);
      if (lvl <= 2) score += 1;
      else if (lvl >= 4) score -= 1;
    }

    // 匹配评级
    const grade = ADVICE_GRADE_MAP.find(g => score >= g.minScore) || ADVICE_GRADE_MAP[ADVICE_GRADE_MAP.length - 1];

    return {
      score,
      icon: grade.icon,
      label: grade.label,
      color: grade.color,
      tips,
    };
  },

  // ── 城市选择 ───────────────────────────────────────────────────────────────
  // onSelectSlot / onSelectorClose 由 outingBehavior 提供

  onSelectCity(e) {
    const city = e.detail.city;
    if (!city || !city.lat || !city.lon) return;
    this.setData({ selectorVisible: false });

    const cityData = {
      location: `${city.lon},${city.lat}`,
      name: city.name || city.adm2 || '',
      province: city.adm1 || '',
      district: city.name || city.adm2 || '',
    };
    this._daily = [];
    this._indicesMap = {};
    this._airData = null;
    this.setData({ city: cityData, daily: [], selectedDay: null, selectedDateIdx: 0 });
    this._loadCity();
  },

  // ── 重试 ──────────────────────────────────────────────────────────────────

  onRetry() {
    this._loadCity();
  },
});
