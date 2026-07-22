// components/hourly-temp-chart/index.js
const { convert, fmt } = require('../../utils/temp.js');
const chartCanvasBehavior = require('../../behaviors/chartCanvasBehavior');
Component({
  behaviors: [chartCanvasBehavior],
  options: {
    addGlobalClass: true
  },
  properties: {
    hourly: {
      type: Array,
      value: []
    },
    tempUnit: {
      type: String,
      value: 'C'
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
  data: {
    canvasWidth: 0,
    canvasHeight: 140,
    chartContentWidth: 0,
    scrollIntoItem: '',
    currentScrollLeft: 0
  },
  lifetimes: {
    ready() {
      this.initSize();
      const idx = this.data.selectedIndex;
      if (idx > 0) {
        this.setData({ scrollIntoItem: 'chart-item-' + idx });
      }
    }
  },
  observers: {
    'hourly'(list) {
      if (list && list.length) {
        this.initSize();
        wx.nextTick(() => this.drawChart());
      }
    },
    'selectedIndex, hourly'(idx, list) {
      if (list && list.length) {
        wx.nextTick(() => this.drawChart());
      }
    },
    'tempUnit'() {
      if (this.data.hourly && this.data.hourly.length) {
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
    }
  },
  methods: {
    initSize() {
      const info = wx.getWindowInfo();
      const width = info.windowWidth - 48;
      const itemWidth = width / 24 * 1.5;
      const chartContentWidth = Math.max(width, itemWidth * this.data.hourly.length);
      this.setData({ canvasWidth: width, chartContentWidth });
    },
    drawChart() {
      this.initCanvas('#tempCanvas', () => this._drawChart());
    },
    _drawChart() {
      const ctx = this._ctx;
      const w = this._w;
      const h = this._h;
      const hourly = this.data.hourly;
      const unit = this.data.tempUnit || 'C';
      if (!ctx || !hourly.length) return;

      const padL = 36, padR = 16, padT = 36, padB = 30;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;
      const count = hourly.length;
      const stepX = chartW / (count - 1);

      let maxT = -Infinity, minT = Infinity;
      hourly.forEach(d => {
        const t = convert(d.temp, unit);
        if (t == null) return;
        if (t > maxT) maxT = t;
        if (t < minT) minT = t;
      });
      const range = maxT - minT || 1;
      const tempToY = (t) => padT + (1 - (t - minT) / range) * chartH;

      ctx.clearRect(0, 0, w, h);

      // 网格线 + Y 轴
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.fillStyle = '#8C9AA5';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const gridCount = 4;
      for (let i = 0; i <= gridCount; i++) {
        const val = minT + (range * i / gridCount);
        const y = tempToY(val);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(Math.round(val) + '°', padL - 6, y + 3);
      }

      // X 轴
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8C9AA5';
      hourly.forEach((d, i) => {
        if (i % 3 === 0) {
          const x = padL + i * stepX;
          ctx.fillText(d.hour + '时', x, h - 8);
        }
      });

      // 折线
      const points = hourly.map((d, i) => ({
        x: padL + i * stepX,
        y: tempToY(convert(d.temp, unit) || 0)
      }));

      // 渐变填充
      const gradient = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      gradient.addColorStop(0, 'rgba(255, 140, 0, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.lineTo(points[points.length - 1].x, padT + chartH);
      ctx.lineTo(points[0].x, padT + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.strokeStyle = '#FF8C00';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();

      // 数据点
      const sel = this.data.selectedIndex;
      points.forEach((p, i) => {
        if (i === sel) {
          ctx.fillStyle = '#FF8C00';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          const tipY = Math.max(padT + 14, p.y - 18);
          ctx.fillText(fmt(hourly[i].temp, unit) + '°', p.x, tipY);
        } else {
          ctx.fillStyle = '#FF8C00';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    },
    onTap(e) {
      const hourly = this.data.hourly;
      if (!hourly.length) return;
      const touch = e.touches[0];
      const w = this._w || this.data.canvasWidth;
      const padL = 36, padR = 16;
      const chartW = w - padL - padR;
      const stepX = chartW / (hourly.length - 1);
      let idx = Math.round((touch.x - padL) / stepX);
      idx = Math.max(0, Math.min(hourly.length - 1, idx));
      this.triggerEvent('select', { index: idx });
    },
    onScroll(e) {
      const { scrollLeft, source } = e.detail;
      this.data.currentScrollLeft = scrollLeft;
      if (this._suppressScrollEvent) return;
      if (source === 'touch') {
        this.triggerEvent('scroll', { scrollLeft, source });
      }
    }
  }
})
