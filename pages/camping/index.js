// pages/camping/index.js
const { sevenDay, indices3d, air } = require('../../utils/api');
const { getDefinition, getColor } = require('../../utils/lifeMeta');
const { toHex } = require('../../utils/util');
const prefs = require('../../utils/prefs');
const { convert } = require('../../utils/temp');
const monitor = require('../../utils/monitor');
const QQMapWX = require('../../libs/qqmap-wx-jssdk.min');
const app = getApp();

// 安全取数字
const safeNum = (val, fb = 0) => {
  if (val == null) return fb;
  const n = Number(val);
  return isNaN(n) ? fb : n;
};

// AQI 等级默认颜色
const AQI_COLORS = {
  '1': '#4caf50', '2': '#8bc34a', '3': '#ffb300',
  '4': '#ff9800', '5': '#f44336', '6': '#b71c1c',
};

// 露营评级（比出行评分更严格：夜间温度、风力、能见度是关键）
const CAMPING_GRADE_MAP = [
  { minScore: 5,  icon: '⛺', label: '绝佳露营日',         color: '#1b5e20' },
  { minScore: 3,  icon: '🌿', label: '适合露营',           color: '#2a7b3e' },
  { minScore: 1,  icon: '👍', label: '可以露营，做好准备',  color: '#8bc34a' },
  { minScore: -1, icon: '⚠️', label: '条件一般，谨慎评估', color: '#ffb300' },
  { minScore: -3, icon: '🌧', label: '不太适合，天气欠佳', color: '#ff9800' },
  { minScore: -99,icon: '🚫', label: '不建议露营',          color: '#f44336' },
];

// 重点展示的生活指数（旅游/运动/穿衣/感冒）
const KEY_INDEX_TYPES = ['6', '1', '3', '9'];

// 星期标签
const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// YYYY-MM-DD → { week, dateLabel }
const parseDateParts = (s) => {
  if (!s) return { week: '', dateLabel: '' };
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday = y === today.getFullYear() && m - 1 === today.getMonth() && d === today.getDate();
  const isTomorrow = (() => {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return date.getTime() === t.getTime();
  })();
  return {
    week: isToday ? '今天' : (isTomorrow ? '明天' : WEEK_LABELS[date.getDay()]),
    dateLabel: `${m}/${d}`,
  };
};

