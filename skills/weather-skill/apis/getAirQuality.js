const { HOST, get, resolveLocation, toAirPath } = require('./_request');

async function getAirQuality({ location, range = 'current' } = {}) {
  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  const airPath = toAirPath(loc.lon, loc.lat);
  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;

  // ── 逐小时预报 ──────────────────────────────────
  if (range === 'hourly') {
    let data;
    try {
      data = await get(`${HOST}/airquality/v1/hourly/${airPath}`, { localTime: true });
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `逐小时空气质量查询失败：${e.message}` }] };
    }
    if (data.code && data.code !== '200') {
      return { isError: true, content: [{ type: 'text', text: `逐小时空气质量暂不可用（code ${data.code}）` }] };
    }
    const hourly = data.hours || [];
    const next6 = hourly.slice(0, 6);
    const lines = next6.map(h => {
      const cn = (h.indexes || []).find(i => i.code === 'cn-mee') || (h.indexes || [])[0];
      return cn ? `${h.forecastTime?.slice(11, 16) || ''} AQI ${cn.aqiDisplay} ${cn.category}` : '';
    }).filter(Boolean);
    return {
      isError: false,
      content: [{ type: 'text', text: `${cityLabel} 未来逐小时空气质量：\n${lines.join('\n')}` }],
      structuredContent: { city: loc.name, adm2: loc.adm2, range: 'hourly', hourly },
      handoff: () => ({
        query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
        payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
      })
    };
  }

  // ── 逐日预报 ────────────────────────────────────
  if (range === 'daily') {
    let data;
    try {
      data = await get(`${HOST}/airquality/v1/daily/${airPath}`, { localTime: true });
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `逐日空气质量查询失败：${e.message}` }] };
    }
    if (data.code && data.code !== '200') {
      return { isError: true, content: [{ type: 'text', text: `逐日空气质量暂不可用（code ${data.code}）` }] };
    }
    const daily = data.days || [];
    const lines = daily.slice(0, 5).map(d => {
      const cn = (d.indexes || []).find(i => i.code === 'cn-mee') || (d.indexes || [])[0];
      const dateStr = (d.forecastStartTime || '').slice(5, 10); // MM-DD
      return cn ? `${dateStr} AQI ${cn.aqiDisplay} ${cn.category}` : '';
    }).filter(Boolean);
    return {
      isError: false,
      content: [{ type: 'text', text: `${cityLabel} 未来几天空气质量：\n${lines.join('\n')}` }],
      structuredContent: { city: loc.name, adm2: loc.adm2, range: 'daily', days: daily },
      handoff: () => ({
        query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
        payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
      })
    };
  }

  // ── 当前实况（默认）─────────────────────────────
  let data;
  try {
    data = await get(`${HOST}/airquality/v1/current/${airPath}`);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `空气质量查询失败：${e.message}` }] };
  }
  if (data.code && data.code !== '200') {
    return { isError: true, content: [{ type: 'text', text: `空气质量数据暂不可用（code ${data.code}）` }] };
  }

  const cnAqi = (data.indexes || []).find(i => i.code === 'cn_aqi') || (data.indexes || [])[0];
  const pm25 = (data.pollutants || []).find(p => p.code === 'pm2p5');
  const pm10 = (data.pollutants || []).find(p => p.code === 'pm10');

  if (!cnAqi) {
    return { isError: true, content: [{ type: 'text', text: '空气质量数据暂不可用' }] };
  }

  const parts = [`${cityLabel} 空气质量：${cnAqi.category}（AQI ${cnAqi.aqiDisplay}）`];
  if (pm25) parts.push(`PM2.5 ${pm25.concentration.value} μg/m³`);
  if (pm10) parts.push(`PM10 ${pm10.concentration.value} μg/m³`);

  return {
    isError: false,
    content: [{ type: 'text', text: parts.join('，') }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      range: 'current',
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
