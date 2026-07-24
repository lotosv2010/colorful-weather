const { pad } = require('../../utils/util');
const { getSolarTermCard } = require('../../utils/lunar');
const { calcTripAdvice } = require('../../utils/tripAdvice');
const prefs = require('../../utils/prefs');
const network = require('../../utils/network');
const { navigateTo } = require('../../utils/route');
const { resolveTheme, resolveThemeBg } = require('../../utils/autoTheme');
const { resolveWeatherEffect } = require('../../utils/weatherEffect');
const monitor = require('../../utils/monitor');
const { fmt: fmtTemp } = require('../../utils/temp');
const { getColor, getDefinition } = require('../../utils/lifeMeta');
const campingBehavior = require('../../behaviors/campingBehavior');
const mapTipsBehavior = require('../../behaviors/mapTipsBehavior');
const cityPagesBehavior = require('../../behaviors/cityPagesBehavior');
const locationBehavior = require('../../behaviors/locationBehavior');
const weatherFetchBehavior = require('../../behaviors/weatherFetchBehavior');

// index.js
// 获取应用实例
const app = getApp()

Page({
  behaviors: [campingBehavior, mapTipsBehavior, cityPagesBehavior, locationBehavior, weatherFetchBehavior],
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

  // ── 抽屉事件 ──────────────────────────────────────────────────────────────────
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

  // ── 工具栏按钮 ────────────────────────────────────────────────────────────────
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
  // init / getLocation / getNow / getCity / _resolveCityId / _buildLocationLabel → locationBehavior
  // getWeather / getIndices / _abortPending → weatherFetchBehavior

  // ── 分享 ──────────────────────────────────────────────────────────────────────
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
  onShareAppMessage() {
    const { locationLabel, currentWeather, tempUnit } = this.data;
    const tempStr = currentWeather && currentWeather.temp != null ? `${fmtTemp(currentWeather.temp, tempUnit)}°` : '';
    const text = currentWeather && currentWeather.text ? `${currentWeather.text} ${tempStr}` : '实时天气';
    // 优先使用 pages/share 生成的精美卡片，未生成时降级为兜底封面
    const imageUrl = app.globalData.sharePreviewPath || '/static/app.jpg';
    return {
      title: `${locationLabel || '我的位置'}：${text}`,
      path: '/pages/index/index',
      imageUrl
    };
  },
  onShareTimeline() {
    const { locationLabel, currentWeather, tempUnit } = this.data;
    const tempStr = currentWeather && currentWeather.temp != null ? `${fmtTemp(currentWeather.temp, tempUnit)}°` : '';
    const imageUrl = app.globalData.sharePreviewPath || '/static/app.jpg';
    return {
      title: `${locationLabel || '我的位置'} 天气 ${tempStr}`,
      query: '',
      imageUrl
    };
  },

  // ── 刷新与重试 ────────────────────────────────────────────────────────────────
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

  // ── 偏好同步 ──────────────────────────────────────────────────────────────────
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
    if (p.tempUnit !== this.data.tempUnit || themeColor !== this.data.themeColor || weatherBg !== this.data.weatherBg ||
        weatherEffect.particle !== this.data.weatherEffect.particle || weatherEffect.decor !== this.data.weatherEffect.decor) {
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

  // ── 生命周期 ──────────────────────────────────────────────────────────────────
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

  // ── 城市选择 ──────────────────────────────────────────────────────────────────
  showSelector() {
    this.setData({ selectorVisible: true });
  },
  hideSelector() {
    this.setData({ selectorVisible: false });
  },
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

  // ── 子页导航 ──────────────────────────────────────────────────────────────────
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
})
