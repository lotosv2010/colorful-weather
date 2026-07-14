Component({
  data: {
    city: '', date: '', time: '',
    elevation: 0, azimuth: 0, azimuthDir: '',
    solarHour: '', hourAngle: 0,
    aboveHorizon: false,
    // 高度角 0~90° 线性进度（仅在地平线以上时有意义）
    elevProgress: 0,
  },
  lifetimes: {
    created() {
      const { NotificationType } = wx.modelContext;
      const modelCtx = wx.modelContext.getContext(this);
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        // 高度角进度：-90~90 映射到 0~100，便于弧线展示
        const elevProgress = Math.round(Math.max(0, Math.min(100, ((s.elevation + 90) / 180) * 100)));
        this.setData({
          city, date: s.date, time: s.time,
          elevation: s.elevation, azimuth: s.azimuth, azimuthDir: s.azimuthDir,
          solarHour: s.solarHour, hourAngle: s.hourAngle,
          aboveHorizon: s.aboveHorizon,
          elevProgress,
        });
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
