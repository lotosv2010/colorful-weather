const { now, indices, hourly, sevenDay, air, sun, moon, warning, minutely, cityLookup } = require('../../utils/api');
const { formatDate } = require('../../utils/util');
const cache = require('../../utils/cache');
const prefs = require('../../utils/prefs');
const network = require('../../utils/network');
const { navigateTo } = require('../../utils/route');
const { resolveTheme, resolveThemeBg } = require('../../utils/autoTheme');
const QQMapWX = require('../../libs/qqmap-wx-jssdk.min');

// index.js
// 获取应用实例
const app = getApp()

// 收集当前批次的 wx.request task，用于城市切换时取消未完成的旧请求
let _pendingTasks = [];
const abortPending = () => {
  _pendingTasks.forEach(t => { try { t.abort(); } catch (_) {} });
  _pendingTasks = [];
};

Page({
  data: {
    // 注意：qqmapsdk 实例存放在 this.qqmapsdk（实例属性），不放入 data
    lbs: app.globalData.lbs,
    currentWeather: {},
    selectorVisible: false,
    city: '',
    dateNow: '',
    desc: '',
    uv: '',
    hourly: [],
    daily: [],
    air: {},
    indices: [],
    astronomySun: {},
    astronomyMoon: {},
    alerts: [],
    showMinutelyEntry: false,
    minutelySummary: '',
    latitude: '',
    longitude: '',
    province: '',
    district: '',
    locationLabel: '',
    sheetExpanded: false,
    sheetProgress: 0,
    mapInteractive: true,
    tempUnit: 'C',
    themeColor: '#1296db',
    weatherBg: 'rgba(34, 37, 48, 0.85)',
    offline: false,
    cityId: '',
    loading: true,
    errorMsg: '',
  },
  onSheetChange(e) {
    this.setData({ sheetExpanded: e.detail.expanded });
  },
  onSheetProgress(e) {
    this.setData({ sheetProgress: e.detail.progress });
  },
  onSheetDragStart() {
    this.setData({ mapInteractive: false });
  },
  onSheetDragEnd() {
    this.setData({ mapInteractive: true });
  },
  onExpandSheet() {
    const sheet = this.selectComponent('#sheet');
    if (sheet) sheet.expand();
  },
  onLocateTap() {
    cache.clear();
    this.init({ forceLocate: true });
  },
  onRefresh() {
    cache.clear();
    this.getWeather();
  },
  onRetry() {
    this.setData({ errorMsg: '' });
    if (this.data.latitude && this.data.longitude) {
      this.getWeather();
    } else {
      this.init();
    }
  },
  _syncPrefs() {
    const p = prefs.getPrefs();
    let themeColor = p.themeColor;
    let weatherBg = 'rgba(34, 37, 48, 0.85)';
    const icon = this.data.currentWeather?.icon;
    if (p.themeMode === 'auto' && icon) {
      themeColor = resolveTheme(icon, this.data.astronomySun?.sunrise, this.data.astronomySun?.sunset);
    }
    if (p.cardBgMode === 'auto' && icon) {
      weatherBg = resolveThemeBg(icon, this.data.astronomySun?.sunrise, this.data.astronomySun?.sunset);
    }
    if (p.tempUnit === this.data.tempUnit && themeColor === this.data.themeColor && weatherBg === this.data.weatherBg) return;
    this.setData({ tempUnit: p.tempUnit, themeColor, weatherBg });
  },
  _buildLocationLabel(district, city, province) {
    const parts = [];
    const push = (v) => { if (v && !parts.includes(v)) parts.push(v); };
    push(district);
    push(city);
    push(province);
    return parts.join('，');
  },
  // 事件处理函数
  onLoad() {
    this._syncPrefs();
    this._unsubPrefs = prefs.subscribe(() => this._syncPrefs());
    this.setData({ offline: !network.isOnline() });
    this._unsubNet = network.subscribe(({ online }) => {
      this.setData({ offline: !online });
    });
    // 10 分钟定时器：捕捉时段切换（白天→黄昏→夜晚）
    this._themeTimer = setInterval(() => {
      const p = prefs.getPrefs();
      if (p.themeMode !== 'auto' && p.cardBgMode !== 'auto') return;
      const icon = this.data.currentWeather?.icon;
      if (!icon) return;
      const updates = {};
      if (p.themeMode === 'auto') {
        const color = resolveTheme(icon, this.data.astronomySun?.sunrise, this.data.astronomySun?.sunset);
        if (color !== this.data.themeColor) updates.themeColor = color;
      }
      if (p.cardBgMode === 'auto') {
        const bg = resolveThemeBg(icon, this.data.astronomySun?.sunrise, this.data.astronomySun?.sunset);
        if (bg !== this.data.weatherBg) updates.weatherBg = bg;
      }
      if (Object.keys(updates).length) this.setData(updates);
    }, 10 * 60 * 1000);
    // 实例化API核心类
    this.init();
  },
  onUnload() {
    if (this._unsubPrefs) this._unsubPrefs();
    if (this._unsubNet) this._unsubNet();
    if (this._themeTimer) clearInterval(this._themeTimer);
  },
  async init(opts = {}) {
    if (this._fetching) return;
    const { forceLocate = false } = opts;
    try {
      this.qqmapsdk = new QQMapWX({
        key: app.globalData.lbs.key
      });
      const defaultCity = !forceLocate ? prefs.findCity(prefs.getPrefs().defaultCityId) : null;
      if (defaultCity) {
        this.setData({
          latitude: defaultCity.lat,
          longitude: defaultCity.lon,
          city: defaultCity.adm2 || defaultCity.adm1 || '',
          province: defaultCity.adm1 || '',
          district: defaultCity.name || '',
          locationLabel: this._buildLocationLabel(defaultCity.name, defaultCity.adm2, defaultCity.adm1),
          cityId: defaultCity.id || '',
        });
        await this.getWeather();
      } else {
        await this.getLocation();
        await this.getNow();
      }
    } catch (error) {
      console.error(error);
      const msg = String(error?.errMsg || error?.message || '');
      const isLocateFail = msg.includes('getLocation') || msg.includes('auth deny') || msg.includes('auth denied');
      this.setData({
        loading: false,
        errorMsg: isLocateFail ? '定位失败，请手动选择城市' : '数据加载失败，请稍后再试',
        ...(isLocateFail ? { selectorVisible: true } : {}),
      });
    }
  },
  async getNow() {
    try {
      const {longitude, latitude} = this.data;
      const { city, province, district } = await this.getCity(`${latitude},${longitude}`);
      this.setData({
        city,
        province,
        district,
        locationLabel: this._buildLocationLabel(district, city, province),
      });
      this._resolveCityId(`${longitude},${latitude}`);
      await this.getWeather();
    } catch (error) {
      console.error(error)
      this.setData({ loading: false, errorMsg: '城市解析失败，请稍后再试' });
    }
  },
  async _resolveCityId(location) {
    try {
      // GeoAPI 坐标精度限制为两位小数
      const [lon, lat] = location.split(',');
      const loc = `${Number(lon).toFixed(2)},${Number(lat).toFixed(2)}`;
      const res = await cityLookup({ location: loc });
      const id = res && res.code === '200' && res.location && res.location[0] ? res.location[0].id : '';
      if (id) this.setData({ cityId: id });
    } catch (_) {}
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
    // 防止并发重复调用
    if (this._fetching) return;
    this._fetching = true;
    try {
      // 取消上一批未完成的请求，避免城市切换时旧数据覆盖新结果
      abortPending();
      this.setData({ loading: true });
      let location = '101010100';
      const {longitude, latitude} = this.data;
      location = `${longitude},${latitude}`;
      const today = this.formatDateStr(new Date());
      const tc = _pendingTasks; // 当前批次 taskCollector
      const [weatherData, {daily}, {hourly: hourlyData}, {daily: dailyData}, airRes, sunData, moonData, warningRes, minutelyRes] = await Promise.all([
        now({location}, tc),
        this.getIndices(location, tc),
        hourly({location}, tc),
        sevenDay({location}, tc),
        air(location, tc),
        sun({location, date: today}, tc),
        moon({location, date: today}, tc),
        warning(location, tc).catch(() => null),
        minutely({location}, tc).catch(() => null)
      ]);

      // 转换空气质量数据：indexes[0] + pollutants[] → 扁平结构供组件使用
      const airData = this.formatAir(airRes);

      // 预警数据：metadata.zeroResult 为 true 时表示无预警
      const alerts = (warningRes && !warningRes.metadata?.zeroResult && warningRes.alerts) ? warningRes.alerts : [];

      // 分钟级降水：取有降水的类型，默认 rain
      const minutelyData = minutelyRes?.minutely || [];
      const hasPrecip = minutelyData.some(m => Number(m.precip) > 0);
      const showMinutelyEntry = hasPrecip;
      const minutelyType = minutelyData.some(m => Number(m.precip) > 0 && m.type === 'snow') ? 'snow' : 'rain';

      this.setData({
        dateNow: formatDate(new Date()).substr(11, 5),
        currentWeather: weatherData?.now,
        uv: daily.find(d => d.type === '5')?.category,
        desc: daily.find(d => d.type === '8')?.text,
        hourly: this.formatHourly(hourlyData),
        daily: this.formatDaily(dailyData),
        air: airData,
        indices: daily,
        astronomySun: sunData,
        astronomyMoon: moonData,
        alerts,
        showMinutelyEntry,
        minutelySummary: minutelyRes?.summary || '',
        minutelyType,
        loading: false,
        errorMsg: ''
      });

      // 自动主题色：天气数据更新后重新计算
      const p = prefs.getPrefs();
      const updates = {};
      if (p.themeMode === 'auto') {
        const autoColor = resolveTheme(weatherData?.now?.icon, sunData?.sunrise, sunData?.sunset);
        if (autoColor !== this.data.themeColor) updates.themeColor = autoColor;
      }
      if (p.cardBgMode === 'auto') {
        const autoBg = resolveThemeBg(weatherData?.now?.icon, sunData?.sunrise, sunData?.sunset);
        if (autoBg !== this.data.weatherBg) updates.weatherBg = autoBg;
      }
      if (Object.keys(updates).length) this.setData(updates);
    } catch (error) {
      console.error(error)
      this.setData({ loading: false, errorMsg: '数据加载失败，请稍后再试' });
    } finally {
      this._fetching = false;
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
      type: 'gcj02',
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
          // 直辖市 district 可能与 province 相同，city 为空
          const district = ad.district || ad.city || ad.province || '';
          const city = ad.city || ad.province || '';
          const province = ad.province || '';
          resolve({ city, province, district });
        },
        fail: function(error) {
          reject(error);
          console.error(error);
        }
      });
    });
  },
  getIndices(location, tc) {
    return indices({ location, type: 0 }, tc);
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
  // GeoAPI 返回字段：name / id / lat / lon / adm1(省) / adm2(市)
  onSelectCity(e) {
    const { city: selected } = e.detail;
    if (!selected) return;
    const district = selected.name || '';
    const city = selected.adm2 || '';
    const province = selected.adm1 || '';
    this.setData({
      city,
      province,
      district,
      locationLabel: this._buildLocationLabel(district, city, province),
      latitude: selected.lat,
      longitude: selected.lon,
      cityId: selected.id ? String(selected.id) : '',
      selectorVisible: false,
    });
    this.getWeather().catch(console.error);
  },
  gotoWarning() {
    const { longitude, latitude, province, district, city } = this.data;
    navigateTo('/pages/warning/index', { location: `${longitude},${latitude}`, province, city, district });
  },
  onHourlyTap(e) {
    const { longitude, latitude, province, district, city } = this.data;
    navigateTo('/pages/hourly/index', { location: `${longitude},${latitude}`, province, city, district }, { hour: e.detail.index });
  },
  onMinutelyTap() {
    const { longitude, latitude, city, province, district } = this.data;
    navigateTo('/pages/minutely/index', { location: `${longitude},${latitude}`, province, city, district });
  },
  onAirTap() {
    const { longitude, latitude, city, province, district } = this.data;
    navigateTo('/pages/air/index', { location: `${longitude},${latitude}`, province, city, district });
  },
  onShareAppMessage() {
    const { locationLabel, currentWeather, tempUnit } = this.data;
    const tempStr = currentWeather && currentWeather.temp != null ? `${currentWeather.temp}°${tempUnit}` : '';
    const text = currentWeather && currentWeather.text ? `${currentWeather.text} ${tempStr}` : '实时天气';
    return {
      title: `${locationLabel || '我的位置'}：${text}`,
      path: '/pages/index/index'
    };
  },
  onShareTimeline() {
    const { locationLabel, currentWeather, tempUnit } = this.data;
    const tempStr = currentWeather && currentWeather.temp != null ? `${currentWeather.temp}°${tempUnit}` : '';
    return {
      title: `${locationLabel || '我的位置'} 天气 ${tempStr}`,
      query: ''
    };
  },
})
