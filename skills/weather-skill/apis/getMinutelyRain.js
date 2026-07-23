const { HOST, get, resolveLocation } = require('./_request');

async function getMinutelyRain({ location } = {}) {
  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  let data;
  try {
    data = await get(`${HOST}/v7/minutely/5m`, { location: `${loc.lon},${loc.lat}` });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `分钟级降水查询失败：${e.message}` }] };
  }

  if (data.code !== '200') {
    return { isError: true, content: [{ type: 'text', text: `分钟级降水数据暂不可用（code ${data.code}）` }] };
  }

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  const summary = data.summary || '未来2小时无明显降水';
  const minutely = data.minutely || [];

  // 判断是否有降水
  const hasRain = minutely.some(m => Number(m.precip) > 0);

  return {
    isError: false,
    content: [{ type: 'text', text: `${cityLabel} 分钟级降水：${summary}` }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      summary,
      hasRain,
      minutely: minutely.map(m => ({
        fxTime: m.fxTime,
        precip: Number(m.precip),
        type: m.type,
      })),
    }
  };
}

module.exports = getMinutelyRain;
