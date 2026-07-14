Component({
  data: { city: '', text: '', temp: '', feelsLike: '', humidity: '', windDir: '', windScale: '', vis: '' },
  lifetimes: {
    created() {
      const modelCtx = wx.modelContext.getContext(this);
      const { NotificationType } = wx.modelContext;
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s || !s.temp) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        this.setData({
          city,
          text: s.text,
          temp: String(s.temp),
          feelsLike: String(s.feelsLike),
          humidity: String(s.humidity),
          windDir: s.windDir,
          windScale: String(s.windScale),
          vis: String(s.vis),
        });
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
