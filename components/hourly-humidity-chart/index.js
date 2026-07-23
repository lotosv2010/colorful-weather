// components/hourly-humidity-chart/index.js
const chartCanvasBehavior = require('../../behaviors/chartCanvasBehavior');

Component({
  behaviors: [chartCanvasBehavior],
  options: { addGlobalClass: true },

  methods: {
    drawChart() {
      this.initCanvas('#humidityCanvas', () => this._drawChart());
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

      // 湿度固定 0-100 范围
      const humToY = (v) => padT + (1 - v / 100) * chartH;

      ctx.clearRect(0, 0, w, h);

      // 网格线 + Y 轴标签
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.fillStyle = '#8C9AA5';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      [0, 25, 50, 75, 100].forEach(val => {
        const y = humToY(val);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(val + '%', padL - 6, y + 3);
      });

      // X 轴时刻标签
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8C9AA5';
      hourly.forEach((d, i) => {
        if (i % 3 === 0) {
          const x = padL + i * stepX;
          ctx.fillText(d.hour + '时', x, h - 8);
        }
      });

      const points = hourly.map((d, i) => ({
        x: padL + i * stepX,
        y: humToY(Number(d.humidity) || 0)
      }));

      // 渐变填充
      const gradient = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      gradient.addColorStop(0, 'rgba(100,181,246,0.35)');
      gradient.addColorStop(1, 'rgba(100,181,246,0)');
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.lineTo(points[points.length - 1].x, padT + chartH);
      ctx.lineTo(points[0].x, padT + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // 折线
      ctx.strokeStyle = '#64B5F6';
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
        const hum = Number(hourly[i].humidity) || 0;
        if (i === sel) {
          ctx.fillStyle = '#64B5F6';
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
          ctx.fillText(hum + '%', p.x, tipY);
        } else {
          ctx.fillStyle = '#64B5F6';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    },
  }
})
