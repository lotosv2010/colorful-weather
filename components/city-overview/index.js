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
  },

  methods: {
    _onShowChange(show) {
      if (show) {
        this.loadWeather();
      } else {
        this.setData({ weathers: [], cardBgs: [] });
      }
    },

    async loadWeather() {
      const pages = this.data.cityPages;
      if (!pages.length) return;

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

    onClose() {
      this.triggerEvent('close');
    },

    noop() {},
  },
});
