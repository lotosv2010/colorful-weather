const { HOST, get } = require('./_request');

// 污染物简称映射
const POLL_SHORT = { pm2p5: 'PM2.5', pm10: 'PM10', o3: 'O₃', co: 'CO', so2: 'SO₂', no2: 'NO₂' };

async function getStationAirQuality({ stationId } = {}) {
  if (!stationId) {
    return { isError: true, content: [{ type: 'text', text: '请提供监测站 ID（如 P58911）' }] };
  }

  let data;
  try {
    data = await get(`${HOST}/airquality/v1/stations/${stationId}`);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `监测站数据查询失败：${e.message}` }] };
  }

  const pollutants = (data.pollutants || []).filter(p => p.concentration && p.concentration.value != null);
  if (!pollutants.length) {
    return { isError: true, content: [{ type: 'text', text: `监测站 ${stationId} 暂无有效数据（可能维护中或数据延迟）` }] };
  }

  const lines = pollutants.map(p =>
    `${POLL_SHORT[p.code] || p.name}：${p.concentration.value} ${p.concentration.unit}`
  );

  return {
    isError: false,
    content: [{ type: 'text', text: `监测站 ${stationId} 污染物浓度：\n${lines.join('\n')}` }],
    structuredContent: {
      stationId,
      pollutants: pollutants.map(p => ({
        code: p.code,
        name: POLL_SHORT[p.code] || p.name,
        fullName: p.fullName || p.name,
        value: p.concentration.value,
        unit: p.concentration.unit,
      })),
    },
  };
}

module.exports = getStationAirQuality;
