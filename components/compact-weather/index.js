// components/compact-weather/index.js
Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    weather: Object,
    locationLabel: String,
    dateNow: String,
    desc: String,
    clothingTip: Object,
    tempUnit: String,
    loading: Boolean,
    errorMsg: String,
    weatherBg: String,
  },
  data: {
    weatherBgStyle: '',
  },
  observers: {
    'weatherBg': function(bg) {
      this.setData({ weatherBgStyle: bg ? `background:${bg}` : '' });
    }
  },
  methods: {
    onGetNow() {
      this.triggerEvent('getnow');
    },
    onRetry() {
      this.triggerEvent('retry');
    },
    onShowSelector() {
      this.triggerEvent('showselector');
    },
    onRefresh() {
      this.triggerEvent('refresh');
    },
  },
});
