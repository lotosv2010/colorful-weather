// pages/compare/index.js
const { now, sevenDay, air } = require('../../utils/api');
const { toHex } = require('../../utils/util');
const prefs = require('../../utils/prefs');
const { convert } = require('../../utils/temp');
const monitor = require('../../utils/monitor');

// 安全取数值
const safeNum = (val, fallback = 0) => {
  if (val == null) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

// AQI 等级颜色（来自 airMeta）
const AQI_LEVEL_COLORS = {
  '1': '#4caf50',
  '2': '#8bc34a',
  '3': '#ffb300',
  '4': '#ff9800',
  '5': '#f44336',
  '6': '#b71c1c',
};

// 城市B对比色
const COLOR_B = '#FF9B50';

Page({
  data: {
    // 城市信息：{ location, name, province, district }
    city1: null,
    city2: null,
    // 实时天气
    now1: null,
    now2: null,
    // 7天预报
    daily1: [],
    daily2: [],
    // 空气质量
    air1: null,
    air2: null,
    // 加载/错误状态（分别管理，允许一个成功一个失败）
    loading1: false,
    loading2: false,
    error1: '',
    error2: '',
    // 城市选择面板
    selectorTarget: null,   // 'c1' | 'c2'
    selectorVisible: false,
    // 偏好
    tempUnit: 'C',
    themeColor: '#1296db',
  },

  onLoad(options = {}) {
    this._loadStart = Date.now();
    const p = prefs.getPrefs();
    this.setData({ tempUnit: p.tempUnit, themeColor: p.themeColor || '#1296db' });
    this._unsubPrefs = prefs.subscribe(up => {
      const changed = up.tempUnit !== this.data.tempUnit || up.themeColor !== this.data.themeColor;
      if (changed) {
        this.setData({ tempUnit: up.tempUnit, themeColor: up.themeColor });
        // 温度单位变化时重绘图表
        if (this.data.daily1.length || this.data.daily2.length) {
          wx.nextTick(() => this._drawChart());
        }
      }
    });

    // 解析 URL 参数（可选预填城市）
    const city1 = this._parseCity(options, '1');
    const city2 = this._parseCity(options, '2');
    if (city1) this.setData({ city1 });
    if (city2) this.setData({ city2 });

    // 有城市则立即加载
    if (city1) this._loadCity(1);
    if (city2) this._loadCity(2);
  },

  onReady() {
    monitor.recordPageLoad('/pages/compare/index', this._loadStart);
  },

  onUnload() {
    if (this._unsubPrefs) this._unsubPrefs();
  },

  // 解析 URL 中的城市参数：loc1/n1/p1/d1 或 loc2/n2/p2/d2
  _parseCity(options, suffix) {
    const loc = options[`loc${suffix}`];
    if (!loc) return null;
    return {
      location: loc,
      name: options[`n${suffix}`] ? decodeURIComponent(options[`n${suffix}`]) : '',
      province: options[`p${suffix}`] ? decodeURIComponent(options[`p${suffix}`]) : '',
      district: options[`d${suffix}`] ? decodeURIComponent(options[`d${suffix}`]) : '',
    };
  },

  // 加载单个城市数据（idx: 1 或 2）
  async _loadCity(idx) {
    const city = this.data[`city${idx}`];
    if (!city || !city.location) return;

    this.setData({ [`loading${idx}`]: true, [`error${idx}`]: '' });
    try {
      const loc = city.location; // "lon,lat"
      const [nowRes, dailyRes, airRes] = await Promise.all([
        now({ location: loc }).catch(() => null),
        sevenDay({ location: loc }).catch(() => null),
        air(loc).catch(() => null),
      ]);

      const nowData = this._processNow(nowRes);
      const dailyData = this._processDaily(dailyRes);
      const airData = this._processAir(airRes);

      this.setData({
        [`now${idx}`]: nowData,
        [`daily${idx}`]: dailyData,
        [`air${idx}`]: airData,
        [`loading${idx}`]: false,
      });

      // 两城市都有数据时绘制图表
      wx.nextTick(() => {
        if ((this.data.daily1.length || this.data.daily2.length)) {
          this._initCanvas(() => this._drawChart());
        }
      });
    } catch (e) {
      monitor.recordError('page', e?.message || '对比页加载失败', { page: '/pages/compare/index', idx });
      this.setData({
        [`loading${idx}`]: false,
        [`error${idx}`]: '加载失败，请重试',
      });
    }
  },

  // 解析实时天气
  _processNow(res) {
    if (!res || res.code !== '200' || !res.now) return null;
    const n = res.now;
    return {
      temp: n.temp,
      feelsLike: n.feelsLike,
      icon: n.icon,
      text: n.text,
      humidity: n.humidity,
      windDir: n.windDir,
      windScale: n.windScale,
      vis: n.vis,
      cloud: n.cloud,
      updateTime: (res.updateTime || '').substr(11, 5),
    };
  },

  // 解析 7 天预报（取前 7 条，保留高低温和日期）
  _processDaily(res) {
    if (!res || res.code !== '200' || !res.daily) return [];
    const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return res.daily.slice(0, 7).map(d => {
      const parts = (d.fxDate || '').split('-');
      const dateObj = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
      return {
        date: d.fxDate,
        week: weekMap[dateObj.getDay()],
        dateLabel: `${parseInt(parts[1] || 1)}/${parseInt(parts[2] || 1)}`,
        tempMax: safeNum(d.tempMax),
        tempMin: safeNum(d.tempMin),
        icon: d.iconDay,
        text: d.textDay,
      };
    });
  },

  // 解析空气质量（取 AQI + 等级 + 颜色）
  _processAir(res) {
    if (!res || !res.indexes || !res.indexes.length) return null;
    const idx = res.indexes[0];
    const colorHex = idx.color ? toHex(idx.color) : (AQI_LEVEL_COLORS[idx.level] || '#9BB365');
    return {
      aqi: idx.aqi,
      aqiDisplay: idx.aqiDisplay || idx.aqi,
      category: idx.category || '',
      level: idx.level || '',
      color: colorHex,
    };
  },

  // ── 城市选择 ────────────────────────────────────────────────────────────

  onSelectSlot1() {
    this.setData({ selectorTarget: 'c1', selectorVisible: true });
  },

  onSelectSlot2() {
    this.setData({ selectorTarget: 'c2', selectorVisible: true });
  },

  onSelectCity(e) {
    const city = e.detail.city;
    if (!city || !city.lat || !city.lon) return;
    this.setData({ selectorVisible: false });

    const idx = this.data.selectorTarget === 'c1' ? 1 : 2;
    const cityData = {
      location: `${city.lon},${city.lat}`,
      name: city.name || city.adm2 || '',
      province: city.adm1 || '',
      district: city.name || city.adm2 || '',
    };
    // 清空旧数据
    this.setData({
      [`city${idx}`]: cityData,
      [`now${idx}`]: null,
      [`daily${idx}`]: [],
      [`air${idx}`]: null,
      [`error${idx}`]: '',
    });
    this._ctx = null; // 重置 canvas（城市变化后重绘）
    this._loadCity(idx);
  },

  onSelectorClose() {
    this.setData({ selectorVisible: false });
  },

  // ── 重试 ────────────────────────────────────────────────────────────────

  onRetry1() {
    this._loadCity(1);
  },

  onRetry2() {
    this._loadCity(2);
  },

  // ── Canvas 双折线图 ─────────────────────────────────────────────────────

  _initCanvas(cb) {
    if (this._ctx) { cb && cb(); return; }
    const query = wx.createSelectorQuery().in(this);
    query.select('#compareChart')
      .fields({ node: true, size: true })
      .exec(res => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getDeviceInfo ? wx.getDeviceInfo().devicePixelRatio : null) || 2;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        this._ctx = ctx;
        this._cw = res[0].width;
        this._ch = res[0].height;
        cb && cb();
      });
  },

  _drawChart() {
    const ctx = this._ctx;
    if (!ctx) return;
    const { daily1, daily2, tempUnit, themeColor } = this.data;
    if (!daily1.length && !daily2.length) return;

    const w = this._cw;
    const h = this._ch;
    const padL = 8;
    const padR = 8;
    const padT = 24;  // 高温标注区
    const padB = 36;  // 低温标注区 + 日期标注区
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;

    // 合并两城市温度范围
    const allTemps = [];
    [...daily1, ...daily2].forEach(d => {
      allTemps.push(convert(d.tempMax, tempUnit));
      allTemps.push(convert(d.tempMin, tempUnit));
    });
    if (!allTemps.length) return;
    const globalMax = Math.max(...allTemps);
    const globalMin = Math.min(...allTemps);
    const range = (globalMax - globalMin) || 1;

    // 坐标映射
    const n = Math.max(daily1.length, daily2.length, 1);
    const xOf = (i) => padL + (i / (n - 1 || 1)) * chartW;
    const yOf = (temp) => {
      const t = convert(temp, tempUnit);
      return padT + (1 - (t - globalMin) / range) * chartH;
    };

    ctx.clearRect(0, 0, w, h);

    // 绘制一组城市折线
    const drawLines = (daily, colorHigh, colorLow) => {
      if (!daily.length) return;
      const hiPts = daily.map((d, i) => ({ x: xOf(i), y: yOf(d.tempMax) }));
      const loPts = daily.map((d, i) => ({ x: xOf(i), y: yOf(d.tempMin) }));

      // 低温线（半透明虚线）
      ctx.save();
      ctx.setLineDash([4, 4]);
      this._drawPolyLine(ctx, loPts, colorLow, 1.5);
      ctx.restore();

      // 高温线（实线）
      this._drawPolyLine(ctx, hiPts, colorHigh, 2);

      // 圆点
      hiPts.forEach(p => { this._drawDot(ctx, p.x, p.y, colorHigh, 3); });
      loPts.forEach(p => { this._drawDot(ctx, p.x, p.y, colorLow, 2.5); });

      // 高温数字（线上方）
      ctx.fillStyle = colorHigh;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      hiPts.forEach((p, i) => {
        const val = convert(daily[i].tempMax, tempUnit);
        ctx.fillText(`${Math.round(val)}°`, p.x, p.y - 5);
      });

      // 低温数字（虚线下方）
      ctx.fillStyle = colorLow;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      loPts.forEach((p, i) => {
        const val = convert(daily[i].tempMin, tempUnit);
        ctx.fillText(`${Math.round(val)}°`, p.x, p.y + 12);
      });
    };

    // 颜色：城市A=主题色，城市B=橙色
    const colorA = themeColor || '#1296db';
    const colorALow = this._alphaColor(colorA, 0.45);
    const colorBHigh = COLOR_B;
    const colorBLow = this._alphaColor(COLOR_B, 0.45);

    drawLines(daily1, colorA, colorALow);
    drawLines(daily2, colorBHigh, colorBLow);

    // X 轴日期标注（取两组中较多的那组）
    const refDaily = daily1.length >= daily2.length ? daily1 : daily2;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    refDaily.forEach((d, i) => {
      ctx.fillText(d.dateLabel, xOf(i), h - 4);
    });
  },

  _drawPolyLine(ctx, pts, color, lineWidth) {
    if (pts.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  },

  _drawDot(ctx, x, y, color, r) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  },

  // hex / rgba 字符串 → 带 alpha 的 rgba 字符串（简单处理 #rrggbb 格式）
  _alphaColor(hex, alpha) {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },
});
