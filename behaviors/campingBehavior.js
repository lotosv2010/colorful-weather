// behaviors/campingBehavior.js
// 露营图层管理：POI 搜索、marker 合并、图层开关。
// 与 mapTipsBehavior 共享 this：通过 this._handleMapClick() 触发 tips 显示。

module.exports = Behavior({
  data: {
    campingLayerOn: false,
    campingMarkers: [],
    campingLoading: false,
    mapMarkers: [],
    mapCenterLat: null,
    mapCenterLon: null,
  },

  methods: {
    // ── marker 管理助手 ─────────────────────────────────────────────────────────

    // 设置天气图钉，与露营 markers 合并写入 mapMarkers
    _setWeatherPin(pin) {
      this._currentWeatherPin = pin;
      this.setData({ mapMarkers: [...this.data.campingMarkers, pin] });
    },

    _clearWeatherPin() {
      this._currentWeatherPin = null;
      this.setData({ mapMarkers: [...this.data.campingMarkers] });
    },

    _clearCampingLayer() {
      this._campingPois = [];
      const app = getApp();
      app.globalData.campingSession = null;
      const pin = this._currentWeatherPin;
      this.setData({
        campingLayerOn: false,
        campingMarkers: [],
        mapMarkers: pin ? [pin] : [],
        mapCenterLat: null,
        mapCenterLon: null,
      });
    },

    // ── 露营图层开关 ──────────────────────────────────────────────────────────

    onCampingLayerTap() {
      if (this.data.campingLayerOn) {
        this._clearCampingLayer();
      } else {
        this.setData({ campingLayerOn: true, campingLoading: true });
        this._loadCampingPOI();
      }
    },

    // 搜索地图当前视窗内的露营地 POI，结果转成地图 markers
    async _loadCampingPOI() {
      const { latitude, longitude } = this.data;
      if (!latitude || !longitude) {
        this.setData({ campingLoading: false });
        wx.showToast({ title: '请先获取位置', icon: 'none' });
        return;
      }

      // ① 取视窗矩形 + 中心点
      let searchLat = Number(latitude);
      let searchLng = Number(longitude);
      let searchRadius = 50000;  // 降级：无法取视窗时用 50km
      let viewBounds = null;     // { swLat, swLng, neLat, neLng } 用于精确矩形过滤
      try {
        const mapCtx = wx.createMapContext('bgMap', this);
        const [region, center] = await Promise.all([
          new Promise((res, rej) => mapCtx.getRegion({ success: res, fail: rej })),
          new Promise((res, rej) => mapCtx.getCenterLocation({ success: res, fail: rej })),
        ]);
        const { northeast: ne, southwest: sw } = region;
        searchLat = center.latitude;
        searchLng = center.longitude;
        // 圆形搜索半径 = 视窗中心到最远角点的距离，保证矩形四角全部覆盖
        const latM = Math.abs(ne.latitude  - sw.latitude)  * 111000 / 2;
        const lngM = Math.abs(ne.longitude - sw.longitude) * 111000 * Math.cos(searchLat * Math.PI / 180) / 2;
        searchRadius = Math.round(Math.min(Math.sqrt(latM * latM + lngM * lngM), 50000));
        viewBounds = { swLat: sw.latitude, swLng: sw.longitude, neLat: ne.latitude, neLng: ne.longitude };
      } catch (_) {}

      // ② 分页拉取（page_size 取 SDK 上限 20，循环直到最后一页，最多 5 页）
      const PAGE_SIZE = 20;
      const MAX_PAGES = 5;
      let allPois = [];
      try {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const pagePois = await new Promise((resolve, reject) => {
            this.qqmapsdk.search({
              keyword: '露营',
              location: `${searchLat},${searchLng}`,
              distance: searchRadius,
              auto_extend: 0,
              page_size: PAGE_SIZE,
              page_index: page,
              success: (res, data) => resolve((data && data.searchSimplify) || []),
              fail: err => reject(err),
            });
          });
          allPois = allPois.concat(pagePois);
          if (pagePois.length < PAGE_SIZE) break;
        }
      } catch (_) {
        this.setData({ campingLoading: false });
        wx.showToast({ title: '营地搜索失败', icon: 'none' });
        return;
      }

      // ③ 精确裁剪：只保留落在视窗矩形内的点
      if (viewBounds) {
        allPois = allPois.filter(poi =>
          poi.latitude  >= viewBounds.swLat && poi.latitude  <= viewBounds.neLat &&
          poi.longitude >= viewBounds.swLng && poi.longitude <= viewBounds.neLng
        );
      }

      this._campingPois = allPois;
      if (!allPois.length) {
        this.setData({ campingLoading: false });
        wx.showToast({ title: '当前视图内未找到露营地', icon: 'none' });
        return;
      }

      // ④ 全量转 markers
      const campingMarkers = allPois.map((poi, i) => ({
        id: 1001 + i,
        latitude: poi.latitude,
        longitude: poi.longitude,
        width: 28,
        height: 36,
        anchor: { x: 0.5, y: 1 },
        callout: {
          content: poi.title || '营地',
          color: '#ffffff',
          fontSize: 11,
          borderWidth: 0,
          borderRadius: 6,
          bgColor: '#2a7b3e',
          padding: 5,
          display: 'ALWAYS',
        },
      }));

      // 存入 campingSession：详情页直接读取，保证 POI 一一对应
      const app = getApp();
      app.globalData.campingSession = {
        poiList: allPois.map(poi => ({
          title: poi.title || '营地',
          address: poi.address || poi.district || '',
          lat: poi.latitude,
          lon: poi.longitude,
        })),
        selection: null,
      };

      this._clearWeatherPin();
      const pins = this._currentWeatherPin ? [...campingMarkers, this._currentWeatherPin] : campingMarkers;
      this.setData({ campingMarkers, campingLoading: false, mapMarkers: pins });
      wx.showToast({ title: `已标注 ${allPois.length} 处营地`, icon: 'none', duration: 1500 });
    },

    // 地图 marker 点击事件（区分营地 marker vs 天气图钉）
    onMarkerTap(e) {
      const { markerId } = e.detail;
      if (markerId >= 1001) {
        // 营地 marker
        const idx = markerId - 1001;
        const pois = this._campingPois || [];
        const poi = pois[idx];
        if (!poi) return;
        this._handleMapClick(poi.longitude, poi.latitude, poi.title, true);
      }
      // id=1 的天气图钉不需要额外处理，onMapTipsTap 已覆盖
    },
  },
});
