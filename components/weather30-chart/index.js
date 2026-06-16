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
    itemWidth: 0,
    totalWidth: 0,
    canvasHeight: 120
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
      const sys = wx.getSystemInfoSync();
      const rpx2px = sys.screenWidth / 750;
      const itemWidth = Math.round(120 * rpx2px);
      const totalWidth = itemWidth * (this.data.daily.length || 30);
      this.setData({ itemWidth, totalWidth });
    },
    initCanvas(cb) {
      if (this._ctx) { cb && cb(); return; }
      const query = this.createSelectorQuery();
      query.select('#tempCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
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
      this.initCanvas(() => this._drawChart());
    },
    _drawChart() {
      const ctx = this._ctx;
      const w = this._w;
      const h = this._h;
      const daily = this.data.daily;
      if (!ctx || !daily.length) return;

      const itemW = this.data.itemWidth;
      const padT = 10;
      const padB = 10;
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

      const tempToY = (temp) => padT + (1 - (temp - globalMin) / range) * chartH;
      const pointX = (index) => index * itemW + itemW / 2;

      ctx.clearRect(0, 0, w, h);

      // 最高温折线
      const maxPoints = daily.map((d, i) => ({ x: pointX(i), y: tempToY(safeNum(d.tempMax)) }));
      this.drawLine(ctx, maxPoints, '#FF8C00', 1.5);

      // 最低温折线
      const minPoints = daily.map((d, i) => ({ x: pointX(i), y: tempToY(safeNum(d.tempMin)) }));
      this.drawLine(ctx, minPoints, '#6CB4EE', 1.5);

      // 圆点
      maxPoints.forEach(p => {
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      minPoints.forEach(p => {
        ctx.fillStyle = '#6CB4EE';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
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
    }
  }
})
