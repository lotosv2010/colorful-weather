function rainColor(precip) {
  if (precip <= 0) return 'rgba(255,255,255,0.08)';
  if (precip < 0.3) return 'rgba(144,202,249,0.5)';
  if (precip < 1) return '#42a5f5';
  if (precip < 3) return '#1565c0';
  return '#0d47a1';
}

Component({
  data: { city: '', summary: '', hasRain: false, bars: [], timeLabels: [] },
  lifetimes: {
    created() {
      const { NotificationType } = wx.modelContext;
      const modelCtx = wx.modelContext.getContext(this);
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        const minutely = s.minutely || [];
        // 取24条（2小时，每5分钟一条）
        const raw = minutely.slice(0, 24);
        const maxP = Math.max(...raw.map(m => m.precip), 0.1);
        const bars = raw.map((m, i) => ({
          h: Math.max(4, Math.round((m.precip / maxP) * 52)),
          color: rainColor(m.precip),
          isNow: i === 0,
        }));
        // 时间刻度：0、+30、+60、+90、+120分钟
        const timeLabels = ['现在', '+30m', '+1h', '+1.5h', '+2h'];
        this.setData({ city, summary: s.summary || '', hasRain: s.hasRain, bars, timeLabels });
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
