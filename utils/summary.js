// 自然语言天气摘要生成
// 格式：白天X，夜晚X，比昨天热/冷X，现在X°，有风，空气X。

const AIR_DESC = {
  '优': '空气不错',
  '良': '空气一般',
  '轻度污染': '空气较差',
  '中度污染': '空气很差',
  '重度污染': '空气很差',
  '严重污染': '空气极差',
};

/**
 * 生成一句话天气摘要
 * @param {object} p
 * @param {object} p.now          实时天气 { temp, windScale }
 * @param {object} p.today        今日预报 { textDay, textNight, tempMax }
 * @param {object} p.air          空气质量 { category }
 * @param {number|null} p.yesterdayTempMax  昨日最高温（可选）
 */
const buildSummary = ({ now, today, air, yesterdayTempMax } = {}) => {
  const parts = [];

  // 1. 白天 / 夜晚天气
  const textDay = today && today.textDay;
  const textNight = today && today.textNight;
  if (textDay && textNight) {
    parts.push(textDay === textNight
      ? `今天全天${textDay}`
      : `今天白天${textDay}，夜晚${textNight}`);
  }

  // 2. 与昨日温度比较
  const todayMax = today && today.tempMax != null ? Number(today.tempMax) : null;
  const yMax = yesterdayTempMax != null ? Number(yesterdayTempMax) : null;
  if (todayMax != null && yMax != null && !isNaN(todayMax) && !isNaN(yMax)) {
    const diff = todayMax - yMax;
    if (diff >= 6) parts.push('比昨天热很多');
    else if (diff >= 2) parts.push('比昨天热一些');
    else if (diff <= -6) parts.push('比昨天冷很多');
    else if (diff <= -2) parts.push('比昨天冷一些');
    else parts.push('温度和昨天差不多');
  }

  // 3. 当前温度
  if (now && now.temp != null) {
    parts.push(`现在${now.temp}°`);
  }

  // 4. 风力（3 级以上才提）
  const ws = Number(now && now.windScale) || 0;
  if (ws >= 7) parts.push('大风');
  else if (ws >= 5) parts.push('风很大');
  else if (ws >= 3) parts.push('有风');

  // 5. 空气质量
  const airDesc = air && air.category ? AIR_DESC[air.category] : null;
  if (airDesc) parts.push(airDesc);

  return parts.length ? parts.join('，') + '。' : '';
};

module.exports = { buildSummary };
