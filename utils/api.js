// 接口地址
const BASE_URL = 'https://m97fbtc2ed.re.qweatherapi.com/v7';
// GeoAPI 地址
const GEO_URL = 'https://m97fbtc2ed.re.qweatherapi.com/geo/v2';
// 空气质量预报地址
const AIR_URL = 'https://m97fbtc2ed.re.qweatherapi.com/airquality/v1';
// 应用key
const KEY = '9f00952418204e51997981c77fc3192a';

/**
 * API 请求函数
 * @param {string} url 请求地址
 * @param {string} method 请求方式
 * @param {object} data 请求参数
 * @param {Array|null} taskCollector 可选，用于收集 wx.request task 以便外部取消
 */
const request = (url, method, data, taskCollector = null) => {
  // 展开新对象，避免修改调用方传入的原始对象
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
    // 若提供了 taskCollector，将 task 收集进去供外部 abort()
    if (taskCollector) {
      taskCollector.push(task);
    }
  });
}

// 将 "lon,lat" 转为 airquality v1 URL 路径所需的 "lat/lon"
const toAirPath = (lonLat) => {
  const [lon, lat] = lonLat.split(',');
  return `${lat}/${lon}`;
};

module.exports = {
  now: (data, tc) => request(`${BASE_URL}/weather/now`, 'GET', data, tc),
  sevenDay: (data, tc) => request(`${BASE_URL}/weather/7d`, 'GET', data, tc),
  indices: (data, tc) => request(`${BASE_URL}/indices/1d`, 'GET', data, tc),
  // 生活指数 3 天预报（和风免费版上限）
  indices3d: (data, tc) => request(`${BASE_URL}/indices/3d`, 'GET', data, tc),
  hourly: (data, tc) => request(`${BASE_URL}/weather/24h`, 'GET', data, tc),
  // 分钟级降水（未来2小时逐5分钟）
  minutely: (data, tc) => request(`${BASE_URL}/minutely/5m`, 'GET', data, tc),
  // 台风列表（当年西北太平洋）
  stormList: (data, tc) => request(`${BASE_URL}/tropical/storm-list`, 'GET', data, tc),
  // 台风预报路径
  stormForecast: (data, tc) => request(`${BASE_URL}/tropical/storm-forecast`, 'GET', data, tc),
  // 台风实况与历史路径
  stormTrack: (data, tc) => request(`${BASE_URL}/tropical/storm-track`, 'GET', data, tc),
  // 30天预报
  weather30d: (data, tc) => request(`${BASE_URL}/weather/30d`, 'GET', data, tc),
  // 空气质量实况（location 为 "lon,lat" 格式，内部转换为 URL 路径）
  air: (location, tc) => request(`${AIR_URL}/current/${toAirPath(location)}`, 'GET', {}, tc),
  // 城市搜索：location 支持中文/拼音/ID/经纬度
  cityLookup: (data, tc) => request(`${GEO_URL}/city/lookup`, 'GET', data, tc),
  // 热门城市（默认 range=cn）
  topCity: (data = {}, tc) => request(`${GEO_URL}/city/top`, 'GET', data, tc),
  // 天文：日出日落
  sun: (data, tc) => request(`${BASE_URL}/astronomy/sun`, 'GET', data, tc),
  // 天文：月升月落 + 月相
  moon: (data, tc) => request(`${BASE_URL}/astronomy/moon`, 'GET', data, tc),
  // 空气质量小时预报（location 为 "lon,lat" 格式，内部转换为 URL 路径）
  airHourly: (location, tc) => request(`${AIR_URL}/hourly/${toAirPath(location)}`, 'GET', {'localTime': true}, tc),
  // 空气质量每日预报
  airDaily: (location, tc) => request(`${AIR_URL}/daily/${toAirPath(location)}`, 'GET', {'localTime': true}, tc),
  // 天气预警（location 为 "lon,lat" 格式，内部转换为 URL 路径）
  warning: (location, tc) => request(`https://m97fbtc2ed.re.qweatherapi.com/weatheralert/v1/current/${toAirPath(location)}`, 'GET', {'localTime': true}, tc),
  // 潮汐（location 为 LocationID，date 为 yyyyMMdd）
  tide: (data, tc) => request(`${BASE_URL}/ocean/tide`, 'GET', data, tc),
  // POI 搜索（type: scenic | TSTA 等）
  poiLookup: (data, tc) => request(`${GEO_URL}/poi/lookup`, 'GET', data, tc),
  // 太阳辐射预报（lat/lon 为路径参数，hours 默认24，interval 默认60）
  solarRadiation: (lat, lon, data = {}, tc) => request(`https://m97fbtc2ed.re.qweatherapi.com/solarradiation/v1/forecast/${lat}/${lon}`, 'GET', { ...data, localTime: true }, tc),
}
