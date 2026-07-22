// behaviors/chartCanvasBehavior.js
// Canvas 2D 初始化公共逻辑：处理 DPR 缩放，对外暴露 initCanvas(selector, cb)。
// hourly-temp / hourly-precip / hourly-wind / hourly-humidity / hourly-cloud 等
// 图表组件混入此 Behavior，只需在 drawChart() 中传入各自的 canvas selector ID。

module.exports = Behavior({
  methods: {
    /**
     * 初始化 Canvas 2D 节点，完成 DPR 缩放后回调。
     * 已初始化过则直接回调（幂等），避免重复查询 DOM。
     * @param {string}   selector - canvas 节点的选择器，如 '#tempCanvas'
     * @param {function} [cb]     - 初始化完成后的回调
     */
    initCanvas(selector, cb) {
      if (this._ctx) { cb && cb(); return; }
      this.createSelectorQuery()
        .select(selector)
        .fields({ node: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = (wx.getDeviceInfo ? wx.getDeviceInfo().devicePixelRatio : null) || 2;
          const cssW = this.data.chartContentWidth;
          const cssH = this.data.canvasHeight;
          canvas.width = cssW * dpr;
          canvas.height = cssH * dpr;
          ctx.scale(dpr, dpr);
          this._ctx = ctx;
          this._w = cssW;
          this._h = cssH;
          cb && cb();
        });
    },
  },
});
