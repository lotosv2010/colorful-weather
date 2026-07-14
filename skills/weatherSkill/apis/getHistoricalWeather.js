const { HOST, get, resolveLocation } = require('./_request');

// 将 YYYY-MM-DD 或 YYYYMMDD 统一转为 YYYYMMDD
function _normalizeDate(s) {
  if (!s) return null;
  return s.replace(/-/g, '');
}

// 生成最近 N 天的 YYYYMMDD 列表（含今天）
function _recentDates(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}${m}${day}`);
  }
  return dates;
}

async function getHistoricalWeather({ location, date, type = 'weather' } = {}) {
  const dateStr = _normalizeDate(date);
  if (!dateStr) {
    return { isError: true, content: [{ type: 'text', text: '请提供查询日期，格式如 20260713' }] };
  }

  // 仅支持最近 10 天（和风天气历史接口限制）
  const valid = _recentDates(10);
  if (!valid.includes(dateStr)) {
    return { isError: true, content: [{ type: 'text', text: `历史数据仅支持最近 10 天，${dateStr} 超出范围` }] };
  }

  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  // 历史接口必须使用 LocationID（不支持经纬度）
  if (!loc.id) {
    return { isError: true, content: [{ type: 'text', text: `无法获取 ${loc.name} 的城市 ID，历史查询需要指定城市名` }] };
  }

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  const dateLabel = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

  if (type === 'air') {
    let data;
    try {
      data = await get(`${HOST}/v7/historical/air`, { location: loc.id, date: dateStr });
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `历史空气质量查询失败：${e.message}` }] };
    }

    if (data.code !== '200' || !data.airHourly) {
      return { isError: true, content: [{ type: 'text', text: `历史空气质量数据暂不可用（code ${data.code}）` }] };
    }

    const avg = Math.round(data.airHourly.reduce((s, h) => s + Number(h.aqi), 0) / data.airHourly.length);
    const peak = data.airHourly.reduce((a, b) => Number(b.aqi) > Number(a.aqi) ? b : a, data.airHourly[0]);
    const summary = `${cityLabel} ${dateLabel} 历史空气质量：全天平均 AQI ${avg}，峰值 AQI ${peak.aqi}（${peak.aqi <= 50 ? '优' : peak.aqi <= 100 ? '良' : peak.aqi <= 150 ? '轻度' : peak.aqi <= 200 ? '中度' : '重度'}）`;

    return {
      isError: false,
      content: [{ type: 'text', text: summary }],
      structuredContent: {
        city: loc.name, adm2: loc.adm2, date: dateLabel, type: 'air',
        avgAqi: avg,
        airHourly: data.airHourly.map(h => ({
          fxTime: h.fxTime,
          aqi: Number(h.aqi),
          category: h.category,
          pm2p5: Number(h.pm2p5),
        })),
      }
    };
  }

  // type === 'weather'（默认）
  let data;
  try {
    data = await get(`${HOST}/v7/historical/weather`, { location: loc.id, date: dateStr });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `历史天气查询失败：${e.message}` }] };
  }

  if (data.code !== '200' || !data.weatherHourly) {
    return { isError: true, content: [{ type: 'text', text: `历史天气数据暂不可用（code ${data.code}）` }] };
  }

  const temps = data.weatherHourly.map(h => Number(h.temp));
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const summary = `${cityLabel} ${dateLabel} 历史天气：气温 ${minTemp}~${maxTemp}℃`;

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: {
      city: loc.name, adm2: loc.adm2, date: dateLabel, type: 'weather',
      maxTemp, minTemp,
      weatherHourly: data.weatherHourly.map(h => ({
        fxTime: h.fxTime,
        temp: Number(h.temp),
        text: h.text,
        icon: h.icon,
        windDir: h.windDir,
        windScale: h.windScale,
        humidity: Number(h.humidity),
        precip: Number(h.precip),
      })),
    },
    handoff: () => ({
      query: `cityId=${loc.id}&lon=${loc.lon}&lat=${loc.lat}`,
      payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
    })
  };
}

module.exports = getHistoricalWeather;
