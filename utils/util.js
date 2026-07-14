const formatDate = (date) => {
  const pad = (n) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// RGBA 对象 → hex 字符串
const toHex = (c = {}) => `#${c.red.toString(16).padStart(2, '0')}${c.green.toString(16).padStart(2, '0')}${c.blue.toString(16).padStart(2, '0')}`;

// 根据背景色计算文字颜色（深色背景用白色，浅色背景用深色）
const getTextColor = (hexColor) => {
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#333' : '#fff';
};

// utcOffset 如 "+08:00" → 相对本地时差文字："早Xh" / "晚Xh" / ""（同区返回空串）
const tzDiffText = (utcOffset) => {
  if (!utcOffset) return '';
  const m = utcOffset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return '';
  const cityMin = (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) * 60 + parseInt(m[3]));
  const localMin = -new Date().getTimezoneOffset();
  const diff = cityMin - localMin;
  if (diff === 0) return '';
  const abs = Math.abs(diff);
  const label = abs % 60 === 0 ? `${abs / 60}h` : `${Math.floor(abs / 60)}h${abs % 60}m`;
  return diff > 0 ? `早${label}` : `晚${label}`;
};

module.exports = {
  formatDate,
  toHex,
  getTextColor,
  tzDiffText,
};
