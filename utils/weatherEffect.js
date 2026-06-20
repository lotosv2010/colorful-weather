// 天气动效映射：天气分类 → 粒子效果 + 卡片装饰
const { getWeatherCategory } = require('./autoTheme');

// 天气分类 → 动效配置
const EFFECT_MAP = {
  sunny:        { particle: 'lightMotes',  decor: 'sun-spots' },
  partlyCloudy: { particle: 'subtleMotes', decor: 'cloud-spot' },
  cloudy:       { particle: null,          decor: 'clouds' },
  overcast:     { particle: null,          decor: 'clouds' },
  thunder:      { particle: 'thunderRain', decor: 'lightning-drops' },
  rainLight:    { particle: 'lightRain',   decor: 'drops' },
  rainHeavy:    { particle: 'heavyRain',   decor: 'drops-heavy' },
  sleet:        { particle: 'mixed',       decor: 'drops-snow' },
  snow:         { particle: 'lightSnow',   decor: 'snowflakes' },
  snowHeavy:    { particle: 'heavySnow',   decor: 'snowflakes-heavy' },
  fog:          { particle: 'drifting',    decor: 'fog-circles' },
  haze:         { particle: 'drifting',    decor: 'haze-circles' },
  sand:         { particle: 'drifting',    decor: 'sand-dots' },
  typhoon:      { particle: 'heavyRain',   decor: 'wind-icon' },
  hot:          { particle: 'lightMotes',  decor: 'sun-glow' },
  cold:         { particle: 'lightSnow',   decor: 'snowflake' },
  default:      { particle: null,          decor: null },
};

// 根据天气 icon code 解析动效配置
const resolveWeatherEffect = (iconCode) => {
  const cat = getWeatherCategory(iconCode);
  return EFFECT_MAP[cat] || EFFECT_MAP.default;
};

module.exports = { resolveWeatherEffect, EFFECT_MAP };
