// pages/share/index.js
const { resolveThemeBg } = require('../../utils/autoTheme');
const prefs = require('../../utils/prefs');
const monitor = require('../../utils/monitor');
const { CANVAS_W, calcCanvasH, drawShareCard } = require('../../utils/shareCard');
const { buildDateLabel } = require('../../utils/date');

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
    desc: '',
    clothingTip: null,
    aqiDisplay: '',
    aqiCategory: '',
    aqiColor: '',
    aqiLevel: 1,
    advice: null,
    indices: [],
    cardBg: '',
    canvasH: 540,   // 隐藏 Canvas 高度（由 calcCanvasH 动态计算后更新）
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
    const dateLabel = buildDateLabel(d.dateStr, d.timeStr);
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
      vis:         d.vis    != null ? d.vis    : null,
      precip:      d.precip != null ? d.precip : null,
      desc:        d.desc        || '',
      clothingTip: d.clothingTip || null,
      aqiDisplay:  d.aqiDisplay  || '',
      aqiCategory: d.aqiCategory || '',
      aqiColor:    d.aqiColor    || '',
      aqiLevel:    d.aqiLevel    != null ? d.aqiLevel : 1,
      advice:      d.advice      || null,
      indices:     d.indices     || [],
      cardBg,
      canvasH:     calcCanvasH(d),
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

  // ── 初始化隐藏 Canvas ────────────────────────────────────────────────────────
  async _initCanvas() {
    const dpr = wx.getSystemInfoSync().pixelRatio;
    const W = CANVAS_W;
    const H = calcCanvasH(this._raw);

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
    drawShareCard(ctx, W, H, this._raw, this.data.tempUnit, this._qiFontLoaded);

    // 静默导出临时路径，缓存到 globalData 供首页 onShareAppMessage 使用
    // 不 await，不阻塞页面交互；失败时忽略（首页会降级到 /static/app.jpg）
    this._exportCanvas().then(path => {
      getApp().globalData.sharePreviewPath = path;
    }).catch(() => {});
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

});
