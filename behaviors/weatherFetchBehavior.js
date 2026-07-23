// behaviors/weatherFetchBehavior.js
// 天气数据拉取：并发请求 11 个接口、格式化结果、写入 data，以及请求取消逻辑。
// 依赖主页 data 中的 latitude/longitude/cityId，以及 _buildCityPages()（cityPagesBehavior）。

const {
  now, indices, hourly, sevenDay, air, sun, moon,
  warning, minutely, historicalWeather, solarElevationAngle,
} = require('../utils/api');
const { formatDate } = require('../utils/util');
const { formatHourly, formatDaily, formatAir, formatDateStr } = require('../utils/weatherFormat');
const { buildSummary, buildShortDesc } = require('../utils/summary');
const { resolveTheme, resolveThemeBg } = require('../utils/autoTheme');
const { resolveWeatherEffect } = require('../utils/weatherEffect');
const prefs = require('../utils/prefs');
const monitor = require('../utils/monitor');

// 收集当前批次的 wx.request task，用于城市切换时取消未完成的旧请求
let _pendingTasks = [];

module.exports = Behavior({
  methods: {
    // 取消上一批未完成的请求，避免城市切换时旧数据覆盖新结果
    _abortPending() {
      _pendingTasks.forEach(t => { try { t.abort(); } catch (_) {} });
      _pendingTasks = [];
    },

    // 生活指数请求（type:0 = 所有类型）
    getIndices(location, tc, opts) {
      return indices({ location, type: 0 }, tc, opts);
    },

    async getWeather(opts = {}) {
      // 防止并发重复调用
      if (this._fetching) return;
      this._fetching = true;
      try {
        this._abortPending();
        this.setData({ loading: true });

        const { longitude, latitude } = this.data;
        let location;
        if (longitude && latitude) {
          location = `${Number(longitude).toFixed(2)},${Number(latitude).toFixed(2)}`;
        } else if (this.data.cityId) {
          location = this.data.cityId;
        } else {
          this.setData({ loading: false, errorMsg: '请先选择城市', selectorVisible: true });
          return;
        }

        const today = formatDateStr(new Date());
        const tc = _pendingTasks; // 当前批次 taskCollector
        const { force = false } = opts;
        const reqOpts = force ? { force: true } : undefined;
        const cityId = this.data.cityId;
        const yesterdayStr = formatDateStr(new Date(Date.now() - 86400000));

        // 太阳高度角所需的当前时间 / 时区参数
        const _now = new Date();
        const _tzOff = -_now.getTimezoneOffset();
        const _tzStr = `${_tzOff < 0 ? '-' : ''}${String(Math.floor(Math.abs(_tzOff) / 60)).padStart(2, '0')}${String(Math.abs(_tzOff) % 60).padStart(2, '0')}`;
        const _timeHHmm = `${String(_now.getHours()).padStart(2, '0')}${String(_now.getMinutes()).padStart(2, '0')}`;

        const [
          weatherData, { daily }, { hourly: hourlyData }, { daily: dailyData },
          airRes, sunData, moonData, warningRes, minutelyRes, histRes, solarAngleData,
        ] = await Promise.all([
          now({ location }, tc, reqOpts),
          this.getIndices(location, tc, reqOpts),
          hourly({ location }, tc, reqOpts),
          sevenDay({ location }, tc, reqOpts),
          air(location, tc, reqOpts),
          sun({ location, date: today }, tc, reqOpts),
          moon({ location, date: today }, tc, reqOpts),
          warning(location, tc, reqOpts).catch(() => null),
          minutely({ location }, tc, reqOpts).catch(() => null),
          cityId ? historicalWeather({ location: cityId, date: yesterdayStr }).catch(() => null) : Promise.resolve(null),
          solarElevationAngle({ location, date: today, time: _timeHHmm, tz: _tzStr, alt: 0 }, tc, reqOpts).catch(() => null),
        ]);

        // 转换空气质量数据：indexes[0] + pollutants[] → 扁平结构供组件使用
        const airData = formatAir(airRes);

        // 昨日最高温（用于"比昨天"温度对比）
        const yMax = histRes && histRes.code === '200' && histRes.weatherDaily
          ? Number(histRes.weatherDaily.tempMax) : null;
        const desc = buildSummary({
          now: weatherData?.now,
          today: dailyData[0],
          air: airData,
          yesterdayTempMax: yMax != null && !isNaN(yMax) ? yMax : null,
        });
        const shortDesc = buildShortDesc({ now: weatherData?.now, today: dailyData[0], air: airData });

        // 预警数据：metadata.zeroResult 为 true 时表示无预警
        const alerts = (warningRes && !warningRes.metadata?.zeroResult && warningRes.alerts)
          ? warningRes.alerts : [];

        // 分钟级降水：取有降水的类型，默认 rain
        const minutelyData = minutelyRes?.minutely || [];
        const hasPrecip = minutelyData.some(m => Number(m.precip) > 0);
        const minutelyType = minutelyData.some(m => Number(m.precip) > 0 && m.type === 'snow') ? 'snow' : 'rain';

        this.setData({
          dateNow: formatDate(new Date()).substr(11, 5),
          currentWeather: weatherData?.now,
          uv: daily.find(d => d.type === '5')?.category,
          clothingTip: (() => { const c = daily.find(d => d.type === '3'); return c ? { category: c.category, text: c.text } : null; })(),
          desc,
          shortDesc,
          hourly: formatHourly(hourlyData),
          daily: formatDaily(dailyData),
          air: airData,
          indices: daily,
          astronomySun: sunData,
          astronomyMoon: moonData,
          astronomySolarAngle: solarAngleData,
          alerts,
          showMinutelyEntry: hasPrecip,
          minutelySummary: minutelyRes?.summary || '',
          minutelyType,
          weatherEffect: resolveWeatherEffect(weatherData?.now?.icon),
          loading: false,
          errorMsg: '',
        });

        // 自动主题色：天气数据更新后重新计算
        const p = prefs.getPrefs();
        const updates = {};
        const prefsPatch = {};
        if (p.themeMode === 'auto') {
          const autoColor = resolveTheme(weatherData?.now?.icon, sunData?.sunrise, sunData?.sunset);
          if (autoColor !== this.data.themeColor) updates.themeColor = autoColor;
          if (autoColor !== p.themeColor) prefsPatch.themeColor = autoColor;
        }
        if (p.cardBgMode === 'auto') {
          const autoBg = resolveThemeBg(weatherData?.now?.icon, sunData?.sunrise, sunData?.sunset);
          if (autoBg !== this.data.weatherBg) updates.weatherBg = autoBg;
        }
        if (Object.keys(updates).length) this.setData(updates);
        if (Object.keys(prefsPatch).length) prefs.setPrefs(prefsPatch);
        this._buildCityPages();
      } catch (error) {
        console.error(error);
        monitor.recordError('page', error?.message || '天气数据加载失败', { page: '/pages/index/index', stack: error?.stack });
        this.setData({ loading: false, errorMsg: '数据加载失败，请稍后再试' });
      } finally {
        this._fetching = false;
      }
    },
  },
});
