const { HOST, get, resolveLocation } = require('./_request');

async function get30DayForecast({ location } = {}) {
  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  const locParam = loc.id || `${loc.lon},${loc.lat}`;
  let data;
  try {
    data = await get(`${HOST}/v7/weather/30d`, { location: locParam });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `30 天预报查询失败：${e.message}` }] };
  }

  if (data.code !== '200' || !data.daily) {
    return { isError: true, content: [{ type: 'text', text: `30 天预报数据暂不可用（code ${data.code}）` }] };
  }

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  const daily = data.daily;

  // 摘要：本月温度区间 + 近 7 天概览
  const temps = daily.map(d => ({ max: Number(d.tempMax), min: Number(d.tempMin) }));
  const overallMax = Math.max(...temps.map(t => t.max));
  const overallMin = Math.min(...temps.map(t => t.min));
  const first7 = daily.slice(0, 7).map(d => `${d.fxDate.slice(5)} ${d.textDay} ${d.tempMin}~${d.tempMax}℃`);
  const summary = `${cityLabel} 未来 30 天温度范围 ${overallMin}~${overallMax}℃\n近 7 天：\n${first7.join('\n')}`;

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      overallMax,
      overallMin,
      daily: daily.map(d => ({
        date: d.fxDate,
        textDay: d.textDay,
        textNight: d.textNight,
        iconDay: d.iconDay,
        tempMax: Number(d.tempMax),
        tempMin: Number(d.tempMin),
        humidity: Number(d.humidity),
        precip: Number(d.precip),
        uvIndex: d.uvIndex != null ? Number(d.uvIndex) : null,
        windDirDay: d.windDirDay,
        windScaleDay: d.windScaleDay,
      })),
    },
    handoff: () => ({
      query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
      payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
    })
  };
}

module.exports = get30DayForecast;
