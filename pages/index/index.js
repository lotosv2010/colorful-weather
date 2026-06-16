const { now, indices, hourly, sevenDay, air, sun, moon, warning } = require('../../utils/api');
const { formatDate } = require('../../utils/util');
const QQMapWX = require('../../libs/qqmap-wx-jssdk.min');

// index.js
// 获取应用实例
const app = getApp()

Page({
  data: {
    qqmapsdk: null,
    lbs: app.globalData.lbs,
    currentWeather: {},
    selectorVisible: false,
    currentCity: '',
    dateNow: formatDate(new Date).substr(11, 5),
    desc: '',
    uv: '',
    hourly: [],
    daily: [],
    air: {},
    indices: [],
    astronomySun: {},
    astronomyMoon: {},
    alerts: [],
    latitude: '',
    longitude: '',
    province: '',
    district: ''
  },
  // 事件处理函数
  onLoad() {
    // 实例化API核心类
    this.init();
  },
  showToast() {
    wx.showToast({
      title: `数据加载失败，请稍后再试`,
      icon: 'none'
    });
  },
  async init() {
    try {
      this.qqmapsdk = new QQMapWX({
        key: app.globalData.lbs.key
      });
      await this.getLocation();
      await this.getNow();
    } catch (error) {
      this.showToast();
    }
  },
  async getNow() {
    try {
      const {longitude, latitude} = this.data;
      const { city, province, district } = await this.getCity(`${latitude},${longitude}`);
      this.setData({
        currentCity: city,
        province,
        district
      });
      await this.getWeather();
    } catch (error) {
      console.log(error)
      this.showToast();
    }
  },
  formatHourly(data=[]) {
    return data?.map(h => {
      const res = {...h};
      res.hour = res.fxTime.substr(11, 2);
      return res;
    });
  },
  formatDaily(data=[]) {
    const weekMap = new Map([
      [1, '周一'],
      [2, '周二'],
      [3, '周三'],
      [4, '周四'],
      [5, '周五'],
      [6, '周六'],
      [0, '周日'],
    ]);
    return data.map(d => {
      const res = {...d};
      const date = new Date(res.fxDate);
      res.week = weekMap.get(date.getDay());
      res.month = date.getMonth() + 1;
      res.day = `${date.getDate()}`.padStart(2, 0);
      return res;
    });
  },
  // 转换空气质量数据：indexes[0] + pollutants[] → 组件可用结构
  formatAir(res) {
    if (!res || !res.indexes || !res.indexes.length) return {};
    const idx = res.indexes[0];
    const c = idx.color || {};
    const colorHex = `#${c.red.toString(16).padStart(2, '0')}${c.green.toString(16).padStart(2, '0')}${c.blue.toString(16).padStart(2, '0')}`;
    const pollutants = (res.pollutants || []).map(p => ({
      name: p.name,
      value: p.concentration ? p.concentration.value : '-',
      unit: p.concentration ? p.concentration.unit : '',
      originData: p
    }));
    return {
      aqi: idx.aqi,
      aqiDisplay: idx.aqiDisplay,
      category: idx.category,
      level: idx.level,
      colorHex,
      primary: idx.primaryPollutant ? idx.primaryPollutant.name : '',
      healthEffect: idx.health ? idx.health.effect : '',
      generalAdvice: idx.health && idx.health.advice ? idx.health.advice.generalPopulation : '',
      sensitiveAdvice: idx.health && idx.health.advice ? idx.health.advice.sensitivePopulation : '',
      pollutants
    };
  },
  async getWeather() {
    try {
      wx.showLoading({
        title: '数据加载中...',
      });
      let location = '101010100';
      const {longitude, latitude} = this.data;
      location = `${longitude},${latitude}`;
      const today = this.formatDateStr(new Date());
      const [weatherData, {daily}, {hourly: hourlyData}, {daily: dailyData}, airRes, sunData, moonData, warningRes] = await Promise.all([
        now({location}),
        this.getIndices(location),
        hourly({location}),
        sevenDay({location}),
        air(location),
        sun({location, date: today}),
        moon({location, date: today}),
        warning(location).catch(() => null)
      ]);

      // 转换空气质量数据：indexes[0] + pollutants[] → 扁平结构供组件使用
      const airData = this.formatAir(airRes);

      // 预警数据：metadata.zeroResult 为 true 时表示无预警
      const alerts = (warningRes && !warningRes.metadata?.zeroResult && warningRes.alerts) ? warningRes.alerts : [];

      this.setData({
        currentWeather: weatherData?.now,
        uv: daily.find(d => d.type === '5')?.category,
        desc: daily.find(d => d.type === '8')?.text,
        hourly: this.formatHourly(hourlyData),
        daily: this.formatDaily(dailyData),
        air: airData,
        indices: daily,
        astronomySun: sunData,
        astronomyMoon: moonData,
        alerts
      });
    } catch (error) {
      console.log(error)
      this.showToast();
    } finally {
      wx.hideLoading();
    }
  },
  // 格式化日期为 yyyyMMdd（天文 API 要求）
  formatDateStr(date) {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}${m}${d}`;
  },
  async getLocation(){
    const { latitude, longitude } = await wx.getLocation({
      altitude: 'gcj02',
    });
    this.setData({
      latitude,
      longitude
    });
  },
  getCity(location) {
    return new Promise((resolve, reject) => {
      this.qqmapsdk.reverseGeocoder({
        location,
        success: (res) => {
          const ad = res?.result?.ad_info || {};
          resolve({
            city: ad.district,
            province: ad.province,
            district: ad.district
          });
        },
        fail: function(error) {
          reject(error);
          console.error(error);
        }
      });
    });
  },
  getIndices(location) {
    return indices({ location, type: 0 });
  },
  // 显示组件
  showSelector() {
    this.setData({
      selectorVisible: true,
    });
  },

  // 关闭城市搜索弹层
  hideSelector() {
    this.setData({
      selectorVisible: false,
    });
  },

  // 当用户选择了组件中的城市之后的回调函数
  // GeoAPI 返回字段：name / lat / lon
  onSelectCity(e) {
    const { city } = e.detail;
    if (!city) return;
    this.setData({
      currentCity: city.name,
      latitude: city.lat,
      longitude: city.lon,
      selectorVisible: false,
    });
    this.getWeather();
  },
  gotoWarning() {
    const {longitude, latitude} = this.data;
    wx.navigateTo({
      url: `/pages/warning/index?location=${longitude},${latitude}`
    });
  },
})
