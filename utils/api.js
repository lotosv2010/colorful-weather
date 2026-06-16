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
 */
const request = (url, method, data) => {
  data.key = KEY;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      data,
      header: {
        'content-type': 'application/json'
      },
      success(res) {
        const { data } = res;
        resolve(data);
      },
      fail(err) {
        console.log('请求数据失败');
        reject(err);
      }
    })
  });
}

// 将 "lon,lat" 转为 airquality v1 URL 路径所需的 "lat/lon"
const toAirPath = (lonLat) => {
  const [lon, lat] = lonLat.split(',');
  return `${lat}/${lon}`;
};

module.exports = {
  now: (data) => request(`${BASE_URL}/weather/now`, 'GET', data),
  sevenDay: (data) => request(`${BASE_URL}/weather/7d`, 'GET', data),
  indices: (data) => request(`${BASE_URL}/indices/1d`, 'GET', data),
  // 生活指数 3 天预报（和风免费版上限）
  indices3d: (data) => request(`${BASE_URL}/indices/3d`, 'GET', data),
  hourly: (data) => request(`${BASE_URL}/weather/24h`, 'GET', data),
  // 空气质量实况（location 为 "lon,lat" 格式，内部转换为 URL 路径）
  air: (location) => request(`${AIR_URL}/current/${toAirPath(location)}`, 'GET', {}),
  // 城市搜索：location 支持中文/拼音/ID/经纬度
  cityLookup: (data) => request(`${GEO_URL}/city/lookup`, 'GET', data),
  // 热门城市（默认 range=cn）
  topCity: (data = {}) => request(`${GEO_URL}/city/top`, 'GET', data),
  // 天文：日出日落
  sun: (data) => request(`${BASE_URL}/astronomy/sun`, 'GET', data),
  // 天文：月升月落 + 月相
  moon: (data) => request(`${BASE_URL}/astronomy/moon`, 'GET', data),
  // 空气质量小时预报（location 为 "lon,lat" 格式，内部转换为 URL 路径）
  airHourly: (location) => request(`${AIR_URL}/hourly/${toAirPath(location)}`, 'GET', {}),
  // 空气质量每日预报
  airDaily: (location) => request(`${AIR_URL}/daily/${toAirPath(location)}`, 'GET', {}),
  // 天气预警（location 为 "lon,lat" 格式，内部转换为 URL 路径）
  warning: (location) => request(`https://m97fbtc2ed.re.qweatherapi.com/weatheralert/v1/current/${toAirPath(location)}`, 'GET', {}),
}
