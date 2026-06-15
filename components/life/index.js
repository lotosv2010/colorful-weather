// components/life/index.js
Component({
  properties: {
    indices: {
      type: Array,
      value: []
    },
    location: {
      type: String,
      value: ''
    }
  },
  data: {},
  methods: {
    gotoDetail(e) {
      const type = e.currentTarget.dataset.type || '';
      const { location } = this.data;
      wx.navigateTo({
        url: `/pages/life/index?location=${location}&type=${type}`,
      });
    }
  }
})
