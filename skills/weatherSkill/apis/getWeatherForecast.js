const { HOST, get, resolveLocation } = require('./_request');

async function getWeatherForecast({ location, days = 5 } = {}) {
  const n = Math.min(Math.max(Number(days) || 5, 1), 7);

  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  const locParam = loc.id || `${loc.lon},${loc.lat}`;
  let data;
  try {
    data = await get(`${HOST}/v7/weather/7d`, { location: locParam });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `预报查询失败：${e.message}` }] };
  }

  if (data.code !== '200' || !data.daily) {
    return { isError: true, content: [{ type: 'text', text: `预报数据暂不可用（code ${data.code}）` }] };
  }

  const forecasts = data.daily.slice(0, n).map(d => ({
    date: d.fxDate,
    textDay: d.textDay,
    textNight: d.textNight,
    iconDay: d.iconDay,
    iconNight: d.iconNight,
    tempMax: Number(d.tempMax),
    tempMin: Number(d.tempMin),
    humidity: Number(d.humidity),
    precip: Number(d.precip),
    precipProb: d.precipProb != null ? Number(d.precipProb) : null,
    uvIndex: Number(d.uvIndex),
    windDirDay: d.windDirDay,
    windScaleDay: d.windScaleDay,
  }));

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  const lines = forecasts.map(d =>
    `${d.date.slice(5)}  ${d.textDay}  ${d.tempMin}~${d.tempMax}℃` +
    (d.precipProb != null ? `  降水概率 ${d.precipProb}%` : '')
  );
  const summary = `${cityLabel} 未来 ${forecasts.length} 天天气预报：\n${lines.join('\n')}`;

  return {
    isError: false,
    content: [{ type: 'text', text: summary + '\n\n点击卡片可查看完整天气详情。' }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      forecasts,
    },
    handoff: () => ({
      query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
      payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
    })
  };
}

module.exports = getWeatherForecast;
