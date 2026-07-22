// pages/share/index.js
const { resolveThemeBg, resolveThemeBgColors } = require('../../utils/autoTheme');
const { iconColor: getIconColor } = require('../../utils/iconColor');
const { convert } = require('../../utils/temp');
const prefs = require('../../utils/prefs');
const monitor = require('../../utils/monitor');

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

// Canvas 画布逻辑宽度（高度动态计算，见 _calcCanvasH）
const CANVAS_W = 375;

Page({
  data: {
    themeColor: '#1296db',
    // WXML 绑定字段
    city: '',
    province: '',
    dateLabel: '',   // 日期时间标签（顶栏右侧）
    icon: '100',
    temp: '--',
    feelsLike: null,
    weatherText: '',
    humidity: null,
    windDir: '',
    windScale: null,
    windSpeed: null,
    vis: null,
    precip: null,
    pressure: null,
    desc: '',
    clothingTip: null,
    aqiDisplay: '',
    aqiCategory: '',
    aqiColor: '',
    aqiLevel: 1,
    advice: null,
    indices: [],
    cardBg: '',
    tempUnit: 'C',
    saving: false,
  },

  _canvas: null,
  _raw: null,
  _qiFontLoaded: false,

  onLoad() {
    this._loadStart = Date.now();
    const p = prefs.getPrefs();
    this.setData({ themeColor: p.themeColor || '#1296db', tempUnit: p.tempUnit || 'C' });
    this._raw = getApp().globalData.shareData || null;
    if (this._raw) this._applyData(this._raw);
  },

  onReady() {
    if (!this._raw) return;
    this._initCanvas().catch(e => {
      console.warn('[share] canvas init failed', e?.message);
    });
    monitor.recordPageLoad('/pages/share/index', this._loadStart);
  },

  onUnload() {
    getApp().globalData.shareData = null;
  },

  // 把快照数据映射到 WXML 绑定字段
  _applyData(d) {
    const dateLabel = this._buildDateLabel(d.dateStr, d.timeStr);
    const cardBg = resolveThemeBg(d.icon, d.sunrise, d.sunset);

    this.setData({
      city:        d.city        || '未知城市',
      province:    d.province    || '',
      dateLabel,
      icon:        d.icon        || '100',
      temp:        d.temp,
      feelsLike:   d.feelsLike   != null ? d.feelsLike : null,
      weatherText: d.text        || '',
      humidity:    d.humidity,
      windDir:     d.windDir     || '',
      windScale:   d.windScale,
      windSpeed:   d.windSpeed   || null,
      vis:         d.vis         != null ? d.vis   : null,
      precip:      d.precip      != null ? d.precip : null,
      pressure:    d.pressure    != null ? d.pressure : null,
      desc:        d.desc        || '',
      clothingTip: d.clothingTip || null,
      aqiDisplay:  d.aqiDisplay  || '',
      aqiCategory: d.aqiCategory || '',
      aqiColor:    d.aqiColor    || '',
      aqiLevel:    d.aqiLevel    != null ? d.aqiLevel : 1,
      advice:      d.advice      || null,
      indices:     d.indices     || [],
      cardBg,
    });
  },

  // ── 加载 qweather 字体（Canvas 绘制天气图标）────────────────────────────────
  _loadQiFont() {
    return new Promise((resolve) => {
      wx.loadFontFace({
        family: 'qweather-icons',
        source: 'url("https://cdn.jsdelivr.net/npm/qweather-icons@1.8.0/font/fonts/qweather-icons.ttf")',
        scopes: ['webview', 'native'],
        success: () => { this._qiFontLoaded = true; resolve(); },
        fail: (err) => {
          console.warn('[share] loadFontFace failed:', err?.errMsg);
          resolve();
        },
      });
    });
  },

  // ── Canvas 高度：精确同步 _drawCanvas 布局参数，避免底部空白过多 ────────────
  _calcCanvasH(d) {
    if (!d) return 540;
    // 与 _drawCanvas 保持同步：nextY 起始 230，有 desc +22，有 clothing +32
    let nextY = 230;
    if (d.desc) nextY += 22;
    if (d.clothingTip) nextY += 32;
    const panelY = Math.max(nextY + 8, 248);
    const footerY = panelY + 252 + 14; // panelH=252
    let h = footerY + 40; // 分割线 + 水印文字 + 小缓冲

    if (d.advice) {
      const n = d.advice.tips ? d.advice.tips.length : 0;
      h += 14 + 16 + 52 + 8 + Math.max(n, 1) * 24 + 16; // gap+padTop+header+sep+tips+padBot
    }
    if (d.indices && d.indices.length) {
      h += 14 + 16 + 22 + 16 + Math.ceil(d.indices.length / 2) * 50 + 16;
    }
    if (d.aqiDisplay) {
      h += 14 + 16 + 22 + 16 + 64 + 16;
    }
    h += 20; // 底部安全距离
    return h;
  },

  // ── 初始化隐藏 Canvas ────────────────────────────────────────────────────────
  async _initCanvas() {
    const dpr = wx.getSystemInfoSync().pixelRatio;
    const W = CANVAS_W;
    const H = this._calcCanvasH(this._raw);

    // 并行：预加载字体 + 获取 Canvas 节点
    const [, canvas] = await Promise.all([
      this._loadQiFont(),
      new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          .in(this)
          .select('#exportCanvas')
          .fields({ node: true })
          .exec((res) => {
            res && res[0] && res[0].node
              ? resolve(res[0].node)
              : reject(new Error('canvas not found'));
          });
      }),
    ]);

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    this._canvas = canvas;
    this._drawCanvas(ctx, W, H);
  },

  // ── Canvas 绘制（375×640，布局仿 temp 组件）──────────────────────────────────
  _drawCanvas(ctx, W, H) {
    const d = this._raw;
    const { tempUnit } = this.data;

    // ── 背景渐变 ──
    const { from, to } = resolveThemeBgColors(d.icon, d.sunrise, d.sunset);
    const grad = ctx.createLinearGradient(0, H, W, 0);
    grad.addColorStop(0, from);
    grad.addColorStop(1, to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── 右上角光晕 ──
    const glow = ctx.createRadialGradient(W * 0.84, H * 0.06, 0, W * 0.84, H * 0.06, W * 0.52);
    glow.addColorStop(0, this._hexToRgba(to, 0.45));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ══ 顶栏：logo（左）+ 日期（右） ══
    ctx.font = '500 13px -apple-system, sans-serif';
    ctx.textBaseline = 'alphabetic';

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillText('霁色天气', 22, 30);

    const dateLabel = this._buildDateLabel(d.dateStr, d.timeStr);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(dateLabel, W - 22, 30);

    // ══ 城市标题 ══
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 38px -apple-system, sans-serif';
    ctx.fillText(d.city || '未知城市', W / 2, 78);

    if (d.province) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 13px -apple-system, sans-serif';
      ctx.fillText(d.province, W / 2, 98);
    }

    // ══ 主天气区（仿 weather-header-main）：图标（左）+ 温度+描述（右） ══
    // 图标：font icon，居中于 Y=162
    const iconRowCenterY = 162;
    ctx.textBaseline = 'middle';
    if (this._qiFontLoaded) {
      ctx.font = '72px "qweather-icons"';
      ctx.fillStyle = getIconColor(d.icon); // 按天气分类着色，与页面图标一致
      ctx.fillText(getIconChar(d.icon), W * 0.28, iconRowCenterY);
    } else {
      ctx.font = '64px -apple-system, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(weatherEmoji(d.icon), W * 0.28, iconRowCenterY);
    }
    ctx.textBaseline = 'alphabetic';

    // 温度值（右侧，大号）
    const tempVal = d.temp != null ? convert(d.temp, tempUnit) : '--';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px -apple-system, sans-serif';
    ctx.fillText(`${tempVal}°`, W * 0.52, 184);

    // 天气描述（温度下方）
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '400 18px -apple-system, sans-serif';
    ctx.fillText(d.text || '', W * 0.52, 208);

    ctx.textAlign = 'center';

    // ══ 天气概述 + 穿衣提示 ══
    let nextY = 230;  // 主区结束后的起始 Y（与 _calcCanvasH 同步）

    if (d.desc) {
      ctx.fillStyle = 'rgba(255,255,255,0.58)';
      ctx.font = '300 13px -apple-system, sans-serif';
      ctx.fillText(d.desc, W / 2, nextY);
      nextY += 22;
    }

    if (d.clothingTip) {
      const tipText = `穿衣 · ${d.clothingTip.category}`;
      ctx.font = '400 11px -apple-system, sans-serif';
      const tipW = ctx.measureText(tipText).width + 28;
      const tipH = 22, tipX = (W - tipW) / 2, tipY = nextY;
      // 胶囊背景
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, tipX, tipY, tipW, tipH, tipH / 2);
      ctx.fill();
      // 文字
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textBaseline = 'middle';
      ctx.fillText(tipText, W / 2, tipY + tipH / 2);
      ctx.textBaseline = 'alphabetic';
      nextY += tipH + 10;
    }

    // ══ 详情面板（仿 weather-header-other）═══════════════════════════════
    const panelX = 18, panelY = Math.max(nextY + 8, 248), panelW = W - 36, panelH = 252; // 与 _calcCanvasH 同步
    const windW = panelW * 0.30;    // 左：风向区宽度
    const gridX = panelX + windW;   // 右：数据格起始 X
    const gridW = panelW - windW;   // 右：数据格总宽
    const colW  = gridW / 2;        // 每格宽
    const rowH  = panelH / 3;       // 每行高

    // 面板背景
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    roundRect(ctx, panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, panelX, panelY, panelW, panelH, 14);
    ctx.stroke();

    // ── 左：风向 ──
    const windCX = panelX + windW / 2;
    const windMidY = panelY + panelH / 2;

    // qi-2150 风向符号
    ctx.textBaseline = 'middle';
    if (this._qiFontLoaded) {
      ctx.font = '32px "qweather-icons"';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(QI_WIND, windCX, windMidY - 36);
    }
    ctx.textBaseline = 'alphabetic';

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '500 13px -apple-system, sans-serif';
    ctx.fillText(d.windDir || '--', windCX, windMidY + 0);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 12px -apple-system, sans-serif';
    ctx.fillText(d.windScale != null ? `${d.windScale}级` : '--', windCX, windMidY + 18);

    if (d.windSpeed) {
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.font = '400 11px -apple-system, sans-serif';
      ctx.fillText(`${d.windSpeed}km/h`, windCX, windMidY + 34);
    }

    // ── 纵向分割线 ──
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(gridX, panelY + 18);
    ctx.lineTo(gridX, panelY + panelH - 18);
    ctx.stroke();

    // ── 右：3行×2列 数据格 ──
    const rows = [
      [
        { val: d.humidity != null ? `${d.humidity}%` : '--', label: '湿度' },
        { val: d.feelsLike != null ? `${convert(d.feelsLike, tempUnit)}°` : '--', label: '体感温度' },
      ],
      [
        { val: d.aqiDisplay || '--', label: 'AQI', color: d.aqiColor },
        { val: d.aqiCategory || '--', label: '空气质量', color: d.aqiColor },
      ],
      [
        { val: d.precip != null ? `${d.precip}mm` : '--', label: '降水量' },
        { val: d.vis    != null ? `${d.vis}km`    : '--', label: '能见度' },
      ],
    ];

    rows.forEach((cols, ri) => {
      const rowCenterY = panelY + rowH * ri + rowH / 2;

      // 横向分割线（行间）
      if (ri > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(gridX + 8, panelY + rowH * ri);
        ctx.lineTo(panelX + panelW - 4, panelY + rowH * ri);
        ctx.stroke();
      }

      cols.forEach((cell, ci) => {
        const cx = gridX + colW * ci + colW / 2;

        // 数值（上）
        ctx.textAlign = 'center';
        ctx.fillStyle = cell.color || 'rgba(255,255,255,0.92)';
        ctx.font = '600 15px -apple-system, sans-serif';
        ctx.fillText(cell.val, cx, rowCenterY - 2);

        // 标签（下）
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '400 11px -apple-system, sans-serif';
        ctx.fillText(cell.label, cx, rowCenterY + 16);
      });
    });

    // ══ 分隔线 + 水印（跟随面板底部动态定位）══
    const footerY = panelY + panelH + 14;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(20, footerY);
    ctx.lineTo(W - 20, footerY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.font = '400 11px -apple-system, sans-serif';
    ctx.fillText('霁色天气  ·  精准天气预报', W / 2, footerY + 22);

    // ══ 额外信息卡（出行建议 / 生活指数 / 空气质量）══
    let sectionY = footerY + 32;

    if (d.advice) {
      sectionY = this._drawAdviceCard(ctx, d.advice, sectionY, W);
      sectionY += 14;
    }
    if (d.indices && d.indices.length) {
      sectionY = this._drawIndicesCard(ctx, d.indices, sectionY, W);
      sectionY += 14;
    }
    if (d.aqiDisplay) {
      this._drawAqiCard(ctx, d, sectionY, W);
    }
  },

  // ── 出行建议卡绘制 ──────────────────────────────────────────────────────────
  _drawAdviceCard(ctx, advice, startY, W) {
    const cX = 18, cW = W - 36, pV = 16, pH = 16;
    const tipsN = advice.tips ? advice.tips.length : 0;
    const cardH = pV + 52 + 8 + Math.max(tipsN, 1) * 24 + pV;

    // 卡片背景
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, cX, startY, cW, cardH, 12);
    ctx.fill();

    // 顶部彩色线
    ctx.strokeStyle = advice.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cX + 12, startY + 1.5);
    ctx.lineTo(cX + cW - 12, startY + 1.5);
    ctx.stroke();

    // 头部：emoji + 标签 + 评分徽章
    const headerCY = startY + pV + 26; // header 垂直中点（header 高 52px）
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '26px -apple-system, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(advice.icon, cX + pH, headerCY);

    ctx.font = 'bold 17px -apple-system, sans-serif';
    ctx.fillStyle = advice.color;
    ctx.fillText(advice.label, cX + pH + 42, headerCY);

    // 评分徽章（右侧）
    ctx.font = 'bold 11px -apple-system, sans-serif';
    const scoreText = `${advice.score > 0 ? '+' : ''}${advice.score}分`;
    const badgeW = ctx.measureText(scoreText).width + 16;
    const badgeH = 20;
    const badgeX = cX + cW - pH - badgeW;
    ctx.fillStyle = this._hexToRgba(advice.color, 0.13);
    roundRect(ctx, badgeX, headerCY - badgeH / 2, badgeW, badgeH, 10);
    ctx.fill();
    ctx.fillStyle = advice.color;
    ctx.textAlign = 'center';
    ctx.fillText(scoreText, badgeX + badgeW / 2, headerCY);
    ctx.textBaseline = 'alphabetic';

    // 分割线
    const sepY = startY + pV + 52 + 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cX + 8, sepY);
    ctx.lineTo(cX + cW - 8, sepY);
    ctx.stroke();

    // tips 列表
    const tipsToShow = tipsN > 0 ? advice.tips : ['天气良好，一切顺利！'];
    tipsToShow.forEach((tip, i) => {
      const tipY = sepY + 20 + i * 24;
      ctx.textAlign = 'left';
      ctx.fillStyle = tipsN > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.22)';
      ctx.font = '400 14px -apple-system, sans-serif';
      ctx.fillText('·', cX + pH, tipY);
      ctx.fillStyle = tipsN > 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)';
      ctx.font = '400 12px -apple-system, sans-serif';
      ctx.fillText(tip, cX + pH + 16, tipY);
    });

    return startY + cardH;
  },

  // ── 生活指数卡绘制 ──────────────────────────────────────────────────────────
  _drawIndicesCard(ctx, indices, startY, W) {
    const cX = 18, cW = W - 36, pV = 16;
    const rows = Math.ceil(indices.length / 2);
    const cardH = pV + 22 + 16 + rows * 50 + pV;
    const colW = cW / 2;

    // 卡片背景
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, cX, startY, cW, cardH, 12);
    ctx.fill();

    // 标题
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '600 11px -apple-system, sans-serif';
    ctx.fillText('生活指数', cX + 16, startY + pV + 14);

    // 2×N 网格
    const gridY = startY + pV + 22 + 16;
    indices.forEach((idx, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cellX = cX + col * colW;
      const cellCY = gridY + row * 50 + 21;

      // 格子背景
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      roundRect(ctx, cellX + 4, cellCY - 17, colW - 8, 38, 7);
      ctx.fill();

      // 彩色圆点
      ctx.fillStyle = idx.color;
      ctx.beginPath();
      ctx.arc(cellX + 16, cellCY, 5, 0, Math.PI * 2);
      ctx.fill();

      // 指数名称（左）
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 12px -apple-system, sans-serif';
      ctx.fillText(idx.name, cellX + 28, cellCY);

      // 类别文字（右）
      ctx.textAlign = 'right';
      ctx.fillStyle = idx.color;
      ctx.font = '600 12px -apple-system, sans-serif';
      ctx.fillText(idx.category, cellX + colW - 12, cellCY);
    });

    ctx.textBaseline = 'alphabetic';
    return startY + cardH;
  },

  // ── 空气质量卡绘制 ──────────────────────────────────────────────────────────
  _drawAqiCard(ctx, d, startY, W) {
    const cX = 18, cW = W - 36, pV = 16;
    const cardH = pV + 22 + 16 + 64 + pV;

    // 卡片背景
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, cX, startY, cW, cardH, 12);
    ctx.fill();

    // 标题
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '600 11px -apple-system, sans-serif';
    ctx.fillText('空气质量', cX + 16, startY + pV + 14);

    const rowCY = startY + pV + 22 + 16 + 32;
    const badgeR = 28;
    const badgeCX = cX + 16 + badgeR;

    // AQI 圆形徽章
    ctx.fillStyle = d.aqiColor || '#9BB365';
    ctx.beginPath();
    ctx.arc(badgeCX, rowCY, badgeR, 0, Math.PI * 2);
    ctx.fill();

    // AQI 数值
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 17px -apple-system, sans-serif';
    ctx.fillText(String(d.aqiDisplay || ''), badgeCX, rowCY - 6);
    ctx.font = '600 9px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(17,17,17,0.7)';
    ctx.fillText('AQI', badgeCX, rowCY + 9);

    // 类别 + 描述
    const infoX = badgeCX + badgeR + 16;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = d.aqiColor || '#9BB365';
    ctx.font = 'bold 17px -apple-system, sans-serif';
    ctx.fillText(d.aqiCategory || '', infoX, rowCY - 2);

    const lvl = d.aqiLevel || 1;
    const aqiDesc = lvl <= 2 ? '空气清新，适合户外活动'
      : lvl == 3 ? '轻度污染，敏感人群减少外出'
      : '空气较差，建议佩戴口罩';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '400 11px -apple-system, sans-serif';
    ctx.fillText(aqiDesc, infoX, rowCY + 16);
  },

  // ── 保存到相册 ──────────────────────────────────────────────────────────────
  async onSave() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      if (!this._canvas) {
        await this._initCanvas();
      }
      const hasPermission = await this._requestAlbumPermission();
      if (!hasPermission) return;
      const tempFilePath = await this._exportCanvas();
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({ filePath: tempFilePath, success: resolve, fail: reject });
      });
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (err) {
      console.error('[share] save failed', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  _requestAlbumPermission() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.writePhotosAlbum']) return resolve(true);
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => resolve(true),
            fail: () => {
              wx.showModal({
                title: '需要相册权限',
                content: '请前往设置页开启相册写入权限',
                confirmText: '去设置',
                success: (m) => { if (m.confirm) wx.openSetting(); },
              });
              resolve(false);
            },
          });
        },
        fail: () => resolve(false),
      });
    });
  },

  _exportCanvas() {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: this._canvas,
        fileType: 'jpg',
        quality: 0.95,
        success: (res) => resolve(res.tempFilePath),
        fail: reject,
      });
    });
  },

  // 日期展示标签（dateStr: YYYY-MM-DD，timeStr: HH:mm）
  _buildDateLabel(dateStr, timeStr) {
    if (!dateStr) return timeStr || '';
    const [, m, d] = dateStr.split('-').map(Number);
    return `${m}月${d}日${timeStr ? '  ' + timeStr : ''}`;
  },

  // hex → rgba(r,g,b,a)
  _hexToRgba(hex, a) {
    if (!hex || hex.length < 7) return `rgba(0,0,0,${a})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  },
});
