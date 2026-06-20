const prefs = require('../../utils/prefs');

Page({
  data: {
    tempUnit: 'C',
    themeColor: '#1296db',
    themePresets: prefs.THEME_PRESETS,
    defaultCityId: null,
    cities: [],
  },
  onLoad() {
    this._unsub = prefs.subscribe((p) => this.sync(p));
    this.sync(prefs.getPrefs());
  },
  onUnload() {
    if (this._unsub) this._unsub();
  },
  sync(p) {
    this.setData({
      tempUnit: p.tempUnit,
      themeColor: p.themeColor,
      defaultCityId: p.defaultCityId,
      cities: p.cities,
    });
  },
  onUnitTap(e) {
    const { unit } = e.currentTarget.dataset;
    if (unit !== this.data.tempUnit) prefs.setPrefs({ tempUnit: unit });
  },
  onThemeTap(e) {
    const { color } = e.currentTarget.dataset;
    if (color !== this.data.themeColor) prefs.setPrefs({ themeColor: color });
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
});
