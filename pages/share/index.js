// pages/share/index.js
const { resolveThemeBg, resolveThemeBgColors } = require('../../utils/autoTheme');
const { convert } = require('../../utils/temp');
const prefs = require('../../utils/prefs');
const monitor = require('../../utils/monitor');

// 内联 emoji 映射（仅用于 Canvas 导出，WXML 预览已用 qi-*-fill 字体类）
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

Page({
  data: {
    themeColor: '#1296db',
    // 卡片数据（绑定到 WXML）
    city: '',
    province: '',
    subLabel: '',
    icon: '100',
    temp: '--',
    feelsLike: null,
    weatherText: '',
    humidity: null,
    windScale: null,
    aqiDisplay: '',
    aqiColor: '',
    cardBg: '',       // CSS linear-gradient 字符串，直接给 WXML style
    tempUnit: 'C',
    saving: false,
  },

  _canvas: null,   // 隐藏 Canvas 节点，仅用于导出
  _raw: null,      // 原始快照（供 Canvas 导出读取）

  onLoad() {
    this._loadStart = Date.now();
    const p = prefs.getPrefs();
    this.setData({ themeColor: p.themeColor || '#1296db', tempUnit: p.tempUnit || 'C' });
    this._raw = getApp().globalData.shareData || null;
    if (this._raw) this._applyData(this._raw);
  },

  onReady() {
    if (!this._raw) return;
    // 初始化隐藏 Canvas（不阻塞页面展示）
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
    const { tempUnit } = this.data;
    const dateLabel = this._buildDateLabel(d.dateStr, d.timeStr);
    const subLabel = [d.province, dateLabel].filter(Boolean).join('  ·  ');

    const cardBg = resolveThemeBg(d.icon, d.sunrise, d.sunset);

    this.setData({
      city: d.city || '未知城市',
      province: d.province || '',
      subLabel,
      icon: d.icon || '100',
      temp: d.temp,
      feelsLike: d.feelsLike != null ? d.feelsLike : null,
      weatherText: d.text || '',
      humidity: d.humidity,
      windScale: d.windScale,
      aqiDisplay: d.aqiDisplay || '',
      aqiColor: d.aqiColor || '',
      cardBg,
    });
  },

  // 初始化隐藏 Canvas（不影响页面展示速度）
  async _initCanvas() {
    const dpr = wx.getSystemInfoSync().pixelRatio;
    const W = 375, H = 560;
    const canvas = await new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#exportCanvas')
        .fields({ node: true })
        .exec((res) => {
          res && res[0] && res[0].node ? resolve(res[0].node) : reject(new Error('canvas not found'));
        });
    });
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    this._canvas = canvas;
    this._drawCanvas(ctx, W, H);
  },

  // Canvas 绘制（背景 + 文字 + emoji 图标）
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

    // 右上角光晕
    const glow = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.55);
    glow.addColorStop(0, this._hexToRgba(to, 0.4));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    // ── 小徽标（左上） ──
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.font = '500 13px -apple-system, sans-serif';
    ctx.fillText('霁色天气', 20, 36);
    ctx.textAlign = 'center';

    // ── 城市 ──
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 38px -apple-system, sans-serif';
    ctx.fillText(d.city || '未知城市', W / 2, 118);

    // ── 省份 + 日期 ──
    const sub = [d.province, this._buildDateLabel(d.dateStr, d.timeStr)].filter(Boolean).join('  ·  ');
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '400 14px -apple-system, sans-serif';
    ctx.fillText(sub, W / 2, 148);

    // ── 天气 emoji（Canvas 原生渲染，无需字体加载） ──
    ctx.font = '64px -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(weatherEmoji(d.icon), W / 2, 228);
    ctx.textBaseline = 'alphabetic';

    // ── 温度 ──
    const tempVal = d.temp != null ? convert(d.temp, tempUnit) : '--';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 68px -apple-system, sans-serif';
    ctx.fillText(`${tempVal}°`, W / 2, 326);

    // ── 天气文字 ──
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '400 20px -apple-system, sans-serif';
    ctx.fillText(d.text || '', W / 2, 362);

    // ── 体感温度 ──
    if (d.feelsLike != null) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '400 14px -apple-system, sans-serif';
      ctx.fillText(`体感 ${convert(d.feelsLike, tempUnit)}°`, W / 2, 388);
    }

    // ── 信息条 ──
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, 20, 414, W - 40, 62, 14);
    ctx.fill();

    const infoCols = [
      { label: 'AQI',  val: d.aqiDisplay ? `${d.aqiDisplay}` : '--', color: d.aqiColor },
      { label: '湿度', val: d.humidity != null ? `${d.humidity}%` : '--' },
      { label: '风力', val: d.windScale  ? `${d.windScale}级` : '--' },
    ];
    const colW = (W - 40) / 3;
    infoCols.forEach((col, i) => {
      const cx = 20 + colW * i + colW / 2;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '400 11px -apple-system, sans-serif';
      ctx.fillText(col.label, cx, 432);
      ctx.fillStyle = col.color || '#fff';
      ctx.font = '500 14px -apple-system, sans-serif';
      ctx.fillText(col.val, cx, 460);
    });

    // ── 分隔线 + 水印 ──
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(20, H - 46);
    ctx.lineTo(W - 20, H - 46);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.font = '400 11px -apple-system, sans-serif';
    ctx.fillText('霁色天气  ·  精准天气预报', W / 2, H - 22);
  },

  // ── 保存到相册 ──────────────────────────────────────────────
  async onSave() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      // 若 canvas 还未初始化（onReady 内异步），先等待一次重试
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
