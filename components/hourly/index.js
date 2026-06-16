// components/hourly/index.js
const { windArrow } = require('../../utils/wind');

Component({
  options: {
    addGlobalClass: true
  },
  /**
   * 组件的属性列表
   */
  properties: {
    hourly: {
      type: Array,
      value: []
    }
  },

  /**
   * 数据监听器
   */
  observers: {
    'hourly': function (hourly) {
      if (!hourly || !hourly.length) return;
      const list = hourly.map(item => {
        const arrow = windArrow(item.wind360);
        return { ...item, windArrowVisible: arrow.visible, windArrowRotate: arrow.rotate };
      });
      this.setData({ hourlyList: list });
    }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    onItemTap(e) {
      const { index } = e.currentTarget.dataset;
      const item = this.data.hourly[index];
      this.triggerEvent('itemtap', { index, item });
    }
  }
})
