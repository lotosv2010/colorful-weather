// components/daily/index.js
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
    district: {
      type: String,
      value: ''
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
            // 高温在左，低温在右
            barLeft: ((globalMax - max) / range * 100).toFixed(1),
            barWidth: ((max - min) / range * 100).toFixed(1)
          };
        })
      });
    }
  }
})
