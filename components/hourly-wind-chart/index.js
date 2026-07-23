// components/hourly-wind-chart/index.js
const { windArrow } = require('../../utils/wind');
const chartCanvasBehavior = require('../../behaviors/chartCanvasBehavior');

Component({
  behaviors: [chartCanvasBehavior],
  options: { addGlobalClass: true },

  // 风向箭头位置列表为本组件独有 data
  data: {
    arrowPositions: []
  },

  methods: {
    // 钩子：hourly / selectedIndex 变化时，在 drawChart 前重算箭头坐标
    _onBeforeDrawChart() {
      this.computeArrowPositions();
    },

    drawChart() {
      this.initCanvas('#windCanvas', () => this._drawChart());
    },

    // 计算各时刻风向箭头的 WXML 层叠位置（用于 SVG 图标定位）
    computeArrowPositions() {
      const hourly = this.data.hourly;
      if (!hourly.length) return;
      const w = this._w || this.data.chartContentWidth;
      if (!w) return;
      const padL = 36, padR = 16, padT = 36, padB = 30;
      const chartW = w - padL - padR;
      const chartH = this.data.canvasHeight - padT - padB;
      const stepX = chartW / (hourly.length - 1);

      let maxS = 0;
      hourly.forEach(d => { const s = Number(d.windSpeed); if (s > maxS) maxS = s; });
      if (maxS === 0) maxS = 1;
      const speedToY = (s) => padT + (1 - s / maxS) * chartH;

      const positions = hourly.map((d, i) => {
        const arrow = windArrow(d.wind360);
        return {
          x: padL + i * stepX - 8,
          y: speedToY(Number(d.windSpeed)) - 36,
          angle: arrow.rotate,
          visible: arrow.visible
        };
      });
      this.setData({ arrowPositions: positions });
    },

    _drawChart() {
      const ctx = this._ctx;
      const w = this._w;
      const h = this._h;
      const hourly = this.data.hourly;
      if (!ctx || !hourly.length) return;

      const padL = 36, padR = 16, padT = 36, padB = 30;
      this._chartPadL = padL;
      this._chartPadR = padR;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;
      const count = hourly.length;
      const stepX = chartW / (count - 1);

      let maxS = 0;
      hourly.forEach(d => {
        const s = Number(d.windSpeed);
        if (s > maxS) maxS = s;
      });
      if (maxS === 0) maxS = 1;
      const speedToY = (s) => padT + (1 - s / maxS) * chartH;

      ctx.clearRect(0, 0, w, h);

      // 网格线 + Y 轴
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.fillStyle = '#8C9AA5';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const gridCount = 4;
      for (let i = 0; i <= gridCount; i++) {
        const val = (maxS * i / gridCount);
        const y = speedToY(val);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(Math.round(val), padL - 6, y + 3);
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
        y: speedToY(Number(d.windSpeed))
      }));

      const gradient = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      gradient.addColorStop(0, 'rgba(78, 205, 196, 0.25)');
      gradient.addColorStop(1, 'rgba(78, 205, 196, 0)');
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.lineTo(points[points.length - 1].x, padT + chartH);
      ctx.lineTo(points[0].x, padT + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.strokeStyle = '#4ECDC4';
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
        const d = hourly[i];
        if (i === sel) {
          ctx.fillStyle = '#4ECDC4';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // 保证 tip 在点上方且不超出顶部
          const tipLine1Y = Math.max(padT + 14, p.y - 48);
          const tipLine2Y = tipLine1Y + 14;
          // tip 背景框
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(p.x - 38, tipLine1Y - 12, 76, 34);
          // tip 文字
          ctx.fillStyle = '#fff';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(d.windDir, p.x, tipLine1Y);
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(d.windSpeed + 'km/h', p.x, tipLine2Y);
        } else {
          ctx.fillStyle = '#4ECDC4';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    },
  }
})
