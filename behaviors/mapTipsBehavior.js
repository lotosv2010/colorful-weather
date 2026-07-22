// behaviors/mapTipsBehavior.js
// 地图点击 → 格点天气 tips 显示逻辑。
// 依赖 campingBehavior 提供的 _setWeatherPin / _clearWeatherPin。
// 依赖主页 getCity() 方法与 data.latitude/longitude/city/province/district。

const { gridNow } = require('../utils/api');
const { iconColor } = require('../utils/iconColor');
const { navigateTo } = require('../utils/route');

module.exports = Behavior({
  data: {
    mapTipsVisible: false,
    mapTipsData: {},
  },

  methods: {
    async onMapTap(e) {
      const { longitude, latitude } = e.detail;
      if (this._mapLoading || longitude == null || latitude == null) return;
      await this._handleMapClick(longitude, latitude);
    },

    async onMapPoiTap(e) {
      const { longitude, latitude } = e.detail;
      // bindpoitap detail 带有 POI 名称（name 或 pointOfInterest），直接取用
      const poiName = e.detail.name || e.detail.pointOfInterest || '';
      if (this._mapLoading || longitude == null || latitude == null) return;
      await this._handleMapClick(longitude, latitude, poiName);
    },

    async _handleMapClick(longitude, latitude, poiName = '', isCamping = false) {
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
      await this._fetchMapTips(longitude, latitude, tapX, tapY, poiName, isCamping);
    },

    async _fetchMapTips(longitude, latitude, x, y, poiName = '', isCamping = false) {
      this._mapLoading = true;
      this.setData({ mapTipsVisible: false, mapTipsData: {} });
      this._setWeatherPin({
        id: 1,
        latitude: Number(latitude),
        longitude: Number(longitude),
        width: 24,
        height: 32,
        anchor: { x: 0.5, y: 1 },
        callout: {},
      });
      try {
        const qqLocation = `${latitude},${longitude}`;
        const qwLocation = `${Number(longitude).toFixed(2)},${Number(latitude).toFixed(2)}`;
        const [cityInfo, weatherRes] = await Promise.all([
          this.getCity(qqLocation),
          // 地图坐标点击使用格点实时天气，精度 3-5km，避免漂移到最近城市站点。
          gridNow({ location: qwLocation }),
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
            poiName,
            locationLabel,
            icon: nw.icon || '100',
            iconColor: iconColor(nw.icon || '100'),
            temp,
            text: nw.text || '',
            tipX,
            tipY,
            isCamping,
            campingName: isCamping ? (poiName || '') : '',
          },
        });
      } catch (error) {
        console.error(error);
        this._clearWeatherPin();
        this.setData({ mapTipsVisible: false });
        wx.showToast({ title: '城市解析失败', icon: 'none' });
      } finally {
        this._mapLoading = false;
      }
    },

    onMapTipsTap() {
      const d = this.data.mapTipsData;
      if (!d || !d.latitude) return;
      // 露营 marker 模式：跳转到露营详情页
      if (d.isCamping) {
        this._clearWeatherPin();
        this.setData({ mapTipsVisible: false, mapTipsData: {} });
        navigateTo('/pages/camping/index', {
          location: `${this.data.longitude},${this.data.latitude}`,
          n: this.data.city || '',
          p: this.data.province || '',
          d: this.data.district || '',
          pn: d.campingName || '',
        });
        return;
      }
      // 普通地图点击：用 tips 中暂存的坐标和城市信息更新主数据，再全量查询
      this._clearWeatherPin();
      this.setData({
        mapTipsVisible: false,
        mapTipsData: {},
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
      this._clearWeatherPin();
      this.setData({ mapTipsVisible: false, mapTipsData: {} });
    },
  },
});
