const { HOST, get, resolveLocation, toAirPath } = require('./_request');

async function getWeatherWarnings({ location } = {}) {
  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  let data;
  try {
    data = await get(`${HOST}/weatheralert/v1/current/${toAirPath(loc.lon, loc.lat)}`, { localTime: true });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `预警查询失败：${e.message}` }] };
  }

  // v1 alert API 不返回 code 字段；仅当明确有 code 且非 200 时报错
  if (data.code && data.code !== '200') {
    return { isError: true, content: [{ type: 'text', text: `预警数据暂不可用（code ${data.code}）` }] };
  }

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  // v1 alert API 字段名为 alerts（v7 为 warning）
  const warnings = data.alerts || data.warning || [];

  if (warnings.length === 0) {
    return {
      isError: false,
      content: [{ type: 'text', text: `${cityLabel} 当前没有有效的天气预警。` }],
      structuredContent: { city: loc.name, adm2: loc.adm2, warnings: [] }
    };
  }

  // v1 接口字段：eventType.name / color.code（蓝/黄/橙/红）/ headline / description
  const COLOR_LEVEL = { blue: '蓝', yellow: '黄', orange: '橙', red: '红' };
  const lines = warnings.map(w => {
    const type = w.eventType?.name || '';
    const level = COLOR_LEVEL[w.color?.code] || w.color?.code || '';
    return `【${type}${level}色预警】${w.headline}`;
  });
  const summary = `${cityLabel} 当前 ${warnings.length} 条天气预警：\n${lines.join('\n')}`;

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      warnings: warnings.map(w => ({
        id: w.id,
        sender: w.senderName,
        pubTime: w.issuedTime,
        title: w.headline,
        level: w.color?.code || '',
        typeName: w.eventType?.name || '',
        severity: w.severity || '',
        text: w.description,
        expireTime: w.expireTime || '',
      })),
    },
    handoff: () => ({
      query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
      payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
    })
  };
}

module.exports = getWeatherWarnings;
