// 温度单位换算：与 utils/tempUnit.wxs 一致
const convert = (c, unit) => {
  if (c === '' || c === null || c === undefined) return null;
  const n = Number(c);
  if (Number.isNaN(n)) return null;
  return unit === 'F' ? n * 9 / 5 + 32 : n;
};

const fmt = (c, unit) => {
  const v = convert(c, unit);
  if (v === null) return '--';
  return v >= 0 ? Math.floor(v + 0.5) : -Math.floor(-v + 0.5);
};

module.exports = { convert, fmt };
