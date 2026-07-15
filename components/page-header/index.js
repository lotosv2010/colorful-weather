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
    displayCity: '',
    displayProvince: ''
  },
  observers: {
    'district, city, province': function(district, city, province) {
      let displayCity = city;
      let displayProvince = province;

      // 直辖市：province === city，去掉重复的省级
      if (province && city && province === city) {
        displayProvince = '';
      }

      // 直辖市 GeoAPI 场景：adm2="重庆" adm1="重庆市"，city + '市' === province，去掉冗余的 city 层
      if (city && province && city + '市' === province) {
        displayCity = '';
      }

      // district === city，去掉重复的市级
      if (district && city && district === city) {
        displayCity = '';
      }

      // district === province，去掉重复的省级
      if (district && province && district === province) {
        displayProvince = '';
      }

      // city === province（直辖市且 district === city），去掉重复的省级
      if (displayCity && province && displayCity === province) {
        displayProvince = '';
      }

      this.setData({ displayCity, displayProvince });
    }
  }
})
