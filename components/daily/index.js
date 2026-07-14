// components/daily/index.js
const { navigateTo } = require('../../utils/route');
Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    daily: {
      type: Array,
      value: []
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
    },
    tempUnit: {
      type: String,
      value: 'C'
    }
  },
  data: {
    dailyList: []
  },
  observers: {
    'daily'(list) {
      if (!list || !list.length) return;
      let globalMin = Infinity;
      let globalMax = -Infinity;
      list.forEach(d => {
        const lo = Number(d.tempMin);
        const hi = Number(d.tempMax);
        if (lo < globalMin) globalMin = lo;
        if (hi > globalMax) globalMax = hi;
      });
      const range = globalMax - globalMin || 1;

      this.setData({
        dailyList: list.map(d => {
          const min = Number(d.tempMin);
          const max = Number(d.tempMax);
          return {
            ...d,
            barLeft: ((globalMax - max) / range * 100).toFixed(1),
            barWidth: ((max - min) / range * 100).toFixed(1)
          };
        })
      });
    }
  },
  methods: {
    onItemTap(e) {
      const { fxdate } = e.currentTarget.dataset;
      const { location, province, city, district } = this.data;
      if (!location) return;
      navigateTo('/pages/hourly/index', { location, province, city, district }, { date: fxdate });
    },
    onMore30Day() {
      const { location, province, city, district } = this.data;
      if (!location) return;
      navigateTo('/pages/weather30/index', { location, province, city, district });
    }
  }
})
