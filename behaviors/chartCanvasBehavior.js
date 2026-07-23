// behaviors/chartCanvasBehavior.js
// Canvas 2D 图表公共行为：DPR 缩放初始化、尺寸计算、滚动同步、点击命中检测。
// hourly-temp / hourly-precip / hourly-wind / hourly-humidity / hourly-cloud 等
// 图表组件混入此 Behavior，只需实现 drawChart() 和 _drawChart()。
//
// 可选钩子（组件按需定义）：
//   _onBeforeDrawChart()   在每次 drawChart() 调用前执行（如风向图需重算箭头坐标）
//
// 可选实例变量（组件在 _drawChart 开头设置）：
//   this._chartPadL   左边距，供 onTap 命中计算使用（默认 36）
//   this._chartPadR   右边距（默认 16；双 Y 轴如降水图应设为 36）

module.exports = Behavior({
  // ── 通用 properties（组件如有额外 property 直接声明即可，会自动合并）──────────
  properties: {
    hourly: {
      type: Array,
      value: []
    },
    selectedIndex: {
      type: Number,
      value: 0
    },
    scrollToItem: {
      type: String,
      value: ''
    },
    syncScrollLeft: {
      type: Number,
      value: 0
    }
  },

  // ── 通用 data（组件如有额外字段直接声明即可，会自动合并）─────────────────────
  data: {
    canvasWidth: 0,
    canvasHeight: 140,
    chartContentWidth: 0,
    scrollIntoItem: '',
    currentScrollLeft: 0,
  },

  // ── 生命周期：ready 后初始化尺寸并定位初始选中项 ──────────────────────────────
  lifetimes: {
    ready() {
      this.initSize();
      const idx = this.data.selectedIndex;
      if (idx > 0) {
        this.setData({ scrollIntoItem: 'chart-item-' + idx });
      }
    },
  },

  // ── 观察器（滚动同步 + 数据驱动重绘）─────────────────────────────────────────
  observers: {
    'hourly'(list) {
      if (list && list.length) {
        this.initSize();
        if (this._onBeforeDrawChart) this._onBeforeDrawChart();
        wx.nextTick(() => this.drawChart());
      }
    },
    'selectedIndex, hourly'(idx, list) {
      if (list && list.length) {
        if (this._onBeforeDrawChart) this._onBeforeDrawChart();
        wx.nextTick(() => this.drawChart());
      }
    },
    'scrollToItem'(val) {
      if (!val) return;
      this._suppressScrollEvent = true;
      this.setData({ scrollIntoItem: val });
      wx.nextTick(() => {
        const query = this.createSelectorQuery();
        query.select('.chart-scroll').scrollOffset();
        query.exec((res) => {
          if (res && res[0]) {
            const scrollLeft = res[0].scrollLeft;
            this.data.currentScrollLeft = scrollLeft;
            this.triggerEvent('scrollend', { scrollLeft });
          }
          setTimeout(() => { this._suppressScrollEvent = false; }, 100);
        });
      });
    },
    'syncScrollLeft'(val) {
      if (this._suppressScrollEvent) return;
      if (Math.abs(val - this.data.currentScrollLeft) < 1) return;
      this.setData({ currentScrollLeft: val });
    },
  },

  methods: {
    // 根据当前窗口宽度计算画布与滚动内容宽度
    initSize() {
      const info = wx.getWindowInfo();
      const width = info.windowWidth - 48;
      const itemWidth = width / 24 * 1.5;
      const chartContentWidth = Math.max(width, itemWidth * this.data.hourly.length);
      this.setData({ canvasWidth: width, chartContentWidth });
    },

    // 触摸点击命中最近数据点，向上触发 'select' 事件
    // 依赖 _drawChart 在执行时设置 this._chartPadL / this._chartPadR
    onTap(e) {
      const hourly = this.data.hourly;
      if (!hourly.length) return;
      const touch = e.touches[0];
      const w = this._w || this.data.chartContentWidth;
      const padL = this._chartPadL != null ? this._chartPadL : 36;
      const padR = this._chartPadR != null ? this._chartPadR : 16;
      const chartW = w - padL - padR;
      const stepX = chartW / (hourly.length - 1);
      let idx = Math.round((touch.x - padL) / stepX);
      idx = Math.max(0, Math.min(hourly.length - 1, idx));
      this.triggerEvent('select', { index: idx });
    },

    // 滚动事件：记录当前偏移，touch 来源时向上广播以驱动跨图表联动
    onScroll(e) {
      const { scrollLeft, source } = e.detail;
      this.data.currentScrollLeft = scrollLeft;
      if (this._suppressScrollEvent) return;
      if (source === 'touch') {
        this.triggerEvent('scroll', { scrollLeft, source });
      }
    },

    /**
     * 初始化 Canvas 2D 节点，完成 DPR 缩放后回调。
     * 已初始化过则直接回调（幂等），避免重复查询 DOM。
     * @param {string}   selector - canvas 节点选择器，如 '#tempCanvas'
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
