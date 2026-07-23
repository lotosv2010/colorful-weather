const api = require('../../utils/api');
const { formatDate, toHex, getTextColor } = require('../../utils/util');
const prefsBehavior = require('../../behaviors/prefsBehavior');

// hex 主题色 → "r,g,b" 字符串（供 rgba() 内联使用）
const hexToRgbStr = (hex) => {
  const h = hex.replace('#', '');
  const len = h.length;
  if (len === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ].join(',');
  }
  if (len >= 6) {
    return [
      parseInt(h.substr(0, 2), 16),
      parseInt(h.substr(2, 2), 16),
      parseInt(h.substr(4, 2), 16),
    ].join(',');
  }
  return '18,150,219'; // 兜底默认蓝
};
const { getLunarLabels } = require('../../utils/lunar');
const prefs = require('../../utils/prefs');
const { buildPath, parsePageOptions } = require('../../utils/route');
const monitor = require('../../utils/monitor');
const { WEEK_LABELS } = require('../../utils/date');

// 扁平化单个值：对象/数组→简单值
const flattenVal = (val) => {
  if (val == null) return '';
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.length ? flattenVal(val[0]) : '';
  if (val.value != null) return String(val.value);
  if (val.text  != null) return String(val.text);
  if (val.name  != null) return String(val.name);
  if (val.desc  != null) return String(val.desc);
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
  behaviors: [prefsBehavior],

  data: {
    loading: true,
    errorMsg: '',
    city: '',
    province: '',
    district: '',
    cityId: '',
    activeDate: '',
    scrollToDate: '',
    daily: [],
    summary: {},
    heatCells: [],
    heatLegend: [],
    // 默认展示月历 tab
    activeTab: 'calendar',
    updateTime: '',
  },

  // 覆盖 prefsBehavior 的默认 _syncPrefs：主题色变化时额外重算热力格
  _syncPrefs() {
    const p = prefs.getPrefs();
    if (p.tempUnit === this.data.tempUnit && p.themeColor === this.data.themeColor) return;
    const patch = { tempUnit: p.tempUnit, themeColor: p.themeColor };
    if (p.themeColor !== this.data.themeColor && this.data.daily.length) {
      const { cells, legend } = this.computeHeatmap(this.data.daily, p.themeColor);
      patch.heatCells = cells;
      patch.heatLegend = legend;
    }
    this.setData(patch);
  },

  onLoad(options) {
    this._loadStart = Date.now();
    const { location, province, city, district, cityId } = parsePageOptions(options);
    const { date } = options;
    if (!location) {
      this.setData({ loading: false, errorMsg: '缺少位置信息' });
      return;
    }
    this.location = location;
    this.setData({ province, city, district, cityId });
    if (date) this.setData({ activeDate: date });
    this.fetchData();
  },

  onReady() {
    monitor.recordPageLoad('/pages/weather30/index', this._loadStart);
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
          week:      WEEK_LABELS[date.getDay()],
          month:     date.getMonth() + 1,
          day:       date.getDate(),
          dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`
        };
      });

      // 补充农历标签
      const lunarLabels = getLunarLabels(daily.map(d => d.fxDate));
      daily.forEach(d => { d.lunarLabel = lunarLabels[d.fxDate] || ''; });

      // 合并空气质量
      this.mergeAir(daily, airRes);

      // 计算降水量相对高度（0–100，供图表列小柱使用）
      const maxPrecip = Math.max(...daily.map(d => parseFloat(d.precip) || 0), 0.1);
      daily.forEach(d => {
        d.precipBarPct = Math.round(((parseFloat(d.precip) || 0) / maxPrecip) * 100);
      });

      // 计算升降温描述
      this.computeTempDesc(daily);

      // 计算统计摘要
      const summary = this.computeSummary(daily);

      // 计算降水热力格
      const { cells: heatCells, legend: heatLegend } = this.computeHeatmap(daily);

      const { activeDate } = this.data;
      this.setData({
        daily,
        summary,
        heatCells,
        heatLegend,
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
      monitor.recordError('page', err?.message || '30天预报加载失败', { page: '/pages/weather30/index', stack: err?.stack });
      this.setData({ loading: false, errorMsg: '网络请求失败' });
    }
  },

  // 合并空气质量数据
  mergeAir(daily, airRes) {
    if (!airRes || !airRes.days) return;
    const airMap = {};
    airRes.days.forEach(day => {
      const dateKey = (day.forecastStartTime || '').substring(0, 10);
      const idx     = (day.indexes && day.indexes[0]) || {};
      const c       = idx.color || {};
      const colorHex = c.red != null ? toHex(c) : '#4caf50';
      airMap[dateKey] = {
        aqi:        idx.aqi,
        aqiDisplay: idx.aqiDisplay || idx.aqi,
        category:   idx.category || '',
        color:      colorHex,
        textColor:  getTextColor(colorHex),
        level:      idx.level || ''
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
      const prev    = daily[i - 1];
      const maxDiff = Number(item.tempMax) - Number(prev.tempMax);
      if (maxDiff === 0)      item.tempDesc = '温度持平';
      else if (maxDiff > 0)   item.tempDesc = `升温+${Math.abs(maxDiff)}°`;
      else                    item.tempDesc = `降温-${Math.abs(maxDiff)}°`;
    });
  },

  // 计算降水热力格数据：返回带前置空格的日历 cells 数组
  computeHeatmap(daily, themeColor) {
    if (!daily || !daily.length) return [];
    const rgbStr = hexToRgbStr(themeColor || this.data.themeColor);
    // 最大降水量（归一化用），兜底 0.1 避免除零
    const maxPrecip = Math.max(...daily.map(d => parseFloat(d.precip) || 0), 0.1);
    // 第一天是周几（0=周日，1=周一...）→ 转为周一起始偏移
    const firstDate = new Date(daily[0].fxDate + 'T00:00:00');
    const dow = firstDate.getDay(); // 0–6
    const offset = dow === 0 ? 6 : dow - 1; // 周一起始
    const cells = [];
    // 前置空格
    for (let i = 0; i < offset; i++) cells.push({ empty: true, key: 'empty-' + i });
    // 30 天数据
    daily.forEach(d => {
      const precip = parseFloat(d.precip) || 0;
      // alpha：0mm → 0.06（淡底色），>0 → 0.15~1 区间线性映射
      const alpha = precip === 0 ? 0.06 : Math.max(0.15, Math.min(1, precip / maxPrecip));
      const bgColor = precip > 0
        ? `rgba(${rgbStr},${alpha.toFixed(2)})`
        : 'rgba(255,255,255,0.04)';
      cells.push({
        key: d.fxDate,
        day: d.day,
        fxDate: d.fxDate,
        lunarLabel: d.lunarLabel || '',
        precip,
        precipDisplay: precip > 0 ? String(precip) : '',
        bgColor,
        isToday: d.week === '今天',
      });
    });
    // 图例色：从无到最深共 5 档
    const legend = [
      'rgba(255,255,255,0.04)',
      `rgba(${rgbStr},0.20)`,
      `rgba(${rgbStr},0.45)`,
      `rgba(${rgbStr},0.70)`,
      `rgba(${rgbStr},1.00)`,
    ];
    return { cells, legend };
  },

  // 计算统计摘要
  computeSummary(daily) {
    let rainDays = 0, snowDays = 0;
    let maxTemp = -Infinity, minTemp = Infinity;
    let maxDate = '', minDate = '';

    daily.forEach(item => {
      const code = Number(item.iconDay);
      if ((code >= 300 && code <= 318) || code === 350 || code === 351 || code === 399) rainDays++;
      if ((code >= 400 && code <= 410) || code === 456 || code === 457 || code === 499) snowDays++;
      if (Number(item.tempMax) > maxTemp) { maxTemp = Number(item.tempMax); maxDate = item.dateLabel; }
      if (Number(item.tempMin) < minTemp) { minTemp = Number(item.tempMin); minDate = item.dateLabel; }
    });

    return { rainDays, snowDays, maxTemp, maxDate, minTemp, minDate };
  },

  onRetry() {
    this.setData({ loading: true, errorMsg: '' });
    this.fetchData();
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
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
    // 月历 tab 由 weather-calendar 组件自行管理，无需页面干预
  },

  onChartSelect() {
    // 图表组件内部已处理选中状态
  },

  async onPullDownRefresh() {
    await this.fetchData().catch(() => {});
    wx.stopPullDownRefresh();
  },

  _shareParams() {
    const { province, city, district } = this.data;
    return { location: this.location || '', province, city, district };
  },
  onShareAppMessage() {
    const { district, city, province } = this.data;
    const path = buildPath('/pages/weather30/index', { location: this.location || '', province, city, district });
    return { title: `${district || city || ''} 未来 30 天天气`, path };
  },
  onShareTimeline() {
    const { district, city, province } = this.data;
    const path = buildPath('/pages/weather30/index', { location: this.location || '', province, city, district });
    return {
      title: `${district || city || ''} 30 天天气趋势`,
      query: path.split('?')[1] || ''
    };
  }
});
