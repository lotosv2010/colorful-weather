// components/weather-particles/index.js
// 全屏天气粒子动效层（Canvas 2D）

// 粒子效果参数配置
const EFFECT_CONFIG = {
  lightRain:   { count: 30, type: 'rain', speed: 6,  width: 1.2, length: 18, wind: 1.5,  alpha: 0.45 },
  heavyRain:   { count: 60, type: 'rain', speed: 10, width: 1.8, length: 25, wind: 2.5,  alpha: 0.5 },
  lightSnow:   { count: 25, type: 'snow', speed: 1.2, radius: 2.5, drift: 0.6, alpha: 0.5 },
  heavySnow:   { count: 40, type: 'snow', speed: 1.8, radius: 3,   drift: 0.8, alpha: 0.55 },
  mixed:       { count: 40, type: 'mixed' },
  thunderRain: { count: 60, type: 'thunder', speed: 10, width: 1.8, length: 25, wind: 2.5, alpha: 0.5 },
  lightMotes:  { count: 15, type: 'mote', speed: 0.4, radius: 4,   alpha: 0.25 },
  subtleMotes: { count: 8,  type: 'mote', speed: 0.3, radius: 3,   alpha: 0.18 },
  drifting:    { count: 20, type: 'drift', speed: 0.5, radius: 8,  alpha: 0.12 },
};

