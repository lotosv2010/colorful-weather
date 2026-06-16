// components/weather30-chart/index.js

// 安全取数值：处理对象/数组/NaN
const safeNum = (val, fallback = 0) => {
  if (val == null) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.length ? safeNum(val[0], fallback) : fallback;
    if (val.value != null) return safeNum(val.value, fallback);
    if (val.text != null) return safeNum(val.text, fallback);
    for (const k of Object.keys(val)) {
      if (typeof val[k] !== 'object') return safeNum(val[k], fallback);
    }
    return fallback;
  }
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    daily: {
      type: Array,
      value: []
    }
  },
  data: {
    selectedIndex: 0,
    scrollIntoItem: '',
    itemWidth: 0,
    totalWidth: 0,
    canvasHeight: 150,
    canvasTop: 0
  },
  lifetimes: {
    ready() {
      this.initSize();
    }
  },
  observers: {
    'daily'(list) {
      if (list && list.length) {
        this.initSize();
        wx.nextTick(() => this.drawChart());
      }
    }
  },
  methods: {
    initSize() {
      const { windowWidth } = wx.getWindowInfo();
      const rpx2px = windowWidth / 750;
      const itemWidth = Math.round(140 * rpx2px);
      const totalWidth = itemWidth * (this.data.daily.length || 30);
      this.setData({ itemWidth, totalWidth });
    },
    // 测量 chart-line-space 相对于 chart-content 的实际 top 位置，动态设置 canvasTop
    measureCanvasTop(cb) {
      const query = this.createSelectorQuery();
      query.select('.chart-line-space').boundingClientRect();
      query.select('.chart-content').boundingClientRect();
      query.exec((res) => {
        const space = res[0];
        const content = res[1];
        if (space && content) {
          const canvasTop = Math.round(space.top - content.top);
          this.setData({ canvasTop }, cb);
        } else {
          cb && cb();
        }
      });
    },
    initCanvas(cb) {
      if (this._ctx) { cb && cb(); return; }
      const query = this.createSelectorQuery();
      query.select('#tempCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            console.error('Canvas not found');
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getDeviceInfo().devicePixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          this._ctx = ctx;
          this._w = res[0].width;
          this._h = res[0].height;
          cb && cb();
        });
    },
    drawChart() {
      this.measureCanvasTop(() => {
        this.initCanvas(() => this._drawChart());
      });
    },
    _drawChart() {
      const ctx = this._ctx;
      const w = this._w;
      const h = this._h;
      const daily = this.data.daily;
      if (!ctx || !daily.length) return;

      const itemW = this.data.itemWidth;
      const padT = 18;
      const padB = 18;
      const chartH = h - padT - padB;

      // 全局温度范围
      let globalMax = -Infinity, globalMin = Infinity;
      daily.forEach(d => {
        const hi = safeNum(d.tempMax, 0);
        const lo = safeNum(d.tempMin, 0);
        if (hi > globalMax) globalMax = hi;
        if (lo < globalMin) globalMin = lo;
      });
      const range = globalMax - globalMin || 1;

      // 温度转换为Y坐标，确保在canvas有效区域内
      const tempToY = (temp) => {
        const normalized = (temp - globalMin) / range;
        const y = padT + (1 - normalized) * chartH;
        // 确保y坐标在canvas范围内
        return Math.max(padT, Math.min(h - padB, y));
      };
      const pointX = (index) => index * itemW + itemW / 2;

      ctx.clearRect(0, 0, w, h);

      // 最高温折线
      const maxPoints = daily.map((d, i) => ({ x: pointX(i), y: tempToY(safeNum(d.tempMax)) }));
      this.drawLine(ctx, maxPoints, '#FF8C00', 2);

      // 最低温折线
      const minPoints = daily.map((d, i) => ({ x: pointX(i), y: tempToY(safeNum(d.tempMin)) }));
      this.drawLine(ctx, minPoints, '#6CB4EE', 2);

      // 圆点
      maxPoints.forEach(p => {
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      minPoints.forEach(p => {
        ctx.fillStyle = '#6CB4EE';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    drawLine(ctx, points, color, lineWidth) {
      if (points.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    },
    onSelectItem(e) {
      const index = e.currentTarget.dataset.index;
      this.setData({ selectedIndex: index });
      this.triggerEvent('select', { index, item: this.data.daily[index] });
    },
    scrollToIndex(index) {
      this.setData({ selectedIndex: index, scrollIntoItem: 'chart-item-' + index });
    }
  }
})
