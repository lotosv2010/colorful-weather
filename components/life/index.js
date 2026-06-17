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
    },
    province: {
      type: String,
      value: ''
    },
    city: {
      type: String,
      value: ''
    },
    district: {
      type: String,
      value: ''
    }
  },
  data: {},
  methods: {
    gotoDetail(e) {
      const type = e.currentTarget.dataset.type || '';
      const { location, province, city, district } = this.data;
      wx.navigateTo({
        url: `/pages/life/index?location=${location}&type=${type}&province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`,
      });
    }
  }
})
