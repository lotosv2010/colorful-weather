// components/hourly-precip-chart/index.js
Component({
  options: {
    addGlobalClass: true
  },
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
  data: {
    canvasWidth: 0,
    canvasHeight: 200,
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
    initCanvas(cb) {
      if (this._ctx) { cb && cb(); return; }
      const query = this.createSelectorQuery();
      query.select('#precipCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = (wx.getDeviceInfo && wx.getDeviceInfo().devicePixelRatio) || 2;
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
      const hourly = this.data.hourly;
      if (!ctx || !hourly.length) return;

      const padL = 36, padR = 36, padT = 24, padB = 30;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;
      const count = hourly.length;
      const stepX = chartW / (count - 1);
      const barW = Math.max(6, stepX * 0.4);

      let maxP = 0;
      hourly.forEach(d => {
        const p = Number(d.precip);
        if (p > maxP) maxP = p;
      });
      if (maxP === 0) maxP = 1;
      const precipToY = (p) => padT + (1 - p / maxP) * chartH;
      const popToY = (p) => padT + (1 - p / 100) * chartH;

      ctx.clearRect(0, 0, w, h);

      // 左 Y 轴（降水量）
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.fillStyle = '#5BA3D9';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const gridCount = 4;
      for (let i = 0; i <= gridCount; i++) {
        const val = (maxP * i / gridCount);
        const y = precipToY(val);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(val.toFixed(1), padL - 4, y + 3);
      }

      // 右 Y 轴（概率）
      ctx.fillStyle = '#1E4D8C';
      ctx.textAlign = 'left';
      for (let i = 0; i <= gridCount; i++) {
        const val = 100 * i / gridCount;
        const y = popToY(val);
        ctx.fillText(Math.round(val) + '%', w - padR + 4, y + 3);
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

      // 柱状图
      const sel = this.data.selectedIndex;
      hourly.forEach((d, i) => {
        const p = Number(d.precip);
        const x = padL + i * stepX;
        const barH = (p / maxP) * chartH;
        const y = padT + chartH - barH;
        ctx.fillStyle = i === sel ? '#5BA3D9' : 'rgba(91, 163, 217, 0.6)';
        ctx.beginPath();
        const r = Math.min(barW / 2, 3);
        if (barH > r * 2) {
          ctx.moveTo(x - barW / 2 + r, y);
          ctx.arcTo(x + barW / 2, y, x + barW / 2, y + barH, r);
          ctx.lineTo(x + barW / 2, padT + chartH);
          ctx.lineTo(x - barW / 2, padT + chartH);
          ctx.lineTo(x - barW / 2, y + r);
          ctx.arcTo(x - barW / 2, y, x + barW / 2, y, r);
        } else if (barH > 0) {
          ctx.rect(x - barW / 2, y, barW, barH);
        }
        ctx.fill();
      });

      // 概率折线
      const popPoints = hourly.map((d, i) => ({
        x: padL + i * stepX,
        y: popToY(Number(d.pop) || 0)
      }));
      ctx.strokeStyle = '#1E4D8C';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(popPoints[0].x, popPoints[0].y);
      for (let i = 1; i < popPoints.length; i++) ctx.lineTo(popPoints[i].x, popPoints[i].y);
      ctx.stroke();
      ctx.setLineDash([]);

      popPoints.forEach((p, i) => {
        if (i === sel) {
          ctx.fillStyle = '#1E4D8C';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = '#1E4D8C';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      const d = hourly[sel];
      if (d) {
        const cx = padL + sel * stepX;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.precip + 'mm', cx, precipToY(Number(d.precip)) - 10);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#1E4D8C';
        const popVal = Number(d.pop) || 0;
        ctx.fillText(popVal + '%', cx, popToY(popVal) - 10);
      }
    },
    onTap(e) {
      const hourly = this.data.hourly;
      if (!hourly.length) return;
      const touch = e.touches[0];
      const w = this._w || this.data.canvasWidth;
      const padL = 36, padR = 36;
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
