// components/weather30-card/index.js
Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    item: {
      type: Object,
      value: {}
    },
    active: {
      type: Boolean,
      value: false
    },
    tempUnit: {
      type: String,
      value: 'C'
    },
    maxTemp: {
      type: Number,
      value: null
    },
    minTemp: {
      type: Number,
      value: null
    }
  }
})
