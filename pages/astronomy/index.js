// pages/astronomy/index.js
const { sun, moon, solarElevationAngle } = require('../../utils/api');
const share = require('../../utils/share');
const monitor = require('../../utils/monitor');
const { parsePageOptions } = require('../../utils/route');
const prefsBehavior = require('../../behaviors/prefsBehavior');
const { fmtTime, toMin, drawSun, drawMoon } = require('../../utils/astronomyCanvas');

Page({
  behaviors: [prefsBehavior],

  data: {
    location: '',
    province: '',
    city: '',
    district: '',
    loading: false,
    errorMsg: '',

    // 日期导航（前后各 3 天，共 7 项）
    dates: [],
    selectedDate: '',
    todayStr: '',

    // 太阳数据
    sunrise: '--:--',
    sunset: '--:--',
    daylightStr: '',

    // 太阳高度角（仅今天有效）
    showSolarAngle: false,
    solarElevation: null,
    solarAzimuth: null,
    solarAzimuthDir: '',
    solarHour: '',
    solarAboveHorizon: false,

    // 月亮数据
    moonrise: '--:--',
    moonset: '--:--',
    hasMoonset: false,
    lunarTimeStr: '',

    // 月相
    moonPhaseName: '',
    moonIllumination: 0,
    moonPhaseIcon: '',
    illuminationMin: 0,  // 当日照明度最小值
    illuminationMax: 0,  // 当日照明度最大值
  },

  onLoad(options = {}) {
    this._loadStart = Date.now();
    const { location, province, city, district } = parsePageOptions(options);
    this.setData({ location, province, city, district });

    this._initDates();

    if (location) {
      this.loadData();
    } else {
      this.setData({ errorMsg: '缺少城市定位' });
    }
  },

  onReady() {
    monitor.recordPageLoad('/pages/astronomy/index', this._loadStart);
  },

  // ─── 日期导航 ─────────────────────────────────────────────────────────

  _initDates() {
    const today = new Date();
    const todayStr = this._fmtDate(today);
    const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
    const dates = [];
    // 天文 API 仅支持未来 60 天，不提供历史数据；显示今天 + 未来 6 天
    for (let i = 0; i <= 6; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = this._fmtDate(d);
      // 跨月时在 dayNum 前加 "月/日" 提示，避免数字跳变
      const isCrossMonth = d.getMonth() !== today.getMonth();
      dates.push({
        dateStr,
        label: i === 0 ? '今天' : `周${weekNames[d.getDay()]}`,
        dayNum: isCrossMonth ? `${d.getMonth() + 1}/${d.getDate()}` : d.getDate(),
        isSelected: i === 0,
      });
    }
    this.setData({ dates, selectedDate: todayStr, todayStr });
  },

  // 格式化为 yyyyMMdd（天文 API 要求，无连字符）
  _fmtDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  },

  onDateSelect(e) {
    const { date } = e.currentTarget.dataset;
    if (date === this.data.selectedDate) return;
    const dates = this.data.dates.map(d => ({ ...d, isSelected: d.dateStr === date }));
    // 清除 canvas 引用，切日期后重新初始化
    this._sunCtx = null;
    this._moonCtx = null;
    this.setData({ dates, selectedDate: date });
    this.loadData();
  },

  // ─── 数据加载 ─────────────────────────────────────────────────────────

  async loadData() {
    const { location, selectedDate, todayStr } = this.data;
    const isToday = selectedDate === todayStr;
    this.setData({ loading: true, errorMsg: '', showSolarAngle: false });

    try {
      // 太阳高度角仅对今天有意义
      let anglePromise = Promise.resolve(null);
      if (isToday) {
        const now_ = new Date();
        const tzOff = -now_.getTimezoneOffset();
        const tzSign = tzOff < 0 ? '-' : '';
        const tzH = String(Math.floor(Math.abs(tzOff) / 60)).padStart(2, '0');
        const tzM = String(Math.abs(tzOff) % 60).padStart(2, '0');
        const tzStr = `${tzSign}${tzH}${tzM}`;
        const timeHHmm = `${String(now_.getHours()).padStart(2, '0')}${String(now_.getMinutes()).padStart(2, '0')}`;
        anglePromise = solarElevationAngle({
          location, date: selectedDate, time: timeHHmm, tz: tzStr, alt: 0
        }).catch(() => null);
      }

      const [sunRes, moonRes, angleRes] = await Promise.all([
        sun({ location, date: selectedDate }),
        moon({ location, date: selectedDate }),
        anglePromise,
      ]);

      this._processSun(sunRes);
      this._processMoon(moonRes);
      if (angleRes) this._processAngle(angleRes);
    } catch (e) {
      console.error(e);
      monitor.recordError('page', e?.message || '天文数据加载失败', {
        page: '/pages/astronomy/index', stack: e?.stack
      });
      this.setData({ errorMsg: '加载失败，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  _processSun(data) {
    if (!data || data.code !== '200') return;
    const riseStr = fmtTime(data.sunrise);
    const setStr = fmtTime(data.sunset);
    const riseMin = toMin(riseStr);
    const setMin = toMin(setStr);
    let daylightStr = '';
    if (riseMin != null && setMin != null && setMin > riseMin) {
      const total = setMin - riseMin;
      const h = Math.floor(total / 60);
      const m = total % 60;
      daylightStr = h > 0 ? `${h}时${String(m).padStart(2, '0')}分` : `${m}分`;
    }
    this.setData({ sunrise: riseStr, sunset: setStr, daylightStr });
    wx.nextTick(() => {
      if (this._sunCtx) {
        this._redrawSun();
      } else {
        this._initSunCanvas();
      }
    });
  },

  _processMoon(data) {
    if (!data || data.code !== '200') return;
    const riseStr = fmtTime(data.moonrise);
    const setStr = data.moonset ? fmtTime(data.moonset) : '--:--';
    const riseMin = toMin(riseStr);
    const setMin = data.moonset ? toMin(setStr) : null;

    // 计算在天时长
    let lunarTimeStr = '';
    if (riseMin != null && setMin != null) {
      const span = setMin >= riseMin ? setMin - riseMin : (1440 - riseMin) + setMin;
      const h = Math.floor(span / 60);
      const m = span % 60;
      lunarTimeStr = h > 0 ? `${h}时${String(m).padStart(2, '0')}分` : `${m}分`;
    }

    // 找最近月相（距当前时刻最近的记录）
    let phase = null;
    if (data.moonPhase && data.moonPhase.length) {
      const nowTs = Date.now();
      let minDiff = Infinity;
      for (const p of data.moonPhase) {
        const diff = Math.abs(new Date(p.fxTime).getTime() - nowTs);
        if (diff < minDiff) { minDiff = diff; phase = p; }
      }
    }

    // 计算当日照明度范围（24 条逐小时数据取 min/max）
    let illuminationMin = 0;
    let illuminationMax = 0;
    if (data.moonPhase && data.moonPhase.length) {
      const vals = data.moonPhase.map(p => parseInt(p.illumination) || 0);
      illuminationMin = Math.min(...vals);
      illuminationMax = Math.max(...vals);
    }

    this.setData({
      moonrise: riseStr,
      moonset: setStr,
      hasMoonset: !!data.moonset,
      lunarTimeStr,
      moonPhaseName: phase ? phase.name : '',
      moonIllumination: phase ? parseInt(phase.illumination) : 0,
      moonPhaseIcon: phase ? phase.icon : '',
      illuminationMin,
      illuminationMax,
    });
    wx.nextTick(() => {
      if (this._moonCtx) {
        this._redrawMoon();
      } else {
        this._initMoonCanvas();
      }
    });
  },

  _processAngle(data) {
    if (!data || data.code !== '200') return;
    const elev = parseFloat(data.solarElevationAngle);
    const azim = parseFloat(data.solarAzimuthAngle);
    if (isNaN(elev) || isNaN(azim)) return;
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    const dir = dirs[Math.round(((azim % 360) + 360) % 360 / 45) % 8];
    const sh = data.solarHour || '';
    const solarHourFmt = sh.length === 4 ? `${sh.slice(0, 2)}:${sh.slice(2)}` : sh;
    this.setData({
      showSolarAngle: true,
      solarElevation: Math.round(elev * 10) / 10,
      solarAzimuth: Math.round(azim * 10) / 10,
      solarAzimuthDir: dir,
      solarHour: solarHourFmt,
      solarAboveHorizon: elev > 0,
    });
  },


  // ─── Canvas 初始化与重绘 ──────────────────────────────────────────────
  // 绘制细节全在 utils/astronomyCanvas.js，页面只负责获取 Canvas 节点、组装 nowMin

  _initSunCanvas(retry = 0) {
    const query = wx.createSelectorQuery();
    query.select('#sunCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        if (retry < 6) setTimeout(() => this._initSunCanvas(retry + 1), 100);
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = (wx.getDeviceInfo ? wx.getDeviceInfo().devicePixelRatio : null) || 2;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);
      this._sunCtx = ctx;
      this._sunW = res[0].width;
      this._sunH = res[0].height;
      this._redrawSun();
    });
  },

  _redrawSun() {
    if (!this._sunCtx) return;
    const { sunrise, sunset, selectedDate, todayStr } = this.data;
    const isToday = selectedDate === todayStr;
    const now = new Date();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : null;
    drawSun(this._sunCtx, this._sunW, this._sunH, { sunrise, sunset, nowMin });
  },

  _initMoonCanvas(retry = 0) {
    const query = wx.createSelectorQuery();
    query.select('#moonCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        if (retry < 6) setTimeout(() => this._initMoonCanvas(retry + 1), 100);
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = (wx.getDeviceInfo ? wx.getDeviceInfo().devicePixelRatio : null) || 2;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);
      this._moonCtx = ctx;
      this._moonW = res[0].width;
      this._moonH = res[0].height;
      this._redrawMoon();
    });
  },

  _redrawMoon() {
    if (!this._moonCtx) return;
    const { moonrise, moonset, hasMoonset, selectedDate, todayStr } = this.data;
    const isToday = selectedDate === todayStr;
    const now = new Date();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : null;
    drawMoon(this._moonCtx, this._moonW, this._moonH, { moonrise, moonset, hasMoonset, nowMin });
  },

  // ─── 重试 & 分享 ──────────────────────────────────────────────────────

  onRetry() {
    this.loadData();
  },

  _shareParams() {
    const { location, province, city, district } = this.data;
    return { location, province, city, district };
  },

  onShareAppMessage() {
    const { district, city, sunrise, sunset } = this.data;
    const loc = district || city || '';
    const title = sunrise !== '--:--'
      ? `${loc} 今天 ${sunrise} 日出 · ${sunset} 日落`
      : `${loc} 天文信息`;
    return share.card('/pages/astronomy/index', this._shareParams(), title);
  },

  onShareTimeline() {
    const { district, city } = this.data;
    return share.timeline('/pages/astronomy/index', this._shareParams(),
      `${district || city || ''} 天文信息`);
  },
});
