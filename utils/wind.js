/**
 * 风向角度 → 8方位箭头旋转角度
 * SVG 箭头默认朝北(0°)，+180° 指向风吹去的方向
 * @param {number|string} wind360 风向角度（风吹来的方向）
 * @returns {{ visible: boolean, rotate: number }}
 */
function windArrow(wind360) {
  const deg = Number(wind360);
  if (deg === -999 || deg === -1) return { visible: false, rotate: 0 };
  const rotateMap = [180, 225, 270, 315, 360, 45, 90, 135];
  const idx = Math.floor(((deg + 22.5) % 360) / 45);
  return { visible: true, rotate: rotateMap[idx] };
}

module.exports = { windArrow };
