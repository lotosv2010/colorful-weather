// utils/astronomyCanvas.js
// 天文 Canvas 绘制纯函数：日出日落曲线、月升月落曲线。
// 从 pages/astronomy/index.js 提取，不依赖 Page/Component 上下文。

// ISO 时间字符串 → 'HH:MM'，无效则返回 '--:--'
const fmtTime = (isoStr) => {
  if (!isoStr) return '--:--';
  const m = isoStr.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '--:--';
};

// 'HH:MM' → 分钟数，'--:--' 或无效则返回 null
const toMin = (str) => {
  if (!str || str === '--:--') return null;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
};

// 折线辅助（虚/实）
const _drawCurve = (ctx, points, color, lineWidth, isDashed) => {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = isDashed ? 0.35 : 1;
  ctx.setLineDash(isDashed ? [6, 4] : []);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
};

/**
 * 绘制日出日落弧线。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w  画布逻辑宽
 * @param {number} h  画布逻辑高
 * @param {{ sunrise: string, sunset: string, nowMin: number|null }} data
 *   nowMin：当前时刻分钟数（仅今天传入，其他日期传 null）
 */
const drawSun = (ctx, w, h, { sunrise, sunset, nowMin }) => {
  const COLOR = '#FF8C00';
  const riseMin = toMin(sunrise);
  const setMin  = toMin(sunset);

  ctx.clearRect(0, 0, w, h);

  const padL = 16, padR = 16, padT = 22, padB = 44;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const toX = (min) => padL + (min / 1440) * chartW;
  const baseY = padT + chartH * 0.78;
  const dotSafeTop = 15;
  const dotSafeBottom = h - 15;

  // 数据无效：只画虚基线
  if (riseMin == null || setMin == null || setMin <= riseMin) {
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, baseY);
    ctx.lineTo(w - padR, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }

  const nightSpan = 1440 - (setMin - riseMin);
  const curveY = (min) => {
    if (min >= riseMin && min <= setMin) {
      const t = (min - riseMin) / (setMin - riseMin);
      return baseY - chartH * 0.80 * Math.sin(Math.PI * t);
    }
    const offset = min >= setMin ? min - setMin : (1440 - setMin) + min;
    const t = offset / nightSpan;
    return baseY + chartH * 0.20 * Math.sin(Math.PI * t);
  };

  const allPts = [];
  for (let m = 0; m <= 1440; m += 5) allPts.push({ x: toX(m), y: curveY(m), m });

  const nightBefore = allPts.filter(p => p.m <= riseMin);
  const dayTime     = allPts.filter(p => p.m >= riseMin && p.m <= setMin);
  const nightAfter  = allPts.filter(p => p.m >= setMin);

  // 基线
  ctx.strokeStyle = COLOR;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.18;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(padL, baseY);
  ctx.lineTo(w - padR, baseY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 白天渐变填充
  const grad = ctx.createLinearGradient(0, padT, 0, baseY);
  grad.addColorStop(0, 'rgba(255,140,0,0.22)');
  grad.addColorStop(1, 'rgba(255,140,0,0)');
  ctx.beginPath();
  ctx.moveTo(toX(riseMin), baseY);
  for (const p of dayTime) ctx.lineTo(p.x, p.y);
  ctx.lineTo(toX(setMin), baseY);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 曲线
  if (nightBefore.length >= 2) _drawCurve(ctx, nightBefore, COLOR, 1.5, true);
  if (nightAfter.length >= 2)  _drawCurve(ctx, nightAfter,  COLOR, 1.5, true);
  if (dayTime.length >= 2)     _drawCurve(ctx, dayTime,     COLOR, 2.5, false);

  // 标注
  const riseX = toX(riseMin);
  const setX  = toX(setMin);
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';

  ctx.fillStyle = COLOR;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(riseX, baseY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.fillText(sunrise, riseX, baseY + 15);
  ctx.fillStyle = 'rgba(166,169,173,0.8)';
  ctx.fillText('日出', riseX, baseY + 28);

  ctx.fillStyle = COLOR;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(setX, baseY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.fillText(sunset, setX, baseY + 15);
  ctx.fillStyle = 'rgba(166,169,173,0.8)';
  ctx.fillText('日落', setX, baseY + 28);

  // 当前太阳位置（仅今天）
  if (nowMin != null && nowMin >= riseMin && nowMin <= setMin) {
    const dotX = toX(nowMin);
    const dotY = Math.max(dotSafeTop, Math.min(dotSafeBottom, curveY(nowMin)));
    ctx.fillStyle = COLOR;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
};

/**
 * 绘制月升月落弧线。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {{ moonrise: string, moonset: string, hasMoonset: boolean, nowMin: number|null }} data
 */
const drawMoon = (ctx, w, h, { moonrise, moonset, hasMoonset, nowMin }) => {
  const COLOR = '#6CB4EE';
  let riseMin = toMin(moonrise);
  const rawSetMin = hasMoonset ? toMin(moonset) : null;
  // 月落次日时，画到 23:59
  const effectiveSetMin = rawSetMin ?? (23 * 60 + 59);

  ctx.clearRect(0, 0, w, h);

  const padL = 16, padR = 16, padT = 22, padB = 44;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const toX = (min) => padL + (min / 1440) * chartW;
  const baseY = padT + chartH * 0.78;
  const dotSafeTop = 15;
  const dotSafeBottom = h - 15;

  if (riseMin == null) {
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, baseY);
    ctx.lineTo(w - padR, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }

  const crossMidnight = effectiveSetMin <= riseMin;
  const upSpan   = crossMidnight ? (1440 - riseMin) + effectiveSetMin : effectiveSetMin - riseMin;
  const downSpan = 1440 - upSpan;

  const curveY = (min) => {
    const isUp = crossMidnight
      ? (min >= riseMin || min <= effectiveSetMin)
      : (min >= riseMin && min <= effectiveSetMin);
    if (isUp) {
      const offset = crossMidnight
        ? (min >= riseMin ? min - riseMin : (1440 - riseMin) + min)
        : (min - riseMin);
      const t = offset / upSpan;
      return baseY - chartH * 0.80 * Math.sin(Math.PI * t);
    }
    const offset = crossMidnight
      ? (min - effectiveSetMin)
      : (min >= effectiveSetMin ? min - effectiveSetMin : (1440 - effectiveSetMin) + min);
    const t = offset / downSpan;
    return baseY + chartH * 0.20 * Math.sin(Math.PI * t);
  };

  const allPts = [];
  for (let m = 0; m <= 1440; m += 5) allPts.push({ x: toX(m), y: curveY(m), m });

  let nightBefore, dayTime, nightAfter;
  if (!crossMidnight) {
    nightBefore = allPts.filter(p => p.m <= riseMin);
    dayTime     = allPts.filter(p => p.m >= riseMin && p.m <= effectiveSetMin);
    nightAfter  = allPts.filter(p => p.m >= effectiveSetMin);
  } else {
    nightBefore = allPts.filter(p => p.m >= effectiveSetMin && p.m <= riseMin);
    dayTime     = allPts.filter(p => p.m >= riseMin || p.m <= effectiveSetMin);
    nightAfter  = [];
  }

  // 基线
  ctx.strokeStyle = COLOR;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.18;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(padL, baseY);
  ctx.lineTo(w - padR, baseY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 月亮在天渐变填充
  const grad = ctx.createLinearGradient(0, padT, 0, baseY);
  grad.addColorStop(0, 'rgba(108,180,238,0.2)');
  grad.addColorStop(1, 'rgba(108,180,238,0)');
  if (!crossMidnight) {
    ctx.beginPath();
    ctx.moveTo(toX(riseMin), baseY);
    for (const p of dayTime) ctx.lineTo(p.x, p.y);
    ctx.lineTo(toX(effectiveSetMin), baseY);
    ctx.closePath();
  } else {
    const risePts = allPts.filter(p => p.m >= riseMin);
    const setPts  = allPts.filter(p => p.m <= effectiveSetMin);
    ctx.beginPath();
    ctx.moveTo(toX(riseMin), baseY);
    for (const p of risePts) ctx.lineTo(p.x, p.y);
    for (const p of setPts)  ctx.lineTo(p.x, p.y);
    ctx.lineTo(toX(effectiveSetMin), baseY);
    ctx.closePath();
  }
  ctx.fillStyle = grad;
  ctx.fill();

  // 曲线
  if (nightBefore.length >= 2) _drawCurve(ctx, nightBefore, COLOR, 1.5, true);
  if (nightAfter.length >= 2)  _drawCurve(ctx, nightAfter,  COLOR, 1.5, true);
  if (dayTime.length >= 2)     _drawCurve(ctx, dayTime,     COLOR, 2.5, false);

  // 月出标注
  const riseX = toX(riseMin);
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';

  ctx.fillStyle = COLOR;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(riseX, baseY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.fillText(moonrise, riseX, baseY + 15);
  ctx.fillStyle = 'rgba(166,169,173,0.8)';
  ctx.fillText('月出', riseX, baseY + 28);

  // 月落标注（仅当天有月落时）
  if (hasMoonset && rawSetMin != null) {
    const setX = toX(rawSetMin);
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(setX, baseY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillText(moonset, setX, baseY + 15);
    ctx.fillStyle = 'rgba(166,169,173,0.8)';
    ctx.fillText('月落', setX, baseY + 28);
  }

  // 当前月亮位置（仅今天）
  if (nowMin != null) {
    const dotX = toX(nowMin);
    const dotY = Math.max(dotSafeTop, Math.min(dotSafeBottom, curveY(nowMin)));
    ctx.fillStyle = COLOR;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
};

module.exports = { fmtTime, toMin, drawSun, drawMoon };
