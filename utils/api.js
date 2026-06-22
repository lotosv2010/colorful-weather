const cache = require('./cache');
const network = require('./network');
const config = require('./config.local');
const monitor = require('./monitor');

// 接口域名
const HOST = 'https://m97fbtc2ed.re.qweatherapi.com';
// 天气数据基地址
const BASE_URL = `${HOST}/v7`;
// GeoAPI 地址
const GEO_URL = `${HOST}/geo/v2`;
// 空气质量预报地址
const AIR_URL = `${HOST}/airquality/v1`;
// 天气预警地址
const ALERT_URL = `${HOST}/weatheralert/v1`;
// 太阳辐射地址
const SOLAR_URL = `${HOST}/solarradiation/v1`;
// 应用key
const KEY = config.qweatherKey;

// 缓存时长（毫秒）
const MIN = 60 * 1000;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const TTL = {
  NOW:        20 * MIN,   // 实时天气：20 分钟
  HOURLY:     30 * MIN,   // 逐小时预报：30 分钟
  DAILY:       1 * HOUR,  // 逐天预报：1 小时
  DAILY_30:    2 * HOUR,  // 30 天预报：2 小时
  INDICES:     6 * HOUR,  // 生活指数：6 小时
  AIR:        30 * MIN,   // 实时空气质量：30 分钟
  AIR_HOURLY: 30 * MIN,   // 空气质量小时预报：30 分钟
  AIR_DAILY:   8 * HOUR,  // 空气质量日预报：8 小时
  WARNING:     3 * MIN,   // 天气预警：3 分钟（紧急性强，缩短延迟）
  MINUTELY:    2 * MIN,   // 分钟级降水：2 分钟（数据本身仅覆盖未来 2h）
  ASTRONOMY:   2 * HOUR,  // 日出日落 / 月相：2 小时
  SOLAR:       6 * HOUR,  // 太阳辐射：6 小时
  TIDE:        8 * HOUR,  // 潮汐：8 小时
  STORM:      20 * MIN,   // 台风：20 分钟
  HISTORICAL:  7 * DAY,   // 历史数据：7 天（同一日期的过去数据不会变化）
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
  const _start = Date.now();
  const apiPath = url.replace(/^https?:\/\/[^/]+/, '');
  return new Promise((resolve, reject) => {
    const task = wx.request({
      url,
      data: reqData,
      header: {
        'content-type': 'application/json'
      },
      success(res) {
        monitor.recordApi(apiPath, Date.now() - _start, true);
        resolve(res.data);
      },
      fail(err) {
        console.log('请求数据失败');
        monitor.recordApi(apiPath, Date.now() - _start, false, err?.errMsg || '');
        reject(err);
      }
    });
    if (taskCollector) {
      taskCollector.push(task);
    }
  });
};

// 经纬度归一化：保留 2 位小数（约 1km 精度），消除调用方传入精度不一致导致的缓存 miss
// 同时用于 URL 路径中的 lat/lon 段（如 airquality / weatheralert）
const _round2 = (s) => {
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : s;
};
const _normalizeLocation = (loc) => {
  if (typeof loc !== 'string' || !loc.includes(',')) return loc;
  const [a, b] = loc.split(',');
  return `${_round2(a)},${_round2(b)}`;
};

// 生成缓存 key：URL 路径 + 去掉 key 字段后的排序参数
// - location 参数统一保留 2 位小数（避免不同调用方精度差异导致同一城市生成不同 key）
// - URL 路径末尾形如 .../{lat}/{lon} 的也做同样归一化（airquality / weatheralert）
const makeCacheKey = (url, data) => {
  let path = url.replace(/^https?:\/\/[^/]+/, '');
  path = path.replace(/\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)(?=\/?$)/, (_, a, b) => `/${_round2(a)}/${_round2(b)}`);
  const params = Object.keys(data)
    .filter(k => k !== 'key')
    .sort()
    .map(k => `${k}=${k === 'location' ? _normalizeLocation(data[k]) : data[k]}`)
    .join('&');
  return params ? `${path}?${params}` : path;
};

// 进行中的请求 Map：相同 cacheKey 在同一时刻只发一次请求，避免快速切城市/重复点刷新引发的请求风暴
const _pending = new Map();

// 带缓存的请求：
// - opts.force: true 时跳过有效缓存（仍可走 stale 降级）
// - 相同 key 同时段共享同一个 in-flight Promise（dedup）
// - 请求失败时回落到 stale 缓存（标记 _stale: true），并通知 network 进入离线态
const cachedRequest = (url, method, data, tc, ttl, opts = {}) => {
  const key = makeCacheKey(url, data);
  const force = !!opts.force;

  if (!force) {
    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit);
  }

  // in-flight dedup：同一 key 的非 force 请求合并，避免快速切城市/重复点刷新引发请求风暴
  // force 请求需要真正跳过缓存，不参与 dedup（防止强制刷新被静默吞掉）
  if (!force && _pending.has(key)) {
    return _pending.get(key);
  }

  const p = request(url, method, data, tc).then(res => {
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
  }).finally(() => {
    _pending.delete(key);
  });

  _pending.set(key, p);
  return p;
};

