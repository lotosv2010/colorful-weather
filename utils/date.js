// utils/date.js
// 日期工具：星期标签常量（全项目共用，禁止在各文件重复定义）

// 与 Date.prototype.getDay() 下标一致：0=周日，1=周一，…，6=周六
const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 返回日期对应的中文标签，支持"今天"/"明天"覆盖
 * @param {Date|string} date  - Date 对象或 'YYYY-MM-DD' 字符串
 * @param {string} [todayStr] - 今天的 'YYYY-MM-DD' 字符串（传入则匹配返回"今天"）
 * @param {string} [tomorrowStr] - 明天的 'YYYY-MM-DD' 字符串（传入则匹配返回"明天"）
 * @returns {string}
 */
const getWeekLabel = (date, todayStr, tomorrowStr) => {
  const d = date instanceof Date ? date : new Date(date);
  if (todayStr || tomorrowStr) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const ds = `${y}-${m}-${day}`;
    if (todayStr && ds === todayStr) return '今天';
    if (tomorrowStr && ds === tomorrowStr) return '明天';
  }
  return WEEK_LABELS[d.getDay()];
};

/**
 * 'YYYY-MM-DD' → { week: '今天'|'明天'|'周X', dateLabel: 'M/D' }
 * camping / trip 页面共用；含今天/明天短标签。
 */
const parseDateParts = (s) => {
  if (!s) return { week: '', dateLabel: '' };
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday = y === today.getFullYear() && m - 1 === today.getMonth() && d === today.getDate();
  const isTomorrow = (() => {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return date.getTime() === t.getTime();
  })();
  return {
    week: isToday ? '今天' : (isTomorrow ? '明天' : WEEK_LABELS[date.getDay()]),
    dateLabel: `${m}/${d}`,
  };
};

/**
 * 分享卡片顶栏日期标签（dateStr: YYYY-MM-DD，timeStr: HH:mm）
 * 例：'2024-07-23', '14:30' → '7月23日  14:30'
 */
const buildDateLabel = (dateStr, timeStr) => {
  if (!dateStr) return timeStr || '';
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}月${d}日${timeStr ? '  ' + timeStr : ''}`;
};

module.exports = { WEEK_LABELS, getWeekLabel, parseDateParts, buildDateLabel };
