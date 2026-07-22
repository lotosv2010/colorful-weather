// utils/weatherFormat.js
// 天气数据格式化工具（纯函数，供 index 页面及未来其他页面复用）

const { getLunarLabels } = require('./lunar');

// 逐小时预报：从 fxTime 中提取 "HH" 小时字段
function formatHourly(data = []) {
  return data?.map(h => {
    const res = { ...h };
    res.hour = res.fxTime.substr(11, 2);
    return res;
  });
}

// 逐日预报：为每条记录附加 week（今天/周X）、month、day、lunarLabel
function formatDaily(data = []) {
  const weekMap = new Map([
    [1, '周一'],
    [2, '周二'],
    [3, '周三'],
    [4, '周四'],
    [5, '周五'],
    [6, '周六'],
    [0, '周日'],
  ]);
  const today = new Date();
  const mapped = data.map(d => {
    const res = { ...d };
    const date = new Date(res.fxDate);
    const isToday = date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate();
    res.week = isToday ? '今天' : weekMap.get(date.getDay());
    res.month = date.getMonth() + 1;
    res.day = `${date.getDate()}`.padStart(2, '0');
    return res;
  });
  const lunarLabels = getLunarLabels(mapped.map(d => d.fxDate));
  mapped.forEach(d => { d.lunarLabel = lunarLabels[d.fxDate] || ''; });
  return mapped;
}

// 空气质量数据：indexes[0] + pollutants[] → 扁平结构供组件使用
function formatAir(res) {
  if (!res || !res.indexes || !res.indexes.length) return {};
  const idx = res.indexes[0];
  const c = idx.color || {};
  const colorHex = `#${(c.red ?? 0).toString(16).padStart(2, '0')}${(c.green ?? 0).toString(16).padStart(2, '0')}${(c.blue ?? 0).toString(16).padStart(2, '0')}`;
  const pollutants = (res.pollutants || []).map(p => ({
    name: p.name,
    value: p.concentration ? p.concentration.value : '-',
    unit: p.concentration ? p.concentration.unit : '',
    originData: p,
  }));
  return {
    aqi: idx.aqi,
    aqiDisplay: idx.aqiDisplay,
    category: idx.category,
    level: idx.level,
    colorHex,
    primary: idx.primaryPollutant ? idx.primaryPollutant.name : '',
    healthEffect: idx.health ? idx.health.effect : '',
    generalAdvice: idx.health && idx.health.advice ? idx.health.advice.generalPopulation : '',
    sensitiveAdvice: idx.health && idx.health.advice ? idx.health.advice.sensitivePopulation : '',
    pollutants,
  };
}

// 日期 → 'yyyyMMdd' 字符串（天文 API 所需格式）
function formatDateStr(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}${m}${d}`;
}

module.exports = { formatHourly, formatDaily, formatAir, formatDateStr };
