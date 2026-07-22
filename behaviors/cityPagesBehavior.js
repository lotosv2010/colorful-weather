// behaviors/cityPagesBehavior.js
// 多城市横划页管理：城市页列表构建、切换、滑动事件、概览面板。
// 依赖主页的 data.cityId / data.latitude / data.longitude 等及 getWeather() 方法。

const prefs = require('../utils/prefs');

module.exports = Behavior({
  data: {
    cityPages: [],
    currentPageIndex: 0,
    citiesOverviewVisible: false,
  },

  methods: {
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
      });
      this._clearCampingLayer();
      this._clearWeatherPin();
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
  },
});