Page({
  data: {
    city: null,              // { location, name, province, district }
    pois: [],                // 营地 POI 列表（展示用）
    selectedPoiIdx: -1,      // 当前选中营地下标
    daily: [],               // 7天日期条（带 active）
    selectedDateIdx: 0,
    selectedDay: null,       // 当前日期渲染数据（含评分）
    loading: false,          // 天气数据加载中
    poiLoading: false,       // POI 搜索中
    errorMsg: '',
    selectorVisible: false,
    scrollToPoiId: '',       // scroll-into-view 目标 id，驱动横滚条定位
    tempUnit: 'C',
    themeColor: '#1296db',
  },

  // 私有变量（不入 data，避免触发渲染）
  _daily: [],      // 原始 7天预报
  _air: null,      // 实时空气质量
  _idxMap: {},     // dateStr → { type → item }
  _allPois: [],    // POI 搜索原始结果

  onLoad(options = {}) {
    this._loadStart = Date.now();
    // 初始化腾讯地图 SDK
    this.qqmapsdk = new QQMapWX({ key: app.globalData.lbs.key });

    const p = prefs.getPrefs();
    this.setData({ tempUnit: p.tempUnit, themeColor: p.themeColor || '#1296db' });
    this._unsubPrefs = prefs.subscribe(up => {
      const changed = up.tempUnit !== this.data.tempUnit || up.themeColor !== this.data.themeColor;
      if (changed) this.setData({ tempUnit: up.tempUnit, themeColor: up.themeColor });
    });

    // 解析 URL 参数（从首页露营 marker tips 跳转时传入）
    const city = this._parseCity(options);
    const preselectedName = options.pn ? decodeURIComponent(options.pn) : '';
    if (city) {
      this.setData({ city });
      // 如果从首页地图露营图层跳来（有 pn），优先使用地图已搜的 POI 列表，保证一一对应
      const session = app.globalData && app.globalData.campingSession;
      if (preselectedName && session && session.poiList && session.poiList.length) {
        this._loadFromSession(session.poiList, preselectedName);
      } else {
        this._searchAndLoad(preselectedName);
      }
    }
  },

  onReady() {
    monitor.recordPageLoad('/pages/camping/index', this._loadStart);
  },

  onUnload() {
    if (this._unsubPrefs) this._unsubPrefs();
  },

  // 解析 URL 城市参数
  // 使用 location 键（route.js NO_ENCODE_KEYS 豁免编码，坐标逗号保留原样）
  _parseCity(options) {
    if (!options.location) return null;
    return {
      location: options.location,
      name: options.n ? decodeURIComponent(options.n) : '',
      province: options.p ? decodeURIComponent(options.p) : '',
      district: options.d ? decodeURIComponent(options.d) : '',
    };
  },

  // ── 搜索 POI + 加载天气 ────────────────────────────────────────────────────

  // 直接使用首页传来的 POI 列表（与地图 markers 严格一一对应，无需重新搜索）
  async _loadFromSession(poiList, preselectedName = '') {
    let initIdx = poiList.length > 0 ? 0 : -1;
    if (preselectedName) {
      const found = poiList.findIndex(p => p.title === preselectedName);
      if (found >= 0) initIdx = found;
    }

    // 先渲染列表和选中态，nextTick 后再触发 scroll-into-view（元素需先存在）
    this.setData({ poiLoading: false, errorMsg: '', pois: poiList, selectedPoiIdx: initIdx, scrollToPoiId: '' });
    if (initIdx > 0) {
      wx.nextTick(() => this.setData({ scrollToPoiId: `poi-item-${initIdx}` }));
    }

    if (initIdx >= 0) {
      await this._loadWeather(poiList[initIdx]);
    }
  },

  async _searchAndLoad(preselectedName = '') {
    const { city } = this.data;
    if (!city || !city.location) return;
    // 解析经纬度（location 为 "lon,lat" 格式）
    const [lon, lat] = city.location.split(',').map(Number);
    if (!lat || !lon) return;

    this.setData({ poiLoading: true, errorMsg: '', pois: [], selectedPoiIdx: -1, selectedDay: null, daily: [] });
    try {
      const pois = await this._searchPOI(lat, lon);
      this._allPois = pois;
      const poiList = pois.slice(0, 12).map(poi => ({
        title: poi.title || '营地',
        address: poi.address || poi.district || '',
        lat: poi.latitude,
        lon: poi.longitude,
      }));
      this.setData({ pois: poiList, poiLoading: false });

      // 如有预选营地名（从首页 tips 跳转），尝试匹配并选中
      let initIdx = poiList.length > 0 ? 0 : -1;
      if (preselectedName && poiList.length > 0) {
        const found = poiList.findIndex(p => p.title === preselectedName);
        if (found >= 0) initIdx = found;
      }

      if (initIdx >= 0) {
        this.setData({ selectedPoiIdx: initIdx });
        if (initIdx > 0) {
          wx.nextTick(() => this.setData({ scrollToPoiId: `poi-item-${initIdx}` }));
        }
        await this._loadWeather(poiList[initIdx]);
      }
    } catch (e) {
      monitor.recordError('page', e?.message || '营地搜索失败', { page: '/pages/camping/index' });
      this.setData({ poiLoading: false, errorMsg: '营地搜索失败，请重试' });
    }
  },

  // 搜索附近露营地 POI（promisify qqmapsdk.search）
  _searchPOI(lat, lon) {
    return new Promise((resolve, reject) => {
      this.qqmapsdk.search({
        keyword: '露营',
        location: `${lat},${lon}`,
        distance: 50000,
        page_size: 15,
        success: (res, data) => resolve((data && data.searchSimplify) || []),
        fail: err => reject(err),
      });
    });
  },

  // 加载选中营地的天气数据
  async _loadWeather(poi) {
    if (!poi || !poi.lat || !poi.lon) return;
    const loc = `${poi.lon},${poi.lat}`;

    this.setData({ loading: true, errorMsg: '', daily: [], selectedDay: null });
    try {
      const [dailyRes, idxRes, airRes] = await Promise.all([
        sevenDay({ location: loc }).catch(() => null),
        indices3d({ location: loc, type: '0' }).catch(() => null),
        air(loc).catch(() => null),
      ]);

      this._daily = this._processDaily(dailyRes);
      this._idxMap = this._processIndices(idxRes);
      this._air = this._processAir(airRes);

      const daily = this._daily.map((d, i) => ({ ...d, active: i === 0 }));
      this.setData({ loading: false, daily, selectedDateIdx: 0 });
      this._selectDate(0);
    } catch (e) {
      monitor.recordError('page', e?.message || '天气加载失败', { page: '/pages/camping/index' });
      this.setData({ loading: false, errorMsg: '天气加载失败，请重试' });
    }
  },

  // ── 数据解析 ───────────────────────────────────────────────────────────────

  _processDaily(res) {
    if (!res || res.code !== '200' || !res.daily) return [];
    return res.daily.slice(0, 7).map(d => {
      const { week, dateLabel } = parseDateParts(d.fxDate);
      return {
        fxDate: d.fxDate,
        week,
        dateLabel,
        iconDay: d.iconDay,
        textDay: d.textDay,
        tempMax: safeNum(d.tempMax),
        tempMin: safeNum(d.tempMin),
        humidity: safeNum(d.humidity),
        pop: safeNum(d.pop),
        windDirDay: d.windDirDay || '',
        windScaleDay: d.windScaleDay || '',
        uvIndex: safeNum(d.uvIndex),
        vis: safeNum(d.vis),
      };
    });
  },

  _processIndices(res) {
    if (!res || res.code !== '200' || !res.daily) return {};
    const map = {};
    res.daily.forEach(item => {
      const dateStr = item.date;
      if (!map[dateStr]) map[dateStr] = {};
      map[dateStr][item.type] = {
        type: item.type,
        name: item.name || (getDefinition(item.type) || {}).name || '',
        level: item.level,
        category: item.category,
        text: item.text,
        color: getColor(item.type, item.level, item.category),
      };
    });
    return map;
  },

  _processAir(res) {
    if (!res || !res.indexes || !res.indexes.length) return null;
    const idx = res.indexes[0];
    const colorHex = idx.color ? toHex(idx.color) : (AQI_COLORS[idx.level] || '#9BB365');
    return {
      aqi: idx.aqi,
      aqiDisplay: idx.aqiDisplay || idx.aqi,
      category: idx.category || '',
      level: idx.level || '',
      color: colorHex,
    };
  },

  // ── 日期切换 ───────────────────────────────────────────────────────────────

  onDateTap(e) {
    const idx = safeNum(e.currentTarget.dataset.idx);
    if (idx === this.data.selectedDateIdx) return;
    const daily = this.data.daily.map((d, i) => ({ ...d, active: i === idx }));
    this.setData({ selectedDateIdx: idx, daily });
    this._selectDate(idx);
  },

  _selectDate(idx) {
    const dayRaw = this._daily[idx];
    if (!dayRaw) return;
    const dateStr = dayRaw.fxDate;
    const { tempUnit } = this.data;
    const idxForDay = this._idxMap[dateStr];

    const indices = idxForDay
      ? KEY_INDEX_TYPES.map(type => idxForDay[type] || null).filter(Boolean)
      : null;

    const advice = this._calcCampingScore(dayRaw, this._air, idxForDay);

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
      indices,
      air: this._air,
      advice,
    };
    this.setData({ selectedDay });
  },

  // ── 露营评分算法 ───────────────────────────────────────────────────────────

  _calcCampingScore(dayData, airData, idxForDay) {
    let score = 0;
    const tips = [];

    // 1. 天气图标（降水/强对流）
    const ic = safeNum(dayData.iconDay);
    if (ic <= 103) {
      score += 2; // 晴/少云，绝佳观星
    } else if (ic <= 104) {
      score += 1; // 多云/阴
    } else if (ic >= 300 && ic <= 313) {
      score -= 1; tips.push('可能有降雨，注意防水');
    } else if (ic >= 314 && ic <= 349) {
      score -= 2; tips.push('降水较强，不适合搭帐篷');
    } else if (ic >= 350 && ic <= 399) {
      score -= 3; tips.push('强对流天气，危险，禁止露营');
    } else if (ic >= 400 && ic <= 499) {
      score -= 2; tips.push('降雪天气，需专业低温装备');
    } else if (ic >= 500 && ic <= 515) {
      score -= 1; tips.push('能见度低，夜间安全注意');
    } else if (ic >= 516 && ic <= 599) {
      score -= 2; tips.push('沙尘天气，强烈不建议露营');
    }

    // 2. 降水概率
    if (dayData.pop >= 70) {
      score -= 2;
      if (!tips.some(t => t.includes('降'))) tips.push(`降水概率 ${dayData.pop}%，露营风险高`);
    } else if (dayData.pop >= 40) {
      score -= 1;
      if (!tips.some(t => t.includes('降'))) tips.push(`降水概率 ${dayData.pop}%，建议备好防雨装备`);
    }

    // 3. 夜间温度（tempMin）—— 露营核心指标
    const tn = safeNum(dayData.tempMin);
    if (tn >= 15 && tn <= 22) {
      score += 2; // 最舒适夜间温度
    } else if ((tn >= 10 && tn < 15) || (tn > 22 && tn <= 27)) {
      score += 1;
      if (tn < 15) tips.push(`夜间 ${tn}°C，注意保暖`);
    } else if (tn >= 5 && tn < 10) {
      tips.push(`夜间仅 ${tn}°C，需携带四季帐篷及睡袋`);
    } else if (tn < 5) {
      score -= 2; tips.push(`夜间低温 ${tn}°C，需专业低温装备`);
    } else if (tn > 27) {
      score -= 1; tips.push(`夜间 ${tn}°C 偏热，睡眠质量较差`);
    }

    // 4. 风力（影响帐篷稳定性）
    const windScale = safeNum(String(dayData.windScaleDay).split('-')[0]);
    if (windScale <= 2) {
      score += 1; // 微风，搭帐篷理想
    } else if (windScale >= 5 && windScale < 7) {
      score -= 1; tips.push(`风力 ${dayData.windScaleDay} 级，注意固定帐篷`);
    } else if (windScale >= 7) {
      score -= 3; tips.push(`大风 ${dayData.windScaleDay} 级，帐篷有倒塌风险`);
    }

    // 5. 能见度（观星/安全）
    const vis = safeNum(dayData.vis);
    if (vis > 20) {
      score += 1; // 适合观星
    } else if (vis > 0 && vis <= 5) {
      score -= 1; tips.push('能见度较低，夜间行动注意安全');
    }

    // 6. 空气质量
    if (airData) {
      const level = safeNum(airData.level, 1);
      if (level <= 2) {
        score += 1; // 空气清新，户外绝佳
      } else if (level >= 4) {
        score -= 2; tips.push('空气质量较差，露营体验大打折扣');
      } else if (level === 3) {
        score -= 1; tips.push('空气轻度污染，敏感人群慎重');
      }
    }

    // 7. 旅游/户外指数
    if (idxForDay && idxForDay['6']) {
      const lvl = safeNum(idxForDay['6'].level, 3);
      if (lvl <= 2) score += 1;
      else if (lvl >= 4) score -= 1;
    }

    const grade = CAMPING_GRADE_MAP.find(g => score >= g.minScore) || CAMPING_GRADE_MAP[CAMPING_GRADE_MAP.length - 1];
    return {
      score,
      icon: grade.icon,
      label: grade.label,
      color: grade.color,
      tips,
      nightTemp: safeNum(dayData.tempMin),
    };
  },

  // ── 营地选择 ───────────────────────────────────────────────────────────────

  async onPoiTap(e) {
    const idx = safeNum(e.currentTarget.dataset.idx);
    if (idx === this.data.selectedPoiIdx) return;
    const pois = this.data.pois;
    if (!pois[idx]) return;

    // 将选中营地写回 campingSession，供返回首页时地图自动定位
    const session = app.globalData && app.globalData.campingSession;
    if (session) {
      session.selection = { title: pois[idx].title, lat: pois[idx].lat, lon: pois[idx].lon };
    }

    this._daily = [];
    this._idxMap = {};
    this._air = null;
    this.setData({
      selectedPoiIdx: idx,
      scrollToPoiId: `poi-item-${idx}`,
      daily: [],
      selectedDay: null,
      selectedDateIdx: 0,
    });
    await this._loadWeather(pois[idx]);
  },

  // ── 城市选择 ───────────────────────────────────────────────────────────────

  onSelectSlot() {
    this.setData({ selectorVisible: true });
  },

  onSelectCity(e) {
    const city = e.detail.city;
    if (!city || !city.lat || !city.lon) return;
    this.setData({ selectorVisible: false });
    // 换城市后 campingSession 失效（与首页地图图层解绑，返回时不再触发地图定位）
    if (app.globalData) app.globalData.campingSession = null;
    const cityData = {
      location: `${city.lon},${city.lat}`,
      name: city.name || city.adm2 || '',
      province: city.adm1 || '',
      district: city.name || city.adm2 || '',
    };
    this._daily = [];
    this._idxMap = {};
    this._air = null;
    this._allPois = [];
    this.setData({
      city: cityData,
      pois: [],
      selectedPoiIdx: -1,
      scrollToPoiId: '',
      daily: [],
      selectedDay: null,
      selectedDateIdx: 0,
    });
    this._searchAndLoad();
  },

  onSelectorClose() {
    this.setData({ selectorVisible: false });
  },

  // ── 重试 ──────────────────────────────────────────────────────────────────

  onRetry() {
    const { pois, selectedPoiIdx } = this.data;
    if (pois.length > 0 && selectedPoiIdx >= 0) {
      this._loadWeather(pois[selectedPoiIdx]);
    } else {
      this._searchAndLoad();
    }
  },
});
