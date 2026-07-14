function tempColor(t) {
  if (t >= 35) return '#ef5350';
  if (t >= 30) return '#ff9800';
  if (t >= 25) return '#ffc107';
  if (t >= 20) return '#8bc34a';
  if (t >= 10) return '#4fc3f7';
  return '#7986cb';
}
function aqiColor(aqi) {
  if (aqi <= 50)  return '#4caf50';
  if (aqi <= 100) return '#cddc39';
  if (aqi <= 150) return '#ff9800';
  if (aqi <= 200) return '#f44336';
  return '#9c27b0';
}

Component({
  data: { city: '', date: '', type: 'weather', maxTemp: 0, minTemp: 0, avgAqi: 0, aqiCat: '', bars: [], timeLabels: [] },
  lifetimes: {
    created() {
      const { NotificationType } = wx.modelContext;
      const modelCtx = wx.modelContext.getContext(this);
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        const type = s.type || 'weather';

        if (type === 'weather' && s.weatherHourly) {
          const raw = s.weatherHourly;
          const temps = raw.map(h => h.temp);
          const maxT = Math.max(...temps);
          const minT = Math.min(...temps);
          const range = (maxT - minT) || 1;
          // 压缩成 12 个柱（每2小时一个）
          const bars = [];
          for (let i = 0; i < 12; i++) {
            const chunk = raw.slice(i * 2, i * 2 + 2);
            const avgT = Math.round(chunk.reduce((s, h) => s + h.temp, 0) / chunk.length);
            bars.push({
              h: Math.max(6, Math.round(((avgT - minT) / range) * 44 + 8)),
              color: tempColor(avgT),
              temp: avgT,
            });
          }
          const timeLabels = ['0', '4', '8', '12', '16', '20', '24'];
          this.setData({ city, date: s.date, type, maxTemp: s.maxTemp, minTemp: s.minTemp, bars, timeLabels });
        } else if (type === 'air' && s.airHourly) {
          const raw = s.airHourly;
          const maxAqi = Math.max(...raw.map(h => h.aqi), 1);
          const bars = raw.slice(0, 24).map(h => ({
            h: Math.max(6, Math.round((h.aqi / maxAqi) * 52)),
            color: aqiColor(h.aqi),
            aqi: h.aqi,
          }));
          const timeLabels = ['0', '6', '12', '18', '24'];
          const cats = ['优','良','轻度','中度','重度','严重'];
          const aqiCat = cats[Math.min(Math.floor(s.avgAqi / 50), 5)] || '良';
          this.setData({ city, date: s.date, type, avgAqi: s.avgAqi, aqiCat, bars, timeLabels });
        }
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
