// utils/tripAdvice.js
// 出行建议评分工具（基于实时天气 + 今日预报 + 空气质量）
// 同逻辑亦用于 pages/share/index 分享卡片。
// 注意：pages/trip/index.js 有基于 7 天预报的 _calcScore，评分参数不同，后续可统一。

// 出行建议评级配置（与 pages/trip/index.js 的 GRADE_MAP 相同）
const ADVICE_GRADE_MAP = [
  { minScore: 4,   icon: '🌟', label: '晴好出行',           color: '#4caf50' },
  { minScore: 2,   icon: '👍', label: '适合出行',           color: '#8bc34a' },
  { minScore: 0,   icon: '☂️', label: '可以出行，建议备伞',  color: '#ffb300' },
  { minScore: -2,  icon: '⚠️', label: '谨慎出行，做好防护',  color: '#ff9800' },
  { minScore: -99, icon: '🚫', label: '不建议出行',          color: '#f44336' },
];

/**
 * 计算出行建议（基于实时天气 + 今日预报 + 空气质量）
 * @param {{ currentWeather: object, daily0: object, air: object }} params
 *   - currentWeather: now API 返回的实时数据（含 icon / windScale）
 *   - daily0:         今日预报数据（含 pop 降水概率）
 *   - air:            经 formatAir 处理后的空气质量数据（含 level）
 * @returns {{ score: number, icon: string, label: string, color: string, tips: string[] }}
 */
function calcTripAdvice({ currentWeather = {}, daily0, air } = {}) {
  let score = 0;
  const tips = [];

  // 天气图标 code → 评分
  const ic = parseInt(String(currentWeather && currentWeather.icon || '100'), 10);
  if (ic <= 103) score += 2;
  else if (ic <= 299) score += 1;
  else if (ic >= 300 && ic <= 313) { score -= 1; tips.push('可能有降雨，建议携带雨具'); }
  else if (ic >= 314 && ic <= 349) { score -= 2; tips.push('降水较强，谨慎出行'); }
  else if (ic >= 350 && ic <= 399) { score -= 3; tips.push('强对流天气，不建议外出'); }
  else if (ic >= 400 && ic <= 499) { score -= 1; tips.push('有降雪天气，注意路况'); }
  else if (ic >= 500 && ic <= 515) { score -= 1; tips.push('能见度较低，注意行车安全'); }
  else if (ic >= 516 && ic <= 599) { score -= 2; tips.push('沙尘天气，注意防护'); }

  // 降水概率
  const pop = daily0 && daily0.pop != null ? Number(daily0.pop) : 0;
  if (pop >= 70 && !tips.some(t => t.includes('降水') || t.includes('雨'))) {
    score -= 1; tips.push(`降水概率 ${pop}%，建议备伞`);
  }

  // 风力
  const ws = parseInt(String(currentWeather && currentWeather.windScale || '0').split('-')[0], 10) || 0;
  if (ws >= 6) { score -= 1; tips.push(`风力较大（${currentWeather.windScale}级），注意出行安全`); }

  // 空气质量
  if (air) {
    const lvl = parseInt(String(air.level || '1'), 10) || 1;
    if (lvl >= 4) { score -= 2; tips.push('空气质量较差，建议佩戴口罩'); }
    else if (lvl === 3) { score -= 1; tips.push('空气轻度污染，敏感人群注意防护'); }
  }

  const grade = ADVICE_GRADE_MAP.find(g => score >= g.minScore) || ADVICE_GRADE_MAP[ADVICE_GRADE_MAP.length - 1];
  return { score, icon: grade.icon, label: grade.label, color: grade.color, tips };
}

module.exports = { ADVICE_GRADE_MAP, calcTripAdvice };
