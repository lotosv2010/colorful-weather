// 页面跳转路径构造：统一 location/province/city/district 拼接

/**
 * 构造查询字符串
 * @param {Object} params - 键值对，null/undefined 值会被跳过
 * @returns {string} 编码后的查询字符串（不含前导 ?）
 */
// location 值中的逗号是坐标分隔符，不应编码
const NO_ENCODE_KEYS = new Set(['location']);

const buildQuery = (params) => {
  return Object.keys(params)
    .filter(k => params[k] != null && params[k] !== '')
    .map(k => {
      const v = String(params[k]);
      return `${k}=${NO_ENCODE_KEYS.has(k) ? v : encodeURIComponent(v)}`;
    })
    .join('&');
};

/**
 * 构造页面路径（含 location 标准参数 + 额外参数）
 * @param {string} page - 页面路径，如 '/pages/air/index'
 * @param {Object} loc - { location, province, city, district }
 * @param {Object} [extra] - 额外参数，如 { hour: 3 }
 * @returns {string} 完整路径
 */
const buildPath = (page, loc, extra) => {
  const query = buildQuery({ ...loc, ...extra });
  return query ? `${page}?${query}` : page;
};

/**
 * 跳转到子页
 * @param {string} page - 页面路径
 * @param {Object} loc - { location, province, city, district }
 * @param {Object} [extra] - 额外参数
 */
const navigateTo = (page, loc, extra) => {
  wx.navigateTo({ url: buildPath(page, loc, extra) });
};

module.exports = { buildQuery, buildPath, navigateTo };
