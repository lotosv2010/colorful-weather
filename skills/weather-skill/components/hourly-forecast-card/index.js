// 温度 → 暖色系渐变色
function tempColor(t) {
  if (t >= 38) return '#ef5350';
  if (t >= 35) return '#ff7043';
  if (t >= 30) return '#ffa726';
  if (t >= 25) return '#ffca28';
  if (t >= 20) return '#a5d6a7';
  if (t >= 15) return '#4fc3f7';
  return '#7986cb';
}

Component({
  data: { city: '', slots: [], maxTemp: 0, minTemp: 0 },
  lifetimes: {
    created() {
      const { NotificationType } = wx.modelContext;
      const modelCtx = wx.modelContext.getContext(this);
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s || !s.hourly) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        const raw = s.hourly.slice(0, 8);
        const temps = raw.map(h => h.temp);
        const maxTemp = Math.max(...temps);
        const minTemp = Math.min(...temps);
        const range = (maxTemp - minTemp) || 1;
        const slots = raw.map(h => ({
          time: (h.fxTime || '').slice(11, 16),
          temp: h.temp,
          text: h.text,
          barH: Math.round(((h.temp - minTemp) / range) * 48 + 12), // 12~60px
          color: tempColor(h.temp),
          pop: h.pop != null ? h.pop : 0,
          showPop: (h.pop != null && h.pop >= 20),
        }));
        this.setData({ city, slots, maxTemp, minTemp });
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
