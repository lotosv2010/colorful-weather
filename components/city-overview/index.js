const { now, sevenDay } = require('../../utils/api');
const { resolveThemeBg } = require('../../utils/autoTheme');
const prefs = require('../../utils/prefs');

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
      observer: '_onShowChange',
    },
    cityPages: {
      type: Array,
      value: [],
      observer: '_onCityPagesChange',
    },
    currentPageIndex: {
      type: Number,
      value: 0,
    },
    tempUnit: {
      type: String,
      value: 'C',
    },
  },

  data: {
    weathers: [],
    cardBgs: [],
    panelStyle: '',
  },

  methods: {
    _onCityPagesChange(pages) {
      const key = (pages || []).map(c => c.id || `${c.lat},${c.lon}`).join(',');
      if (key !== this._cityPagesKey) {
        this._cityPagesKey = key;
        this._loadSeq = (this._loadSeq || 0) + 1;
        if (this.data.show) this.loadWeather();
      }
    },

    _onShowChange(show) {
      if (show) {
        this.loadWeather();
      } else {
        // show=false 后再重置内联样式，避免滑动关闭时面板闪回
        this.setData({ panelStyle: '' });
      }
    },

    async loadWeather() {
      const pages = this.data.cityPages;
      if (!pages.length) return;
      const pageKey = pages.map(c => c.id || `${c.lat},${c.lon}`).join(',');
      // 数据已是最新城市列表且已加载，跳过重复请求
      if (pageKey === this._loadedKey) return;
      const seq = ++this._loadSeq;

      // 先设空占位，让骨架屏立刻渲染
      this.setData({
        weathers: new Array(pages.length).fill(null),
        cardBgs: new Array(pages.length).fill(''),
      });

      const results = await Promise.all(
        pages.map(c => {
          const loc = { location: `${c.lon},${c.lat}` };
          return Promise.all([
            now(loc).catch(() => null),
            sevenDay(loc).catch(() => null),
          ]).then(([nr, dr]) => {
            if (!nr || nr.code !== '200') return null;
            const today = dr && dr.code === '200' && dr.daily && dr.daily[0];
            return {
              temp: nr.now.temp,
              icon: nr.now.icon,
              text: nr.now.text,
              tempMax: today ? today.tempMax : null,
              tempMin: today ? today.tempMin : null,
              sunrise: today ? today.sunrise : null,
              sunset:  today ? today.sunset  : null,
            };
          });
        })
      );
      if (seq !== this._loadSeq) return;
      this._loadedKey = pageKey;
      const autoBg = prefs.getPrefs().cardBgMode === 'auto';
      this.setData({
        weathers: results,
        cardBgs: results.map(w =>
          w && autoBg ? `background:${resolveThemeBg(w.icon, w.sunrise, w.sunset)}` : ''
        ),
      });
    },

    onSelectCity(e) {
      const index = e.currentTarget.dataset.index;
      this.triggerEvent('selectcity', { index });
    },

    onDragStart(e) {
      this._startY = e.touches[0].clientY;
      this.setData({ panelStyle: 'transition: none' });
    },

    onDragMove(e) {
      const dy = e.touches[0].clientY - this._startY;
      if (dy <= 0) return;
      this.setData({ panelStyle: `transition: none; transform: translateY(${dy}px)` });
    },

    onDragEnd(e) {
      const dy = e.changedTouches[0].clientY - this._startY;
      if (dy > 80) {
        this.setData({ panelStyle: 'transform: translateY(100%)' });
        setTimeout(() => {
          this.triggerEvent('close');
        }, 350);
      } else {
        this.setData({ panelStyle: '' });
      }
    },

    onClose() {
      this.triggerEvent('close');
    },

    noop() {},
  },
});
