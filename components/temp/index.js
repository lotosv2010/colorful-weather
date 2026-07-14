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
    clothingTip: {
      type: null,
      value: null
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
    weatherBgStyle: '',
    weatherBgSub: '',
  },

  observers: {
    'weatherBg': function(bg) {
      if (!bg) {
        this.setData({ weatherBgStyle: '', weatherBgSub: '' });
        return;
      }
      const bgStyle = `background:${bg}`;
      // 渐变色：使用半透明白色作为子背景
      if (bg.includes('gradient')) {
        this.setData({ weatherBgStyle: bgStyle, weatherBgSub: 'background:rgba(255,255,255,0.08)' });
        return;
      }
      // 纯色：变亮 rgb 值各 +15，保持透明度
      const sub = bg.replace(/\d+/g, (m) => Math.min(255, parseInt(m) + 15));
      this.setData({ weatherBgStyle: bgStyle, weatherBgSub: `background:${sub}` });
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
