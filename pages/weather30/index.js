const api = require('../../utils/api');
const { formatDate, toHex, getTextColor } = require('../../utils/util');

const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 扁平化单个值：对象/数组→简单值
const flattenVal = (val) => {
  if (val == null) return '';
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.length ? flattenVal(val[0]) : '';
  if (val.value != null) return String(val.value);
  if (val.text != null) return String(val.text);
  if (val.name != null) return String(val.name);
  if (val.desc != null) return String(val.desc);
  for (const k of Object.keys(val)) {
    if (typeof val[k] !== 'object' && val[k] != null) return String(val[k]);
  }
  return '';
};

// 遍历对象所有属性，将对象/数组字段扁平化
const flattenObj = (obj) => {
  const result = {};
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    result[k] = (v != null && typeof v === 'object') ? flattenVal(v) : v;
  });
  return result;
};

Page({
  data: {
    loading: true,
    errorMsg: '',
    city: '',
    province: '',
    district: '',
    activeDate: '',
    scrollToDate: '',
    daily: [],
    summary: {},
    activeTab: 'list',
    updateTime: ''
  },

  onLoad(options) {
    const { location, province, city, district, date } = options;
    if (!location) {
      this.setData({ loading: false, errorMsg: '缺少位置信息' });
      return;
    }
    this.location = location;
    this.setData({
      province: province ? decodeURIComponent(province) : '',
      city: city ? decodeURIComponent(city) : '',
      district: district ? decodeURIComponent(district) : ''
    });
    if (date) this.setData({ activeDate: date });
    this.fetchData();
  },

  async fetchData() {
    this.setData({ loading: true, errorMsg: '' });
    try {
      const [weatherRes, airRes] = await Promise.all([
        api.weather30d({ location: this.location }),
        api.airDaily(this.location).catch(() => null)
      ]);

      if (weatherRes.code !== '200') {
        this.setData({ loading: false, errorMsg: `请求失败：${weatherRes.code}` });
        return;
      }

      // 基础数据处理
      let daily = (weatherRes.daily || []).map(item => {
        const date = new Date(item.fxDate);
        return {
          ...flattenObj(item),
          week: weekMap[date.getDay()],
          month: date.getMonth() + 1,
          day: date.getDate(),
          dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`
        };
      });

      // 合并空气质量
      this.mergeAir(daily, airRes);

      // 计算升降温描述
      this.computeTempDesc(daily);

      // 计算统计摘要
      const summary = this.computeSummary(daily);

      const { activeDate } = this.data;
      this.setData({
        daily,
        summary,
        loading: false,
        updateTime: weatherRes.updateTime
          ? formatDate(new Date(weatherRes.updateTime))
          : ''
      }, () => {
        if (activeDate) {
          wx.nextTick(() => {
            this.setData({ scrollToDate: 'card-' + activeDate });
          });
        }
      });
    } catch (err) {
      console.error('30天预报请求失败', err);
      this.setData({ loading: false, errorMsg: '网络请求失败' });
    }
  },

  // 合并空气质量数据
  mergeAir(daily, airRes) {
    if (!airRes || !airRes.days) return;
    const airMap = {};
    airRes.days.forEach(day => {
      const dateKey = (day.forecastStartTime || '').substring(0, 10);
      const idx = (day.indexes && day.indexes[0]) || {};
      const c = idx.color || {};
      const colorHex = c.red != null ? toHex(c) : '#4caf50';
      airMap[dateKey] = {
        aqi: idx.aqi,
        aqiDisplay: idx.aqiDisplay || idx.aqi,
        category: idx.category || '',
        color: colorHex,
        textColor: getTextColor(colorHex),
        level: idx.level || ''
      };
    });
    daily.forEach(item => {
      item.air = airMap[item.fxDate] || null;
    });
  },

  // 计算升降温描述
  computeTempDesc(daily) {
    daily.forEach((item, i) => {
      if (i === 0) {
        item.week = '今天';
        item.tempDesc = '';
        return;
      }
      const prev = daily[i - 1];
      const maxDiff = Number(item.tempMax) - Number(prev.tempMax);
      if (maxDiff === 0) {
        item.tempDesc = '温度持平';
      } else if (maxDiff > 0) {
        item.tempDesc = `升温+${Math.abs(maxDiff)}°`;
      } else {
        item.tempDesc = `降温-${Math.abs(maxDiff)}°`;
      }
    });
  },

  // 计算统计摘要
  computeSummary(daily) {
    let rainDays = 0, snowDays = 0;
    let maxTemp = -Infinity, minTemp = Infinity;
    let maxDate = '', minDate = '';

    daily.forEach(item => {
      const code = Number(item.iconDay);
      // 雨类
      if ((code >= 300 && code <= 318) || code === 350 || code === 351 || code === 399) {
        rainDays++;
      }
      // 雪类
      if ((code >= 400 && code <= 410) || code === 456 || code === 457 || code === 499) {
        snowDays++;
      }
      if (Number(item.tempMax) > maxTemp) {
        maxTemp = Number(item.tempMax);
        maxDate = item.dateLabel;
      }
      if (Number(item.tempMin) < minTemp) {
        minTemp = Number(item.tempMin);
        minDate = item.dateLabel;
      }
    });

    return { rainDays, snowDays, maxTemp, maxDate, minTemp, minDate };
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'chart') {
      wx.nextTick(() => {
        const chartComp = this.selectComponent('#weather30Chart');
        if (chartComp) {
          chartComp.drawChart();
          const { activeDate, daily } = this.data;
          if (activeDate) {
            const idx = daily.findIndex(d => d.fxDate === activeDate);
            if (idx >= 0) chartComp.scrollToIndex(idx);
          }
        }
      });
    }
  },

  onChartSelect(e) {
    // 图表组件内部已处理选中状态
  },

  onPullDownRefresh() {
    this.fetchData();
    wx.stopPullDownRefresh();
  }
});
