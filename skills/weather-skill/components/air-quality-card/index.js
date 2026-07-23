// 将 API 返回的 color 对象转为 CSS 颜色字符串
function toRgba(c) {
  if (!c || typeof c !== 'object') return '#4caf50';
  return `rgba(${c.red},${c.green},${c.blue},${c.alpha ?? 1})`;
}

// 取污染物简称
const POLL_SHORT = { pm2p5: 'PM2.5', pm10: 'PM10', o3: 'O₃', co: 'CO', so2: 'SO₂', no2: 'NO₂' };

Component({
  data: { city: '', aqi: '', category: '', aqiColor: '#4caf50', primary: '', pollutants: [], range: 'current', rows: [] },
  lifetimes: {
    created() {
      const modelCtx = wx.modelContext.getContext(this);
      const { NotificationType } = wx.modelContext;
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        const range = s.range || 'current';

        if (range === 'current') {
          const pollutants = (s.pollutants || []).slice(0, 6).map(p => ({
            name: POLL_SHORT[p.code] || p.name,
            value: p.value,
          }));
          this.setData({
            city, range,
            aqi: s.aqiDisplay || String(s.aqi),
            category: s.category,
            aqiColor: toRgba(s.color),
            pollutants,
          });
        } else if (range === 'hourly') {
          const rows = (s.hourly || []).slice(0, 8).map(h => {
            const cn = (h.indexes || []).find(i => i.code === 'cn-mee') || (h.indexes || [])[0];
            return cn ? { time: (h.forecastTime || '').slice(11, 16), aqi: cn.aqiDisplay, cat: cn.category, color: toRgba(cn.color) } : null;
          }).filter(Boolean);
          this.setData({ city, range, rows });
        } else {
          const rows = (s.days || []).slice(0, 5).map(d => {
            const cn = (d.indexes || []).find(i => i.code === 'cn-mee') || (d.indexes || [])[0];
            return cn ? { time: (d.forecastStartTime || '').slice(5, 10), aqi: cn.aqiDisplay, cat: cn.category, color: toRgba(cn.color) } : null;
          }).filter(Boolean);
          this.setData({ city, range, rows });
        }
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
