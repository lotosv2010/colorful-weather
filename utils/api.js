// 接口地址
const BASE_URL = 'https://devapi.qweather.com/v7';
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

module.exports = {
  now: (data) => request(`${BASE_URL}/weather/now`, 'GET', data),
  sevenDay: (data) => request(`${BASE_URL}/weather/7d`, 'GET', data),
  indices: (data) => request(`${BASE_URL}/indices/1d`, 'GET', data),
  hourly: (data) => request(`${BASE_URL}/weather/24h`, 'GET', data),
  air: (data) => request(`${BASE_URL}/air/now`, 'GET', data),
}