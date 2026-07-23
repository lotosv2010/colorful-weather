// utils/shareCard.js
// 分享卡片绘制辅助：纯函数与常量，与 pages/share/index.js 的 Canvas 绘制逻辑解耦。

// ── QWeather fill 图标 code → Unicode 字符 ──────────────────────────────────
// 摘自 static/qweather-icons.wxss 的 -fill 条目；台风码使用线框版
const QI_FILL = {
  100: '\uf1cc',
  101: '\uf1cd',
  102: '\uf1ce',
  103: '\uf1cf',
  104: '\uf1d0',
  150: '\uf1d1',
  151: '\uf1d2',
  152: '\uf1d3',
  153: '\uf1d4',
  300: '\uf1d5',
  301: '\uf1d6',
  302: '\uf1d7',
  303: '\uf1d8',
  304: '\uf1d9',
  305: '\uf1da',
  306: '\uf1db',
  307: '\uf1dc',
  308: '\uf1dd',
  309: '\uf1de',
  310: '\uf1df',
  311: '\uf1e0',
  312: '\uf1e1',
  313: '\uf1e2',
  314: '\uf1e3',
  315: '\uf1e4',
  316: '\uf1e5',
  317: '\uf1e6',
  318: '\uf1e7',
  350: '\uf1e8',
  351: '\uf1e9',
  399: '\uf1ea',
  400: '\uf1eb',
  401: '\uf1ec',
  402: '\uf1ed',
  403: '\uf1ee',
  404: '\uf1ef',
  405: '\uf1f0',
  406: '\uf1f1',
  407: '\uf1f2',
  408: '\uf1f3',
  409: '\uf1f4',
  410: '\uf1f5',
  456: '\uf1f6',
  457: '\uf1f7',
  499: '\uf1f8',
  500: '\uf1f9',
  501: '\uf1fa',
  502: '\uf1fb',
  503: '\uf1fc',
  504: '\uf1fd',
  507: '\uf1fe',
  508: '\uf1ff',
  509: '\uf200',
  510: '\uf201',
  511: '\uf202',
  512: '\uf203',
  513: '\uf204',
  514: '\uf205',
  515: '\uf206',
  900: '\uf207',
  901: '\uf208',
  999: '\uf209',
  800: '\uf13c',
  801: '\uf13d',
  802: '\uf13e',
  803: '\uf13f',
  804: '\uf140',
  805: '\uf141',
  806: '\uf142',
  807: '\uf143'
};

const QI_WIND = '\uf246';  // qi-2150 风向符号

// Canvas 画布逻辑宽度（高度由页面 _calcCanvasH 动态计算）
const CANVAS_W = 375;

const getIconChar = (code) => {
  const c = parseInt(String(code), 10);
  return QI_FILL[c] || '\uf209'; // 999-fill = unknown
};

// emoji 降级（字体加载失败时使用）
const weatherEmoji = (code) => {
  const c = parseInt(String(code), 10);
  if (c === 100) return '☀️';
  if (c === 150 || c === 151) return '🌙';
  if (c <= 103 || c === 152 || c === 153) return '🌤️';
  if (c === 104 || c === 154) return '☁️';
  if (c === 302 || c === 303 || c === 304) return '⛈️';
  if (c >= 300 && c <= 399) return '🌧️';
  if (c >= 400 && c <= 499) return '❄️';
  if (c >= 500 && c <= 515) return '🌫️';
  if (c >= 800 && c <= 807) return '🌀';
  if (c === 900) return '🔥';
  if (c === 901) return '🥶';
  return '🌡️';
};

// 圆角矩形路径（Canvas 2D 兼容写法）
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

module.exports = { QI_FILL, QI_WIND, CANVAS_W, getIconChar, weatherEmoji, roundRect };
