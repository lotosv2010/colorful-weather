const prefs = require('../../utils/prefs');
const monitor = require('../../utils/monitor');
const cache = require('../../utils/cache');
const { tzDiffText } = require('../../utils/util');

Page({
  data: {
    tempUnit: 'C',
    themeColor: '#1296db',
    themeMode: 'auto',
    cardBgMode: 'auto',
    themePresets: prefs.THEME_PRESETS,
    defaultCityId: null,
    cities: [],
  },
  onLoad() {
    this._loadStart = Date.now();
    this._unsub = prefs.subscribe((p) => this.sync(p));
    this.sync(prefs.getPrefs());
  },
  onReady() {
    monitor.recordPageLoad('/pages/settings/index', this._loadStart);
  },
  onUnload() {
    if (this._unsub) this._unsub();
  },
  sync(p) {
    this.setData({
      tempUnit: p.tempUnit,
      themeColor: p.themeColor,
      themeMode: p.themeMode || 'manual',
      cardBgMode: p.cardBgMode || 'auto',
      defaultCityId: p.defaultCityId,
      cities: p.cities.map(c => ({ ...c, tzDiff: tzDiffText(c.utcOffset) })),
    });
  },
  onUnitTap(e) {
    const { unit } = e.currentTarget.dataset;
    if (unit !== this.data.tempUnit) prefs.setPrefs({ tempUnit: unit });
  },
  onThemeTap(e) {
    const { color } = e.currentTarget.dataset;
    if (color !== this.data.themeColor) {
      prefs.setPrefs({ themeColor: color, manualThemeColor: color });
    }
  },
  onThemeModeTap(e) {
    const { mode } = e.currentTarget.dataset;
    if (mode === this.data.themeMode) return;
    if (mode === 'manual') {
      const manual = prefs.getPrefs().manualThemeColor || '#1296db';
      prefs.setPrefs({ themeMode: 'manual', themeColor: manual });
    } else {
      prefs.setPrefs({ themeMode: 'auto' });
    }
  },
  onCardBgModeTap(e) {
    const { mode } = e.currentTarget.dataset;
    if (mode === this.data.cardBgMode) return;
    prefs.setPrefs({ cardBgMode: mode });
  },
  onDefaultCityTap(e) {
    const { id } = e.currentTarget.dataset;
    const next = this.data.defaultCityId === id ? null : id;
    prefs.setDefaultCity(next);
  },
  onRemoveCity(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '取消收藏',
      content: `确定从收藏中移除「${name}」？`,
      success: (res) => {
        if (res.confirm) prefs.removeCity(id);
      },
    });
  },
  onTogglePin(e) {
    const { id } = e.currentTarget.dataset;
    prefs.togglePin(id);
  },
  onTripTap() {
    wx.navigateTo({ url: '/pages/trip/index' });
  },
  onAddShortcut() {
    if (wx.canIUse('addShortcut')) {
      wx.addShortcut({ fail: () => this._showShortcutGuide() });
    } else {
      this._showShortcutGuide();
    }
  },
  _showShortcutGuide() {
    const info = wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync();
    const isAndroid = (info.platform || '').toLowerCase() === 'android';
    wx.showModal({
      title: '添加到桌面',
      content: isAndroid
        ? '点击右上角「···」→「发送到桌面」，即可在手机桌面快速打开霁色天气'
        : '点击右上角「···」，选择「添加到我的小程序」或「关于」页面中的添加选项',
      showCancel: false,
      confirmText: '知道了',
    });
  },
  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除所有已缓存的天气数据，下次刷新会重新拉取。',
      confirmText: '清除',
      success: (res) => {
        if (!res.confirm) return;
        cache.clear();
        // 通知首页下次 onShow 强刷
        const app = getApp();
        if (app && app.globalData) app.globalData.needForceRefresh = true;
        wx.showToast({ title: '已清除', icon: 'success' });
      },
    });
  },
});
