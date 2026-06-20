const { cityLookup, topCity, now } = require('../../utils/api');
const prefs = require('../../utils/prefs');

// 本地存储 key
const HISTORY_KEY = 'city_search_history';
// 最大历史条数
const HISTORY_MAX = 10;

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
      observer(val) {
        if (val) {
          this.loadFavorites();
          this.loadHistory();
          if (this.data.hotList.length === 0) this.loadHotCity();
        }
      }
    }
  },
  data: {
    keyword: '',
    results: [],
    hotList: [],
    historyList: [], // 历史记录 + 实时天气
    favoritesList: [], // 收藏城市 + 实时天气
    favoriteIds: {}, // { [cityId]: true } 用于在结果项上展示是否已收藏
    loading: false,
    errorMsg: ''
  },
  methods: {
    _refreshFavoriteIds() {
      const map = {};
      prefs.getPrefs().cities.forEach(c => { map[c.id] = true; });
      this.setData({ favoriteIds: map });
    },

    // 加载收藏城市并并发拉实时天气
    async loadFavorites() {
      const cities = prefs.getPrefs().cities;
      this._refreshFavoriteIds();
      if (!cities.length) {
        this.setData({ favoritesList: [] });
        return;
      }
      this.setData({ favoritesList: cities });
      try {
        const weathers = await Promise.all(
          cities.map(item =>
            now({ location: `${item.lon},${item.lat}` })
              .then(r => (r.code === '200' ? r.now : null))
              .catch(() => null)
          )
        );
        this.setData({
          favoritesList: cities.map((item, i) => ({ ...item, weather: weathers[i] }))
        });
      } catch (e) {}
    },

    // 切换收藏
    onToggleFavorite(e) {
      const { city } = e.currentTarget.dataset;
      const isFav = !!this.data.favoriteIds[city.id];
      if (isFav) {
        prefs.removeCity(city.id);
        // 删除场景：本地裁剪，避免重新请求所有城市天气
        const favoritesList = this.data.favoritesList.filter(c => c.id !== String(city.id));
        this._refreshFavoriteIds();
        this.setData({ favoritesList });
      } else {
        prefs.addCity({
          id: city.id,
          name: city.name,
          adm1: city.adm1,
          adm2: city.adm2,
          lat: city.lat,
          lon: city.lon,
        });
        this._refreshFavoriteIds();
        // 新增场景：仅为该城市拉一次天气，追加到列表
        const newItem = { ...prefs.findCity(city.id) };
        now({ location: `${newItem.lon},${newItem.lat}` })
          .then(r => { if (r.code === '200') newItem.weather = r.now; })
          .catch(() => {})
          .then(() => this.setData({ favoritesList: [...this.data.favoritesList, newItem] }));
      }
    },

    onOpenSettings() {
      this.triggerEvent('close');
      wx.navigateTo({ url: '/pages/settings/index' });
    },

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

    // 加载本地历史并并发拉取实时天气
    async loadHistory() {
      const list = wx.getStorageSync(HISTORY_KEY) || [];
      if (!list.length) {
        this.setData({ historyList: [] });
        return;
      }
      // 先回填基础数据，避免空白
      this.setData({ historyList: list });
      try {
        const weathers = await Promise.all(
          list.map(item =>
            now({ location: `${item.lon},${item.lat}` })
              .then(r => (r.code === '200' ? r.now : null))
              .catch(() => null)
          )
        );
        const merged = list.map((item, i) => ({
          ...item,
          weather: weathers[i]
        }));
        this.setData({ historyList: merged });
      } catch (e) {
        console.log('历史天气加载失败', e);
      }
    },

    // 写入历史（去重 + 截断）
    saveHistory(city) {
      const list = wx.getStorageSync(HISTORY_KEY) || [];
      const next = [city, ...list.filter(i => i.id !== city.id)].slice(0, HISTORY_MAX);
      wx.setStorageSync(HISTORY_KEY, next);
    },

    // 清空历史
    onClearHistory() {
      wx.removeStorageSync(HISTORY_KEY);
      this.setData({ historyList: [] });
    },

    // 输入变化（防抖搜索）
    onInput(e) {
      const keyword = e.detail.value.trim();
      this.setData({ keyword });
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      if (!keyword) {
        this.setData({ results: [], errorMsg: '' });
        return;
      }
      this._debounceTimer = setTimeout(() => this.search(keyword), 300);
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
      this.saveHistory(city);
      this.setData({ keyword: '', results: [], errorMsg: '' });
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
