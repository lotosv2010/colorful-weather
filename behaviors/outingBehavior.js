// behaviors/outingBehavior.js
// 出行类页面（camping / trip）共享逻辑：
//   - 7 天预报解析 → 带 week/dateLabel 的日期结构
//   - 生活指数（indices3d）解析 → dateStr → { type → item } 嵌套 map
//   - 实时空气质量解析 → { aqi, category, level, color }
//   - 城市选择面板通用开关方法
//
// 各页面自行保留：评分算法（评级规则不同）、日期点击/切换、城市切换后的私有状态清理。

const { getDefinition, getColor } = require('../utils/lifeMeta');
const { toHex, safeNum } = require('../utils/util');
const { parseDateParts } = require('../utils/date');
const { AQI_LEVEL_COLORS } = require('../utils/airMeta');

module.exports = Behavior({
  methods: {
    // 解析 7 天预报：截取前 7 天，附加 week/dateLabel，数值字段用 safeNum 兜底
    _processDaily(res) {
      if (!res || res.code !== '200' || !res.daily) return [];
      return res.daily.slice(0, 7).map(d => {
        const { week, dateLabel } = parseDateParts(d.fxDate);
        return {
          fxDate: d.fxDate,
          week,
          dateLabel,
          iconDay: d.iconDay,
          textDay: d.textDay,
          tempMax: safeNum(d.tempMax),
          tempMin: safeNum(d.tempMin),
          humidity: safeNum(d.humidity),
          pop: safeNum(d.pop),
          windDirDay: d.windDirDay || '',
          windScaleDay: d.windScaleDay || '',
          uvIndex: safeNum(d.uvIndex),
          vis: safeNum(d.vis),
        };
      });
    },

    // 解析 indices3d：构建 dateStr → { type → item } 的嵌套 map
    _processIndices(res) {
      if (!res || res.code !== '200' || !res.daily) return {};
      const map = {};
      res.daily.forEach(item => {
        const dateStr = item.date; // indices3d 使用 item.date
        if (!map[dateStr]) map[dateStr] = {};
        map[dateStr][item.type] = {
          type: item.type,
          name: item.name || (getDefinition(item.type) || {}).name || '',
          level: item.level,
          category: item.category,
          text: item.text,
          color: getColor(item.type, item.level, item.category),
        };
      });
      return map;
    },

    // 解析实时空气质量：颜色优先用接口 RGB，缺失时按 level 兜底
    _processAir(res) {
      if (!res || !res.indexes || !res.indexes.length) return null;
      const idx = res.indexes[0];
      const colorHex = idx.color ? toHex(idx.color) : (AQI_LEVEL_COLORS[idx.level] || '#9BB365');
      return {
        aqi: idx.aqi,
        aqiDisplay: idx.aqiDisplay || idx.aqi,
        category: idx.category || '',
        level: idx.level || '',
        color: colorHex,
      };
    },

    // 通用城市选择面板开关
    onSelectSlot() {
      this.setData({ selectorVisible: true });
    },

    onSelectorClose() {
      this.setData({ selectorVisible: false });
    },
  },
});
