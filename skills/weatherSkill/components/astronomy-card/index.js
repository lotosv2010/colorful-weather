const MOON_EMOJI = {
  '新月': '🌑', '蛾眉月': '🌒', '上弦月': '🌓', '盈凸月': '🌔',
  '满月': '🌕', '亏凸月': '🌖', '下弦月': '🌗', '残月': '🌘',
};

function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

Component({
  data: { city: '', date: '', sunrise: '', sunset: '', moonrise: '', moonset: '', moonEmoji: '🌙', moonName: '', sunProgress: 0, isDaytime: false },
  lifetimes: {
    created() {
      const { NotificationType } = wx.modelContext;
      const modelCtx = wx.modelContext.getContext(this);
      this._viewCtx = wx.modelContext.getViewContext(this);
      modelCtx.on(NotificationType.Result, ({ result }) => {
        const s = result.structuredContent;
        if (!s || !s.sunrise) return;
        const city = s.adm2 && s.adm2 !== s.city ? `${s.adm2} ${s.city}` : s.city;
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const srMin = toMin(s.sunrise);
        const ssMin = toMin(s.sunset);
        const isDaytime = nowMin >= srMin && nowMin <= ssMin;
        const progress = isDaytime
          ? Math.round(Math.max(0, Math.min(100, ((nowMin - srMin) / (ssMin - srMin)) * 100)))
          : nowMin < srMin ? 0 : 100;
        const moonName = s.moonPhase ? s.moonPhase.name : '';
        const moonEmoji = MOON_EMOJI[moonName] || '🌙';
        this.setData({ city, date: s.date, sunrise: s.sunrise, sunset: s.sunset, moonrise: s.moonrise, moonset: s.moonset, moonEmoji, moonName, sunProgress: progress, isDaytime });
        this._viewCtx.setRelatedPage({ query: `agentCity=${encodeURIComponent(s.city)}` });
      });
    }
  }
});
