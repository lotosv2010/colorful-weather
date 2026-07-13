// pages/air/index.js
const { air, airHourly, airDaily } = require('../../utils/api');
const { toHex, getTextColor } = require('../../utils/util');
const { getAirLevel } = require('../../utils/airMeta');
const share = require('../../utils/share');
const monitor = require('../../utils/monitor');

Page({
  data: {
    location: '',
    province: '',
    city: '',
    district: '',
    aqi: '',
    category: '',
    categoryDesc: '',
    healthEffect: '',
    generalAdvice: '',
    sensitiveAdvice: '',
    levelColor: '',
    primary: '',
    pollutants: [],
    hourly: [],
    daily: [],
    loading: false,
    errorMsg: ''
  },

  onLoad(options = {}) {
    this._loadStart = Date.now();
    const location = options.location || '';
    const province = options.province ? decodeURIComponent(options.province) : '';
    const city = options.city ? decodeURIComponent(options.city) : '';
    const district = options.district ? decodeURIComponent(options.district) : '';
    console.log('onLoad', location);
    this.setData({ location, province, city, district });
    if (location) {
      this.loadData();
    } else {
      this.setData({ errorMsg: '缺少城市定位' });
    }
  },

  onReady() {
    monitor.recordPageLoad('/pages/air/index', this._loadStart);
  },

  initCanvas(cb) {
    if (this._ctx) { cb && cb(); return; }
    const query = wx.createSelectorQuery();
    query.select('#aqiCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return;
        const canvas = res[0].node;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getDeviceInfo ? wx.getDeviceInfo().devicePixelRatio : null) || 2;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        this._ctx = ctx;
        this._w = res[0].width;
        this._h = res[0].height;
        cb && cb();
      });
  },

  drawRing() {
    if (!this._ctx) return;
    const { aqi, levelColor } = this.data;
    if (!aqi && aqi !== 0) return;
    const ctx = this._ctx;
    const w = this._w;
    const h = this._h;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 8;
    const lineWidth = 10;
    const pct = Math.min(aqi / 500, 1);

    ctx.clearRect(0, 0, w, h);

    // 背景环
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#3D3F4A';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 进度弧
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.strokeStyle = levelColor || '#9BB365';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  },

  async loadData() {
    this.setData({ loading: true, errorMsg: '' });
    try {
      const { location } = this.data;

      const [airRes, hourlyRes, dailyRes] = await Promise.all([
        air(location),
        airHourly(location),
        airDaily(location)
      ]);

      this.processAirNow(airRes);
      if (hourlyRes && hourlyRes.hours) {
        this.processHourly(hourlyRes.hours);
      }
      if (dailyRes && dailyRes.days) {
        this.processDaily(dailyRes.days);
      }
    } catch (e) {
      console.log(e);
      monitor.recordError('page', e?.message || '空气质量加载失败', { page: '/pages/air/index', stack: e?.stack });
      this.setData({ errorMsg: '网络异常，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 解析新 API 响应：indexes[0] + pollutants[]
  processAirNow(res) {
    if (!res || !res.indexes || !res.indexes.length) return;
    const idx = res.indexes[0];
    const colorHex = toHex(idx.color);

    // 直接从 API 响应解析污染物数据
    const pollutants = (res.pollutants || []).map(p => ({
      name: p.name,
      key: p.code,
      value: p.concentration ? p.concentration.value : '-',
      unit: p.concentration ? p.concentration.unit : ''
    }));

    const health = idx.health || {};
    const advice = health.advice || {};
    const fallbackAdvice = (!advice.generalPopulation && !advice.sensitivePopulation)
      ? (getAirLevel(idx.aqi) || {}).healthAdvice || ''
      : '';

    this.setData({
      aqi: idx.aqi,
      aqiDisplay: idx.aqiDisplay,
      category: idx.category,
      categoryDesc: health.effect || '',
      healthEffect: health.effect || '',
      generalAdvice: advice.generalPopulation || fallbackAdvice,
      sensitiveAdvice: advice.sensitivePopulation || '',
      levelColor: colorHex,
      primary: idx.primaryPollutant ? idx.primaryPollutant.name : '',
      pollutants
    });
    // 等 wx:else 渲染出 canvas 后再初始化并绘制
    wx.nextTick(() => this.initCanvas(() => this.drawRing()));
  },

  processHourly(list) {
    const hourly = list.map(item => {
      const idx = (item.indexes && item.indexes[0]) || {};
      const aqi = idx.aqi || 0;
      return {
        time: (item.forecastTime || '').substr(11, 5),
        aqi,
        aqiDisplay: idx.aqiDisplay || aqi,
        pct: Math.min(aqi / 500 * 100, 100).toFixed(1),
        category: idx.category || '',
        level: idx.level || '',
        color: idx.color ? toHex(idx.color) : '',
        primary: idx.primaryPollutant ? idx.primaryPollutant.name : ''
      };
    });
    this.setData({ hourly });
  },

  processDaily(list) {
    const weekArr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const daily = list.map(item => {
      const idx = (item.indexes && item.indexes[0]) || {};
      const dateStr = (item.forecastStartTime || '').substr(0, 10);
      const parts = dateStr.split('-');
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const today = new Date();
      const isToday = dateObj.getFullYear() === today.getFullYear() &&
                      dateObj.getMonth() === today.getMonth() &&
                      dateObj.getDate() === today.getDate();
      const bgColor = idx.color ? toHex(idx.color) : '#9BB365';
      return {
        date: dateStr,
        week: isToday ? '今天' : weekArr[dateObj.getDay()],
        dateLabel: `${parseInt(parts[1])}月${parseInt(parts[2])}日`,
        name: idx.name || 'AQI',
        aqi: idx.aqi,
        aqiDisplay: idx.aqiDisplay || idx.aqi,
        category: idx.category || '',
        level: idx.level || '',
        color: bgColor,
        textColor: getTextColor(bgColor),
        primary: idx.primaryPollutant ? idx.primaryPollutant.name : ''
      };
    });
    this.setData({ daily });
  },

  // 重试：清除错误并重新加载
  onRetry() {
    this.setData({ loading: true, errorMsg: '' });
    this.loadData();
  },

  _shareParams() {
    const { location, province, city, district } = this.data;
    return { location, province, city, district };
  },
  onShareAppMessage() {
    const { district, city, aqi, category } = this.data;
    const title = aqi
      ? `${district || city || ''} 空气 AQI ${aqi}${category ? ' · ' + category : ''}`
      : `${district || city || ''} 空气质量`;
    return share.card('/pages/air/index', this._shareParams(), title);
  },
  onShareTimeline() {
    const { district, city, aqi, category } = this.data;
    const title = aqi
      ? `${district || city || ''} AQI ${aqi}${category ? ' ' + category : ''}`
      : `${district || city || ''} 空气质量`;
    return share.timeline('/pages/air/index', this._shareParams(), title);
  }
});
