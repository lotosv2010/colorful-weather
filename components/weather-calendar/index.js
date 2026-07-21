// components/weather-calendar/index.js
const api = require('../../utils/api');
const { getLunarLabels } = require('../../utils/lunar');

const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// ── 辅助函数 ──────────────────────────────────────────────────────────────
// 某月天数
const daysInMonth  = (y, m) => new Date(y, m, 0).getDate();
// 某月第一天偏移（周一起始：0=周一 … 6=周日）
const firstOffset  = (y, m) => { const d = new Date(y, m - 1, 1).getDay(); return d === 0 ? 6 : d - 1; };
// YYYY-MM-DD 字符串
const dateStr      = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
// 历史接口日期格式 YYYYMMDD
const toYMD        = (s) => s.replace(/-/g, '');

Component({
  options: {
    // 允许访问 app.wxss 全局样式（qi-* 天气字体图标、icon-color-* 颜色类）
    addGlobalClass: true,
  },

  properties: {
    // 独立模式（无父页预报数据时）：组件自主拉取 weather30d
    location:   { type: String, value: '' },
    // 历史天气接口需要城市 ID（两种模式均适用）
    cityId:     { type: String, value: '' },
    // 嵌入模式（pages/weather30）：父页已加载好的预报数组直接传入
    daily:      { type: Array,  value: [] },
    tempUnit:   { type: String, value: 'C' },
    themeColor: { type: String, value: '#1296db' },
  },

  data: {
    viewYear:     0,
    viewMonth:    0,
    cells:        [],
    canGoPrev:    false,
    canGoNext:    false,
    loading:      false,
    errorMsg:     '',
    selectedDate: '',
    selectedItem: null,
    summaryMax:   null,   // 供 weather30-card 温度条使用
    summaryMin:   null,
  },

  lifetimes: {
    ready() {
      this._isReady = true;
      const { daily, location } = this.data;
      if (daily && daily.length) {
        // 嵌入模式：父页数据已就绪
        this._init(true);
      } else if (location) {
        // 独立模式：自主拉取
        this._fetchAndInit();
      }
      // 否则等待 observer 触发（父页数据稍后到达）
    },
    detached() {
      this._isReady = false;
    },
  },

  observers: {
    // 监听 daily 变化（父页首次加载或下拉刷新后更新）
    'daily': function(daily) {
      if (!this._isReady) return;
      if (daily && daily.length) {
        this._init(true);
      }
    },
  },

  methods: {

    // ── 初始化（定位到今月，可选自动选中今天）────────────────────────────
    _init(autoSelectToday) {
      if (!this._histCache) this._histCache = {};
      this._computeSummary();
      const t = new Date();
      this._loadAndBuild(t.getFullYear(), t.getMonth() + 1, autoSelectToday);
    },

    // ── 独立模式：先拉取 weather30d，再初始化 ─────────────────────────────
    async _fetchAndInit() {
      if (this._w30Fetched) {
        // 已缓存，直接构建
        if (!this._histCache) this._histCache = {};
        this._computeSummary();
        const t = new Date();
        this._loadAndBuild(t.getFullYear(), t.getMonth() + 1, true);
        return;
      }

      if (!this._histCache) this._histCache = {};
      this.setData({ loading: true, errorMsg: '' });
      try {
        const res = await api.weather30d({ location: this.data.location });
        if (!res || res.code !== '200' || !res.daily) {
          this.setData({ loading: false, errorMsg: '数据加载失败，请稍后重试' });
          return;
        }
        this._w30Map = {};
        let maxT = -Infinity, minT = Infinity;
        res.daily.forEach(d => {
          this._w30Map[d.fxDate] = d;
          const mx = Number(d.tempMax), mn = Number(d.tempMin);
          if (!isNaN(mx) && mx > maxT) maxT = mx;
          if (!isNaN(mn) && mn < minT) minT = mn;
        });
        this._w30Fetched = true;
        this.setData({ summaryMax: maxT, summaryMin: minT });
      } catch (e) {
        console.error('[weather-calendar] 拉取天气数据失败', e);
        this.setData({ loading: false, errorMsg: '数据加载失败，请稍后重试' });
        return;
      }
      const t = new Date();
      this._loadAndBuild(t.getFullYear(), t.getMonth() + 1, true);
    },

    // ── 计算摘要（嵌入模式从 daily prop 取）────────────────────────────────
    _computeSummary() {
      const daily = this.data.daily;
      if (!daily || !daily.length) return;
      let maxT = -Infinity, minT = Infinity;
      daily.forEach(d => {
        const mx = Number(d.tempMax), mn = Number(d.tempMin);
        if (!isNaN(mx) && mx > maxT) maxT = mx;
        if (!isNaN(mn) && mn < minT) minT = mn;
      });
      this.setData({ summaryMax: maxT, summaryMin: minT });
    },

    // ── 加载历史 + 构建网格 ────────────────────────────────────────────────
    async _loadAndBuild(year, month, autoSelectToday) {
      await this._loadHistory(year, month);
      this._buildGrid(year, month, autoSelectToday);
    },

    // ── 批量拉取当月过去 ≤10 天的历史数据 ──────────────────────────────────
    async _loadHistory(year, month) {
      const { cityId } = this.data;
      if (!cityId) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minD  = new Date(today.getTime() - 10 * 86400000);
      const total = daysInMonth(year, month);

      const needed = [];
      for (let d = 1; d <= total; d++) {
        const ds      = dateStr(year, month, d);
        const dateObj = new Date(year, month - 1, d);
        if (dateObj >= today) continue;      // 今天及之后不查历史
        if (dateObj < minD)   continue;      // 超出 10 天
        if (this._histCache[ds]) continue;   // 已缓存
        needed.push(ds);
      }
      if (!needed.length) return;

      this.setData({ loading: true });
      try {
        const results = await Promise.all(
          needed.map(ds =>
            api.historicalWeather({ location: cityId, date: toYMD(ds) })
              .then(res => ({ ds, res }))
              .catch(() => ({ ds, res: null }))
          )
        );

        results.forEach(({ ds, res }) => {
          if (!res || res.code !== '200' || !res.weatherDaily) return;
          const dw = res.weatherDaily;

          // 从正午小时记录派生白天图标
          const hourly = res.weatherHourly || [];
          let noon = null;
          if (hourly.length) {
            let minDiff = Infinity;
            hourly.forEach(h => {
              const hh   = Number((h.time || '').substr(11, 2));
              const diff = Math.abs(hh - 12);
              if (diff < minDiff) { minDiff = diff; noon = h; }
            });
          }

          const [y, mo, day] = ds.split('-').map(Number);
          const lunarMap = getLunarLabels([ds]);

          this._histCache[ds] = {
            fxDate:        ds,
            week:          weekMap[new Date(y, mo - 1, day).getDay()],
            dateLabel:     `${mo}月${day}日`,
            lunarLabel:    lunarMap[ds] || '',
            iconDay:       noon ? noon.icon : '100',
            iconNight:     '150',
            textDay:       noon ? noon.text : '',
            textNight:     '',
            tempMax:       dw.tempMax,
            tempMin:       dw.tempMin,
            windSpeedDay:  '',
            windDirDay:    dw.windDir,
            windScaleDay:  '',
            precip:        dw.precip,
            humidity:      dw.humidity,
            uvIndex:       '',
            sunrise:       dw.sunrise,
            sunset:        dw.sunset,
            moonPhase:     dw.moonPhase,
            moonPhaseIcon: dw.moonPhaseIcon,
            moonrise:      dw.moonrise,
            moonset:       dw.moonset,
            air:           null,
          };
        });
      } catch (e) {
        console.error('[weather-calendar] 历史数据加载失败', e);
      } finally {
        this.setData({ loading: false });
      }
    },

    // ── 构建月历格子数组 ───────────────────────────────────────────────────
    _buildGrid(year, month, autoSelectToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = dateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const minD = new Date(today.getTime() - 10 * 86400000);

      // 预报数据源：嵌入模式用 daily prop，独立模式用 _w30Map
      // 必须先建好映射，再从实际数据推算 maxD，避免硬编码 +30 导致多出无数据的格子
      const w30Map = {};
      const dailyArr = this.data.daily;
      if (dailyArr && dailyArr.length) {
        dailyArr.forEach(item => { w30Map[item.fxDate] = item; });
      } else if (this._w30Map) {
        Object.assign(w30Map, this._w30Map);
      }

      // 以实际最后一条预报日期为上限
      const forecastDates = Object.keys(w30Map).filter(d => d >= todayStr).sort();
      const maxD = forecastDates.length
        ? new Date(forecastDates[forecastDates.length - 1] + 'T00:00:00')
        : new Date(today.getTime() + 29 * 86400000);

      const total  = daysInMonth(year, month);
      const offset = firstOffset(year, month);
      const allDates = Array.from({ length: total }, (_, i) => dateStr(year, month, i + 1));
      const lunarMap = getLunarLabels(allDates);

      const cells = [];
      for (let i = 0; i < offset; i++) cells.push({ empty: true, key: `ce-${i}` });

      for (let d = 1; d <= total; d++) {
        const ds      = dateStr(year, month, d);
        const dateObj = new Date(year, month - 1, d);
        const inRange = dateObj >= minD && dateObj <= maxD;
        const item    = w30Map[ds] || (this._histCache && this._histCache[ds]) || null;

        cells.push({
          empty:      false,
          key:        ds,
          date:       ds,
          day:        d,
          lunarLabel: lunarMap[ds] || '',
          isToday:    ds === todayStr,
          isPast:     ds < todayStr,
          inRange,
          hasData:    !!(item && inRange),
          iconDay:    item ? (item.iconDay   || '') : '',
          iconNight:  item ? (item.iconNight || '') : '',
          textDay:    item ? (item.textDay   || '') : '',
          textNight:  item ? (item.textNight || '') : '',
          tempMax:    item ? item.tempMax : '',
          tempMin:    item ? item.tempMin : '',
          isSunday:   new Date(year, month - 1, d).getDay() === 0,
        });
      }

      // 导航按钮可用性
      const prevLast  = new Date(year, month - 1, 0);
      const nextFirst = new Date(year, month, 1);

      this.setData({
        viewYear:     year,
        viewMonth:    month,
        cells,
        canGoPrev:    prevLast  >= minD,
        canGoNext:    nextFirst <= maxD,
        selectedDate: '',
        selectedItem: null,
      });

      // 自动选中今天（仅初始化时，且今天在当前月且有数据）
      if (autoSelectToday) {
        const todayCell = cells.find(c => !c.empty && c.date === todayStr && c.hasData);
        if (todayCell) this._selectDate(todayStr);
      }
    },

    // ── 查找某日期对应的完整数据项 ───────────────────────────────────────
    _findItem(date) {
      const dailyArr = this.data.daily;
      if (dailyArr && dailyArr.length) {
        const found = dailyArr.find(d => d.fxDate === date);
        if (found) return found;
      }
      if (this._w30Map   && this._w30Map[date])   return this._w30Map[date];
      if (this._histCache && this._histCache[date]) return this._histCache[date];
      return null;
    },

    // ── 选中某日期并显示详情卡 ────────────────────────────────────────────
    _selectDate(date) {
      const item = this._findItem(date);
      if (!item) return;
      this.setData({ selectedDate: date, selectedItem: item });
    },

    // ── 用户事件 ──────────────────────────────────────────────────────────
    onDayTap(e) {
      const { date } = e.currentTarget.dataset;
      if (!date) return;
      // 若再次点击同一天，关闭详情
      if (this.data.selectedDate === date) {
        this.setData({ selectedDate: '', selectedItem: null });
        return;
      }
      this._selectDate(date);
    },

    onPrevMonth() {
      if (!this.data.canGoPrev) return;
      let { viewYear: y, viewMonth: m } = this.data;
      if (--m < 1) { m = 12; y--; }
      this._loadAndBuild(y, m, false);
    },

    onNextMonth() {
      if (!this.data.canGoNext) return;
      let { viewYear: y, viewMonth: m } = this.data;
      if (++m > 12) { m = 1; y++; }
      this._loadAndBuild(y, m, false);
    },

    onRetry() {
      // 清除独立模式缓存，重新拉取
      this._w30Fetched = false;
      this._w30Map     = null;
      this._histCache  = {};
      this.setData({ errorMsg: '' });
      const { daily, location } = this.data;
      if (daily && daily.length) {
        this._init(true);
      } else if (location) {
        this._fetchAndInit();
      }
    },
  },
});
