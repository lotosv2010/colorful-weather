// components/hourly-precip-chart/index.js
const chartCanvasBehavior = require('../../behaviors/chartCanvasBehavior');

Component({
  behaviors: [chartCanvasBehavior],
  options: { addGlobalClass: true },

  methods: {
    drawChart() {
      this.initCanvas('#precipCanvas', () => this._drawChart());
    },
    _drawChart() {
      const ctx = this._ctx;
      const w = this._w;
      const h = this._h;
      const hourly = this.data.hourly;
      if (!ctx || !hourly.length) return;

      // 双 Y 轴布局：右侧留更多空间，需告知 onTap 使用正确右边距
      const padL = 36, padR = 36, padT = 24, padB = 30;
      this._chartPadL = padL;
      this._chartPadR = padR;
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
        const precipVal = Number(d.precip);
        const popVal = Number(d.pop) || 0;
        // 降水量 tip（左侧，白色）
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'right';
        const precipTipY = Math.max(padT + 14, precipToY(precipVal) - 24);
        ctx.fillText(d.precip + 'mm', cx - 6, precipTipY);
        // 概率 tip（右侧，浅蓝）
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#5BA3D9';
        ctx.textAlign = 'left';
        const popTipY = Math.max(padT + 14, popToY(popVal) - 24);
        ctx.fillText(popVal + '%', cx + 6, popTipY);
      }
    },
  }
})
