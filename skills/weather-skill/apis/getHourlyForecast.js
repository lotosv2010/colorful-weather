const { HOST, get, resolveLocation } = require('./_request');

async function getHourlyForecast({ location, hours = 24 } = {}) {
  const n = Number(hours) || 24;
  const endpoint = n > 72 ? '168h' : n > 24 ? '72h' : '24h';

  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  const locParam = loc.id || `${loc.lon},${loc.lat}`;
  let data;
  try {
    data = await get(`${HOST}/v7/weather/${endpoint}`, { location: locParam });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `逐小时预报查询失败：${e.message}` }] };
  }

  if (data.code !== '200' || !data.hourly) {
    return { isError: true, content: [{ type: 'text', text: `逐小时数据暂不可用（code ${data.code}）` }] };
  }

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  const hourly = data.hourly.slice(0, Math.min(n, data.hourly.length));

  // 摘要：找最近降水时段
  const rainHours = hourly.filter(h => Number(h.pop) >= 30 || Number(h.precip) > 0);
  let summary = `${cityLabel} 未来 ${hourly.length} 小时预报`;
  if (rainHours.length > 0) {
    const first = rainHours[0];
    const time = first.fxTime ? first.fxTime.slice(11, 16) : '';
    summary += `，${time} 前后有降水（概率 ${first.pop}%）`;
  } else {
    summary += `，无明显降水`;
  }

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      hourly: hourly.map(h => ({
        fxTime: h.fxTime,
        temp: Number(h.temp),
        text: h.text,
        icon: h.icon,
        windDir: h.windDir,
        windScale: h.windScale,
        humidity: Number(h.humidity),
        pop: h.pop != null ? Number(h.pop) : null,
        precip: Number(h.precip),
      })),
    },
    handoff: () => ({
      query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
      payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
    })
  };
}

module.exports = getHourlyForecast;
