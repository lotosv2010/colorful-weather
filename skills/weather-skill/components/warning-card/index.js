// 预警颜色等级 → CSS 色值
const LEVEL_COLOR = { blue: '#4fc3f7', yellow: '#ffd740', orange: '#ff9800', red: '#f44336' };

Component({
  data: { city: '', warnings: [], empty: false },
  lifetimes: {
    created() {
      const modelCtx = wx.modelContext.getContext(this);
      const { NotificationType } = wx.modelContext;
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        const warnings = (s.warnings || []).slice(0, 3).map(w => ({
          title: w.title,
          typeName: w.typeName,
          level: w.level,
          color: LEVEL_COLOR[w.level] || '#ff9800',
          // 截断预警正文，卡片内只展示前 40 字
          brief: w.text ? w.text.slice(0, 40) + (w.text.length > 40 ? '…' : '') : '',
        }));
        this.setData({ city, warnings, empty: warnings.length === 0 });
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
