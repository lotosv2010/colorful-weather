const { now, indices, hourly, sevenDay, air, sun, moon, warning, minutely, cityLookup, historicalWeather, solarElevationAngle } = require('../../utils/api');
const { formatDate } = require('../../utils/util');
const { getLunarLabels } = require('../../utils/lunar');
const prefs = require('../../utils/prefs');
const network = require('../../utils/network');
const { navigateTo } = require('../../utils/route');
const { resolveTheme, resolveThemeBg } = require('../../utils/autoTheme');
const { resolveWeatherEffect } = require('../../utils/weatherEffect');
const monitor = require('../../utils/monitor');
const { fmt: fmtTemp } = require('../../utils/temp');
const { buildSummary, buildShortDesc } = require('../../utils/summary');
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
    shortDesc: '',
    clothingTip: null,
    uv: '',
    hourly: [],
    daily: [],
    air: {},
    indices: [],
    astronomySun: {},
    astronomyMoon: {},
    astronomySolarAngle: null,
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
    sheetFadeOutStyle: 'opacity:1',
    sheetFadeInStyle: 'opacity:0',
    mapInteractive: true,
    tempUnit: 'C',
    themeColor: '#1296db',
    weatherBg: 'rgba(34, 37, 48, 0.85)',
    weatherEffect: { particle: null, decor: null },
    offline: false,
    cityId: '',
    cityPages: [],
    currentPageIndex: 0,
    loading: true,
    errorMsg: '',
    mapTipsVisible: false,
    mapTipsData: {},
    mapMarkers: [],
    citiesOverviewVisible: false,
  },
  onSheetChange(e) {
    const expanded = e.detail.expanded;
    const updates = {
      sheetExpanded: expanded,
      mapInteractive: !expanded,
    };
    if (expanded) {
      updates.mapTipsVisible = false;
    }
    this.setData(updates);
  },
  onSheetProgress(e) {
    const p = e.detail.progress;
    if (typeof p !== 'number' || !isFinite(p)) return;
    this.setData({
      sheetProgress: p,
      sheetFadeOutStyle: `opacity:${1 - p}`,
      sheetFadeInStyle: `opacity:${p}`,
    });
  },
  onSheetDragStart() {
    this.setData({ mapInteractive: false });
  },
  onSheetDragEnd() {
    // 仅在抽屉收起时恢复地图交互，展开状态保持锁定
    if (!this.data.sheetExpanded) {
      this.setData({ mapInteractive: true });
    }
  },
  onExpandSheet() {
    const sheet = this.selectComponent('#sheet');
    if (sheet) sheet.expand();
  },
  onLocateTap() {
    this.setData({ mapTipsVisible: false, mapTipsData: {}, mapMarkers: [] });
    this.init({ forceLocate: true, force: true });
  },
  onSettingsTap() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },
  onRefresh() {
    this.getWeather({ force: true });
  },
  onRetry() {
    this.setData({ errorMsg: '' });
    if (this.data.latitude && this.data.longitude) {
      this.getWeather();
    } else {
      this.init();
    }
  },
  async onMapTap(e) {
    const { longitude, latitude } = e.detail;
    if (this._mapLoading || longitude == null || latitude == null) return;
    await this._handleMapClick(longitude, latitude);
  },
  async onMapPoiTap(e) {
    const { longitude, latitude } = e.detail;
    if (this._mapLoading || longitude == null || latitude == null) return;
    await this._handleMapClick(longitude, latitude);
  },
  async _handleMapClick(longitude, latitude) {
    // 计算屏幕坐标：通过地图可视区域和点击经纬度换算
    let tapX = null;
    let tapY = null;
    try {
      const mapCtx = wx.createMapContext('bgMap', this);
      const [region, center] = await Promise.all([
        new Promise((res, rej) => mapCtx.getRegion({ success: res, fail: rej })),
        new Promise((res, rej) => mapCtx.getCenterLocation({ success: res, fail: rej })),
      ]);
      const { northeast, southwest } = region;
      const lngSpan = northeast.longitude - southwest.longitude;
      const latSpan = northeast.latitude - southwest.latitude;
      const windowInfo = wx.getWindowInfo();
      const screenW = windowInfo.windowWidth || 375;
      const screenH = windowInfo.windowHeight || 667;
      if (lngSpan > 0 && latSpan > 0) {
        // 以地图中心为基准做相对偏移，减小墨卡托累计误差
        const dLng = longitude - center.longitude;
        const dLat = latitude - center.latitude;
        const pxPerLng = screenW / lngSpan;
        const pxPerLat = screenH / latSpan;
        tapX = screenW / 2 + dLng * pxPerLng;
        tapY = screenH / 2 - dLat * pxPerLat;
      }
    } catch (_) {}
    await this._fetchMapTips(longitude, latitude, tapX, tapY);
  },
  async _fetchMapTips(longitude, latitude, x, y) {
    this._mapLoading = true;
    this.setData({
      mapTipsVisible: false,
      mapTipsData: {},
      mapMarkers: [{
        id: 1,
        latitude: Number(latitude),
        longitude: Number(longitude),
        width: 24,
        height: 32,
        anchor: { x: 0.5, y: 1 },
        callout: {},
      }],
    });
    try {
      const qqLocation = `${latitude},${longitude}`;
      const qwLocation = `${Number(longitude).toFixed(2)},${Number(latitude).toFixed(2)}`;
      const [cityInfo, weatherRes] = await Promise.all([
        this.getCity(qqLocation),
        now({ location: qwLocation }),
      ]);
      const { city, province, district } = cityInfo;
      const nw = weatherRes?.now || {};
      const locationLabel = this._buildLocationLabel(district, city, province);
      const temp = nw.temp;
      const windowInfo = wx.getWindowInfo();
      const screenW = windowInfo.windowWidth || 375;
      const screenH = windowInfo.windowHeight || 667;
      // tips 自适应宽度，估算约 240px（实际由内容撑开，这里用于边界检测）
      const tipEstW = 240;
      const tipH = 110;
      const gap = 4;
      const margin = 12;
      let tipX, tipY;
      if (x != null && y != null && !isNaN(x) && !isNaN(y)) {
        // tips 位置：以点击点为中心
        tipX = x - tipEstW / 2;
        // 水平边界约束
        if (tipX < margin) tipX = margin;
        if (tipX + tipEstW > screenW - margin) tipX = screenW - tipEstW - margin;
        // 垂直定位：优先显示在图钉上方
        tipY = y - tipH - gap;
        if (tipY < 60) {
          // 上方空间不足，显示在图钉下方
          tipY = y + gap;
        }
      } else {
        // 无坐标时居中显示
        tipX = margin;
        tipY = Math.round(screenH * 0.35);
      }
      this.setData({
        mapTipsVisible: true,
        mapTipsData: {
          latitude,
          longitude,
          city,
          province,
          district,
          locationLabel,
          icon: nw.icon || '100',
          iconColor: this._iconColor(nw.icon || '100'),
          temp,
          text: nw.text || '',
          tipX,
          tipY,
        },
      });
    } catch (error) {
      console.error(error);
      this.setData({ mapTipsVisible: false, mapMarkers: [] });
      wx.showToast({ title: '城市解析失败', icon: 'none' });
    } finally {
      this._mapLoading = false;
    }
  },
  _iconColor(code) {
    const c = parseInt(code, 10);
    const map = {
      sunny: '#FDB813', partlyCloudy: '#F0A500', cloudy: '#7B9BB5',
      overcast: '#5A7080', rainLight: '#5BA3D9', rainHeavy: '#1E4D8C',
      thunder: '#7B3FA0', sleet: '#6AAFD6', snow: '#A8D8EA',
      snowHeavy: '#D0EEF8', fog: '#9E9E9E', haze: '#B5854A',
      sand: '#C49A3C', typhoon: '#E53935', hot: '#DC143C',
      cold: '#81D4FA', default: '#8C9AA5',
    };
    let cat = 'default';
    if (c === 100 || c === 150) cat = 'sunny';
    else if (c === 101 || c === 151) cat = 'partlyCloudy';
    else if (c === 102 || c === 103 || c === 152 || c === 153) cat = 'cloudy';
    else if (c === 104 || c === 154) cat = 'overcast';
    else if (c === 302 || c === 303 || c === 304) cat = 'thunder';
    else if (c === 300 || c === 305 || c === 309 || c === 313 || c === 399 || c === 350 || c === 351) cat = 'rainLight';
    else if (c === 301 || c === 306 || c === 307 || c === 308 || c === 310 || c === 311 || c === 312 || c === 314 || c === 315 || c === 316 || c === 317 || c === 318) cat = 'rainHeavy';
    else if (c === 404 || c === 405) cat = 'sleet';
    else if (c === 400 || c === 406 || c === 407 || c === 408 || c === 456 || c === 457 || c === 499) cat = 'snow';
    else if (c === 401 || c === 402 || c === 403 || c === 409 || c === 410) cat = 'snowHeavy';
    else if (c === 500 || c === 501 || c === 502 || c === 509 || c === 510 || c === 514 || c === 515) cat = 'fog';
    else if (c === 503 || c === 504 || c === 511 || c === 512 || c === 513) cat = 'haze';
    else if (c === 507 || c === 508) cat = 'sand';
    else if (c >= 800 && c <= 807) cat = 'typhoon';
    else if (c === 900) cat = 'hot';
    else if (c === 901) cat = 'cold';
    return map[cat] || map.default;
  },
  onMapTipsTap() {
    const d = this.data.mapTipsData;
    if (!d || !d.latitude) return;
    // 用 tips 中暂存的坐标和城市信息更新主数据，再全量查询
    this.setData({
      mapTipsVisible: false,
      mapTipsData: {},
      mapMarkers: [],
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.city,
      province: d.province,
      district: d.district,
      locationLabel: d.locationLabel,
      cityId: '',
    });
    this._resolveCityId(`${d.longitude},${d.latitude}`);
    const sheet = this.selectComponent('#sheet');
    if (sheet) sheet.expand();
    this.getWeather().catch(console.error);
  },
  onMapTipsClose() {
    this.setData({ mapTipsVisible: false, mapTipsData: {}, mapMarkers: [] });
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
    const weatherEffect = resolveWeatherEffect(icon);
    if (p.tempUnit === this.data.tempUnit && themeColor === this.data.themeColor && weatherBg === this.data.weatherBg &&
        weatherEffect.particle === this.data.weatherEffect.particle && weatherEffect.decor === this.data.weatherEffect.decor) {
      // 即使视觉参数未变，仍检查收藏城市是否变化
    } else {
      this.setData({ tempUnit: p.tempUnit, themeColor, weatherBg, weatherEffect });
    }
    // 同步自动主题色到 prefs，使设置页等其他页面也能获取到
    if (p.themeMode === 'auto' && themeColor !== p.themeColor) {
      prefs.setPrefs({ themeColor });
    }
    // 收藏城市变化时重建页面列表
    const citiesJson = JSON.stringify(p.cities);
    if (citiesJson !== this._lastCitiesJson) {
      this._lastCitiesJson = citiesJson;
      this._buildCityPages();
    }
  },
  _buildLocationLabel(district, city, province) {
    let displayCity = city;
    let displayProvince = province;

    // 直辖市：province === city，去掉重复的省级
    if (province && city && province === city) {
      displayProvince = '';
    }

    // 直辖市 GeoAPI 场景：adm2="重庆" adm1="重庆市"，city + '市' === province，去掉冗余的 city 层
    if (city && province && city + '市' === province) {
      displayCity = '';
    }

    // district === city，去掉重复的市级
    if (district && city && district === city) {
      displayCity = '';
    }

    // district === province，去掉重复的省级
    if (district && province && district === province) {
      displayProvince = '';
    }

    // city === province（直辖市且 district === city），去掉重复的省级
    if (displayCity && province && displayCity === province) {
      displayProvince = '';
    }

    const parts = [district, displayCity, displayProvince].filter(Boolean);
    return parts.join('，');
  },
  // 事件处理函数
  onLoad() {
    this._loadStart = Date.now();
    this._lastCitiesJson = '';
    this._locatedGPS = null;      // GPS 定位城市（有定位时才有值）
    this._currentIsLocated = false; // 当前是否在查看定位城市
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
      const weatherEffect = resolveWeatherEffect(icon);
      if (weatherEffect.particle !== this.data.weatherEffect.particle || weatherEffect.decor !== this.data.weatherEffect.decor) {
        updates.weatherEffect = weatherEffect;
      }
      if (Object.keys(updates).length) this.setData(updates);
    }, 10 * 60 * 1000);
    // 冷启动若标记了强刷，在 init 路径透传 force；onShow 看到 false 后不会重复触发
    const force = !!app.globalData.needForceRefresh;
    app.globalData.needForceRefresh = false;
    // AI Handoff：如有接力城市存入 globalData，供 init() 优先加载
    const handoff = app.takeAgentHandoff(this.getPageId());
    if (handoff && handoff.payload && handoff.payload.city) {
      app.globalData.agentHandoffCity = handoff.payload.city;
    }
    this.init({ force });
  },
  onReady() {
    monitor.recordPageLoad('/pages/index/index', this._loadStart);
  },
  onShow() {
    // 仅处理「页面已存在 + 应用从后台回到前台超过阈值」场景；冷启动由 onLoad 接管
    if (!app.globalData.needForceRefresh) return;
    app.globalData.needForceRefresh = false;
    if (this._fetching || !this.data.latitude || !this.data.longitude) return;
    this.getWeather({ force: true }).catch(console.error);
  },
  onUnload() {
    if (this._unsubPrefs) this._unsubPrefs();
    if (this._unsubNet) this._unsubNet();
    if (this._themeTimer) clearInterval(this._themeTimer);
  },
  async init(opts = {}) {
    if (this._fetching || this._initing) return;
    this._initing = true;
    const { forceLocate = false, force = false } = opts;
    try {
      this.qqmapsdk = new QQMapWX({
        key: app.globalData.lbs.key
      });
      // AI Handoff 接力城市优先于 defaultCity
      const agentCity = app.globalData.agentHandoffCity;
      if (agentCity) {
        app.globalData.agentHandoffCity = null;
        this.setData({
          latitude: agentCity.lat,
          longitude: agentCity.lon,
          city: agentCity.adm2 || '',
          province: '',
          district: agentCity.name || '',
          locationLabel: this._buildLocationLabel(agentCity.name, agentCity.adm2, ''),
          cityId: agentCity.id || '',
        });
        await this.getWeather({ force: true });
        return;
      }
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
        await this.getWeather({ force });
      } else {
        await this.getLocation();
        await this.getNow({ force });
      }
    } catch (error) {
      console.error(error);
      monitor.recordError('page', error?.message || '初始化失败', { page: '/pages/index/index', stack: error?.stack });
      const msg = String(error?.errMsg || error?.message || '');
      const isLocateFail = msg.includes('getLocation') || msg.includes('auth deny') || msg.includes('auth denied');
      this.setData({
        loading: false,
        errorMsg: isLocateFail ? '定位失败，请手动选择城市' : '数据加载失败，请稍后再试',
        ...(isLocateFail ? { selectorVisible: true } : {}),
      });
    } finally {
      this._initing = false;
    }
  },
  async getNow(opts = {}) {
    try {
      const {longitude, latitude} = this.data;
      const { city, province, district } = await this.getCity(`${latitude},${longitude}`);
      // 记录 GPS 城市，并标记当前查看的是定位城市
      this._locatedGPS = { lat: latitude, lon: longitude, city, province, district };
      this._currentIsLocated = true;
      this.setData({
        city,
        province,
        district,
        locationLabel: this._buildLocationLabel(district, city, province),
        cityId: '',  // 清除旧 cityId，表示当前是 GPS 城市
      });
      await this._resolveCityId(`${longitude},${latitude}`);
      await this.getWeather(opts);
    } catch (error) {
      console.error(error);
      monitor.recordError('page', error?.message || '城市解析失败', { page: '/pages/index/index', stack: error?.stack });
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
      if (id) {
        this._locatedCityId = id;
        this.setData({ cityId: id });
        this._buildCityPages();
      }
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
    const today = new Date();
    const mapped = data.map(d => {
      const res = {...d};
      const date = new Date(res.fxDate);
      const isToday = date.getFullYear() === today.getFullYear() &&
                      date.getMonth() === today.getMonth() &&
                      date.getDate() === today.getDate();
      res.week = isToday ? '今天' : weekMap.get(date.getDay());
      res.month = date.getMonth() + 1;
      res.day = `${date.getDate()}`.padStart(2, '0');
      return res;
    });
    const lunarLabels = getLunarLabels(mapped.map(d => d.fxDate));
    mapped.forEach(d => { d.lunarLabel = lunarLabels[d.fxDate] || ''; });
    return mapped;
  },
  // 转换空气质量数据：indexes[0] + pollutants[] → 组件可用结构
  formatAir(res) {
    if (!res || !res.indexes || !res.indexes.length) return {};
    const idx = res.indexes[0];
    const c = idx.color || {};
    const colorHex = `#${(c.red ?? 0).toString(16).padStart(2, '0')}${(c.green ?? 0).toString(16).padStart(2, '0')}${(c.blue ?? 0).toString(16).padStart(2, '0')}`;
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
  async getWeather(opts = {}) {
    // 防止并发重复调用
    if (this._fetching) return;
    this._fetching = true;
    try {
      // 取消上一批未完成的请求，避免城市切换时旧数据覆盖新结果
      abortPending();
      this.setData({ loading: true });
      const {longitude, latitude} = this.data;
      let location;
      if (longitude && latitude) {
        location = `${Number(longitude).toFixed(2)},${Number(latitude).toFixed(2)}`;
      } else if (this.data.cityId) {
        location = this.data.cityId;
      } else {
        this.setData({ loading: false, errorMsg: '请先选择城市', selectorVisible: true });
        return;
      }
      const today = this.formatDateStr(new Date());
      const tc = _pendingTasks; // 当前批次 taskCollector
      const { force = false } = opts;
      const reqOpts = force ? { force: true } : undefined;
      const cityId = this.data.cityId;
      const yesterdayStr = this.formatDateStr(new Date(Date.now() - 86400000));
      // 太阳高度角所需的当前时间 / 时区参数
      const _now = new Date();
      const _tzOff = -_now.getTimezoneOffset();
      const _tzStr = `${_tzOff < 0 ? '-' : ''}${String(Math.floor(Math.abs(_tzOff) / 60)).padStart(2, '0')}${String(Math.abs(_tzOff) % 60).padStart(2, '0')}`;
      const _timeHHmm = `${String(_now.getHours()).padStart(2, '0')}${String(_now.getMinutes()).padStart(2, '0')}`;
      const [weatherData, {daily}, {hourly: hourlyData}, {daily: dailyData}, airRes, sunData, moonData, warningRes, minutelyRes, histRes, solarAngleData] = await Promise.all([
        now({location}, tc, reqOpts),
        this.getIndices(location, tc, reqOpts),
        hourly({location}, tc, reqOpts),
        sevenDay({location}, tc, reqOpts),
        air(location, tc, reqOpts),
        sun({location, date: today}, tc, reqOpts),
        moon({location, date: today}, tc, reqOpts),
        warning(location, tc, reqOpts).catch(() => null),
        minutely({location}, tc, reqOpts).catch(() => null),
        cityId ? historicalWeather({ location: cityId, date: yesterdayStr }).catch(() => null) : Promise.resolve(null),
        solarElevationAngle({ location, date: today, time: _timeHHmm, tz: _tzStr, alt: 0 }, tc, reqOpts).catch(() => null),
      ]);

      // 转换空气质量数据：indexes[0] + pollutants[] → 扁平结构供组件使用
      const airData = this.formatAir(airRes);

      // 昨日最高温（用于"比昨天"温度对比）
      const yMax = histRes && histRes.code === '200' && histRes.weatherDaily
        ? Number(histRes.weatherDaily.tempMax) : null;
      const desc = buildSummary({
        now: weatherData?.now,
        today: dailyData[0],
        air: airData,
        yesterdayTempMax: yMax != null && !isNaN(yMax) ? yMax : null,
      });
      const shortDesc = buildShortDesc({ now: weatherData?.now, today: dailyData[0], air: airData });

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
        clothingTip: (() => { const c = daily.find(d => d.type === '3'); return c ? { category: c.category, text: c.text } : null; })(),
        desc,
        shortDesc,
        hourly: this.formatHourly(hourlyData),
        daily: this.formatDaily(dailyData),
        air: airData,
        indices: daily,
        astronomySun: sunData,
        astronomyMoon: moonData,
        astronomySolarAngle: solarAngleData,
        alerts,
        showMinutelyEntry,
        minutelySummary: minutelyRes?.summary || '',
        minutelyType,
        weatherEffect: resolveWeatherEffect(weatherData?.now?.icon),
        loading: false,
        errorMsg: ''
      });

      // 自动主题色：天气数据更新后重新计算
      const p = prefs.getPrefs();
      const updates = {};
      const prefsPatch = {};
      if (p.themeMode === 'auto') {
        const autoColor = resolveTheme(weatherData?.now?.icon, sunData?.sunrise, sunData?.sunset);
        if (autoColor !== this.data.themeColor) updates.themeColor = autoColor;
        if (autoColor !== p.themeColor) prefsPatch.themeColor = autoColor;
      }
      if (p.cardBgMode === 'auto') {
        const autoBg = resolveThemeBg(weatherData?.now?.icon, sunData?.sunrise, sunData?.sunset);
        if (autoBg !== this.data.weatherBg) updates.weatherBg = autoBg;
      }
      if (Object.keys(updates).length) this.setData(updates);
      if (Object.keys(prefsPatch).length) prefs.setPrefs(prefsPatch);
      this._buildCityPages();
    } catch (error) {
      console.error(error);
      monitor.recordError('page', error?.message || '天气数据加载失败', { page: '/pages/index/index', stack: error?.stack });
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
  getIndices(location, tc, opts) {
    return indices({ location, type: 0 }, tc, opts);
  },
  // 构建可横划城市页列表：GPS 定位城市（有定位时）+ 收藏城市
  _buildCityPages() {
    const { cities } = prefs.getPrefs();
    const { cityId } = this.data;
    const savedIds = new Set(cities.map(c => c.id));
    const pages = [];

    // 有 GPS 定位城市时，始终作为第一页
    if (this._locatedGPS) {
      pages.push({
        id: '__located__',
        name: this._locatedGPS.district || this._locatedGPS.city || '',
        adm1: this._locatedGPS.province || '',
        adm2: this._locatedGPS.city || '',
        lat: this._locatedGPS.lat,
        lon: this._locatedGPS.lon,
        isLocated: true,
      });
    }

    cities.forEach(c => pages.push({ ...c, isLocated: false }));
    if (pages.length === 0) return;

    // 确定当前页：_currentIsLocated 优先；否则按 cityId 匹配收藏城市
    let currentPageIndex;
    if (this._currentIsLocated && pages.some(p => p.id === '__located__')) {
      currentPageIndex = pages.findIndex(p => p.id === '__located__');
    } else if (cityId && savedIds.has(cityId)) {
      currentPageIndex = pages.findIndex(p => p.id === cityId);
      if (currentPageIndex < 0) currentPageIndex = 0;
    } else {
      currentPageIndex = pages.findIndex(p => p.id === '__located__');
      if (currentPageIndex < 0) currentPageIndex = 0;
    }

    this.setData({ cityPages: pages, currentPageIndex });
  },

  // 切换到指定页（更新城市数据并重新拉取天气）
  switchToCity(index) {
    const { cityPages } = this.data;
    if (index < 0 || index >= cityPages.length) return;
    const c = cityPages[index];
    this._currentIsLocated = (c.id === '__located__');
    this.setData({
      currentPageIndex: index,
      latitude: c.lat,
      longitude: c.lon,
      city: c.adm2 || '',
      province: c.adm1 || '',
      district: c.name || c.adm2 || '',
      locationLabel: this._buildLocationLabel(c.name || c.adm2, c.adm2, c.adm1),
      cityId: c.id !== '__located__' ? c.id : (this._locatedCityId || ''),
      mapTipsVisible: false,
      mapTipsData: {},
      mapMarkers: [],
    });
    this.getWeather().catch(console.error);
  },

  // bottom-sheet 水平滑动事件
  onSheetSwipe(e) {
    const { direction } = e.detail;
    const { currentPageIndex } = this.data;
    if (direction === 'left') this.switchToCity(currentPageIndex + 1);
    else if (direction === 'right') this.switchToCity(currentPageIndex - 1);
  },

  // 点击圆点指示器
  onDotTap(e) {
    const index = e.currentTarget.dataset.index;
    this.switchToCity(Number(index));
  },

  // 城市概览面板
  onCitiesOverviewOpen() {
    this.setData({ citiesOverviewVisible: true });
  },
  onCitiesOverviewClose() {
    this.setData({ citiesOverviewVisible: false });
  },
  onCitiesOverviewSelect(e) {
    this.setData({ citiesOverviewVisible: false });
    this.switchToCity(e.detail.index);
  },
  onCitiesOverviewCompare() {
    this.setData({ citiesOverviewVisible: false });
    wx.navigateTo({ url: '/pages/compare/index' });
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
      mapTipsVisible: false,
      mapTipsData: {},
      mapMarkers: [],
    });
    this._buildCityPages();
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
    const tempStr = currentWeather && currentWeather.temp != null ? `${fmtTemp(currentWeather.temp, tempUnit)}°` : '';
    const text = currentWeather && currentWeather.text ? `${currentWeather.text} ${tempStr}` : '实时天气';
    return {
      title: `${locationLabel || '我的位置'}：${text}`,
      path: '/pages/index/index'
    };
  },
  onShareTimeline() {
    const { locationLabel, currentWeather, tempUnit } = this.data;
    const tempStr = currentWeather && currentWeather.temp != null ? `${fmtTemp(currentWeather.temp, tempUnit)}°` : '';
    return {
      title: `${locationLabel || '我的位置'} 天气 ${tempStr}`,
      query: ''
    };
  },
})
