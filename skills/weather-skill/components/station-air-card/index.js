const POLL_SHORT = { pm2p5: 'PM2.5', pm10: 'PM10', o3: 'O₃', co: 'CO', so2: 'SO₂', no2: 'NO₂' };

Component({
  data: { stationId: '', pollutants: [] },
  lifetimes: {
    created() {
      const { NotificationType } = wx.modelContext;
      const modelCtx = wx.modelContext.getContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s) return;
        const pollutants = (s.pollutants || []).map(p => ({
          name: POLL_SHORT[p.code] || p.name,
          fullName: p.fullName,
          value: p.value,
          unit: p.unit,
        }));
        this.setData({ stationId: s.stationId, pollutants });
      });
    }
  }
});
