// utils/iconColor.js
// 天气图标 code（数字字符串）→ 颜色 hex（JS 版本）
// 注意：同目录下的 iconColor.wxs 是 WXS 格式，供 WXML 模板内直接使用；
// 本文件为普通 JS 模块，供 Page / Component JS 逻辑层调用。
// 分类逻辑统一由 autoTheme.js 的 getWeatherCategory 提供，此处不再内联。

const { getWeatherCategory } = require('./autoTheme');

const COLOR_MAP = {
  sunny: '#FDB813', partlyCloudy: '#F0A500', cloudy: '#7B9BB5',
  overcast: '#5A7080', rainLight: '#5BA3D9', rainHeavy: '#1E4D8C',
  thunder: '#7B3FA0', sleet: '#6AAFD6', snow: '#A8D8EA',
  snowHeavy: '#D0EEF8', fog: '#9E9E9E', haze: '#B5854A',
  sand: '#C49A3C', typhoon: '#E53935', hot: '#DC143C',
  cold: '#81D4FA', default: '#8C9AA5',
};

const iconColor = (code) => COLOR_MAP[getWeatherCategory(code)] || COLOR_MAP.default;

module.exports = { iconColor, COLOR_MAP };
