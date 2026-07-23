// skills/weather-skill/utils/time.js
// 时间辅助函数（skills 包内部使用）。
// 注：主应用 utils/astronomyCanvas.js 有同签名的 toMin；
// 因 skills 需独立部署，两者无法共享，但实现保持一致。

// 'HH:MM' → 分钟数；null / 空字符串 / '--:--' / 非法值 → 返回 null
const toMin = (str) => {
  if (!str || str === '--:--') return null;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

module.exports = { toMin };
