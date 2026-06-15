// components/daily/index.js
Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    daily: {
      type: Array,
      value: []
    }
  },
  data: {
    dailyList: []
  },
  observers: {
    'daily'(list) {
      if (!list || !list.length) return;
      const temps = list.flatMap(d => [Number(d.tempMin), Number(d.tempMax)]);
      const globalMin = Math.min(...temps);
      const globalMax = Math.max(...temps);
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
