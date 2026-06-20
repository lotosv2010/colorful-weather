const { minutely } = require('../../utils/api');
const { buildPath } = require('../../utils/route');
const monitor = require('../../utils/monitor');

Page({
  data: {
    loading: true,
    errorMsg: '',
    summary: '',
    minutelyList: [],
    precipType: 'rain',
    city: '',
    province: '',
    district: ''
  },

  onLoad(options) {
    this._loadStart = Date.now();
    const { location, city, province, district } = options;
    if (!location) return;
    this._location = location;
    this.setData({
      city: city ? decodeURIComponent(city) : '',
      province: province ? decodeURIComponent(province) : '',
      district: district ? decodeURIComponent(district) : ''
    });
    this.fetchData(location);
  },

  onReady() {
    monitor.recordPageLoad('/pages/minutely/index', this._loadStart);
  },

  async fetchData(location) {
    try {
      this.setData({ loading: true, errorMsg: '' });
      const res = await minutely({ location });
      if (!res || res.code !== '200' || !res.minutely) {
        this.setData({ loading: false, errorMsg: '暂无分钟级降水数据' });
        return;
      }
      const list = res.minutely.map(m => ({
        fxTime: m.fxTime,
        timeLabel: m.fxTime.substr(11, 5),
        precip: Number(m.precip),
        type: m.type
      }));
      const precipType = list.some(m => m.precip > 0 && m.type === 'snow') ? 'snow' : 'rain';
      this.setData({
        summary: res.summary || '',
        minutelyList: list,
        precipType,
        loading: false
      });
      wx.nextTick(() => this.drawChart());
    } catch (e) {
      console.error(e);
      monitor.recordError('page', e?.message || '分钟降水加载失败', { page: '/pages/minutely/index', stack: e?.stack });
      this.setData({ loading: false, errorMsg: '数据加载失败' });
    }
  },

  initCanvas(cb) {
    if (this._ctx) { cb && cb(); return; }
    const query = this.createSelectorQuery();
    query.select('#minutelyCanvas')
      .fields({ node: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
        const info = wx.getWindowInfo();
        const cssW = info.windowWidth - 48;
        const cssH = 220;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.scale(dpr, dpr);
        this._ctx = ctx;
        this._w = cssW;
        this._h = cssH;
        cb && cb();
      });
  },

  drawChart() {
    this.initCanvas(() => this._drawChart());
  },

  _drawChart() {
    const ctx = this._ctx;
    const w = this._w;
    const h = this._h;
    const list = this.data.minutelyList;
    if (!ctx || !list.length) return;

    const padL = 40, padR = 16, padT = 20, padB = 36;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const count = list.length;
    const stepX = chartW / count;
    const barW = Math.max(4, stepX * 0.55);

    let maxP = 0;
    list.forEach(d => { if (d.precip > maxP) maxP = d.precip; });
    if (maxP === 0) maxP = 0.5;

    const precipToY = (p) => padT + (1 - p / maxP) * chartH;

    ctx.clearRect(0, 0, w, h);

    // Y 轴网格线与标签
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#8C9AA5';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const val = maxP * i / gridCount;
      const y = precipToY(val);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(val.toFixed(1), padL - 4, y + 3);
    }

    // X 轴标签（每 15 分钟）
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8C9AA5';
    ctx.font = '9px sans-serif';
    list.forEach((d, i) => {
      if (i % 3 === 0) {
        const x = padL + i * stepX + stepX / 2;
        ctx.fillText(d.timeLabel, x, h - 10);
      }
    });

    // 柱状图
    list.forEach((d, i) => {
      if (d.precip <= 0) return;
      const x = padL + i * stepX + stepX / 2;
      const barH = (d.precip / maxP) * chartH;
      const y = padT + chartH - barH;
      ctx.fillStyle = d.type === 'snow' ? '#A8D8EA' : '#5BA3D9';
      ctx.beginPath();
      const r = Math.min(barW / 2, 2);
      if (barH > r * 2) {
        ctx.moveTo(x - barW / 2 + r, y);
        ctx.arcTo(x + barW / 2, y, x + barW / 2, y + barH, r);
        ctx.lineTo(x + barW / 2, padT + chartH);
        ctx.lineTo(x - barW / 2, padT + chartH);
        ctx.lineTo(x - barW / 2, y + r);
        ctx.arcTo(x - barW / 2, y, x + barW / 2, y, r);
      } else {
        ctx.rect(x - barW / 2, y, barW, barH);
      }
      ctx.fill();
    });

    // 底部基线
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padL, padT + chartH);
    ctx.lineTo(w - padR, padT + chartH);
    ctx.stroke();
  },

  // 重试：清除错误并重新加载
  onRetry() {
    this.setData({ loading: true, errorMsg: '' });
    this.fetchData(this._location);
  },

  onShareAppMessage() {
    const { city, district, province, summary } = this.data;
    const path = buildPath('/pages/minutely/index', { location: this._location || '', province, city, district });
    return { title: `${district || city || ''} ${summary || '分钟级降水'}`, path };
  },
  onShareTimeline() {
    const { city, district, province, summary } = this.data;
    const path = buildPath('/pages/minutely/index', { location: this._location || '', province, city, district });
    return {
      title: `${district || city || ''} ${summary || '分钟级降水'}`,
      query: path.split('?')[1] || ''
    };
  }
});