// 将 "lon,lat" 转为 airquality v1 URL 路径所需的 "lat/lon"
const toAirPath = (lonLat) => {
  const [lon, lat] = lonLat.split(',');
  return `${lat}/${lon}`;
};

module.exports = {
  now:        (data, tc, opts) => cachedRequest(`${BASE_URL}/weather/now`, 'GET', data, tc, TTL.NOW, opts),
  sevenDay:   (data, tc, opts) => cachedRequest(`${BASE_URL}/weather/7d`, 'GET', data, tc, TTL.DAILY, opts),
  indices:    (data, tc, opts) => cachedRequest(`${BASE_URL}/indices/1d`, 'GET', data, tc, TTL.INDICES, opts),
  indices3d:  (data, tc, opts) => cachedRequest(`${BASE_URL}/indices/3d`, 'GET', data, tc, TTL.INDICES, opts),
  hourly:     (data, tc, opts) => cachedRequest(`${BASE_URL}/weather/24h`, 'GET', data, tc, TTL.HOURLY, opts),
  minutely:   (data, tc, opts) => cachedRequest(`${BASE_URL}/minutely/5m`, 'GET', data, tc, TTL.MINUTELY, opts),
  stormList:  (data, tc, opts) => cachedRequest(`${BASE_URL}/tropical/storm-list`, 'GET', data, tc, TTL.STORM, opts),
  stormForecast: (data, tc, opts) => cachedRequest(`${BASE_URL}/tropical/storm-forecast`, 'GET', data, tc, TTL.STORM, opts),
  stormTrack: (data, tc, opts) => cachedRequest(`${BASE_URL}/tropical/storm-track`, 'GET', data, tc, TTL.STORM, opts),
  weather30d: (data, tc, opts) => cachedRequest(`${BASE_URL}/weather/30d`, 'GET', data, tc, TTL.DAILY_30, opts),
  air:        (location, tc, opts) => cachedRequest(`${AIR_URL}/current/${toAirPath(location)}`, 'GET', {}, tc, TTL.AIR, opts),
  airHourly:  (location, tc, opts) => cachedRequest(`${AIR_URL}/hourly/${toAirPath(location)}`, 'GET', { localTime: true }, tc, TTL.AIR_HOURLY, opts),
  airDaily:   (location, tc, opts) => cachedRequest(`${AIR_URL}/daily/${toAirPath(location)}`, 'GET', { localTime: true }, tc, TTL.AIR_DAILY, opts),
  warning:    (location, tc, opts) => cachedRequest(`${ALERT_URL}/current/${toAirPath(location)}`, 'GET', { localTime: true }, tc, TTL.WARNING, opts),
  sun:        (data, tc, opts) => cachedRequest(`${BASE_URL}/astronomy/sun`, 'GET', data, tc, TTL.ASTRONOMY, opts),
  moon:       (data, tc, opts) => cachedRequest(`${BASE_URL}/astronomy/moon`, 'GET', data, tc, TTL.ASTRONOMY, opts),
  tide:       (data, tc, opts) => cachedRequest(`${BASE_URL}/ocean/tide`, 'GET', data, tc, TTL.TIDE, opts),
  solarRadiation: (lat, lon, data = {}, tc, opts) => cachedRequest(`${SOLAR_URL}/forecast/${lat}/${lon}`, 'GET', { ...data, localTime: true }, tc, TTL.SOLAR, opts),
  // 历史天气再分析（最近 10 天，需 LocationID）
  historicalWeather: (data, tc, opts) => cachedRequest(`${BASE_URL}/historical/weather`, 'GET', data, tc, TTL.HISTORICAL, opts),
  // 历史空气质量（最近 10 天，需 LocationID）
  historicalAir:     (data, tc, opts) => cachedRequest(`${BASE_URL}/historical/air`, 'GET', data, tc, TTL.HISTORICAL, opts),
  // GeoAPI 数据版权禁止缓存，始终实时请求
  cityLookup: (data, tc) => request(`${GEO_URL}/city/lookup`, 'GET', data, tc),
  topCity:    (data = {}, tc) => request(`${GEO_URL}/city/top`, 'GET', data, tc),
  poiLookup:  (data, tc) => request(`${GEO_URL}/poi/lookup`, 'GET', data, tc),
};