Component({
  properties: {
    // 粒子效果类型字符串，如 'lightRain'、'lightSnow' 等
    weatherEffect: {
      type: String,
      value: '',
    },
    // 抽屉展开进度 0~1，控制淡出
    sheetProgress: {
      type: Number,
      value: 0,
    },
  },

  observers: {
    'weatherEffect'(effect) {
      this._switchEffect(effect);
    },
    'sheetProgress'(p) {
      // 抽屉接近全展开时停止动画，节省性能
      if (p > 0.95) {
        this._stopLoop();
        if (this._ctx) this._ctx.clearRect(0, 0, this._w, this._h);
      } else if (this._particles.length > 0 && !this._running) {
        this._startLoop();
      }
    },
  },

  lifetimes: {
    attached() {
      this._particles = [];
      this._running = false;
      this._rafId = null;
      this._lastFrame = 0;
      this._ctx = null;
      this._canvas = null;
      this._w = 0;
      this._h = 0;
      this._flashAlpha = 0; // 雷暴闪白
      this._initCanvas();
    },
    detached() {
      this._stopLoop();
      this._ctx = null;
      this._canvas = null;
      this._particles = [];
    },
  },

  methods: {
    // 初始化 Canvas
    _initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#particleCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return;
          const canvas = res[0].node;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getDeviceInfo?.().devicePixelRatio ?? 2;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          this._canvas = canvas;
          this._ctx = ctx;
          this._w = res[0].width;
          this._h = res[0].height;
          // 如果已有 weatherEffect，启动粒子
          if (this.data.weatherEffect) {
            this._switchEffect(this.data.weatherEffect);
          }
        });
    },

    // 切换粒子效果
    _switchEffect(effect) {
      this._stopLoop();
      this._particles = [];
      this._flashAlpha = 0;
      if (!effect || !this._ctx) return;

      const config = EFFECT_CONFIG[effect];
      if (!config) return;

      if (config.type === 'mixed') {
        // 雨夹雪：一半雨一半雪
        const rainCfg = EFFECT_CONFIG.lightRain;
        const snowCfg = EFFECT_CONFIG.lightSnow;
        const half = config.count / 2;
        for (let i = 0; i < half; i++) this._particles.push(this._createRain(rainCfg));
        for (let i = 0; i < half; i++) this._particles.push(this._createSnow(snowCfg));
      } else if (config.type === 'rain' || config.type === 'thunder') {
        for (let i = 0; i < config.count; i++) this._particles.push(this._createRain(config));
      } else if (config.type === 'snow') {
        for (let i = 0; i < config.count; i++) this._particles.push(this._createSnow(config));
      } else if (config.type === 'mote') {
        for (let i = 0; i < config.count; i++) this._particles.push(this._createMote(config));
      } else if (config.type === 'drift') {
        for (let i = 0; i < config.count; i++) this._particles.push(this._createDrift(config));
      }

      this._startLoop();
    },

    // 创建雨滴粒子
    _createRain(cfg) {
      return {
        kind: 'rain',
        x: Math.random() * (this._w + 80) - 40,
        y: Math.random() * this._h - this._h,
        speed: cfg.speed + Math.random() * 3,
        width: cfg.width,
        length: cfg.length + Math.random() * 8,
        wind: cfg.wind,
        alpha: cfg.alpha + (Math.random() - 0.5) * 0.1,
      };
    },

    // 创建雪花粒子
    _createSnow(cfg) {
      return {
        kind: 'snow',
        x: Math.random() * this._w,
        y: Math.random() * this._h - this._h,
        speed: cfg.speed + Math.random() * 0.8,
        radius: cfg.radius + Math.random() * 1.5,
        drift: cfg.drift,
        phase: Math.random() * Math.PI * 2,
        alpha: cfg.alpha + (Math.random() - 0.5) * 0.1,
      };
    },

    // 创建光斑粒子
    _createMote(cfg) {
      return {
        kind: 'mote',
        x: Math.random() * this._w,
        y: Math.random() * this._h,
        speed: cfg.speed + Math.random() * 0.3,
        radius: cfg.radius + Math.random() * 3,
        alpha: cfg.alpha,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.008 + Math.random() * 0.012,
      };
    },

    // 创建漂浮粒子（雾/霾/沙尘）
    _createDrift(cfg) {
      return {
        kind: 'drift',
        x: Math.random() * this._w,
        y: Math.random() * this._h,
        speed: cfg.speed + Math.random() * 0.3,
        radius: cfg.radius + Math.random() * 6,
        alpha: cfg.alpha,
        phase: Math.random() * Math.PI * 2,
      };
    },

    // 启动动画循环
    _startLoop() {
      if (this._running) return;
      this._running = true;
      this._lastFrame = Date.now();
      this._loop();
    },

    // 停止动画循环
    _stopLoop() {
      this._running = false;
      if (this._rafId && this._canvas) {
        this._canvas.cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    },

    // 动画主循环
    _loop() {
      if (!this._running || !this._ctx) return;
      const now = Date.now();
      // 30 FPS 节流
      if (now - this._lastFrame < 33) {
        this._rafId = this._canvas.requestAnimationFrame(() => this._loop());
        return;
      }
      this._lastFrame = now;
      this._update();
      this._draw();
      this._rafId = this._canvas.requestAnimationFrame(() => this._loop());
    },

    // 更新粒子状态
    _update() {
      const w = this._w;
      const h = this._h;

      for (let i = 0; i < this._particles.length; i++) {
        const p = this._particles[i];

        if (p.kind === 'rain') {
          p.y += p.speed;
          p.x += p.wind;
          if (p.y > h + p.length) {
            p.y = -p.length;
            p.x = Math.random() * (w + 80) - 40;
          }
        } else if (p.kind === 'snow') {
          p.y += p.speed;
          p.phase += 0.02;
          p.x += Math.sin(p.phase) * p.drift;
          if (p.y > h + p.radius) {
            p.y = -p.radius;
            p.x = Math.random() * w;
          }
        } else if (p.kind === 'mote') {
          p.y -= p.speed;
          p.phase += p.phaseSpeed;
          p.alpha = 0.1 + Math.sin(p.phase) * 0.15;
          if (p.y < -p.radius * 2) {
            p.y = h + p.radius;
            p.x = Math.random() * w;
          }
        } else if (p.kind === 'drift') {
          p.x += p.speed;
          p.phase += 0.005;
          p.y += Math.sin(p.phase) * 0.3;
          if (p.x > w + p.radius) {
            p.x = -p.radius;
            p.y = Math.random() * h;
          }
        }
      }

      // 雷暴闪白衰减
      if (this._flashAlpha > 0) {
        this._flashAlpha -= 0.05;
        if (this._flashAlpha < 0) this._flashAlpha = 0;
      }
      // 随机触发闪白
      const effect = this.data.weatherEffect;
      if (effect === 'thunderRain' && Math.random() < 0.003) {
        this._flashAlpha = 0.4 + Math.random() * 0.3;
      }
    },

    // 绘制粒子
    _draw() {
      const ctx = this._ctx;
      const w = this._w;
      const h = this._h;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < this._particles.length; i++) {
        const p = this._particles[i];

        if (p.kind === 'rain') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.wind * 0.5, p.y + p.length);
          ctx.strokeStyle = `rgba(180, 210, 240, ${p.alpha})`;
          ctx.lineWidth = p.width;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else if (p.kind === 'snow') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(240, 248, 255, ${p.alpha})`;
          ctx.fill();
        } else if (p.kind === 'mote') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, `rgba(255, 230, 130, ${p.alpha})`);
          grad.addColorStop(1, 'rgba(255, 230, 130, 0)');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        } else if (p.kind === 'drift') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          grad.addColorStop(0, `rgba(200, 200, 200, ${p.alpha})`);
          grad.addColorStop(1, 'rgba(200, 200, 200, 0)');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // 雷暴闪白覆盖层
      if (this._flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this._flashAlpha})`;
        ctx.fillRect(0, 0, w, h);
      }
    },
  },
});
