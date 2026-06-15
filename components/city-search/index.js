const { cityLookup, topCity } = require('../../utils/api');

// 防抖定时器
let debounceTimer = null;

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
      observer(val) {
        if (val && this.data.hotList.length === 0) {
          this.loadHotCity();
        }
      }
    }
  },
  data: {
    keyword: '',
    results: [],
    hotList: [],
    loading: false,
    errorMsg: ''
  },
  methods: {
    // 加载热门城市
    async loadHotCity() {
      try {
        const res = await topCity({ range: 'cn', number: 10 });
        if (res.code === '200') {
          this.setData({ hotList: res.topCityList || [] });
        }
      } catch (e) {
        console.log('热门城市加载失败', e);
      }
    },

    // 输入变化（防抖搜索）
    onInput(e) {
      const keyword = e.detail.value.trim();
      this.setData({ keyword });
      if (debounceTimer) clearTimeout(debounceTimer);
      if (!keyword) {
        this.setData({ results: [], errorMsg: '' });
        return;
      }
      debounceTimer = setTimeout(() => this.search(keyword), 300);
    },

    // 调用 cityLookup
    async search(keyword) {
      this.setData({ loading: true, errorMsg: '' });
      try {
        const res = await cityLookup({ location: keyword, number: 20 });
        if (res.code === '200') {
          this.setData({ results: res.location || [] });
        } else if (res.code === '404') {
          this.setData({ results: [], errorMsg: '未找到匹配城市' });
        } else {
          this.setData({ results: [], errorMsg: `搜索失败(${res.code})` });
        }
      } catch (e) {
        this.setData({ results: [], errorMsg: '网络异常' });
      } finally {
        this.setData({ loading: false });
      }
    },

    // 清空输入
    onClear() {
      this.setData({ keyword: '', results: [], errorMsg: '' });
    },

    // 选中城市
    onPick(e) {
      const { city } = e.currentTarget.dataset;
      this.triggerEvent('select', { city });
      this.onClose();
    },

    // 关闭弹层
    onClose() {
      this.triggerEvent('close');
    },

    // 阻止冒泡
    noop() {}
  }
});
