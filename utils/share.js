// 分享辅助：构造小程序卡片分享 / 朋友圈分享
// 每页可调用 build('/pages/x/index', { location, province, city, district }, '标题')

// 兜底分享封面图：避免微信截到骨架屏/加载态导致缩略图呈灰色
const SHARE_IMAGE = '/static/app.jpg';

const buildPath = (page, params = {}) => {
  const q = Object.keys(params)
    .filter(k => params[k] != null && params[k] !== '')
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  return q ? `${page}?${q}` : page;
};

const card = (page, params, title) => ({
  title,
  path: buildPath(page, params),
  imageUrl: SHARE_IMAGE
});

const timeline = (page, params, title) => ({
  title,
  query: buildPath(page, params).split('?')[1] || '',
  imageUrl: SHARE_IMAGE
});

module.exports = { buildPath, card, timeline };
