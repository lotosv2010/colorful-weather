// 优先展示的指数，含展示名和色阶映射
const KEY_TYPES = [
  { type: '3',  label: '穿衣' },
  { type: '1',  label: '运动' },
  { type: '5',  label: '紫外线' },
  { type: '9',  label: '感冒' },
  { type: '6',  label: '旅游' },
  { type: '14', label: '晾晒' },
  { type: '2',  label: '洗车' },
  { type: '8',  label: '舒适度' },
];

// category → 色块颜色
const CAT_COLOR = {
  '适宜': '#4caf50', '较适宜': '#8bc34a', '极适宜': '#4caf50', '基本适宜': '#8bc34a',
  '舒适': '#4caf50', '较舒适': '#8bc34a',
  '一般': '#ffc107', '中等': '#ffc107',
  '较不宜': '#ff9800', '不太适宜': '#ff9800',
  '不宜': '#f44336', '不适宜': '#f44336', '非常不舒适': '#f44336',
  '寒冷': '#5c9aff', '冷': '#7ab4ff', '较冷': '#9eceff',
  '热': '#ff9800', '炎热': '#f44336',
  '弱': '#4caf50', '较弱': '#8bc34a', '最弱': '#4caf50',
  '强': '#ff9800', '很强': '#f44336', '极强': '#b71c1c',
  '少发': '#4caf50', '较易发': '#ffc107', '易发': '#ff9800', '极易发': '#f44336',
};

function catColor(cat) {
  return CAT_COLOR[cat] || '#607d8b';
}

Component({
  data: { city: '', grid: [] },
  lifetimes: {
    created() {
      const modelCtx = wx.modelContext.getContext(this);
      const { NotificationType } = wx.modelContext;
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s || !s.indices) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        const indexMap = {};
        (s.indices || []).forEach(i => { indexMap[i.type] = i; });
        const grid = KEY_TYPES
          .map(k => {
            const idx = indexMap[k.type];
            return idx ? { label: k.label, category: idx.category, color: catColor(idx.category) } : null;
          })
          .filter(Boolean)
          .slice(0, 8);
        this.setData({ city, grid });
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
