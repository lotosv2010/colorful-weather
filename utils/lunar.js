// 农历日期 + 二十四节气封装（基于 6tail/lunar-javascript）
const { Solar } = require('../libs/lunar');

// 批量获取农历标签，dates: ['YYYY-MM-DD', ...]
// 返回 {'YYYY-MM-DD': label, ...}
// 优先级：节气 > 月首（"X月"）> 普通日（"初X"/"廿X"）
function getLunarLabels(dates) {
  if (!dates || !dates.length) return {};
  const result = {};
  dates.forEach(ds => {
    try {
      const [y, m, d] = ds.split('-').map(Number);
      const lunar = Solar.fromYmd(y, m, d).getLunar();
      const jieQi = lunar.getJieQi();
      if (jieQi) {
        result[ds] = jieQi;
      } else if (lunar.getDay() === 1) {
        result[ds] = lunar.getMonthInChinese() + '月';
      } else {
        result[ds] = lunar.getDayInChinese();
      }
    } catch (e) {
      result[ds] = '';
    }
  });
  return result;
}

module.exports = { getLunarLabels };
