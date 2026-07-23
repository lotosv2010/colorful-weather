// behaviors/prefsBehavior.js
// 用户偏好订阅 Behavior：统一处理 prefs 订阅/取消订阅生命周期。
//
// 使用方法：
//   在 Page({ behaviors: [prefsBehavior], ... }) 中引入。
//
// 提供：
//   - data.tempUnit / data.themeColor 初始值
//   - 默认 _syncPrefs()：仅同步 tempUnit + themeColor（无变化时跳过 setData）
//   - onLoad 中自动调用 _syncPrefs() 并订阅，onUnload 中自动取消
//
// 覆盖：
//   页面如需同步更多字段或触发副作用（如重绘图表），
//   在自己的 methods 中定义同名 _syncPrefs() 即可覆盖默认行为。
//   页面方法优先级高于 behavior 方法（微信小程序原生规则）。

const prefs = require('../utils/prefs');

module.exports = Behavior({
  data: {
    tempUnit: 'C',
    themeColor: '#1296db',
  },

  methods: {
    // 默认同步：只更新发生变化的字段，避免不必要的 setData
    _syncPrefs() {
      const p = prefs.getPrefs();
      const patch = {};
      if (p.tempUnit !== this.data.tempUnit) patch.tempUnit = p.tempUnit;
      if (p.themeColor !== this.data.themeColor) patch.themeColor = p.themeColor;
      if (Object.keys(patch).length) this.setData(patch);
    },
  },

  onLoad() {
    this._syncPrefs();
    this._unsubPrefs = prefs.subscribe(() => this._syncPrefs());
  },

  onUnload() {
    if (this._unsubPrefs) this._unsubPrefs();
  },
});
