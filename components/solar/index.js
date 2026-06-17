// components/solar/index.js
const LEVELS = [
  { max: 200, level: 0, text: '弱' },
  { max: 500, level: 1, text: '中等' },
  { max: 800, level: 2, text: '强' },
  { max: Infinity, level: 3, text: '极强' },
];
const MAX_GHI = 1000;

function getLevel(ghi) {
  return LEVELS.find(l => ghi < l.max) || LEVELS[LEVELS.length - 1];
}

Component({
  properties: {
    forecasts: { type: Array, value: [] },
  },
  data: {
    currentGhi: 0,
    currentPct: 0,
    currentLevel: 0,
    currentLevelText: '弱',
    peakItem: null,
  },
  observers: {
    forecasts() {
      if (!this._ctx) {
        this._initRetry = (this._initRetry || 0) + 1;
        if (this._initRetry <= 5) this.initCanvas();
        return;
      }
      this._initRetry = 0;
      this.computeStatus();
      this.drawCanvas();
    }
  },
  lifetimes: {
    ready() {
      this.initCanvas();
    },
    detached() {
      if (this._ctx) this._ctx.clearRect(0, 0, this._cw || 0, this._ch || 0);
      this._ctx = null;
      this._cw = null;
      this._ch = null;
    }
  },
  methods: {
    computeStatus() {
      const { forecasts } = this.data;
      if (!forecasts.length) return;

      const now = new Date();
      const nowHour = now.getHours();

      // 找当前小时
      const curr = forecasts.find(f => new Date(f.forecastTime).getHours() === nowHour) || forecasts[0];
      const ghi = curr ? Math.round(curr.ghi.value) : 0;
      const lvl = getLevel(ghi);
      const pct = Math.min(Math.round((ghi / MAX_GHI) * 100), 100);

      // 峰值
      const peak = forecasts.reduce((a, b) => b.ghi.value > a.ghi.value ? b : a, forecasts[0]);
      const peakHour = new Date(peak.forecastTime).getHours();
      const peakItem = {
        timeStr: `${String(peakHour).padStart(2, '0')}:00`,
        ghi: peak.ghi.value.toFixed(2),
      };

      this.setData({
        currentGhi: ghi,
        currentPct: pct,
        currentLevel: lvl.level,
        currentLevelText: lvl.text,
        peakItem,
      });
    },

    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#solarCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return;
          if (!res[0].width || !res[0].height) {
            setTimeout(() => this.initCanvas(), 100);
            return;
          }
          const canvas = res[0].node;
          const dpr = (wx.getDeviceInfo && wx.getDeviceInfo().devicePixelRatio) || wx.getSystemInfoSync().pixelRatio || 2;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          const ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);
          this._ctx = ctx;
          this._cw = res[0].width;
          this._ch = res[0].height;
          this.computeStatus();
          this.drawCanvas();
        });
    },

    drawCanvas() {
      if (!this._ctx || !this._cw || !this._ch) return;
      const { forecasts } = this.data;
      if (!forecasts.length) return;

      const ctx = this._ctx;
      const W = this._cw;
      const H = this._ch;
      const padL = 28, padR = 10, padT = 22, padB = 20;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;

      ctx.clearRect(0, 0, W, H);

      const values = forecasts.map(f => f.ghi.value);
      const maxV = Math.max(...values, 1);
      const n = forecasts.length;

      const toX = (i) => padL + (i / (n - 1)) * chartW;
      const toY = (v) => padT + chartH - (v / maxV) * chartH;

      const points = forecasts.map((f, i) => ({ x: toX(i), y: toY(f.ghi.value) }));

      // 渐变填充
      const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      grad.addColorStop(0, 'rgba(255,213,79,0.45)');
      grad.addColorStop(1, 'rgba(255,213,79,0.02)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
        const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
        ctx.bezierCurveTo(cp1x, points[i].y, cp2x, points[i + 1].y, points[i + 1].x, points[i + 1].y);
      }
      ctx.lineTo(points[points.length - 1].x, padT + chartH);
      ctx.lineTo(points[0].x, padT + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // 曲线描边
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
        const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
        ctx.bezierCurveTo(cp1x, points[i].y, cp2x, points[i + 1].y, points[i + 1].x, points[i + 1].y);
      }
      ctx.strokeStyle = 'rgba(255,213,79,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 峰值标注
      const peakIdx = values.indexOf(Math.max(...values));
      const px = points[peakIdx].x;
      const py = points[peakIdx].y;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD54F';
      ctx.fill();
      ctx.fillStyle = '#FFD54F';
      ctx.font = 'bold 8px sans-serif';
      // 根据距左右边界距离决定对齐，确保文字不超出 canvas
      const labelText = `${values[peakIdx].toFixed(2)}`;
      const distLeft = px - padL;
      const distRight = W - padR - px;
      let textAlign, labelX;
      if (distLeft < 20) {
        textAlign = 'left';
        labelX = padL;
      } else if (distRight < 20) {
        textAlign = 'right';
        labelX = W - padR;
      } else {
        textAlign = 'center';
        labelX = px;
      }
      ctx.textAlign = textAlign;
      // 始终放在折线上方，padT 已留足空间
      const labelY = py - 6;
      ctx.fillText(labelText, labelX, labelY);

      // 当前时刻竖线
      const nowHour = new Date().getHours();
      const nowIdx = forecasts.findIndex(f => new Date(f.forecastTime).getHours() === nowHour);
      if (nowIdx >= 0) {
        const nx = points[nowIdx].x;
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(nx, padT);
        ctx.lineTo(nx, padT + chartH);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // X 轴时刻标签（每4小时）
      ctx.fillStyle = 'rgba(166,169,173,0.7)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      forecasts.forEach((f, i) => {
        const h = new Date(f.forecastTime).getHours();
        if (h % 4 === 0) {
          ctx.fillText(`${h}`, toX(i), H - 4);
        }
      });

      // Y 轴最大值标签
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(166,169,173,0.7)';
      ctx.fillText(Math.round(maxV), padL - 3, padT + 8);
    }
  }
});
