const { HOST, get, resolveLocation } = require('./_request');

function _today() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function _currentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

// 从系统 getTimezoneOffset 推算 tz 字符串（如 "0800"、"-0530"）
function _localTz() {
  const offset = -new Date().getTimezoneOffset(); // 分钟，东区为正
  const sign = offset < 0 ? '-' : '';
  const abs = Math.abs(offset);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `${sign}${h}${m}`;
}

// 兼容 YYYY-MM-DD / YYYYMMDD，时间兼容 HH:mm / HHmm
function _normalizeDate(s) { return s ? s.replace(/-/g, '') : null; }
function _normalizeTime(s) { return s ? s.replace(':', '') : null; }

// 方位角 → 8 方位汉字
function _azimuthDir(deg) {
  const dirs = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

async function getSolarElevationAngle({ location, date, time } = {}) {
  let loc;
  try {
    loc = await resolveLocation(location);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: e.message }] };
  }

  const targetDate = _normalizeDate(date) || _today();
  const targetTime = _normalizeTime(time) || _currentTime();
  const tz = _localTz();

  let data;
  try {
    data = await get(`${HOST}/v7/astronomy/solar-elevation-angle`, {
      location: `${loc.lon},${loc.lat}`,
      date: targetDate,
      time: targetTime,
      tz,
      alt: 0,
    });
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `太阳高度角查询失败：${e.message}` }] };
  }

  if (data.code !== '200') {
    return { isError: true, content: [{ type: 'text', text: `太阳高度角暂不可用（code ${data.code}）` }] };
  }

  const cityLabel = loc.adm2 && loc.adm2 !== loc.name ? `${loc.adm2} ${loc.name}` : loc.name;
  const elevation = parseFloat(data.solarElevationAngle);
  const azimuth = parseFloat(data.solarAzimuthAngle);
  const aboveHorizon = elevation > 0;

  const dateLabel = `${targetDate.slice(0, 4)}-${targetDate.slice(4, 6)}-${targetDate.slice(6, 8)}`;
  const timeLabel = `${targetTime.slice(0, 2)}:${targetTime.slice(2, 4)}`;
  const dir = _azimuthDir(azimuth);

  const summary = aboveHorizon
    ? `${cityLabel} ${dateLabel} ${timeLabel} 太阳高度角 ${elevation.toFixed(1)}°，方位 ${dir}（${azimuth.toFixed(1)}°）`
    : `${cityLabel} ${dateLabel} ${timeLabel} 太阳在地平线以下（高度角 ${elevation.toFixed(1)}°）`;

  return {
    isError: false,
    content: [{ type: 'text', text: summary }],
    structuredContent: {
      city: loc.name,
      adm2: loc.adm2,
      date: dateLabel,
      time: timeLabel,
      elevation,
      azimuth,
      azimuthDir: dir,
      solarHour: data.solarHour || '',
      hourAngle: parseFloat(data.hourAngle || '0'),
      aboveHorizon,
    },
  };
}

module.exports = getSolarElevationAngle;
