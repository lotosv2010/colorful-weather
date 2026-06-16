// pages/hourly/index.js
const api = require('../../utils/api');

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
    district: '',
    detail: null
  },

  onLoad(options) {
    const { location, city, hour } = options;
    if (!location) {
      this.setData({ loading: false, errorMsg: '缺少位置信息' });
      return;
    }
    this.location = location;
    if (city) {
      const decoded = decodeURIComponent(city);
      const parts = decoded.split(',');
      this.setData({ province: parts[0] || '', district: parts[1] || '' });
    }
    if (hour !== undefined) {
      this.setData({ selectedIndex: Number(hour) });
    }
    this.fetchData();
  },

  async fetchData() {
    this.setData({ loading: true, errorMsg: '' });
    try {
      const res = await api.hourly({ location: this.location });
      if (res.code !== '200') {
        this.setData({ loading: false, errorMsg: `请求失败：${res.code}` });
        return;
      }

      const hourly = (res.hourly || []).map(item => {
        const date = new Date(item.fxTime);
        return {
          ...item,
          hour: item.fxTime.substr(11, 2),
          week: weekMap[date.getDay()],
          dateLabel: `${date.getMonth() + 1}月${date.getDate()}日 ${item.fxTime.substr(11, 5)}`
        };
      });

      const selectedIndex = Math.min(this.data.selectedIndex, hourly.length - 1);
      this.setData({
        hourly,
        loading: false,
        selectedIndex,
        scrollToItem: 'chart-item-' + selectedIndex,
        detail: hourly[selectedIndex]
      });
    } catch (err) {
      console.error('逐小时预报请求失败', err);
      this.setData({ loading: false, errorMsg: '网络请求失败' });
    }
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
  }
});
