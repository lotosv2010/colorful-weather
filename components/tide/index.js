// components/tide/index.js
Component({
  properties: {
    tideTable: { type: Array, value: [] },
    tideHourly: { type: Array, value: [] },
    stationName: { type: String, value: '' },
    dateOffset: { type: Number, value: 0 }
  },
  data: {
    currentHeight: '--',
    rising: true,
    nextEvent: null,
    nextFxTime: '',
    displayDate: '',
  },
  observers: {
    'tideHourly, tideTable'() {
      if (!this._ctx) {
        this._initRetry = (this._initRetry || 0) + 1;
        if (this._initRetry <= 5) this.initCanvas();
        return;
      }
      this._initRetry = 0;
      this.computeStatus();
      this.drawCanvas();
    },
    dateOffset() {
      this.buildDisplayDate();
    }
  },
  lifetimes: {
    ready() {
      this.initCanvas();
      this.buildDisplayDate();
    },
    detached() {
      if (this._ctx) {
        this._ctx.clearRect(0, 0, this._cw || 0, this._ch || 0);
      }
      this._ctx = null;
      this._cw = null;
      this._ch = null;
    }
  },
  methods: {
    buildDisplayDate() {
      const offset = this.data.dateOffset;
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const labels = ['今天', '明天', '后天'];
      const label = offset <= 2 ? labels[offset] : `${m}/${day}`;
      this.setData({ displayDate: label });
    },

    // 计算当前水位、涨落、下一个事件倒计时（仅今天有意义）
    computeStatus() {
      const { tideHourly, tideTable, dateOffset } = this.data;
      if (!tideHourly.length || dateOffset > 0) return;

      const now = new Date();
      const nowHour = now.getHours();

      const curr = tideHourly.find(h => new Date(h.fxTime).getHours() === nowHour);
      const prev = tideHourly.find(h => new Date(h.fxTime).getHours() === Math.max(nowHour - 1, 0));

      const currentHeight = curr ? parseFloat(curr.height).toFixed(2) : '--';
      const rising = curr && prev ? parseFloat(curr.height) >= parseFloat(prev.height) : true;

      // 下一个满/干潮
      const nowMs = now.getTime();
      const future = tideTable
        .map(t => ({ ...t, ms: new Date(t.fxTime).getTime() }))
        .filter(t => t.ms > nowMs)
        .sort((a, b) => a.ms - b.ms);

      let nextEvent = null;
      if (future.length) {
        const n = future[0];
        const diff = Math.floor((n.ms - nowMs) / 60000);
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        nextEvent = { type: n.type, countdown: h > 0 ? `${h}h ${m}m` : `${m}m` };
      }

      // 不写回 tideTable，避免触发 observer 死循环
      // isNext 标记通过计算 nextFxTime 在 wxml 中比对
      this.setData({ currentHeight, rising, nextEvent, nextFxTime: future.length ? future[0].fxTime : '' });
    },

    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#tideCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          console.log('[tide] initCanvas res:', JSON.stringify(res && res[0] ? { width: res[0].width, height: res[0].height, hasNode: !!res[0].node } : null));
          if (!res || !res[0] || !res[0].node) return;
          if (!res[0].width || !res[0].height) {
            // 节点尺寸为 0，延迟重试（hidden 状态下首次可能为 0）
            setTimeout(() => this.initCanvas(), 100);
            return;
          }
          const canvas = res[0].node;
          const dpr = (wx.getDeviceInfo ? wx.getDeviceInfo().devicePixelRatio : null) || 2;
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
      const { tideHourly, tideTable } = this.data;
      if (!tideHourly.length) return;

      const ctx = this._ctx;
      const W = this._cw;
      const H = this._ch;
      const padLeft = 28;
      const padRight = 10;
      const padTop = 20;
      const padBottom = 22;
      const chartW = W - padLeft - padRight;
      const chartH = H - padTop - padBottom;

      ctx.clearRect(0, 0, W, H);

      // 高度范围
      const heights = tideHourly.map(h => parseFloat(h.height)).filter(v => !isNaN(v));
      if (!heights.length) return;
      const minH = Math.min(...heights);
      const maxH = Math.max(...heights);
      const range = maxH - minH || 1;

      const toX = (hour) => padLeft + (hour / 23) * chartW;
      const toY = (h) => padTop + chartH - ((h - minH) / range) * chartH;

      // 构建曲线点
      const points = tideHourly.map(h => {
        const hour = new Date(h.fxTime).getHours();
        return { x: toX(hour), y: toY(parseFloat(h.height)) };
      }).filter(p => !isNaN(p.x) && !isNaN(p.y));

      if (points.length < 2) return;

      // 渐变填充
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      grad.addColorStop(0, 'rgba(68,179,255,0.4)');
      grad.addColorStop(1, 'rgba(68,179,255,0.02)');

      // 绘制平滑曲线（Catmull-Rom → 贝塞尔）
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
        const cp1y = points[i].y;
        const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
        const cp2y = points[i + 1].y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i + 1].x, points[i + 1].y);
      }
      // 填充到底部
      ctx.lineTo(points[points.length - 1].x, padTop + chartH);
      ctx.lineTo(points[0].x, padTop + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // 曲线描边
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
        const cp1y = points[i].y;
        const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3;
        const cp2y = points[i + 1].y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i + 1].x, points[i + 1].y);
      }
      ctx.strokeStyle = 'rgba(68,179,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // X 轴刻度
      ctx.fillStyle = 'rgba(166,169,173,0.7)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      [0, 4, 8, 12, 16, 20, 23].forEach(h => {
        const x = toX(h);
        ctx.fillText(h === 23 ? '23' : `${h}`, x, H - 4);
        ctx.beginPath();
        ctx.moveTo(x, padTop + chartH);
        ctx.lineTo(x, padTop + chartH + 3);
        ctx.strokeStyle = 'rgba(166,169,173,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Y 轴标签（最大/最小）
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(166,169,173,0.7)';
      ctx.fillText(maxH.toFixed(1), padLeft - 3, padTop + 6);
      ctx.fillText(minH.toFixed(1), padLeft - 3, padTop + chartH);

      // 满/干潮标注
      tideTable.forEach(t => {
        const hour = new Date(t.fxTime).getHours();
        const h = parseFloat(t.height);
        if (isNaN(h)) return;
        const x = toX(hour);
        const y = toY(h);
        const isHigh = t.type === 'H';

        // 圆点
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = isHigh ? 'rgb(68,179,255)' : 'rgba(166,169,173,0.8)';
        ctx.fill();

        // 文字标注
        const labelText = `${isHigh ? '▲' : '▼'} ${h}m`;
        ctx.font = 'bold 8px sans-serif';
        ctx.fillStyle = isHigh ? 'rgb(68,179,255)' : 'rgba(166,169,173,0.9)';
        // 左右边界检测
        const distLeft = x - padLeft;
        const distRight = W - padRight - x;
        let textAlign, labelX;
        if (distLeft < 18) {
          textAlign = 'left'; labelX = padLeft;
        } else if (distRight < 18) {
          textAlign = 'right'; labelX = W - padRight;
        } else {
          textAlign = 'center'; labelX = x;
        }
        ctx.textAlign = textAlign;
        // 上下边界检测
        let labelY = isHigh ? y - 7 : y + 13;
        if (isHigh && labelY < padTop + 8) labelY = y + 13;
        if (!isHigh && labelY > padTop + chartH - 2) labelY = y - 7;
        ctx.fillText(labelText, labelX, labelY);
      });

      // 当前时刻竖线
      const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
      const nowX = toX(Math.min(nowHour, 23));
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(nowX, padTop);
      ctx.lineTo(nowX, padTop + chartH);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    },

    prevDay() {
      const offset = this.data.dateOffset;
      if (offset <= 0) return;
      this.triggerEvent('datechange', { offset: offset - 1 });
    },

    nextDay() {
      const offset = this.data.dateOffset;
      if (offset >= 9) return;
      this.triggerEvent('datechange', { offset: offset + 1 });
    }
  }
});
