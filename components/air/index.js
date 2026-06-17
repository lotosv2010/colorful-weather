// components/air/index.js
Component({
  properties: {
    air: {
      type: Object,
      value: {}
    },
    location: {
      type: String,
      value: ''
    },
    province: {
      type: String,
      value: ''
    },
    city: {
      type: String,
      value: ''
    },
    district: {
      type: String,
      value: ''
    }
  },
  data: {},
  observers: {
    'air.aqi'() {
      this.drawRing();
    }
  },
  lifetimes: {
    ready() {
      this.initCanvas();
    },
    detached() {
      // 组件卸载时释放 Canvas 引用，防止 observer 在 detached 后触发报错
      this._ctx = null;
      this._w = null;
      this._h = null;
    }
  },
  methods: {
    gotoDetail() {
      const { location, province, city, district } = this.data;
      wx.navigateTo({
        url: `/pages/air/index?location=${location}&province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`
      });
    },
    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#aqiCanvas')
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
          this._ctx = ctx;
          this._w = res[0].width;
          this._h = res[0].height;
          this.drawRing();
        });
    },
    drawRing() {
      if (!this._ctx) return;
      const { aqi, colorHex } = this.data.air;
      if (!aqi && aqi !== 0) return;
      const ctx = this._ctx;
      const w = this._w;
      const h = this._h;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) - 6;
      const lineWidth = 5;
      const pct = Math.min(aqi / 500, 1);

      ctx.clearRect(0, 0, w, h);

      // 背景环
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#3D3F4A';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 进度弧
      if (pct > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        ctx.strokeStyle = colorHex || '#9BB365';
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  }
})
