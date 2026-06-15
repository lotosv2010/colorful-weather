// pages/air/index.js
const { air, airHourly, airDaily } = require('../../utils/api');

// API pollutant code → 内部字段名映射
const CODE_MAP = { 'PM2.5': 'pm2p5', 'PM10': 'pm10', 'O3': 'o3', 'CO': 'co', 'SO2': 'so2', 'NO2': 'no2' };
const POLLUTANT_NAMES = { pm2p5: 'PM2.5', pm10: 'PM10', o3: 'O₃', co: 'CO', so2: 'SO₂', no2: 'NO₂' };
const POLLUTANT_UNITS = { pm2p5: 'μg/m³', pm10: 'μg/m³', o3: 'μg/m³', co: 'mg/m³', so2: 'μg/m³', no2: 'μg/m³' };

// RGBA → hex
const toHex = (c = {}) => `#${((c.red << 16) | (c.green << 8) | c.blue).toString(16).padStart(6, '0')}`;

Page({
  data: {
    location: '',
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
    const location = options.location || '';
    this.setData({ location });
    if (location) {
      this.loadData();
    } else {
      this.setData({ errorMsg: '缺少城市定位' });
    }
  },

  // longitude,latitude → latitude/longitude（airquality v1 URL 路径格式）
  formatLocation(loc) {
    const parts = loc.split(',');
    return parts.length === 2 ? `${parts[1]}/${parts[0]}` : loc;
  },

  async loadData() {
    this.setData({ loading: true, errorMsg: '' });
    try {
      const apiLoc = this.formatLocation(this.data.location);

      const [airRes, hourlyRes, dailyRes] = await Promise.all([
        air(apiLoc),
        airHourly(apiLoc),
        airDaily(apiLoc)
      ]);

      this.processAirNow(airRes);
      if (hourlyRes && hourlyRes.hourly) {
        this.processHourly(hourlyRes.hourly);
      }
      if (dailyRes && dailyRes.daily) {
        this.processDaily(dailyRes.daily);
      }
    } catch (e) {
      console.log(e);
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

    // 从 pollutants 数组提取各污染物浓度
    const pollutantMap = {};
    (res.pollutants || []).forEach(p => {
      const key = CODE_MAP[p.code];
      if (key) {
        pollutantMap[key] = p.concentration ? p.concentration.value : '-';
      }
    });

    const pollutants = Object.keys(POLLUTANT_NAMES).map(key => ({
      name: POLLUTANT_NAMES[key],
      key,
      value: pollutantMap[key] || '-',
      unit: POLLUTANT_UNITS[key]
    }));

    const health = idx.health || {};
    const advice = health.advice || {};

    this.setData({
      aqi: idx.aqi,
      aqiDisplay: idx.aqiDisplay,
      category: idx.category,
      categoryDesc: health.effect || '',
      healthEffect: health.effect || '',
      generalAdvice: advice.generalPopulation || '',
      sensitiveAdvice: advice.sensitivePopulation || '',
      levelColor: colorHex,
      primary: idx.primaryPollutant ? idx.primaryPollutant.name : '',
      pollutants
    });
  },

  processHourly(list) {
    const hourly = list.map(item => ({
      time: (item.fxTime || '').substr(11, 5),
      aqi: item.aqi,
      category: item.category,
      primary: item.primary || ''
    }));
    this.setData({ hourly });
  },

  processDaily(list) {
    const weekArr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const daily = list.map(item => {
      const parts = (item.fxDate || '').split('-');
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      return {
        date: item.fxDate,
        week: weekArr[dateObj.getDay()],
        dateLabel: `${parseInt(parts[1])}月${parseInt(parts[2])}日`,
        aqi: item.aqi,
        category: item.category,
        primary: item.primary || '',
        color: '#9BB365'
      };
    });
    this.setData({ daily });
  }
});
