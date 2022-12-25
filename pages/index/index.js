const { now, indices, hourly, sevenDay, air } = require('../../utils/api');
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
    latitude: '',
    longitude: ''
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
        key: 'LY2BZ-2PECQ-4VD5L-GS33R-VGQO5-RQB3Z'
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
      const { city } = await this.getCity(`${latitude},${longitude}`);
      this.setData({
        currentCity: city
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
  async getWeather() {
    try {
      wx.showLoading({
        title: '数据加载中...',
      });
      let location = '101010100';
      const {longitude, latitude} = this.data;
      location = `${longitude},${latitude}`;
      const [weatherData, {daily}, {hourly: hourlyData}, {daily: dailyData},  {now: airData}] = await Promise.all([
        now({location}),
        this.getIndices(location),
        hourly({location}),
        sevenDay({location}),
        air({location})
      ]);

      this.setData({
        currentWeather: weatherData?.now,
        uv: daily[4]?.category,
        desc: daily[7]?.text,
        hourly: this.formatHourly(hourlyData),
        daily: this.formatDaily(dailyData),
        air: airData,
        indices: daily
      });
    } catch (error) {
      console.log(error)
      this.showToast();
    } finally {
      wx.hideLoading();
    }
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
          resolve({
            city: res?.result?.ad_info?.district
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

  // 当用户选择了组件中的城市之后的回调函数
  onSelectCity(e) {
    const { city } = e.detail;
    this.setData({
      currentCity: city?.name,
      latitude: city?.location?.latitude,
      longitude: city?.location?.longitude,
    });
    this.getWeather();
  },
})
