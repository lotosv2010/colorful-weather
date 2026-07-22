// 农历日期 + 二十四节气封装（基于 6tail/lunar-javascript）
const { Solar } = require('../libs/lunar');
const { pad } = require('./util');

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

/**
 * 获取节气/节日卡片数据
 * @param {string} dateStr - 'YYYY-MM-DD' 格式的当天日期
 * @returns {{
 *   lunarYear: string,       // 干支纪年，如 "乙巳"
 *   lunarDate: string,       // 农历月日，如 "六月廿七"
 *   todaySolarTerm: string,  // 当日节气名，无则 ""
 *   todayFestivals: string[],// 当日节日列表（农历+阳历合并），无则 []
 *   nextSolarTerm: { name: string, dateLabel: string, daysLeft: number },
 *   nextFestival: { name: string, dateLabel: string, daysLeft: number } | null
 * }}
 */
function getSolarTermCard(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);

  try {
    const solar = Solar.fromYmd(y, m, d);
    const lunar = solar.getLunar();

    // 农历信息
    const lunarYear = lunar.getYearInGanZhi();
    const lunarDate = lunar.getMonthInChinese() + '月' + lunar.getDayInChinese();

    // 今日节气
    const todaySolarTerm = lunar.getJieQi() || '';

    // 今日节日（农历节日 + 阳历节日去重合并）
    const todayFestivals = Array.from(new Set([
      ...lunar.getFestivals(),
      ...solar.getFestivals(),
    ]));

    // 下一个节气（getNextJieQi(true) 不含今日）
    let nextSolarTerm = null;
    try {
      const jq = lunar.getNextJieQi(true);
      if (jq) {
        const jqS = jq.getSolar();
        const mo = pad(jqS.getMonth());
        const dy = pad(jqS.getDay());
        const diffMs =
          new Date(jqS.getYear(), jqS.getMonth() - 1, jqS.getDay()) -
          new Date(y, m - 1, d);
        const daysLeft = Math.ceil(diffMs / 86400000);
        nextSolarTerm = { name: jq.getName(), dateLabel: `${mo}月${dy}日`, daysLeft };
      }
    } catch (_) {}

    // 下一个主要节日（45 天内扫描）
    let nextFestival = null;
    for (let i = 1; i <= 45 && !nextFestival; i++) {
      try {
        const ns = solar.next(i);
        const nl = ns.getLunar();
        const fests = Array.from(new Set([
          ...nl.getFestivals(),
          ...ns.getFestivals(),
        ]));
        if (fests.length) {
          const mo = pad(ns.getMonth());
          const dy = pad(ns.getDay());
          nextFestival = { name: fests[0], dateLabel: `${mo}月${dy}日`, daysLeft: i };
        }
      } catch (_) {}
    }

    return { lunarYear, lunarDate, todaySolarTerm, todayFestivals, nextSolarTerm, nextFestival };
  } catch (e) {
    return { lunarYear: '', lunarDate: '', todaySolarTerm: '', todayFestivals: [], nextSolarTerm: null, nextFestival: null };
  }
}

module.exports = { getLunarLabels, getSolarTermCard };
