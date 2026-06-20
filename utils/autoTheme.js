// 主题色随天气/时段自动切换
// 复用 iconColor.wxs 的天气分类逻辑，结合日出日落判断时段

// 天气图标 code → 分类（与 iconColor.wxs 保持一致）
const getWeatherCategory = (code) => {
  const c = parseInt(code, 10);
  if (isNaN(c)) return 'default';
  if (c === 100 || c === 150) return 'sunny';
  if (c === 101 || c === 151) return 'partlyCloudy';
  if (c === 102 || c === 103 || c === 152 || c === 153) return 'cloudy';
  if (c === 104 || c === 154) return 'overcast';
  if (c === 302 || c === 303 || c === 304) return 'thunder';
  if (c === 300 || c === 305 || c === 309 || c === 313 || c === 399 ||
      c === 350 || c === 351) return 'rainLight';
  if (c === 301 || c === 306 || c === 307 || c === 308 ||
      c === 310 || c === 311 || c === 312 ||
      c === 314 || c === 315 || c === 316 || c === 317 || c === 318) return 'rainHeavy';
  if (c === 404 || c === 405) return 'sleet';
  if (c === 400 || c === 406 || c === 407 || c === 408 ||
      c === 456 || c === 457 || c === 499) return 'snow';
  if (c === 401 || c === 402 || c === 403 || c === 409 || c === 410) return 'snowHeavy';
  if (c === 500 || c === 501 || c === 502 || c === 509 ||
      c === 510 || c === 514 || c === 515) return 'fog';
  if (c === 503 || c === 504 || c === 511 || c === 512 || c === 513) return 'haze';
  if (c === 507 || c === 508) return 'sand';
  if (c >= 800 && c <= 807) return 'typhoon';
  if (c === 900) return 'hot';
  if (c === 901) return 'cold';
  return 'default';
};

// ISO 8601 时间字符串 → 当天分钟数（如 "2024-01-15T07:25+08:00" → 445）
const isoToMinutes = (isoStr) => {
  if (!isoStr) return null;
  const match = isoStr.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

// 判断时段：day / dusk / night
// 黄昏窗口：日落前后各 30 分钟
const getTimePeriod = (sunriseISO, sunsetISO) => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const riseMin = isoToMinutes(sunriseISO);
  const setMin = isoToMinutes(sunsetISO);

  // 有日出日落数据
  if (riseMin != null && setMin != null) {
    if (nowMin >= riseMin + 30 && nowMin <= setMin - 30) return 'day';
    if (nowMin > setMin - 30 && nowMin <= setMin + 30) return 'dusk';
    return 'night';
  }

  // 无数据时回落到小时规则
  const hour = now.getHours();
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 18) return 'dusk';
  return 'night';
};

// 颜色映射表：天气分类 × 时段
const COLOR_MAP = {
  sunny:        { day: '#1296db', dusk: '#fa8c16', night: '#1a3a5c' },
  partlyCloudy: { day: '#5b9bd5', dusk: '#e0854d', night: '#2d4a6b' },
  cloudy:       { day: '#7b9bb5', dusk: '#a07855', night: '#3d4f63' },
  overcast:     { day: '#5a7080', dusk: '#7a6555', night: '#2c3640' },
  thunder:      { day: '#7b3fa0', dusk: '#8b3a6a', night: '#4a2060' },
  rainLight:    { day: '#5ba3d9', dusk: '#6b8aaa', night: '#2e5577' },
  rainHeavy:    { day: '#1e4d8c', dusk: '#2a4060', night: '#152d4a' },
  sleet:        { day: '#6aafd6', dusk: '#7a90a5', night: '#3a6080' },
  snow:         { day: '#a8d8ea', dusk: '#b0a898', night: '#5a7890' },
  snowHeavy:    { day: '#d0eef8', dusk: '#b8b0a5', night: '#7890a0' },
  fog:          { day: '#9e9e9e', dusk: '#8a8070', night: '#4a4a4a' },
  haze:         { day: '#b5854a', dusk: '#a07040', night: '#5a4030' },
  sand:         { day: '#c49a3c', dusk: '#a07830', night: '#5a4520' },
  typhoon:      { day: '#e53935', dusk: '#c04030', night: '#701a1a' },
  hot:          { day: '#dc143c', dusk: '#c04040', night: '#6a1020' },
  cold:         { day: '#81d4fa', dusk: '#7090a5', night: '#3a6080' },
  default:      { day: '#8c9aa5', dusk: '#8a7a6a', night: '#4a5565' },
};

