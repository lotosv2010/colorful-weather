// pages/astronomy/index.js
const { sun, moon, solarElevationAngle } = require('../../utils/api');
const share = require('../../utils/share');
const monitor = require('../../utils/monitor');
const prefs = require('../../utils/prefs');

Page({
  data: {
    location: '',
    province: '',
    city: '',
    district: '',
    loading: false,
    errorMsg: '',
    themeColor: '',

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
    const location = options.location || '';
    const province = options.province ? decodeURIComponent(options.province) : '';
    const city = options.city ? decodeURIComponent(options.city) : '';
    const district = options.district ? decodeURIComponent(options.district) : '';
    this.setData({ location, province, city, district });

    const p = prefs.getPrefs();
    this.setData({ themeColor: p.themeColor || '' });
    this._unsubPrefs = prefs.subscribe(up => {
      this.setData({ themeColor: up.themeColor || '' });
    });

    this._initDates();

    if (location) {
      this.loadData();
    } else {
      this.setData({ errorMsg: '缺少城市定位' });
    }
  },

  onUnload() {
    if (this._unsubPrefs) this._unsubPrefs();
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
    const riseStr = this._fmtTime(data.sunrise);
    const setStr = this._fmtTime(data.sunset);
    const riseMin = this._toMin(riseStr);
    const setMin = this._toMin(setStr);
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
        this._drawSun();
      } else {
        this._initSunCanvas();
      }
    });
  },

  _processMoon(data) {
    if (!data || data.code !== '200') return;
    const riseStr = this._fmtTime(data.moonrise);
    const setStr = data.moonset ? this._fmtTime(data.moonset) : '--:--';
    const riseMin = this._toMin(riseStr);
    const setMin = data.moonset ? this._toMin(setStr) : null;

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
        this._drawMoon();
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

  // ─── Canvas 工具 ──────────────────────────────────────────────────────

  _fmtTime(isoStr) {
    if (!isoStr) return '--:--';
    const m = isoStr.match(/T(\d{2}:\d{2})/);
    return m ? m[1] : '--:--';
  },

  _toMin(str) {
    if (!str || str === '--:--') return null;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  },

  _drawCurve(ctx, points, color, lineWidth, isDashed) {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = isDashed ? 0.35 : 1;
    ctx.setLineDash(isDashed ? [6, 4] : []);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  },

  // ─── 日出日落 Canvas ──────────────────────────────────────────────────

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
      this._drawSun();
    });
  },

  _drawSun() {
    if (!this._sunCtx) return;
    const ctx = this._sunCtx;
    const w = this._sunW;
    const h = this._sunH;
    const COLOR = '#FF8C00';
    const { sunrise, sunset, selectedDate, todayStr } = this.data;
    const riseMin = this._toMin(sunrise);
    const setMin = this._toMin(sunset);
    const isToday = selectedDate === todayStr;
    const now = new Date();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : null;

    ctx.clearRect(0, 0, w, h);

    const padL = 16, padR = 16, padT = 10, padB = 44;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const toX = (min) => padL + (min / 1440) * chartW;
    const baseY = padT + chartH * 0.78;

    // 数据无效
    if (riseMin == null || setMin == null || setMin <= riseMin) {
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, baseY);
      ctx.lineTo(w - padR, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      return;
    }

    const nightSpan = 1440 - (setMin - riseMin);
    const curveY = (min) => {
      if (min >= riseMin && min <= setMin) {
        const t = (min - riseMin) / (setMin - riseMin);
        return baseY - chartH * 0.86 * Math.sin(Math.PI * t);
      }
      const offset = min >= setMin ? min - setMin : (1440 - setMin) + min;
      const t = offset / nightSpan;
      return baseY + chartH * 0.20 * Math.sin(Math.PI * t);
    };

    const allPts = [];
    for (let m = 0; m <= 1440; m += 5) allPts.push({ x: toX(m), y: curveY(m), m });

    const nightBefore = allPts.filter(p => p.m <= riseMin);
    const dayTime    = allPts.filter(p => p.m >= riseMin && p.m <= setMin);
    const nightAfter = allPts.filter(p => p.m >= setMin);

    // 基线
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.18;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(padL, baseY);
    ctx.lineTo(w - padR, baseY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 白天渐变填充
    const grad = ctx.createLinearGradient(0, padT, 0, baseY);
    grad.addColorStop(0, 'rgba(255,140,0,0.22)');
    grad.addColorStop(1, 'rgba(255,140,0,0)');
    ctx.beginPath();
    ctx.moveTo(toX(riseMin), baseY);
    for (const p of dayTime) ctx.lineTo(p.x, p.y);
    ctx.lineTo(toX(setMin), baseY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 曲线
    if (nightBefore.length >= 2) this._drawCurve(ctx, nightBefore, COLOR, 1.5, true);
    if (nightAfter.length >= 2)  this._drawCurve(ctx, nightAfter,  COLOR, 1.5, true);
    if (dayTime.length >= 2)     this._drawCurve(ctx, dayTime,     COLOR, 2.5, false);

    // 日出标注
    const riseX = toX(riseMin);
    const setX  = toX(setMin);
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillStyle = COLOR;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(riseX, baseY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillText(sunrise, riseX, baseY + 15);
    ctx.fillStyle = 'rgba(166,169,173,0.8)';
    ctx.fillText('日出', riseX, baseY + 28);

    // 日落标注
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(setX, baseY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillText(sunset, setX, baseY + 15);
    ctx.fillStyle = 'rgba(166,169,173,0.8)';
    ctx.fillText('日落', setX, baseY + 28);

    // 太阳当前位置（仅今天）
    if (nowMin != null && nowMin >= riseMin && nowMin <= setMin) {
      const dotX = toX(nowMin);
      const dotY = curveY(nowMin);
      ctx.fillStyle = COLOR;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  // ─── 月升月落 Canvas ──────────────────────────────────────────────────

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
      this._drawMoon();
    });
  },

  _drawMoon() {
    if (!this._moonCtx) return;
    const ctx = this._moonCtx;
    const w = this._moonW;
    const h = this._moonH;
    const COLOR = '#6CB4EE';
    const { moonrise, moonset, hasMoonset, selectedDate, todayStr } = this.data;

    let riseMin = this._toMin(moonrise);
    const rawSetMin = hasMoonset ? this._toMin(moonset) : null;
    // moonset 为空（月落次日）时，画到 23:59
    const effectiveSetMin = rawSetMin ?? (23 * 60 + 59);

    const isToday = selectedDate === todayStr;
    const now = new Date();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : null;

    ctx.clearRect(0, 0, w, h);

    const padL = 16, padR = 16, padT = 10, padB = 44;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const toX = (min) => padL + (min / 1440) * chartW;
    const baseY = padT + chartH * 0.78;

    if (riseMin == null) {
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, baseY);
      ctx.lineTo(w - padR, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      return;
    }

    const crossMidnight = effectiveSetMin <= riseMin;
    const upSpan   = crossMidnight ? (1440 - riseMin) + effectiveSetMin : effectiveSetMin - riseMin;
    const downSpan = 1440 - upSpan;

    const curveY = (min) => {
      const isUp = crossMidnight
        ? (min >= riseMin || min <= effectiveSetMin)
        : (min >= riseMin && min <= effectiveSetMin);
      if (isUp) {
        const offset = crossMidnight
          ? (min >= riseMin ? min - riseMin : (1440 - riseMin) + min)
          : (min - riseMin);
        const t = offset / upSpan;
        return baseY - chartH * 0.86 * Math.sin(Math.PI * t);
      }
      const offset = crossMidnight
        ? (min - effectiveSetMin)
        : (min >= effectiveSetMin ? min - effectiveSetMin : (1440 - effectiveSetMin) + min);
      const t = offset / downSpan;
      return baseY + chartH * 0.20 * Math.sin(Math.PI * t);
    };

    const allPts = [];
    for (let m = 0; m <= 1440; m += 5) allPts.push({ x: toX(m), y: curveY(m), m });

    let nightBefore, dayTime, nightAfter;
    if (!crossMidnight) {
      nightBefore = allPts.filter(p => p.m <= riseMin);
      dayTime     = allPts.filter(p => p.m >= riseMin && p.m <= effectiveSetMin);
      nightAfter  = allPts.filter(p => p.m >= effectiveSetMin);
    } else {
      nightBefore = allPts.filter(p => p.m >= effectiveSetMin && p.m <= riseMin);
      dayTime     = allPts.filter(p => p.m >= riseMin || p.m <= effectiveSetMin);
      nightAfter  = [];
    }

    // 基线
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.18;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(padL, baseY);
    ctx.lineTo(w - padR, baseY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 月亮在天渐变填充
    const grad = ctx.createLinearGradient(0, padT, 0, baseY);
    grad.addColorStop(0, 'rgba(108,180,238,0.2)');
    grad.addColorStop(1, 'rgba(108,180,238,0)');
    if (!crossMidnight) {
      ctx.beginPath();
      ctx.moveTo(toX(riseMin), baseY);
      for (const p of dayTime) ctx.lineTo(p.x, p.y);
      ctx.lineTo(toX(effectiveSetMin), baseY);
      ctx.closePath();
    } else {
      ctx.beginPath();
      const risePts = allPts.filter(p => p.m >= riseMin);
      const setPts  = allPts.filter(p => p.m <= effectiveSetMin);
      ctx.moveTo(toX(riseMin), baseY);
      for (const p of risePts) ctx.lineTo(p.x, p.y);
      for (const p of setPts)  ctx.lineTo(p.x, p.y);
      ctx.lineTo(toX(effectiveSetMin), baseY);
      ctx.closePath();
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // 曲线
    if (nightBefore.length >= 2) this._drawCurve(ctx, nightBefore, COLOR, 1.5, true);
    if (nightAfter.length >= 2)  this._drawCurve(ctx, nightAfter,  COLOR, 1.5, true);
    if (dayTime.length >= 2)     this._drawCurve(ctx, dayTime,     COLOR, 2.5, false);

    // 月出标注
    const riseX = toX(riseMin);
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillStyle = COLOR;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(riseX, baseY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillText(moonrise, riseX, baseY + 15);
    ctx.fillStyle = 'rgba(166,169,173,0.8)';
    ctx.fillText('月出', riseX, baseY + 28);

    // 月落标注（仅当天有月落时）
    if (hasMoonset && rawSetMin != null) {
      const setX = toX(rawSetMin);
      ctx.fillStyle = COLOR;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(setX, baseY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillText(moonset, setX, baseY + 15);
      ctx.fillStyle = 'rgba(166,169,173,0.8)';
      ctx.fillText('月落', setX, baseY + 28);
    }

    // 月亮当前位置（仅今天）
    if (nowMin != null) {
      const isUp = crossMidnight
        ? (nowMin >= riseMin || nowMin <= effectiveSetMin)
        : (nowMin >= riseMin && nowMin <= effectiveSetMin);
      if (isUp) {
        const dotX = toX(nowMin);
        const dotY = curveY(nowMin);
        ctx.fillStyle = COLOR;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
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
