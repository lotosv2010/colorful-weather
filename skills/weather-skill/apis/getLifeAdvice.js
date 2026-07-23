const { HOST, get, resolveLocation } = require('./_request');

// 优先展示的指数类型（穿衣、运动、紫外线、感冒、旅游）
const PRIORITY_TYPES = ['3', '1', '5', '9', '6'];

async function getLifeAdvice({ location } = {}) {
  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  const locParam = loc.id || `${loc.lon},${loc.lat}`;
  let data;
  try {
    // type=0 拉取全部指数
    data = await get(`${HOST}/v7/indices/1d`, { location: locParam, type: '0' });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `生活指数查询失败：${e.message}` }] };
  }

  if (data.code !== '200' || !data.daily) {
    return { isError: true, content: [{ type: 'text', text: `生活指数暂不可用（code ${data.code}）` }] };
  }

  const indices = data.daily.map(d => ({
    type: d.type,
    name: d.name,
    level: d.level,
    category: d.category,
    text: d.text,
  }));

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;

  // 取优先展示的几项作为摘要
  const priority = PRIORITY_TYPES
    .map(t => indices.find(i => i.type === t))
    .filter(Boolean);
  const lines = priority.map(i => `【${i.name}】${i.category}：${i.text}`);
  const summary = `${cityLabel} 今日生活指数：\n${lines.join('\n')}`;

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: { city: loc.name, adm2: loc.adm2, indices },
    handoff: () => ({
      query: `cityId=${loc.id || ''}&lon=${loc.lon}&lat=${loc.lat}`,
      payload: { city: { id: loc.id, name: loc.name, adm2: loc.adm2, lon: loc.lon, lat: loc.lat } }
    })
  };
}

module.exports = getLifeAdvice;
