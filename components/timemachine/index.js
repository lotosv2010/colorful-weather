// components/timemachine/index.js
const { historicalWeather, historicalAir } = require('../../utils/api');
const { convert, fmt: fmtTemp } = require('../../utils/temp');
const { getAirLevel } = require('../../utils/airMeta');

// 生成最近 N 天日期列表（不含今天，最近的在前）
const buildDateList = (days = 10) => {
  const list = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 1; i <= days; i++) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    list.push({
      key: `${y}${m}${day}`,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      weekday: i === 1 ? '昨天' : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
    });
  }
  return list;
};

Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    cityId: { type: String, value: '' },
    tempUnit: { type: String, value: 'C' },
    themeColor: { type: String, value: '#1296db' },
  },
  data: {
    tab: 'weather',           // weather | air
    dateList: [],
    selectedDate: '',
    loading: false,           // 是否在请求（用于右上角 spinner）
    skeleton: true,           // 是否首次/无缓存加载（用于骨架屏）
    errorMsg: '',
    weather: null,            // { weatherDaily, weatherHourly, ... }
    air: null,                // { airHourly, summary }
    weatherCache: {},
    airCache: {},
    canvasW: 0,
    canvasH: 160,
  },
  observers: {
    'cityId'(id) {
      if (!id) return;
      this.setData({ weatherCache: {}, airCache: {}, weather: null, air: null });
      this._fetch();
    },
    'tempUnit'() {
      if (this.data.tab === 'weather' && this.data.weather) {
        wx.nextTick(() => this._draw());
      }
    },
  },
  lifetimes: {
    attached() {
      const list = buildDateList(10);
      this.setData({
        dateList: list,
        selectedDate: list[0] ? list[0].key : '',
      });
      const info = wx.getWindowInfo();
      this.setData({ canvasW: info.windowWidth - 60 });
    },
    ready() {
      // canvas 在 attached 后未必已挂载（骨架阶段被 wx:else 遮蔽），由 _draw 按需懒初始化
      this._fetch();
    },
    detached() {
      this._wctx = null;
      this._actx = null;
    },
  },
  methods: {
    onTabTap(e) {
      const { tab } = e.currentTarget.dataset;
      if (tab === this.data.tab) return;
      // 切 tab 时不清空另一侧旧数据；命中缓存可瞬切，否则保留旧视图 + spinner
      // 同时失效两侧 ctx：被 hidden 的 canvas 会被压成 0 尺寸，旧 ctx 不可复用
      this._wctx = null;
      this._actx = null;
      this.setData({ tab });
      this._fetch();
    },
    onDateTap(e) {
      const { date } = e.currentTarget.dataset;
      if (date === this.data.selectedDate) return;
      this.setData({ selectedDate: date });
      this._fetch();
    },
    async _fetch() {
      const { tab, selectedDate, cityId } = this.data;
      if (!cityId || !selectedDate) return;
      const cacheKey = tab === 'weather' ? 'weatherCache' : 'airCache';
      const dataKey = tab === 'weather' ? 'weather' : 'air';
      const hit = this.data[cacheKey][selectedDate];
      if (hit) {
        // 命中缓存：瞬切，关骨架与 loading
        this.setData({ [dataKey]: hit, errorMsg: '', loading: false, skeleton: false });
        wx.nextTick(() => this._draw());
        return;
      }
      // 未命中：仅在该 tab 还没数据时显示骨架，否则保留旧视图，仅右上角 spinner
      const showSkeleton = !this.data[dataKey];
      this.setData({ loading: true, errorMsg: '', skeleton: showSkeleton });
      try {
        const res = tab === 'weather'
          ? await historicalWeather({ location: cityId, date: selectedDate })
          : await historicalAir({ location: cityId, date: selectedDate });
        // 异步返回时若用户已切到其它 tab/日期，丢弃结果
        if (this.data.tab !== tab || this.data.selectedDate !== selectedDate) return;
        if (res && res.code === '200') {
          const enriched = tab === 'air' ? this._enrichAir(res) : res;
          this.setData({
            [dataKey]: enriched,
            [`${cacheKey}.${selectedDate}`]: enriched,
            skeleton: false,
          });
          wx.nextTick(() => this._draw());
        } else {
          this.setData({ errorMsg: `暂无数据(${res && res.code || '?'})`, skeleton: false });
        }
      } catch (e) {
        if (this.data.tab !== tab || this.data.selectedDate !== selectedDate) return;
        this.setData({ errorMsg: '加载失败，请重试', skeleton: false });
      } finally {
        if (this.data.tab === tab && this.data.selectedDate === selectedDate) {
          this.setData({ loading: false });
        }
      }
    },
    _enrichAir(res) {
      const list = res.airHourly || [];
      if (!list.length) return { ...res, summary: {} };
      let sum = 0, peak = 0, peakItem = list[0];
      const primaryCount = {};
      list.forEach(d => {
        const a = Number(d.aqi) || 0;
        sum += a;
        if (a > peak) { peak = a; peakItem = d; }
        const p = d.primary && d.primary !== 'NA' ? d.primary : null;
        if (p) primaryCount[p] = (primaryCount[p] || 0) + 1;
      });
      const avg = Math.round(sum / list.length);
      const lvl = getAirLevel(avg) || {};
      let primary = 'NA';
      let max = 0;
      Object.keys(primaryCount).forEach(k => {
        if (primaryCount[k] > max) { max = primaryCount[k]; primary = k; }
      });
      return {
        ...res,
        summary: {
          aqi: avg,
          avg,
          peak,
          peakTime: peakItem.pubTime,
          category: lvl.category || '',
          color: lvl.color || '#9BB365',
          primary,
        },
      };
    },
    _initCanvas(kind, cb) {
      // kind: 'weather' | 'air'，两块 canvas 常驻 wxml，各自缓存 ctx
      const cache = kind === 'weather' ? '_wctx' : '_actx';
      if (this[cache]) { cb && cb(this[cache]); return; }
      const id = kind === 'weather' ? '#tmWeatherCanvas' : '#tmAirCanvas';
      const query = this.createSelectorQuery().in(this);
      query.select(id)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) { cb && cb(null); return; }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio || 2;
          const cssW = res[0].width;
          const cssH = res[0].height;
          canvas.width = cssW * dpr;
          canvas.height = cssH * dpr;
          ctx.scale(dpr, dpr);
          this[cache] = { ctx, w: cssW, h: cssH };
          cb && cb(this[cache]);
        });
    },
    _draw() {
      const kind = this.data.tab;
      // 等下一帧确保 hidden 切换后的布局已生效，避免 query 拿到 0 宽
      wx.nextTick(() => {
        this._initCanvas(kind, (c) => {
          if (!c || !c.w) return;
          if (kind === 'weather') this._drawWeather(c);
          else this._drawAir(c);
        });
      });
    },
    _drawWeather({ ctx, w, h }) {
      const data = this.data.weather;
      const unit = this.data.tempUnit || 'C';
      ctx.clearRect(0, 0, w, h);
      const list = (data && data.weatherHourly) || [];
      if (!list.length) return;
      const padL = 32, padR = 16, padT = 24, padB = 24;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;
      const stepX = chartW / (list.length - 1 || 1);

      let maxT = -Infinity, minT = Infinity;
      list.forEach(d => {
        const t = convert(d.temp, unit);
        if (t == null) return;
        if (t > maxT) maxT = t;
        if (t < minT) minT = t;
      });
      const range = maxT - minT || 1;
      const tToY = (t) => padT + (1 - (t - minT) / range) * chartH;

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.fillStyle = '#8C9AA5';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const grid = 4;
      for (let i = 0; i <= grid; i++) {
        const v = minT + (range * i / grid);
        const y = tToY(v);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(Math.round(v) + '°', padL - 4, y + 3);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#8C9AA5';
      list.forEach((d, i) => {
        if (i % 4 === 0 || i === list.length - 1) {
          const x = padL + i * stepX;
          const hh = (d.time || '').substr(11, 2);
          ctx.fillText(hh + '时', x, h - 6);
        }
      });

      const points = list.map((d, i) => ({
        x: padL + i * stepX,
        y: tToY(convert(d.temp, unit) || 0),
      }));

      const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      grad.addColorStop(0, 'rgba(255, 140, 0, 0.32)');
      grad.addColorStop(1, 'rgba(255, 140, 0, 0)');
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.lineTo(points[points.length - 1].x, padT + chartH);
      ctx.lineTo(points[0].x, padT + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = '#FF8C00';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();

      let hi = 0, lo = 0;
      list.forEach((_, i) => {
        if (points[i].y < points[hi].y) hi = i;
        if (points[i].y > points[lo].y) lo = i;
      });
      [hi, lo].forEach((idx, k) => {
        const p = points[idx];
        ctx.fillStyle = k === 0 ? '#FF8C00' : '#6CB4EE';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        const label = fmtTemp(list[idx].temp, unit) + '°';
        const ty = p.y - 10;
        // 绘制标签背景
        const metrics = ctx.measureText(label);
        const bgW = metrics.width + 8;
        const bgH = 16;
        const bgX = p.x - bgW / 2;
        const bgY = ty - bgH + 3;
        const r = 3;
        ctx.fillStyle = k === 0 ? 'rgba(255, 140, 0, 0.85)' : 'rgba(108, 180, 238, 0.85)';
        ctx.beginPath();
        ctx.moveTo(bgX + r, bgY);
        ctx.lineTo(bgX + bgW - r, bgY);
        ctx.arcTo(bgX + bgW, bgY, bgX + bgW, bgY + r, r);
        ctx.lineTo(bgX + bgW, bgY + bgH - r);
        ctx.arcTo(bgX + bgW, bgY + bgH, bgX + bgW - r, bgY + bgH, r);
        ctx.lineTo(bgX + r, bgY + bgH);
        ctx.arcTo(bgX, bgY + bgH, bgX, bgY + bgH - r, r);
        ctx.lineTo(bgX, bgY + r);
        ctx.arcTo(bgX, bgY, bgX + r, bgY, r);
        ctx.closePath();
        ctx.fill();
        // 绘制标签文字
        ctx.fillStyle = '#fff';
        ctx.fillText(label, p.x, ty);
      });
    },
    _drawAir({ ctx, w, h }) {
      const data = this.data.air;
      ctx.clearRect(0, 0, w, h);
      const list = (data && data.airHourly) || [];
      if (!list.length) return;
      const padL = 32, padR = 16, padT = 24, padB = 24;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;
      const count = list.length;
      const stepX = chartW / (count - 1 || 1);
      const barW = Math.max(4, stepX * 0.55);

      let maxA = 0;
      list.forEach(d => { const a = Number(d.aqi); if (a > maxA) maxA = a; });
      if (maxA < 50) maxA = 50;
      const aToY = (a) => padT + (1 - a / maxA) * chartH;

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.fillStyle = '#8C9AA5';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const grid = 4;
      for (let i = 0; i <= grid; i++) {
        const v = maxA * i / grid;
        const y = aToY(v);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(Math.round(v), padL - 4, y + 3);
      }

      ctx.textAlign = 'center';
      list.forEach((d, i) => {
        if (i % 4 === 0 || i === count - 1) {
          const x = padL + i * stepX;
          const hh = (d.pubTime || '').substr(11, 2);
          ctx.fillText(hh + '时', x, h - 6);
        }
      });

      list.forEach((d, i) => {
        const a = Number(d.aqi) || 0;
        const lvl = getAirLevel(a);
        const color = (lvl && lvl.color) || '#9BB365';
        const x = padL + i * stepX;
        const y = aToY(a);
        const barH = (a / maxA) * chartH;
        ctx.fillStyle = color;
        const r = Math.min(barW / 2, 3);
        ctx.beginPath();
        if (barH > r * 2) {
          ctx.moveTo(x - barW / 2 + r, y);
          ctx.arcTo(x + barW / 2, y, x + barW / 2, y + barH, r);
          ctx.lineTo(x + barW / 2, padT + chartH);
          ctx.lineTo(x - barW / 2, padT + chartH);
          ctx.lineTo(x - barW / 2, y + r);
          ctx.arcTo(x - barW / 2, y, x + barW / 2, y, r);
        } else if (barH > 0) {
          ctx.rect(x - barW / 2, y, barW, barH);
        }
        ctx.fill();
      });

      let peak = 0;
      list.forEach((d, i) => { if ((Number(d.aqi) || 0) > (Number(list[peak].aqi) || 0)) peak = i; });
      const px = padL + peak * stepX;
      const py = aToY(Number(list[peak].aqi) || 0);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('峰值 ' + (list[peak].aqi || '-'), px, Math.max(padT + 12, py - 6));
    },
  },
});
