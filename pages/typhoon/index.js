const { stormList, stormTrack, stormForecast } = require('../../utils/api');

// 台风等级配色（GBT 19201-2006）
const TYPE_COLORS = {
  TD: '#4CAF50',
  TS: '#FFC107',
  STS: '#FF9800',
  TY: '#F44336',
  STY: '#B71C1C',
  SuperTY: '#9C27B0'
};
const TYPE_NAMES = {
  TD: '热带气压',
  TS: '热带风暴',
  STS: '强热带风暴',
  TY: '台风',
  STY: '强台风',
  SuperTY: '超强台风'
};

Page({
  data: {
    loading: true,
    errorMsg: '',
    stormList: [],
    selectedStorm: null,
    track: [],
    forecast: [],
    isActive: false
  },

  onLoad() {
    this.fetchStormList();
  },

  async fetchStormList() {
    try {
      const year = new Date().getFullYear();
      const res = await stormList({ basin: 'NP', year });
      if (!res || res.code !== '200' || !res.storm) {
        this.setData({ loading: false, errorMsg: '暂无台风数据' });
        return;
      }
      // 活跃台风排前面
      const list = res.storm.sort((a, b) => Number(b.isActive) - Number(a.isActive));
      this.setData({ stormList: list, loading: false });

      // 默认选中第一个活跃台风
      const active = list.find(s => s.isActive === '1');
      if (active) this.onSelectStorm({ currentTarget: { dataset: { id: active.id } } });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, errorMsg: '数据加载失败' });
    }
  },

  async onSelectStorm(e) {
    const stormId = e.currentTarget.dataset.id;
    if (!stormId) return;
    const storm = this.data.stormList.find(s => s.id === stormId);
    if (!storm) return;

    this.setData({ selectedStorm: storm, track: [], forecast: [] });

    try {
      const [trackRes, forecastRes] = await Promise.all([
        stormTrack({ stormid: stormId }).catch(() => null),
        stormForecast({ stormid: stormId }).catch(() => null)
      ]);

      const track = (trackRes?.track || []).map(t => ({
        ...t,
        lat: Number(t.lat),
        lon: Number(t.lon),
        windSpeed: Number(t.windSpeed),
        pressure: Number(t.pressure),
        color: TYPE_COLORS[t.type] || '#8C9AA5',
        typeName: TYPE_NAMES[t.type] || t.type,
        timeLabel: t.time ? t.time.substr(5, 11).replace('T', ' ') : ''
      }));

      const forecast = (forecastRes?.forecast || []).map(f => ({
        ...f,
        lat: Number(f.lat),
        lon: Number(f.lon),
        windSpeed: Number(f.windSpeed),
        pressure: Number(f.pressure),
        color: TYPE_COLORS[f.type] || '#8C9AA5',
        typeName: TYPE_NAMES[f.type] || f.type,
        timeLabel: f.fxTime ? f.fxTime.substr(5, 11).replace('T', ' ') : ''
      }));

      const isActive = trackRes?.isActive === '1';
      this.setData({ track, forecast, isActive });
      wx.nextTick(() => this.drawTrack());
    } catch (e) {
      console.error(e);
    }
  },

  // Canvas 绘制台风路径
  initCanvas(cb) {
    if (this._ctx) { cb && cb(); return; }
    const query = this.createSelectorQuery();
    query.select('#trackCanvas')
      .fields({ node: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
        const info = wx.getWindowInfo();
        const cssW = info.windowWidth - 48;
        const cssH = 300;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.scale(dpr, dpr);
        this._ctx = ctx;
        this._w = cssW;
        this._h = cssH;
        cb && cb();
      });
  },

  drawTrack() {
    this.initCanvas(() => this._drawTrack());
  },

  _drawTrack() {
    const ctx = this._ctx;
    const w = this._w;
    const h = this._h;
    const { track, forecast } = this.data;
    if (!ctx) return;

    const allPoints = [...track, ...forecast];
    if (!allPoints.length) return;

    const pad = 40;
    const chartW = w - pad * 2;
    const chartH = h - pad * 2;

    // 计算 lat/lon 范围
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    allPoints.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    });
    // 加边距
    const latRange = (maxLat - minLat) || 5;
    const lonRange = (maxLon - minLon) || 5;
    minLat -= latRange * 0.1;
    maxLat += latRange * 0.1;
    minLon -= lonRange * 0.1;
    maxLon += lonRange * 0.1;

    const toX = (lon) => pad + ((lon - minLon) / (maxLon - minLon)) * chartW;
    const toY = (lat) => pad + ((maxLat - lat) / (maxLat - minLat)) * chartH;

    ctx.clearRect(0, 0, w, h);

    // 绘制网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (chartH * i / 4);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
      const x = pad + (chartW * i / 4);
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
    }

    // 绘制历史路径（实线）
    if (track.length > 1) {
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 1; i < track.length; i++) {
        ctx.strokeStyle = track[i].color;
        ctx.beginPath();
        ctx.moveTo(toX(track[i - 1].lon), toY(track[i - 1].lat));
        ctx.lineTo(toX(track[i].lon), toY(track[i].lat));
        ctx.stroke();
      }
    }

    // 绘制预报路径（虚线）
    if (forecast.length > 0) {
      const lastTrack = track[track.length - 1];
      const firstForecast = forecast[0];
      const forecastPoints = lastTrack ? [lastTrack, ...forecast] : forecast;

      ctx.setLineDash([6, 3]);
      ctx.lineWidth = 1.5;
      for (let i = 1; i < forecastPoints.length; i++) {
        ctx.strokeStyle = forecastPoints[i].color;
        ctx.beginPath();
        ctx.moveTo(toX(forecastPoints[i - 1].lon), toY(forecastPoints[i - 1].lat));
        ctx.lineTo(toX(forecastPoints[i].lon), toY(forecastPoints[i].lat));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 绘制历史路径点
    track.forEach((p, i) => {
      const x = toX(p.lon);
      const y = toY(p.lat);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, i === track.length - 1 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
      // 最后一个点加白色边框
      if (i === track.length - 1) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // 绘制预报点
    forecast.forEach(p => {
      const x = toX(p.lon);
      const y = toY(p.lat);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // 时间标签（首尾 + 中间每隔几个）
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#8C9AA5';
    ctx.textAlign = 'center';
    const labelIndices = [0, Math.floor(track.length / 2), track.length - 1];
    labelIndices.forEach(i => {
      if (i >= 0 && i < track.length) {
        const p = track[i];
        ctx.fillText(p.timeLabel, toX(p.lon), toY(p.lat) - 10);
      }
    });
  }
});
