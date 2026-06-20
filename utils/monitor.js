// utils/monitor.js
// 性能监控与版本更新管理

const PREFIX = 'qw_monitor_';
const MAX_LOAD_SAMPLES = 20;
const MAX_API_DURATIONS = 50;
const MAX_ERROR_LOG = 100;

// ── 存储辅助 ──

const _load = (key) => {
  try { return wx.getStorageSync(PREFIX + key) || null; }
  catch (e) { return null; }
};

const _save = (key, data) => {
  try { wx.setStorageSync(PREFIX + key, data); }
  catch (e) {}
};

const _pushLimited = (arr, item, max) => {
  arr.push(item);
  if (arr.length > max) arr.shift();
  return arr;
};

const _avg = (arr) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

// ── 版本更新检测 ──

const checkUpdate = () => {
  if (!wx.getUpdateManager) return;
  const manager = wx.getUpdateManager();
  manager.onUpdateReady(() => {
    wx.showModal({
      title: '更新提示',
      content: '新版本已准备好，是否重启应用？',
      success(res) {
        if (res.confirm) manager.applyUpdate();
      }
    });
  });
  manager.onUpdateFailed(() => {
    console.log('[monitor] 新版本下载失败');
  });
};

// ── 全局错误监听 ──

const initGlobalErrors = () => {
  wx.onError((msg) => {
    recordError('global', msg);
  });
};

// ── 页面加载耗时 ──

const recordPageLoad = (pagePath, startMs) => {
  if (!startMs) return;
  const duration = Date.now() - startMs;
  const perf = _load('perf') || { pages: {}, updatedAt: 0 };
  if (!perf.pages[pagePath]) {
    perf.pages[pagePath] = { loadTimes: [], avg: 0, count: 0 };
  }
  const entry = perf.pages[pagePath];
  _pushLimited(entry.loadTimes, duration, MAX_LOAD_SAMPLES);
  entry.avg = _avg(entry.loadTimes);
  entry.count += 1;
  perf.updatedAt = Date.now();
  _save('perf', perf);
};

// ── API 调用指标 ──

const recordApi = (apiPath, duration, success, errMsg) => {
  const metrics = _load('api') || { updatedAt: 0 };
  if (!metrics[apiPath]) {
    metrics[apiPath] = { total: 0, success: 0, fail: 0, durations: [], avgDuration: 0, lastFail: null };
  }
  const entry = metrics[apiPath];
  entry.total += 1;
  if (success) {
    entry.success += 1;
  } else {
    entry.fail += 1;
    entry.lastFail = { time: Date.now(), errMsg: errMsg || '' };
  }
  _pushLimited(entry.durations, duration, MAX_API_DURATIONS);
  entry.avgDuration = _avg(entry.durations);
  metrics.updatedAt = Date.now();
  _save('api', metrics);
};

// ── 错误记录 ──

const recordError = (type, message, extra = {}) => {
  const data = _load('errors') || { errors: [], updatedAt: 0 };
  const existing = data.errors.find(e => e.type === type && e.message === message);
  if (existing) {
    existing.count += 1;
    existing.time = Date.now();
  } else {
    _pushLimited(data.errors, {
      time: Date.now(),
      type,
      page: extra.page || '',
      message,
      stack: extra.stack || '',
      count: 1
    }, MAX_ERROR_LOG);
  }
  data.updatedAt = Date.now();
  _save('errors', data);
};

// ── 查询接口 ──

const getSummary = () => ({
  perf: _load('perf') || { pages: {} },
  api: _load('api') || {},
  errors: (_load('errors') || { errors: [] }).errors,
});

const clearAll = () => {
  ['perf', 'api', 'errors'].forEach(k => {
    try { wx.removeStorageSync(PREFIX + k); } catch (e) {}
  });
};

module.exports = {
  checkUpdate,
  initGlobalErrors,
  recordPageLoad,
  recordApi,
  recordError,
  getSummary,
  clearAll,
};
