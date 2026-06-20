// 分享辅助：构造小程序卡片分享 / 朋友圈分享
// 每页可调用 build('/pages/x/index', { location, province, city, district }, '标题')
const buildPath = (page, params = {}) => {
  const q = Object.keys(params)
    .filter(k => params[k] != null && params[k] !== '')
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  return q ? `${page}?${q}` : page;
};

const card = (page, params, title) => ({
  title,
  path: buildPath(page, params)
});

const timeline = (page, params, title) => ({
  title,
  query: buildPath(page, params).split('?')[1] || ''
});

module.exports = { buildPath, card, timeline };
