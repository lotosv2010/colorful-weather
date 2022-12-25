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
    getNow() {
      this.triggerEvent('getnow');
    }
  }
})
