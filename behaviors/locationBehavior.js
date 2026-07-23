// behaviors/locationBehavior.js
// 定位与城市解析：wx.getLocation、逆地理编码、cityId 解析、init 入口。
// 依赖主页 data 中的 latitude/longitude/cityId，以及 getWeather()（weatherFetchBehavior）。

const QQMapWX = require('../libs/qqmap-wx-jssdk.min');
const { cityLookup } = require('../utils/api');
const { buildLocationLabel } = require('../utils/util');
const prefs = require('../utils/prefs');
const monitor = require('../utils/monitor');

module.exports = Behavior({
  methods: {
    // 初始化入口：优先 AI Handoff 城市 → 默认城市 → GPS 定位
    async init(opts = {}) {
      if (this._fetching || this._initing) return;
      this._initing = true;
      const { forceLocate = false, force = false } = opts;
      const app = getApp();
      try {
        this.qqmapsdk = new QQMapWX({ key: app.globalData.lbs.key });

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

    // wx.getLocation 封装（gcj02 坐标系）
    async getLocation() {
      const { latitude, longitude } = await wx.getLocation({ type: 'gcj02' });
      this.setData({ latitude, longitude });
    },

    // GPS 坐标 → 城市名 → 触发天气请求
    async getNow(opts = {}) {
      try {
        const { longitude, latitude } = this.data;
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

    // GeoAPI 解析城市 ID（坐标精度限两位小数）
    async _resolveCityId(location) {
      try {
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

    // 逆地理编码：坐标 → 城市/省/区
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
          fail(error) {
            reject(error);
            console.error(error);
          },
        });
      });
    },

    // 格式化显示用地名（区/市/省）
    _buildLocationLabel(district, city, province) {
      return buildLocationLabel(district, city, province);
    },
  },
});
