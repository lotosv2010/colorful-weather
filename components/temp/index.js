// components/temp/index.js
Component({
  options: {
    addGlobalClass: true
  },
  /**
   * 组件的属性列表
   */
  properties: {
    weather: {
      type: Object,
      value: {},
    },
    city: {
      type: String,
      value: ''
    },
    date: {
      type: String,
      value: ''
    },
    desc: {
      type: String,
      value: ''
    },
    uv: {
      type: String,
      value: ''
    },
    alerts: {
      type: Array,
      value: []
    },
    showMinutelyEntry: {
      type: Boolean,
      value: false
    },
    minutelyType: {
      type: String,
      value: 'rain'
    },
    minutelySummary: {
      type: String,
      value: ''
    },
    tempUnit: {
      type: String,
      value: 'C'
    },
    weatherBg: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    weatherBgSub: '',
  },

  observers: {
    'weatherBg': function(bg) {
      // 变亮：rgb 值各 +15，保持透明度
      if (bg) {
        const sub = bg.replace(/\d+/g, (m) => Math.min(255, parseInt(m) + 15));
        this.setData({ weatherBgSub: sub });
      }
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    getNow() {
      this.triggerEvent('getnow');
    },
    gotoWarning() {
      this.triggerEvent('gowarning');
    },
    onMinutelyTap() {
      this.triggerEvent('minutelytap');
    }
  }
})
