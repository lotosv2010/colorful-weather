// components/air/index.js
Component({
  properties: {
    air: {
      type: Object,
      value: {}
    },
    location: {
      type: String,
      value: ''
    }
  },
  data: {},
  methods: {
    gotoDetail() {
      console.log('gotoDetail', this.data.location, this.data.air);
      wx.navigateTo({
        url: `/pages/air/index?location=${this.data.location}`
      });
    }
  }
})
