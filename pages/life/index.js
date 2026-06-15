// pages/life/index.js
const { indices3d, indices: indices1d } = require('../../utils/api');
const { getDefinition, getColor } = require('../../utils/lifeMeta');

// 全量 16 类生活指数（无 SVG 的用文字兜底显示在圆内）
const DEFAULT_TYPES = [
  { type: '1',  name: '运动',   icon: '/static/icons/pb.svg' },
  { type: '2',  name: '洗车',   icon: '/static/icons/qc.svg' },
  { type: '3',  name: '穿衣',   icon: '/static/icons/yf.svg' },
  { type: '4',  name: '钓鱼',   icon: '/static/icons/dy.svg' },
  { type: '5',  name: '紫外线', icon: '/static/icons/ys.svg' },
  { type: '6',  name: '旅游',   icon: '/static/icons/ly.svg' },
  { type: '7',  name: '花粉',   icon: '/static/icons/hf.svg' },
  { type: '8',  name: '舒适度', icon: '/static/icons/ssd.svg' },
  { type: '9',  name: '感冒',   icon: '/static/icons/gm.svg' },
  { type: '10', name: '空气',   icon: '/static/icons/kqwr.svg' },
  { type: '11', name: '空调',   icon: '/static/icons/kt.svg' },
  { type: '12', name: '太阳镜', icon: '/static/icons/tyj.svg' },
  { type: '13', name: '化妆',   icon: '/static/icons/hz.svg' },
  { type: '14', name: '晾晒',   icon: '/static/icons/ls.svg' },
  { type: '15', name: '交通',   icon: '/static/icons/jt.svg' },
  { type: '16', name: '防晒',   icon: '/static/icons/fs.svg' }
];

// YYYY-MM-DD → { week, dateLabel }
const formatDateParts = (s) => {
  const weekArr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  if (!s) return { week: '', dateLabel: '' };
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    week: weekArr[date.getDay()],
    dateLabel: `${m}月${d}日`
  };
};

Page({
  data: {
    location: '',
    tabs: DEFAULT_TYPES,
    activeType: '1',
    // 当前 tab 的指数列表（最多 4 项）
    list: [],
    definition: {},
    loading: false,
    errorMsg: ''
  },

  onLoad(options = {}) {
    const location = options.location || '';
    const activeType = options.type && this.matchType(options.type) ? options.type : '1';
    this.setData({ location, activeType, definition: getDefinition(activeType) });
    if (location) {
      this.loadIndices();
    } else {
      this.setData({ errorMsg: '缺少城市定位' });
    }
  },

  matchType(t) {
    return DEFAULT_TYPES.some(x => x.type === t);
  },

  async loadIndices() {
    this.setData({ loading: true, errorMsg: '' });
    // type=0 表示请求全部生活指数（QWeather 官方约定）
    try {
      let res = await indices3d({ location: this.data.location, type: '0' });
      if (res.code !== '200') {
        res = await indices1d({ location: this.data.location, type: '0' });
      }
      if (res.code !== '200') {
        this.setData({ errorMsg: `加载失败(${res.code})` });
        return;
      }
      const map = {};
      (res.daily || []).forEach(item => {
        if (!map[item.type]) map[item.type] = [];
        const parts = formatDateParts(item.date);
        map[item.type].push({
          ...item,
          week: parts.week,
          dateLabel: parts.dateLabel,
          categoryColor: getColor(item.type, item.level, item.category)
        });
      });
      this.indicesMap = map;
      this.refreshList();
    } catch (e) {
      this.setData({ errorMsg: '网络异常' });
    } finally {
      this.setData({ loading: false });
    }
  },

  refreshList() {
    const list = (this.indicesMap[this.data.activeType] || []).slice(0, 4);
    this.setData({ list });
  },

  onTabTap(e) {
    const { type } = e.currentTarget.dataset;
    if (type === this.data.activeType) return;
    this.setData({ activeType: type, definition: getDefinition(type) });
    this.refreshList();
  }
});

