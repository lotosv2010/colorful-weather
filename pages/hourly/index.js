// pages/hourly/index.js
const api = require('../../utils/api');
const prefs = require('../../utils/prefs');
const { buildPath, parsePageOptions } = require('../../utils/route');
const monitor = require('../../utils/monitor');
const { getLunarLabels } = require('../../utils/lunar');

const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

Page({
  data: {
    loading: true,
    errorMsg: '',
    hourly: [],
    selectedIndex: 0,
    scrollToItem: '',
    syncScrollLeft: 0,
    province: '',
    city: '',
    district: '',
    detail: null,
    tempUnit: 'C',
    themeColor: '#1296db'
  },

  _syncPrefs() {
    const p = prefs.getPrefs();
    if (p.tempUnit === this.data.tempUnit && p.themeColor === this.data.themeColor) return;
    this.setData({ tempUnit: p.tempUnit, themeColor: p.themeColor });
  },

  onUnload() {
    if (this._unsubPrefs) this._unsubPrefs();
  },

  onLoad(options) {
    this._loadStart = Date.now();
    this._syncPrefs();
    this._unsubPrefs = prefs.subscribe(() => this._syncPrefs());
    const { location, province, city, district } = parsePageOptions(options);
    const { hour, date } = options;
    if (!location) {
      this.setData({ loading: false, errorMsg: '缺少位置信息' });
      return;
    }
    this.location = location;
    this._targetDate = date || null;
    this.setData({
      province,
      city,
      district
    });
    if (hour !== undefined) {
      this.setData({ selectedIndex: Number(hour) });
    }
    this.fetchData();
  },

  onReady() {
    monitor.recordPageLoad('/pages/hourly/index', this._loadStart);
  },

  async fetchData() {
    this.setData({ loading: true, errorMsg: '' });
    try {
      // 根据目标日期距今天数选合适的接口（24h / 72h / 168h）
      let apiFn = api.hourly;
      if (this._targetDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.round((new Date(this._targetDate) - today) / 86400000);
        if (diffDays >= 4) apiFn = api.hourly168;
        else if (diffDays >= 2) apiFn = api.hourly72;
      }
      const res = await apiFn({ location: this.location });
      if (res.code !== '200') {
        this.setData({ loading: false, errorMsg: `请求失败：${res.code}` });
        return;
      }

      const hourly = (res.hourly || []).map(item => {
        const date = new Date(item.fxTime);
        const datePart = `${date.getMonth() + 1}月${date.getDate()}日`;
        const timePart = item.fxTime.substr(11, 5);
        return {
          ...item,
          hour: item.fxTime.substr(11, 2),
          week: weekMap[date.getDay()],
          datePart,
          timePart,
          dateLabel: `${datePart} ${timePart}`
        };
      });

      // 批量计算农历标签
      const uniqueDates = [...new Set(hourly.map(h => h.fxTime.substr(0, 10)))];
      const lunarMap = getLunarLabels(uniqueDates);
      hourly.forEach(h => { h.lunarLabel = lunarMap[h.fxTime.substr(0, 10)] || ''; });

      let selectedIndex = Math.min(this.data.selectedIndex, hourly.length - 1);
      // 若从 daily 点击指定日期跳入，定位到该日第一条数据
      if (this._targetDate) {
        const idx = hourly.findIndex(h => h.fxTime && h.fxTime.startsWith(this._targetDate));
        if (idx >= 0) selectedIndex = idx;
      }
      this.setData({
        hourly,
        loading: false,
        selectedIndex,
        scrollToItem: 'chart-item-' + selectedIndex,
        detail: hourly[selectedIndex]
      });
    } catch (err) {
      console.error('逐小时预报请求失败', err);
      monitor.recordError('page', err?.message || '逐小时预报加载失败', { page: '/pages/hourly/index', stack: err?.stack });
      this.setData({ loading: false, errorMsg: '网络请求失败' });
    }
  },

  // 重试：清除错误并重新加载
  onRetry() {
    this.setData({ loading: true, errorMsg: '' });
    this.fetchData();
  },

  onChartSelect(e) {
    const { index } = e.detail;
    const detail = this.data.hourly[index];
    this.setData({
      selectedIndex: index,
      scrollToItem: 'chart-item-' + index,
      detail
    });
  },

  onChartScroll(e) {
    const { source, scrollLeft } = e.detail;
    if (source !== 'touch') return;
    this.setData({ syncScrollLeft: scrollLeft });
  },

  _sharePath() {
    const { province, city, district } = this.data;
    return buildPath('/pages/hourly/index', { location: this.location || '', province, city, district });
  },
  onShareAppMessage() {
    const { district, city } = this.data;
    return {
      title: `${district || city || ''} 逐小时天气预报`,
      path: this._sharePath()
    };
  },
  onShareTimeline() {
    const { district, city } = this.data;
    return {
      title: `${district || city || ''} 逐小时天气预报`,
      query: this._sharePath().split('?')[1] || ''
    };
  }
});
