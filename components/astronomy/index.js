// components/astronomy/index.js
Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    sun: {
      type: Object,
      value: {}
    },
    moon: {
      type: Object,
      value: {}
    }
  },
  data: {
    sunrise: '--:--',
    sunset: '--:--',
    moonrise: '--:--',
    moonset: '--:--',
    moonPhaseName: '',
    moonIllumination: 0,
    moonPhaseIcon: ''
  },
  observers: {
    'sun': function(sun) {
      if (!sun || !sun.sunrise) return;
      this.setData({
        sunrise: this.formatTime(sun.sunrise),
        sunset: this.formatTime(sun.sunset)
      });
      if (this._sunReady) {
        this.drawSunChart();
      } else {
        this.initSunCanvas();
      }
    },
    'moon': function(moon) {
      if (!moon || !moon.moonPhase) return;
      const phase = this.getCurrentPhase(moon.moonPhase);
      this.setData({
        moonrise: this.formatTime(moon.moonrise),
        moonset: this.formatTime(moon.moonset),
        moonPhaseName: phase ? phase.name : '',
        moonIllumination: phase ? phase.illumination : 0,
        moonPhaseIcon: phase ? phase.icon : ''
      });
      if (this._moonReady) {
        this.drawMoonChart();
      } else {
        this.initMoonCanvas();
      }
    }
  },
  lifetimes: {
    ready() {
      this._sunReady = false;
      this._moonReady = false;
      // wx.nextTick 确保原生 canvas 节点在下一帧已挂载再查询
      wx.nextTick(() => {
        this.initSunCanvas();
        this.initMoonCanvas();
      });
    }
  },
  methods: {
    formatTime(isoStr) {
      if (!isoStr) return '--:--';
      const match = isoStr.match(/T(\d{2}:\d{2})/);
      return match ? match[1] : '--:--';
    },
    timeStrToMinutes(str) {
      if (!str || str === '--:--') return null;
      const [h, m] = str.split(':').map(Number);
      return h * 60 + m;
    },
    getCurrentPhase(moonPhase) {
      if (!moonPhase || !moonPhase.length) return null;
      const now = Date.now();
      let closest = moonPhase[0];
      let minDiff = Infinity;
      for (const p of moonPhase) {
        const diff = Math.abs(new Date(p.fxTime).getTime() - now);
        if (diff < minDiff) {
          minDiff = diff;
          closest = p;
        }
      }
      return closest;
    },
    initSunCanvas(retry = 0) {
      const query = this.createSelectorQuery();
      query.select('#sunCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            if (retry < 3) setTimeout(() => this.initSunCanvas(retry + 1), 100);
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = (wx.getDeviceInfo && wx.getDeviceInfo().devicePixelRatio) || wx.getSystemInfoSync().pixelRatio || 2;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          this._sunCtx = ctx;
          this._sunW = res[0].width;
          this._sunH = res[0].height;
          this._sunReady = true;
          this.drawSunChart();
        });
    },
    initMoonCanvas(retry = 0) {
      const query = this.createSelectorQuery();
      query.select('#moonCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            if (retry < 3) setTimeout(() => this.initMoonCanvas(retry + 1), 100);
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = (wx.getDeviceInfo && wx.getDeviceInfo().devicePixelRatio) || wx.getSystemInfoSync().pixelRatio || 2;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          this._moonCtx = ctx;
          this._moonW = res[0].width;
          this._moonH = res[0].height;
          this._moonReady = true;
          this.drawMoonChart();
        });
    },
    // 绘制曲线的一段（实线或虚线）
    drawCurveSegment(ctx, points, color, lineWidth, isDashed) {
      if (points.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = isDashed ? 0.35 : 1;
      if (isDashed) {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    },
    drawSunChart() {
      if (!this._sunReady) return;
      const ctx = this._sunCtx;
      const w = this._sunW;
      const h = this._sunH;
      const color = '#FF8C00';

      const riseMin = this.timeStrToMinutes(this.data.sunrise);
      const setMin = this.timeStrToMinutes(this.data.sunset);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      ctx.clearRect(0, 0, w, h);

      const padL = 10, padR = 10, padT = 20, padB = 40;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;

      // 将 0~1440 分钟映射到 canvas x 坐标
      const minuteToX = (min) => padL + (min / 1440) * chartW;

      // 数据无效时画一条虚线
      if (riseMin == null || setMin == null || setMin <= riseMin) {
        const midY = padT + chartH * 0.82;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, midY);
        ctx.lineTo(w - padR, midY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        return;
      }

      // 基线 y 坐标
      const baseY = padT + chartH * 0.82;

      // 曲线：白天在基线上方（sin 弧），夜间在基线下方（sin 弧，幅度小）
      const nightSpan = 1440 - (setMin - riseMin); // 夜间总分钟数
      const curveY = (min) => {
        if (min >= riseMin && min <= setMin) {
          // 白天：基线上方
          const t = (min - riseMin) / (setMin - riseMin);
          return baseY - chartH * 0.68 * Math.sin(Math.PI * t);
        } else {
          // 夜间：基线下方，以日落→午夜→日出为一段弧
          const offset = min >= setMin ? min - setMin : (1440 - setMin) + min;
          const t = offset / nightSpan;
          return baseY + chartH * 0.18 * Math.sin(Math.PI * t);
        }
      };

      // 生成全天曲线点（每 5 分钟一个点）
      const allPoints = [];
      for (let m = 0; m <= 1440; m += 5) {
        const x = minuteToX(m);
        const y = curveY(m);
        allPoints.push({ x, y, m });
      }

      // 分割成夜间和白天的点
      const nightBefore = allPoints.filter(p => p.m <= riseMin);
      const dayTime = allPoints.filter(p => p.m >= riseMin && p.m <= setMin);
      const nightAfter = allPoints.filter(p => p.m >= setMin);

      // 横坐标（基线）：贯穿全图实线
      const riseX = minuteToX(riseMin);
      const setX = minuteToX(setMin);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padL, baseY);
      ctx.lineTo(w - padR, baseY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 日出标记点和标签
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(riseX, baseY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.data.sunrise, riseX, baseY + 16);
      ctx.fillStyle = 'rgb(166, 169, 173)';
      ctx.fillText('日出', riseX, baseY + 28);

      // 日落标记点和标签
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(setX, baseY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.data.sunset, setX, baseY + 16);
      ctx.fillStyle = 'rgb(166, 169, 173)';
      ctx.fillText('日落', setX, baseY + 28);

      // 画夜间曲线（虚线）：午夜 → 日出
      if (nightBefore.length >= 2) {
        this.drawCurveSegment(ctx, nightBefore, color, 1.5, true);
      }

      // 画夜间曲线（虚线）：日落 → 午夜
      if (nightAfter.length >= 2) {
        this.drawCurveSegment(ctx, nightAfter, color, 1.5, true);
      }

      // 画白天曲线（实线）：日出 → 日落
      if (dayTime.length >= 2) {
        this.drawCurveSegment(ctx, dayTime, color, 2, false);
      }

      // 太阳圆点（当前位置）
      if (nowMin >= riseMin && nowMin <= setMin) {
        const dotX = minuteToX(nowMin);
        const dotY = curveY(nowMin);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    },
    drawMoonChart() {
      if (!this._moonReady) return;
      const ctx = this._moonCtx;
      const w = this._moonW;
      const h = this._moonH;
      const color = '#6CB4EE';

      const riseMin = this.timeStrToMinutes(this.data.moonrise);
      const setMin = this.timeStrToMinutes(this.data.moonset);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      ctx.clearRect(0, 0, w, h);

      const padL = 10, padR = 10, padT = 20, padB = 40;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;

      const minuteToX = (min) => padL + (min / 1440) * chartW;

      // 数据无效时画一条虚线
      if (riseMin == null || setMin == null) {
        const midY = padT + chartH * 0.82;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, midY);
        ctx.lineTo(w - padR, midY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        return;
      }

      // 基线 y 坐标
      const baseY = padT + chartH * 0.82;

      // 曲线：在空（月升→月落）时基线上方实线，其余基线下方虚线
      const crossMidnight = setMin <= riseMin;
      const upSpan = crossMidnight ? (1440 - riseMin) + setMin : setMin - riseMin;
      const downSpan = 1440 - upSpan;
      const curveY = (min) => {
        const isUp = crossMidnight
          ? (min >= riseMin || min <= setMin)
          : (min >= riseMin && min <= setMin);
        if (isUp) {
          // 基线上方
          const offset = crossMidnight
            ? (min >= riseMin ? min - riseMin : (1440 - riseMin) + min)
            : min - riseMin;
          const t = offset / upSpan;
          return baseY - chartH * 0.68 * Math.sin(Math.PI * t);
        } else {
          // 基线下方
          const offset = crossMidnight
            ? min - setMin
            : (min >= setMin ? min - setMin : (1440 - setMin) + min);
          const t = offset / downSpan;
          return baseY + chartH * 0.18 * Math.sin(Math.PI * t);
        }
      };

      // 生成全天曲线点
      const allPoints = [];
      for (let m = 0; m <= 1440; m += 5) {
        const x = minuteToX(m);
        const y = curveY(m);
        allPoints.push({ x, y, m });
      }

      // 处理跨午夜的情况
      let nightBefore, dayTime, nightAfter;
      if (!crossMidnight) {
        nightBefore = allPoints.filter(p => p.m <= riseMin);
        dayTime = allPoints.filter(p => p.m >= riseMin && p.m <= setMin);
        nightAfter = allPoints.filter(p => p.m >= setMin);
      } else {
        nightBefore = allPoints.filter(p => p.m >= setMin && p.m <= riseMin);
        dayTime = allPoints.filter(p => p.m >= riseMin || p.m <= setMin);
        nightAfter = [];
      }

      // 横坐标（基线）：贯穿全图实线
      const riseX = minuteToX(riseMin);
      const setX = minuteToX(setMin);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padL, baseY);
      ctx.lineTo(w - padR, baseY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 月升标记点和标签
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(riseX, baseY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.data.moonrise, riseX, baseY + 16);
      ctx.fillStyle = 'rgb(166, 169, 173)';
      ctx.fillText('月出', riseX, baseY + 28);

      // 月落标记点和标签
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(setX, baseY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.data.moonset, setX, baseY + 16);
      ctx.fillStyle = 'rgb(166, 169, 173)';
      ctx.fillText('月落', setX, baseY + 28);

      // 画夜间曲线（虚线）
      if (nightBefore.length >= 2) {
        this.drawCurveSegment(ctx, nightBefore, color, 1.5, true);
      }
      if (nightAfter.length >= 2) {
        this.drawCurveSegment(ctx, nightAfter, color, 1.5, true);
      }

      // 画白天曲线（实线）
      if (dayTime.length >= 2) {
        this.drawCurveSegment(ctx, dayTime, color, 2, false);
      }

      // 月亮圆点
      const isUp = !crossMidnight
        ? (nowMin >= riseMin && nowMin <= setMin)
        : (nowMin >= riseMin || nowMin <= setMin);

      if (isUp) {
        const dotX = minuteToX(nowMin);
        const dotY = curveY(nowMin);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
});