// 主函数：根据天气图标和日出日落时间解析主题色
const resolveTheme = (weatherIcon, sunriseISO, sunsetISO) => {
  const category = getWeatherCategory(weatherIcon);
  const period = getTimePeriod(sunriseISO, sunsetISO);
  return COLOR_MAP[category]?.[period] || COLOR_MAP.default[period];
};

// 卡片背景色映射表：天气分类 × 时段（深色调，保持文字可读性）
const BG_MAP = {
  sunny:        { day: 'rgba(25, 60, 100, 0.85)', dusk: 'rgba(80, 45, 20, 0.85)', night: 'rgba(15, 25, 45, 0.85)' },
  partlyCloudy: { day: 'rgba(35, 55, 80, 0.85)',  dusk: 'rgba(70, 45, 25, 0.85)', night: 'rgba(20, 30, 50, 0.85)' },
  cloudy:       { day: 'rgba(45, 55, 70, 0.85)',   dusk: 'rgba(60, 50, 35, 0.85)', night: 'rgba(25, 30, 42, 0.85)' },
  overcast:     { day: 'rgba(50, 55, 65, 0.85)',   dusk: 'rgba(55, 48, 40, 0.85)', night: 'rgba(22, 25, 32, 0.85)' },
  thunder:      { day: 'rgba(60, 30, 80, 0.85)',   dusk: 'rgba(55, 25, 55, 0.85)', night: 'rgba(35, 15, 50, 0.85)' },
  rainLight:    { day: 'rgba(30, 55, 85, 0.85)',   dusk: 'rgba(45, 50, 65, 0.85)', night: 'rgba(18, 35, 55, 0.85)' },
  rainHeavy:    { day: 'rgba(15, 40, 70, 0.85)',   dusk: 'rgba(25, 35, 50, 0.85)', night: 'rgba(10, 22, 40, 0.85)' },
  sleet:        { day: 'rgba(35, 55, 80, 0.85)',   dusk: 'rgba(50, 50, 60, 0.85)', night: 'rgba(20, 35, 50, 0.85)' },
  snow:         { day: 'rgba(55, 65, 80, 0.85)',   dusk: 'rgba(65, 58, 50, 0.85)', night: 'rgba(30, 40, 55, 0.85)' },
  snowHeavy:    { day: 'rgba(65, 75, 90, 0.85)',   dusk: 'rgba(70, 65, 58, 0.85)', night: 'rgba(40, 48, 60, 0.85)' },
  fog:          { day: 'rgba(60, 60, 60, 0.85)',   dusk: 'rgba(55, 50, 45, 0.85)', night: 'rgba(30, 30, 30, 0.85)' },
  haze:         { day: 'rgba(70, 55, 35, 0.85)',   dusk: 'rgba(60, 45, 30, 0.85)', night: 'rgba(35, 28, 20, 0.85)' },
  sand:         { day: 'rgba(75, 60, 30, 0.85)',   dusk: 'rgba(60, 48, 25, 0.85)', night: 'rgba(35, 30, 18, 0.85)' },
  typhoon:      { day: 'rgba(100, 30, 30, 0.85)',  dusk: 'rgba(75, 25, 25, 0.85)', night: 'rgba(50, 15, 15, 0.85)' },
  hot:          { day: 'rgba(90, 25, 35, 0.85)',   dusk: 'rgba(70, 25, 30, 0.85)', night: 'rgba(45, 15, 20, 0.85)' },
  cold:         { day: 'rgba(40, 60, 80, 0.85)',   dusk: 'rgba(45, 50, 60, 0.85)', night: 'rgba(20, 35, 50, 0.85)' },
  default:      { day: 'rgba(34, 37, 48, 0.85)',   dusk: 'rgba(34, 37, 48, 0.85)', night: 'rgba(34, 37, 48, 0.85)' },
};

// 卡片背景色：根据天气图标和日出日落时间解析
const resolveThemeBg = (weatherIcon, sunriseISO, sunsetISO) => {
  const category = getWeatherCategory(weatherIcon);
  const period = getTimePeriod(sunriseISO, sunsetISO);
  return BG_MAP[category]?.[period] || BG_MAP.default[period];
};

module.exports = {
  resolveTheme,
  resolveThemeBg,
  getWeatherCategory,
};
