const { HOST, get, resolveLocation } = require('./_request');

// API 要求 YYYYMMDD 格式（无横线）
function _today() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// 兼容 YYYY-MM-DD 和 YYYYMMDD 两种输入
function _normalizeDate(s) {
  return s ? s.replace(/-/g, '') : null;
}

async function getAstronomy({ location, date } = {}) {
  const targetDate = _normalizeDate(date) || _today();

  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  const locParam = loc.id || `${loc.lon},${loc.lat}`;
  let sunData, moonData;
  try {
    [sunData, moonData] = await Promise.all([
      get(`${HOST}/v7/astronomy/sun`, { location: locParam, date: targetDate }),
      get(`${HOST}/v7/astronomy/moon`, { location: locParam, date: targetDate }),
    ]);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `天文信息查询失败：${e.message}` }] };
  }

  if (sunData.code !== '200') {
    return { isError: true, content: [{ type: 'text', text: `天文数据暂不可用（code ${sunData.code}）` }] };
  }

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  const dateLabel = `${targetDate.slice(0, 4)}-${targetDate.slice(4, 6)}-${targetDate.slice(6, 8)}`;
  const sun = sunData.sunrise ? `日出 ${sunData.sunrise}，日落 ${sunData.sunset}` : '';
  const moon = moonData.moonPhase && moonData.moonPhase.length > 0
    ? `月相：${moonData.moonPhase[0].name}`
    : '';

  const parts = [sun, moon].filter(Boolean);
  const summary = `${cityLabel} ${dateLabel} 天文信息：${parts.join('；')}`;

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      date: dateLabel,
      sunrise: sunData.sunrise || '',
      sunset: sunData.sunset || '',
      moonrise: moonData.moonrise || '',
      moonset: moonData.moonset || '',
      moonPhase: moonData.moonPhase && moonData.moonPhase.length > 0
        ? { name: moonData.moonPhase[0].name, icon: moonData.moonPhase[0].icon }
        : null,
    }
  };
}

module.exports = getAstronomy;
