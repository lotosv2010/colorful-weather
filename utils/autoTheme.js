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

// 时间字符串 → 当天分钟数
// 支持 ISO 8601（"2024-01-15T07:25+08:00"）和纯 HH:mm（"07:25"，7 日预报接口格式）
const isoToMinutes = (isoStr) => {
  if (!isoStr) return null;
  const isoMatch = isoStr.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return parseInt(isoMatch[1], 10) * 60 + parseInt(isoMatch[2], 10);
  const hmMatch = isoStr.match(/^(\d{2}):(\d{2})$/);
  if (hmMatch) return parseInt(hmMatch[1], 10) * 60 + parseInt(hmMatch[2], 10);
  return null;
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
  const themeColor = COLOR_MAP[category]?.[period] || COLOR_MAP.default[period];
  return themeColor;
};

// 卡片背景色映射表：天气分类 × 时段（渐变色，左下角亮度低，右上角亮度高）
const BG_MAP = {
  sunny:        { day: 'linear-gradient(315deg, rgb(25, 45, 85) 0%, rgb(55, 85, 145) 100%)', dusk: 'linear-gradient(315deg, rgb(50, 30, 15) 0%, rgb(95, 65, 35) 100%)', night: 'linear-gradient(315deg, rgb(12, 18, 35) 0%, rgb(28, 40, 65) 100%)' },
  partlyCloudy: { day: 'linear-gradient(315deg, rgb(30, 45, 70) 0%, rgb(60, 85, 120) 100%)', dusk: 'linear-gradient(315deg, rgb(45, 30, 18) 0%, rgb(80, 58, 35) 100%)', night: 'linear-gradient(315deg, rgb(15, 22, 40) 0%, rgb(32, 45, 70) 100%)' },
  cloudy:       { day: 'linear-gradient(315deg, rgb(38, 45, 58) 0%, rgb(72, 82, 100) 100%)', dusk: 'linear-gradient(315deg, rgb(42, 35, 25) 0%, rgb(78, 65, 48) 100%)', night: 'linear-gradient(315deg, rgb(18, 22, 30) 0%, rgb(38, 45, 58) 100%)' },
  overcast:     { day: 'linear-gradient(315deg, rgb(40, 44, 52) 0%, rgb(75, 80, 92) 100%)',  dusk: 'linear-gradient(315deg, rgb(38, 32, 25) 0%, rgb(72, 60, 48) 100%)', night: 'linear-gradient(315deg, rgb(16, 18, 24) 0%, rgb(35, 38, 48) 100%)' },
  thunder:      { day: 'linear-gradient(315deg, rgb(45, 20, 65) 0%, rgb(95, 48, 125) 100%)',  dusk: 'linear-gradient(315deg, rgb(40, 18, 40) 0%, rgb(78, 38, 78) 100%)', night: 'linear-gradient(315deg, rgb(22, 10, 35) 0%, rgb(48, 22, 68) 100%)' },
  rainLight:    { day: 'linear-gradient(315deg, rgb(28, 45, 72) 0%, rgb(58, 82, 118) 100%)',  dusk: 'linear-gradient(315deg, rgb(32, 35, 45) 0%, rgb(62, 68, 82) 100%)', night: 'linear-gradient(315deg, rgb(12, 25, 40) 0%, rgb(30, 48, 72) 100%)' },
  rainHeavy:    { day: 'linear-gradient(315deg, rgb(15, 30, 55) 0%, rgb(32, 58, 98) 100%)',   dusk: 'linear-gradient(315deg, rgb(18, 25, 35) 0%, rgb(40, 50, 65) 100%)', night: 'linear-gradient(315deg, rgb(8, 15, 28) 0%, rgb(18, 32, 52) 100%)' },
  sleet:        { day: 'linear-gradient(315deg, rgb(30, 45, 70) 0%, rgb(60, 82, 115) 100%)',  dusk: 'linear-gradient(315deg, rgb(35, 35, 42) 0%, rgb(65, 65, 75) 100%)', night: 'linear-gradient(315deg, rgb(15, 25, 38) 0%, rgb(32, 45, 65) 100%)' },
  snow:         { day: 'linear-gradient(315deg, rgb(42, 50, 65) 0%, rgb(82, 92, 115) 100%)',   dusk: 'linear-gradient(315deg, rgb(45, 38, 32) 0%, rgb(82, 72, 62) 100%)', night: 'linear-gradient(315deg, rgb(20, 28, 38) 0%, rgb(42, 55, 72) 100%)' },
  snowHeavy:    { day: 'linear-gradient(315deg, rgb(48, 55, 72) 0%, rgb(92, 102, 125) 100%)',  dusk: 'linear-gradient(315deg, rgb(48, 42, 38) 0%, rgb(88, 80, 72) 100%)', night: 'linear-gradient(315deg, rgb(25, 32, 42) 0%, rgb(52, 62, 78) 100%)' },
  fog:          { day: 'linear-gradient(315deg, rgb(55, 60, 42) 0%, rgb(105, 112, 78) 100%)',  dusk: 'linear-gradient(315deg, rgb(38, 35, 28) 0%, rgb(72, 65, 55) 100%)', night: 'linear-gradient(315deg, rgb(20, 20, 20) 0%, rgb(42, 42, 42) 100%)' },
  haze:         { day: 'linear-gradient(315deg, rgb(52, 40, 25) 0%, rgb(98, 78, 48) 100%)',    dusk: 'linear-gradient(315deg, rgb(40, 30, 20) 0%, rgb(75, 58, 38) 100%)', night: 'linear-gradient(315deg, rgb(22, 18, 12) 0%, rgb(48, 38, 28) 100%)' },
  sand:         { day: 'linear-gradient(315deg, rgb(55, 42, 20) 0%, rgb(102, 82, 42) 100%)',   dusk: 'linear-gradient(315deg, rgb(40, 32, 18) 0%, rgb(75, 60, 35) 100%)', night: 'linear-gradient(315deg, rgb(22, 18, 10) 0%, rgb(48, 42, 25) 100%)' },
  typhoon:      { day: 'linear-gradient(315deg, rgb(72, 20, 20) 0%, rgb(138, 42, 42) 100%)',   dusk: 'linear-gradient(315deg, rgb(52, 18, 18) 0%, rgb(98, 35, 35) 100%)', night: 'linear-gradient(315deg, rgb(32, 10, 10) 0%, rgb(65, 22, 22) 100%)' },
  hot:          { day: 'linear-gradient(315deg, rgb(65, 18, 25) 0%, rgb(125, 38, 48) 100%)',   dusk: 'linear-gradient(315deg, rgb(48, 18, 22) 0%, rgb(88, 32, 38) 100%)', night: 'linear-gradient(315deg, rgb(28, 10, 15) 0%, rgb(58, 22, 28) 100%)' },
  cold:         { day: 'linear-gradient(315deg, rgb(30, 45, 65) 0%, rgb(58, 82, 112) 100%)',   dusk: 'linear-gradient(315deg, rgb(32, 35, 42) 0%, rgb(62, 68, 78) 100%)', night: 'linear-gradient(315deg, rgb(15, 25, 35) 0%, rgb(32, 45, 65) 100%)' },
  default:      { day: 'linear-gradient(315deg, rgb(28, 30, 38) 0%, rgb(55, 58, 72) 100%)',    dusk: 'linear-gradient(315deg, rgb(28, 30, 38) 0%, rgb(55, 58, 72) 100%)', night: 'linear-gradient(315deg, rgb(28, 30, 38) 0%, rgb(55, 58, 72) 100%)' },
};

// 卡片背景色：根据天气图标和日出日落时间解析
const resolveThemeBg = (weatherIcon, sunriseISO, sunsetISO) => {
  const category = getWeatherCategory(weatherIcon);
  const period = getTimePeriod(sunriseISO, sunsetISO);
  const bgColor = BG_MAP[category]?.[period] || BG_MAP.default[period];
  return bgColor;
};
module.exports = {
  resolveTheme,
  resolveThemeBg,
  getWeatherCategory,
};
