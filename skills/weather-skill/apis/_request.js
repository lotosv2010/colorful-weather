const config = require('../config.local');

const HOST = 'https://m97fbtc2ed.re.qweatherapi.com';
const KEY = config.qweatherKey;

// GET 请求，自动附加 key 参数
const get = (url, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      data: { ...data, key: KEY },
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
};

// GeoAPI 城市查询（不加 key 到 get，单独传）
const cityLookup = (location) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${HOST}/geo/v2/city/lookup`,
      method: 'GET',
      data: { location, key: KEY },
      success(res) {
        if (res.statusCode === 200 && res.data.code === '200' && res.data.location && res.data.location.length > 0) {
          const c = res.data.location[0];
          resolve({ id: c.id, name: c.name, adm2: c.adm2 || '', adm1: c.adm1 || '', lon: c.lon, lat: c.lat });
        } else if (res.data && res.data.code === '404') {
          reject(new Error(`找不到城市：${location}`));
        } else {
          reject(new Error(`GeoAPI 错误 code=${res.data.code}`));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || 'GeoAPI 请求失败'));
      }
    });
  });
};

// 解析 location 参数 → { id, name, adm2, lon, lat }
// 支持：不传（当前定位）、城市名、"lon,lat" 经纬度字符串
const resolveLocation = (location) => {
  return new Promise((resolve, reject) => {
    if (!location) {
      // 当前 GPS 定位 → 反查城市
      wx.getLocation({
        type: 'wgs84',
        success(pos) {
          const lon = pos.longitude.toFixed(2);
          const lat = pos.latitude.toFixed(2);
          cityLookup(`${lon},${lat}`)
            .then(city => resolve(city))
            .catch(() => resolve({ id: null, name: '当前位置', adm2: '', lon, lat }));
        },
        fail(err) {
          reject(new Error('定位失败：' + (err.errMsg || '')));
        }
      });
    } else if (/^-?[\d.]+,-?[\d.]+$/.test(location.trim())) {
      // 经纬度格式 "lon,lat"
      cityLookup(location.trim())
        .then(city => resolve(city))
        .catch(() => {
          const [lon, lat] = location.trim().split(',');
          resolve({ id: null, name: location, adm2: '', lon, lat });
        });
    } else {
      // 城市名
      cityLookup(location.trim())
        .then(city => resolve(city))
        .catch(err => reject(err));
    }
  });
};

// "lon,lat" → "lat/lon"（空气质量/预警接口使用路径参数格式）
const toAirPath = (lon, lat) => `${parseFloat(lat).toFixed(2)}/${parseFloat(lon).toFixed(2)}`;

module.exports = { HOST, get, resolveLocation, toAirPath };
