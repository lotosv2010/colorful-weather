function tempDotColor(maxT) {
  if (maxT >= 38) return '#ef5350';
  if (maxT >= 35) return '#ff7043';
  if (maxT >= 30) return '#ffa726';
  if (maxT >= 25) return '#ffca28';
  if (maxT >= 20) return '#a5d6a7';
  if (maxT >= 15) return '#4fc3f7';
  return '#7986cb';
}
// 天气文字简化
function shortText(t) {
  if (!t) return '';
  if (t.includes('雷')) return '⛈';
  if (t.includes('暴雨')) return '🌧';
  if (t.includes('雨')) return '🌦';
  if (t.includes('雪')) return '❄';
  if (t.includes('阴')) return '☁';
  if (t.includes('云') || t.includes('多云')) return '⛅';
  if (t.includes('晴')) return '☀';
  return '·';
}

Component({
  data: { city: '', overallMax: 0, overallMin: 0, weeks: [] },
  lifetimes: {
    created() {
      const { NotificationType } = wx.modelContext;
      const modelCtx = wx.modelContext.getContext(this);
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s || !s.daily) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        // 分成 5 行，每行 6 天
        const days = s.daily.slice(0, 30).map(d => ({
          day: (d.date || '').slice(8, 10),
          icon: shortText(d.textDay),
          color: tempDotColor(d.tempMax),
          tempMax: d.tempMax,
          tempMin: d.tempMin,
        }));
        const weeks = [];
        for (let r = 0; r < 5; r++) weeks.push(days.slice(r * 6, r * 6 + 6));
        this.setData({ city, overallMax: s.overallMax, overallMin: s.overallMin, weeks });
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
