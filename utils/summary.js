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

// 极简 3-5 字天气结论（彩云风格，用于折叠卡片）
const buildShortDesc = ({ now, today, air } = {}) => {
  const textDay   = (today && today.textDay)   || '';
  const textNight = (today && today.textNight) || '';
  const temp      = Number(now && now.temp);
  const ws        = Number(now && now.windScale) || 0;
  const category  = air && air.category;

  // 降水优先
  if (textDay.includes('雷') || textNight.includes('雷'))  return '注意雷暴';
  if (textDay.includes('雨') || textNight.includes('雨'))  return '出门带伞';
  if (textDay.includes('雪') || textNight.includes('雪'))  return '路滑注意';

  // 风力
  if (ws >= 9)  return '狂风注意';
  if (ws >= 7)  return '大风注意';
  if (ws >= 5)  return '风力较大';

  // 温度极端
  if (!isNaN(temp)) {
    if (temp >= 38) return '高温预警';
    if (temp >= 35) return '注意防暑';
    if (temp <= 0)  return '注意防冻';
    if (temp <= 5)  return '注意保暖';
  }

  // 空气质量
  if (category === '严重污染' || category === '重度污染') return '减少外出';
  if (category === '中度污染') return '注意防护';
  if (category === '轻度污染') return '空气欠佳';

  // 晴好
  if ((textDay.includes('晴') || textDay.includes('少云')) && !isNaN(temp) && temp >= 18 && temp <= 28) {
    return '今日宜出行';
  }

  return '天气平稳';
};

module.exports = { buildSummary, buildShortDesc };
