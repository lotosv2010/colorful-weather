const { HOST, get, resolveLocation } = require('./_request');

async function getCurrentWeather({ location } = {}) {
  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  const locParam = loc.id || `${loc.lon},${loc.lat}`;
  let data;
  try {
    data = await get(`${HOST}/v7/weather/now`, { location: locParam });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `天气查询失败：${e.message}` }] };
  }

  if (data.code !== '200' || !data.now) {
    return { isError: true, content: [{ type: 'text', text: `天气数据暂不可用（code ${data.code}）` }] };
  }

  const now = data.now;
  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  const summary = [
    `${cityLabel} 当前天气：${now.temp}℃，${now.text}`,
    `体感温度 ${now.feelsLike}℃，湿度 ${now.humidity}%`,
    `${now.windDir} ${now.windScale} 级，能见度 ${now.vis} km`,
    now.precip > 0 ? `过去 1 小时降水 ${now.precip} mm` : null,
  ].filter(Boolean).join('；');

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      temp: Number(now.temp),
      feelsLike: Number(now.feelsLike),
      text: now.text,
      icon: now.icon,
      humidity: Number(now.humidity),
      windDir: now.windDir,
      windScale: now.windScale,
      windSpeed: Number(now.windSpeed),
      precip: Number(now.precip),
      vis: Number(now.vis),
      pressure: Number(now.pressure),
      obsTime: now.obsTime,
    },
    handoff: () => ({
      query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
      payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
    })
  };
}

module.exports = getCurrentWeather;
