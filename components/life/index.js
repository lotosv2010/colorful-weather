// components/life/index.js
const { navigateTo } = require('../../utils/route');
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
      navigateTo('/pages/life/index', { location, province, city, district }, { type });
    }
  }
})
