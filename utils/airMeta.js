// utils/airMeta.js
// 历史空气质量接口（v7/historical/air）返回 level/category 但不含颜色，
// 此处仅保留 level → color 映射供 timemachine 组件着色使用。

const AQI_LEVEL_COLORS = {
  '1': '#4caf50',
  '2': '#8bc34a',
  '3': '#ffb300',
  '4': '#ff9800',
  '5': '#f44336',
  '6': '#b71c1c',
};

module.exports = { AQI_LEVEL_COLORS };
