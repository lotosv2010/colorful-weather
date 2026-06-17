// components/page-header/index.js
Component({
  properties: {
    district: {
      type: String,
      value: ''
    },
    city: {
      type: String,
      value: ''
    },
    province: {
      type: String,
      value: ''
    }
  },
  data: {
    displayCity: ''
  },
  observers: {
    'district, city, province': function(district, city, province) {
      // 直辖市：province === city，去掉重复的省级
      if (province && city && province === city) {
        this.setData({ displayCity: '' });
      } else {
        this.setData({ displayCity: city });
      }
    }
  }
})
