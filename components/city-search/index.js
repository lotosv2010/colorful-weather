const { cityLookup, topCity, now } = require('../../utils/api');
const prefs = require('../../utils/prefs');
const { tzDiffText } = require('../../utils/util');

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
          this.loadCurrent();
          if (this.data.hotList.length === 0) this.loadHotCity();
        } else {
          this.setData({ panelStyle: '' });
        }
      }
    },
    // 当前定位城市：{ name, adm1, adm2, lat, lon }
    current: {
      type: Object,
      value: null,
      observer() {
        if (this.data.show) this.loadCurrent();
      }
    },
    tempUnit: {
      type: String,
      value: 'C'
    }
  },
  data: {
    keyword: '',
    results: [],
    hotList: [],
    historyList: [], // 历史记录 + 实时天气
    favoritesList: [], // 收藏城市 + 实时天气
    currentItem: null, // 当前定位 + 实时天气
    favoriteIds: {}, // { [cityId]: true } 用于在结果项上展示是否已收藏
    loading: false,
    errorMsg: '',
    panelStyle: '',
  },
  lifetimes: {
    created() {
      this._searchSeq = 0;
    },
    detached() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._searchSeq++;  // 使所有飞行中的搜索请求失效
    },
  },
  methods: {
    // 加载当前定位天气
    async loadCurrent() {
      const cur = this.data.current;
      if (!cur || !cur.lat || !cur.lon) {
        this.setData({ currentItem: null });
        return;
      }
      this.setData({ currentItem: { ...cur } });
      try {
        const r = await now({ location: `${cur.lon},${cur.lat}` });
        if (r && r.code === '200') {
          this.setData({ currentItem: { ...cur, weather: r.now } });
        }
      } catch (e) {}
    },

    // 选中当前定位
    onPickCurrent() {
      const cur = this.data.current;
      if (!cur) return;
      // 模拟 GeoAPI 返回结构，复用 onSelectCity
      this.triggerEvent('select', { city: {
        id: cur.id || `cur_${cur.lat}_${cur.lon}`,
        name: cur.name,
        adm1: cur.adm1,
        adm2: cur.adm2,
        lat: cur.lat,
        lon: cur.lon,
        country: cur.country || '中国'
      } });
      this.onClose();
    },

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
      const withTz = cities.map(c => ({ ...c, tzDiff: tzDiffText(c.utcOffset) }));
      this.setData({ favoritesList: withTz });
      try {
        const weathers = await Promise.all(
          cities.map(item =>
            now({ location: `${item.lon},${item.lat}` })
              .then(r => (r.code === '200' ? r.now : null))
              .catch(() => null)
          )
        );
        // 基于当前列表合并天气，避免并发时覆盖用户操作
        const currentList = this.data.favoritesList;
        const updated = currentList.map(item => {
          const idx = withTz.findIndex(c => String(c.id) === String(item.id));
          return idx >= 0 ? { ...item, weather: weathers[idx] } : item;
        });
        this.setData({ favoritesList: updated });
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
          utcOffset: city.utcOffset || '',
        });
        this._refreshFavoriteIds();
        // 新增场景：仅为该城市拉一次天气，追加到列表
        const newItem = { ...prefs.findCity(city.id) };
        now({ location: `${newItem.lon},${newItem.lat}` })
          .then(r => { if (r.code === '200') newItem.weather = r.now; })
          .catch(() => {})
          .then(() => {
            // 避免飞行期间重复点击导致重复追加
            if (!this.data.favoritesList.find(c => String(c.id) === String(newItem.id))) {
              this.setData({ favoritesList: [...this.data.favoritesList, newItem] });
            }
          });
      }
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
      const seq = ++this._searchSeq;
      this.setData({ loading: true, errorMsg: '' });
      try {
        const res = await cityLookup({ location: keyword, number: 20 });
        if (seq !== this._searchSeq) return;
        if (res.code === '200') {
          this.setData({ results: res.location || [] });
        } else if (res.code === '404' || res.code === '400') {
          this.setData({ results: [], errorMsg: '未找到该地址' });
        } else {
          this.setData({ results: [], errorMsg: '搜索失败，请稍后重试' });
        }
      } catch (e) {
        if (seq !== this._searchSeq) return;
        this.setData({ results: [], errorMsg: '网络异常' });
      } finally {
        if (seq === this._searchSeq) this.setData({ loading: false });
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

    onDragStart(e) {
      this._startY = e.touches[0].clientY;
      this.setData({ panelStyle: 'transition: none' });
    },

    onDragMove(e) {
      const dy = e.touches[0].clientY - this._startY;
      if (dy <= 0) return;
      this.setData({ panelStyle: `transition: none; transform: translateY(${dy}px)` });
    },

    onDragEnd(e) {
      const dy = e.changedTouches[0].clientY - this._startY;
      if (dy > 80) {
        this.setData({ panelStyle: 'transform: translateY(100%)' });
        setTimeout(() => {
          this.triggerEvent('close');
        }, 350);
      } else {
        this.setData({ panelStyle: '' });
      }
    },

    // 关闭弹层
    onClose() {
      this.triggerEvent('close');
    },

    // 阻止冒泡
    noop() {}
  }
});
