const { now, indices, hourly, sevenDay, air, sun, moon, warning, minutely, cityLookup, historicalWeather, solarElevationAngle } = require('../../utils/api');
const { pad, formatDate, buildLocationLabel } = require('../../utils/util');
const { getSolarTermCard } = require('../../utils/lunar');
const { formatHourly, formatDaily, formatAir, formatDateStr } = require('../../utils/weatherFormat');
const { calcTripAdvice } = require('../../utils/tripAdvice');
const prefs = require('../../utils/prefs');
const network = require('../../utils/network');
const { navigateTo } = require('../../utils/route');
const { resolveTheme, resolveThemeBg } = require('../../utils/autoTheme');
const { resolveWeatherEffect } = require('../../utils/weatherEffect');
const monitor = require('../../utils/monitor');
const { fmt: fmtTemp } = require('../../utils/temp');
const { buildSummary, buildShortDesc } = require('../../utils/summary');
const { getColor, getDefinition } = require('../../utils/lifeMeta');
const QQMapWX = require('../../libs/qqmap-wx-jssdk.min');
const campingBehavior = require('../../behaviors/campingBehavior');
const mapTipsBehavior = require('../../behaviors/mapTipsBehavior');
const cityPagesBehavior = require('../../behaviors/cityPagesBehavior');

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
  behaviors: [campingBehavior, mapTipsBehavior, cityPagesBehavior],
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
    loading: true,
    errorMsg: '',
    solarTermInfo: null,
    // mapTipsVisible / mapTipsData              → mapTipsBehavior
    // mapMarkers / mapCenterLat / mapCenterLon   → campingBehavior
    // campingLayerOn / campingMarkers / campingLoading → campingBehavior
    // cityPages / currentPageIndex / citiesOverviewVisible → cityPagesBehavior
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
    this._clearCampingLayer();
    this._clearWeatherPin();
    this.setData({ mapTipsVisible: false, mapTipsData: {} });
    this.init({ forceLocate: true, force: true });
  },
  onSettingsTap() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },
  onTripTap() {
    wx.navigateTo({ url: '/pages/trip/index' });
  },

  // camping / mapTips / cityPages 方法 → 已迁移至同名 Behavior
  onShareCardTap() {
    // 将当前天气快照存入 globalData，供 share 页读取
    const {
      currentWeather, city, province, district,
      air, tempUnit, themeColor, weatherBg,
      astronomySun, dateNow,
    } = this.data;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    // ── 出行建议评分（基于实时天气 + 今日预报 + 空气质量）──
    const daily0 = this.data.daily && this.data.daily[0];
    const advice = calcTripAdvice({ currentWeather, daily0, air });

    // ── 关键生活指数（旅游/穿衣/运动/感冒）──
    const KEY_IDX_TYPES = ['6', '3', '1', '9'];
    const shareIndices = KEY_IDX_TYPES
      .map(type => (this.data.indices || []).find(idx => idx.type === type))
      .filter(Boolean)
      .map(idx => ({
        type: idx.type,
        name: idx.name || (getDefinition(idx.type) || {}).name || '',
        category: idx.category,
        color: getColor(idx.type, idx.level, idx.category),
      }));

    getApp().globalData.shareData = {
      city: district || city || '',
      province: province || '',
      temp: currentWeather && currentWeather.temp,
      feelsLike: currentWeather && currentWeather.feelsLike,
      icon: currentWeather && currentWeather.icon,
      text: currentWeather && currentWeather.text,
      humidity: currentWeather && currentWeather.humidity,
      windDir: currentWeather && currentWeather.windDir,
      windScale: currentWeather && currentWeather.windScale,
      windSpeed: currentWeather && currentWeather.windSpeed,
      vis: currentWeather && currentWeather.vis,
      precip: currentWeather && currentWeather.precip,
      pressure: currentWeather && currentWeather.pressure,
      desc: this.data.desc || '',
      clothingTip: this.data.clothingTip ? { category: this.data.clothingTip.category } : null,
      aqiDisplay: air && air.aqiDisplay,
      aqiCategory: air && air.category,
      aqiColor: air && air.colorHex,
      aqiLevel: air && air.level ? parseInt(String(air.level), 10) : 1,
      advice,
      indices: shareIndices,
      tempUnit,
      themeColor,
      weatherBg,
      sunrise: astronomySun && astronomySun.sunrise,
      sunset: astronomySun && astronomySun.sunset,
      dateStr,
      timeStr: dateNow || '',
    };
    wx.navigateTo({ url: '/pages/share/index' });
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
    return buildLocationLabel(district, city, province);
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
    this._computeSolarTermInfo();
    this.init({ force });
  },
  // 同步计算节气/节日卡片数据（无网络依赖，onLoad 时调用一次）
  _computeSolarTermInfo() {
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      const info = getSolarTermCard(dateStr);
      this.setData({ solarTermInfo: info });
    } catch (e) {
      console.error('节气计算失败', e);
    }
  },
  onReady() {
    monitor.recordPageLoad('/pages/index/index', this._loadStart);
  },
  onShow() {
    // 从露营详情页返回：若用户在详情页切换了营地，高亮对应 marker 并移动地图
    const session = app.globalData.campingSession;
    if (session && session.selection && this.data.campingLayerOn) {
      const sel = session.selection;
      session.selection = null; // 消费一次，避免重复触发

      // 高亮选中营地的 callout（橙色），其余恢复绿色；同时移动地图中心到选中点
      const updatedMarkers = (this.data.campingMarkers || []).map((m, i) => {
        const poi = (this._campingPois || [])[i];
        const isSelected = poi && poi.title === sel.title;
        return { ...m, callout: { ...m.callout, bgColor: isSelected ? '#e67c00' : '#2a7b3e' } };
      });
      const pin = this._currentWeatherPin;
      this.setData({
        campingMarkers: updatedMarkers,
        mapMarkers: pin ? [...updatedMarkers, pin] : updatedMarkers,
        mapCenterLat: sel.lat,   // 直接驱动地图 latitude 绑定，无需 moveToLocation
        mapCenterLon: sel.lon,
      });
      return;
    }
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
      const today = formatDateStr(new Date());
      const tc = _pendingTasks; // 当前批次 taskCollector
      const { force = false } = opts;
      const reqOpts = force ? { force: true } : undefined;
      const cityId = this.data.cityId;
      const yesterdayStr = formatDateStr(new Date(Date.now() - 86400000));
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
      const airData = formatAir(airRes);

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
        hourly: formatHourly(hourlyData),
        daily: formatDaily(dailyData),
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
  // _buildCityPages / switchToCity / onSheetSwipe / onDotTap / onCitiesOverview* → cityPagesBehavior

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
    });
    this._clearCampingLayer();
    this._clearWeatherPin();
    this._buildCityPages();
    this.getWeather().catch(console.error);
  },
  gotoWarning() {
    const { longitude, latitude, province, district, city, cityId } = this.data;
    navigateTo('/pages/warning/index', { location: `${longitude},${latitude}`, province, city, district, cityId });
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
  onAstronomyTap() {
    const { longitude, latitude, city, province, district } = this.data;
    navigateTo('/pages/astronomy/index', { location: `${longitude},${latitude}`, province, city, district });
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
