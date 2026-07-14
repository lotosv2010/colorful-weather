const { HOST, get, resolveLocation, toAirPath } = require('./_request');

async function getAirQuality({ location } = {}) {
  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  let data;
  try {
    data = await get(`${HOST}/airquality/v1/current/${toAirPath(loc.lon, loc.lat)}`);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `空气质量查询失败：${e.message}` }] };
  }

  // v1 air quality API 不返回 code 字段；仅当明确有 code 且非 200 时报错
  if (data.code && data.code !== '200') {
    return { isError: true, content: [{ type: 'text', text: `空气质量数据暂不可用（code ${data.code}）` }] };
  }

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;

  // 优先取中国 AQI，找不到取第一个
  const cnAqi = (data.indexes || []).find(i => i.code === 'cn_aqi') || (data.indexes || [])[0];
  const pm25 = (data.pollutants || []).find(p => p.code === 'pm2p5');
  const pm10 = (data.pollutants || []).find(p => p.code === 'pm10');

  if (!cnAqi) {
    return { isError: true, content: [{ type: 'text', text: '空气质量数据暂不可用' }] };
  }

  const parts = [`${cityLabel} 空气质量：${cnAqi.category}（AQI ${cnAqi.aqiDisplay}）`];
  if (pm25) parts.push(`PM2.5 ${pm25.concentration.value} μg/m³`);
  if (pm10) parts.push(`PM10 ${pm10.concentration.value} μg/m³`);
  const summary = parts.join('，');

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      aqi: Number(cnAqi.aqi),
      aqiDisplay: cnAqi.aqiDisplay,
      category: cnAqi.category,
      color: cnAqi.color || '',
      pollutants: (data.pollutants || []).map(p => ({
        code: p.code,
        name: p.fullName || p.name,
        value: Number(p.concentration.value),
        unit: p.concentration.unit,
      })),
    },
    handoff: () => ({
      query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
      payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
    })
  };
}

module.exports = getAirQuality;
