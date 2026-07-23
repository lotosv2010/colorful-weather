// components/astronomy/index.js
const { fmtTime, drawSun, drawMoon } = require('../../utils/astronomyCanvas');

Component({
  options: { addGlobalClass: true },
  properties: {
    sun: { type: Object, value: {} },
    moon: { type: Object, value: {} },
    solarAngle: { type: Object, value: null },
  },
  data: {
    sunrise: '--:--',
    sunset: '--:--',
    moonrise: '--:--',
    moonset: '--:--',
    moonPhaseName: '',
    moonIllumination: 0,
    moonPhaseIcon: '',
    solarElevation: null,
    solarAzimuth: null,
    solarAzimuthDir: '',
    solarHour: '',
    solarAboveHorizon: false,
  },
  observers: {
    'solarAngle'(data) {
      if (!data || data.code !== '200') return;
      const elev = parseFloat(data.solarElevationAngle);
      const azim = parseFloat(data.solarAzimuthAngle);
      const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
      const dir = dirs[Math.round(((azim % 360) + 360) % 360 / 45) % 8];
      const sh = data.solarHour || '';
      const solarHourFmt = sh.length === 4 ? `${sh.slice(0, 2)}:${sh.slice(2)}` : sh;
      this.setData({
        solarElevation: isNaN(elev) ? null : elev,
        solarAzimuth: isNaN(azim) ? null : azim,
        solarAzimuthDir: dir,
        solarHour: solarHourFmt,
        solarAboveHorizon: !isNaN(elev) && elev > 0,
      });
    },
    'sun'(sun) {
      if (!sun || !sun.sunrise) return;
      this.setData({
        sunrise: fmtTime(sun.sunrise),
        sunset: fmtTime(sun.sunset),
      });
      if (this._sunReady) this.drawSunChart();
      else this.initSunCanvas();
    },
    'moon'(moon) {
      if (!moon || !moon.moonPhase) return;
      const phase = this.getCurrentPhase(moon.moonPhase);
      this.setData({
        moonrise: fmtTime(moon.moonrise),
        moonset: fmtTime(moon.moonset),
        moonPhaseName: phase ? phase.name : '',
        moonIllumination: phase ? phase.illumination : 0,
        moonPhaseIcon: phase ? phase.icon : '',
      });
      if (this._moonReady) this.drawMoonChart();
      else this.initMoonCanvas();
    },
  },
  lifetimes: {
    ready() {
      this._sunReady = false;
      this._moonReady = false;
      this._destroyed = false;
      wx.nextTick(() => {
        this.initSunCanvas();
        this.initMoonCanvas();
      });
    },
    detached() {
      this._destroyed = true;
    },
  },
  methods: {
    // 取最接近当前时刻的月相
    getCurrentPhase(moonPhase) {
      if (!moonPhase || !moonPhase.length) return null;
      const now = Date.now();
      let closest = moonPhase[0];
      let minDiff = Infinity;
      for (const p of moonPhase) {
        const diff = Math.abs(new Date(p.fxTime).getTime() - now);
        if (diff < minDiff) { minDiff = diff; closest = p; }
      }
      return closest;
    },

    initSunCanvas(retry = 0) {
      this.createSelectorQuery()
        .select('#sunCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            if (retry < 3) setTimeout(() => {
              if (!this._destroyed) this.initSunCanvas(retry + 1);
            }, 100);
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = (wx.getDeviceInfo ? wx.getDeviceInfo().devicePixelRatio : null) || 2;
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
      this.createSelectorQuery()
        .select('#moonCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            if (retry < 3) setTimeout(() => {
              if (!this._destroyed) this.initMoonCanvas(retry + 1);
            }, 100);
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = (wx.getDeviceInfo ? wx.getDeviceInfo().devicePixelRatio : null) || 2;
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

    // 日出日落弧线（委托 astronomyCanvas.drawSun）
    drawSunChart() {
      if (!this._sunReady) return;
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      drawSun(this._sunCtx, this._sunW, this._sunH, {
        sunrise: this.data.sunrise,
        sunset: this.data.sunset,
        nowMin,
      });
    },

    // 月升月落弧线（委托 astronomyCanvas.drawMoon）
    drawMoonChart() {
      if (!this._moonReady) return;
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const hasMoonset = !!this.data.moonset && this.data.moonset !== '--:--';
      drawMoon(this._moonCtx, this._moonW, this._moonH, {
        moonrise: this.data.moonrise,
        moonset: this.data.moonset,
        hasMoonset,
        nowMin,
      });
    },
  },
});
