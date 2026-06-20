const cache = require('./cache');
const network = require('./network');
const config = require('./config.local');

// 接口地址
const BASE_URL = 'https://m97fbtc2ed.re.qweatherapi.com/v7';
// GeoAPI 地址
const GEO_URL = 'https://m97fbtc2ed.re.qweatherapi.com/geo/v2';
// 空气质量预报地址
const AIR_URL = 'https://m97fbtc2ed.re.qweatherapi.com/airquality/v1';
// 应用key
const KEY = config.qweatherKey;

// 缓存时长（毫秒）
const MIN = 60 * 1000;
const HOUR = 3600 * 1000;
const TTL = {
  NOW:        20 * MIN,   // 实时天气：20 分钟
  HOURLY:     30 * MIN,   // 逐小时预报：30 分钟
  DAILY:       1 * HOUR,  // 逐天预报：1 小时
  DAILY_30:    2 * HOUR,  // 30 天预报：2 小时
  INDICES:     6 * HOUR,  // 生活指数：6 小时
  AIR:        30 * MIN,   // 实时空气质量：30 分钟
  AIR_HOURLY: 30 * MIN,   // 空气质量小时预报：30 分钟
  AIR_DAILY:   8 * HOUR,  // 空气质量日预报：8 小时
  WARNING:    10 * MIN,   // 天气预警：10 分钟
  MINUTELY:    5 * MIN,   // 分钟级降水：5 分钟
  ASTRONOMY:   2 * HOUR,  // 日出日落 / 月相：2 小时
  SOLAR:       6 * HOUR,  // 太阳辐射：6 小时
  TIDE:        8 * HOUR,  // 潮汐：8 小时
  STORM:      20 * MIN,   // 台风：20 分钟
};

/**
 * API 请求函数
 * @param {string} url 请求地址
 * @param {string} method 请求方式
 * @param {object} data 请求参数
 * @param {Array|null} taskCollector 可选，用于收集 wx.request task 以便外部取消
 */
const request = (url, method, data, taskCollector = null) => {
  const reqData = { ...data, key: KEY };
  return new Promise((resolve, reject) => {
    const task = wx.request({
      url,
      data: reqData,
      header: {
        'content-type': 'application/json'
      },
      success(res) {
        resolve(res.data);
      },
      fail(err) {
        console.log('请求数据失败');
        reject(err);
      }
    });
    if (taskCollector) {
      taskCollector.push(task);
    }
  });
};

// 生成缓存 key：URL 路径 + 去掉 key 字段后的排序参数
const makeCacheKey = (url, data) => {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  const params = Object.keys(data)
    .filter(k => k !== 'key')
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join('&');
  return params ? `${path}?${params}` : path;
};

// 带缓存的请求：命中直接返回，未命中则发起请求并在成功时写缓存
// 请求失败时回落到 stale 缓存（标记 _stale: true），并通知 network 进入离线态
const cachedRequest = (url, method, data, tc, ttl) => {
  const key = makeCacheKey(url, data);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return request(url, method, data, tc).then(res => {
    // code 为 '200' 或无 code 字段（air / warning 等）时缓存
    if (res && (res.code == null || res.code === '200')) {
      cache.set(key, res, ttl);
    }
    return res;
  }, err => {
    const stale = cache.getStale(key);
    if (stale) {
      network.markOffline();
      console.log(`[cache stale] ${key}（离线降级）`);
      return { ...stale, _stale: true };
    }
    throw err;
  });
};

// 将 "lon,lat" 转为 airquality v1 URL 路径所需的 "lat/lon"
const toAirPath = (lonLat) => {
  const [lon, lat] = lonLat.split(',');
  return `${lat}/${lon}`;
};

module.exports = {
  now:        (data, tc) => cachedRequest(`${BASE_URL}/weather/now`, 'GET', data, tc, TTL.NOW),
  sevenDay:   (data, tc) => cachedRequest(`${BASE_URL}/weather/7d`, 'GET', data, tc, TTL.DAILY),
  indices:    (data, tc) => cachedRequest(`${BASE_URL}/indices/1d`, 'GET', data, tc, TTL.INDICES),
  indices3d:  (data, tc) => cachedRequest(`${BASE_URL}/indices/3d`, 'GET', data, tc, TTL.INDICES),
  hourly:     (data, tc) => cachedRequest(`${BASE_URL}/weather/24h`, 'GET', data, tc, TTL.HOURLY),
  minutely:   (data, tc) => cachedRequest(`${BASE_URL}/minutely/5m`, 'GET', data, tc, TTL.MINUTELY),
  stormList:  (data, tc) => cachedRequest(`${BASE_URL}/tropical/storm-list`, 'GET', data, tc, TTL.STORM),
  stormForecast: (data, tc) => cachedRequest(`${BASE_URL}/tropical/storm-forecast`, 'GET', data, tc, TTL.STORM),
  stormTrack: (data, tc) => cachedRequest(`${BASE_URL}/tropical/storm-track`, 'GET', data, tc, TTL.STORM),
  weather30d: (data, tc) => cachedRequest(`${BASE_URL}/weather/30d`, 'GET', data, tc, TTL.DAILY_30),
  air:        (location, tc) => cachedRequest(`${AIR_URL}/current/${toAirPath(location)}`, 'GET', {}, tc, TTL.AIR),
  airHourly:  (location, tc) => cachedRequest(`${AIR_URL}/hourly/${toAirPath(location)}`, 'GET', { localTime: true }, tc, TTL.AIR_HOURLY),
  airDaily:   (location, tc) => cachedRequest(`${AIR_URL}/daily/${toAirPath(location)}`, 'GET', { localTime: true }, tc, TTL.AIR_DAILY),
  warning:    (location, tc) => cachedRequest(`https://m97fbtc2ed.re.qweatherapi.com/weatheralert/v1/current/${toAirPath(location)}`, 'GET', { localTime: true }, tc, TTL.WARNING),
  sun:        (data, tc) => cachedRequest(`${BASE_URL}/astronomy/sun`, 'GET', data, tc, TTL.ASTRONOMY),
  moon:       (data, tc) => cachedRequest(`${BASE_URL}/astronomy/moon`, 'GET', data, tc, TTL.ASTRONOMY),
  tide:       (data, tc) => cachedRequest(`${BASE_URL}/ocean/tide`, 'GET', data, tc, TTL.TIDE),
  solarRadiation: (lat, lon, data = {}, tc) => cachedRequest(`https://m97fbtc2ed.re.qweatherapi.com/solarradiation/v1/forecast/${lat}/${lon}`, 'GET', { ...data, localTime: true }, tc, TTL.SOLAR),
  // GeoAPI 数据版权禁止缓存，始终实时请求
  cityLookup: (data, tc) => request(`${GEO_URL}/city/lookup`, 'GET', data, tc),
  topCity:    (data = {}, tc) => request(`${GEO_URL}/city/top`, 'GET', data, tc),
  poiLookup:  (data, tc) => request(`${GEO_URL}/poi/lookup`, 'GET', data, tc),
};
