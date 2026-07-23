// 天气状况文字 → 简单色块背景色映射
const CONDITION_COLORS = {
  '晴': '#f59e0b', '多云': '#6b7280', '阴': '#4b5563',
  '小雨': '#3b82f6', '中雨': '#2563eb', '大雨': '#1d4ed8', '暴雨': '#1e3a8a',
  '雪': '#93c5fd', '雾': '#9ca3af', '霾': '#92400e',
};

function getConditionColor(text) {
  for (const k of Object.keys(CONDITION_COLORS)) {
    if (text && text.includes(k)) return CONDITION_COLORS[k];
  }
  return '#374151';
}

Component({
  data: {
    city: '',
    forecasts: [],
  },
  lifetimes: {
    created() {
      const modelCtx = wx.modelContext.getContext(this);
      const { NotificationType } = wx.modelContext;
      this._viewCtx = wx.modelContext.getViewContext(this);

      modelCtx.on(NotificationType.Result, (data) => {
        const sc = data.result && data.result.structuredContent;
        if (!sc || !sc.forecasts) return;

        const cityLabel = sc.adm2 && sc.adm2 !== sc.city ? `${sc.adm2} ${sc.city}` : sc.city;
        const forecasts = sc.forecasts.slice(0, 5).map(d => ({
          ...d,
          condColor: getConditionColor(d.textDay),
        }));

        this.setData({ city: cityLabel, forecasts });
        this._viewCtx.setRelatedPage({
          query: `agentCity=${encodeURIComponent(sc.city)}&agentAdm2=${encodeURIComponent(sc.adm2 || '')}`
        });
      });
    }
  }
});
