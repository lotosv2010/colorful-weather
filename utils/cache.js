// 缓存键前缀；带 schema 版本号，字段结构调整时升级版本即可让旧缓存整体失效
const PREFIX = 'qw_cache_v1_';

// 默认 stale 上限：超过 24h 的过期缓存视为失效（避免极端场景下展示过于陈旧的数据）
const DEFAULT_STALE_MAX_AGE = 24 * 3600 * 1000;

// LRU prune 参数
const MAX_ENTRIES = 200;            // 条数上限
const PRUNE_TO = 150;               // 触发后裁剪到该条数
const USAGE_THRESHOLD = 0.8;        // storage 占用率超过该值也触发
const PRUNE_CHECK_INTERVAL = 20;    // 每 N 次 set 抽检一次容量
let _writeCounter = 0;

const _entry = (key) => {
  try {
    return wx.getStorageSync(PREFIX + key) || null;
  } catch (e) {
    return null;
  }
};

const get = (key) => {
  const entry = _entry(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) return null;
  const remaining = Math.round((entry.exp - Date.now()) / 1000);
  console.log(`[cache hit] ${key} (剩余 ${remaining}s)`);
  return entry.data;
};

// 取过期/未过期均可的旧数据，用于离线降级
// maxAgeMs：从写入时间起算，超过该年龄返回 null（默认 24h）
const getStale = (key, maxAgeMs = DEFAULT_STALE_MAX_AGE) => {
  const entry = _entry(key);
  if (!entry) return null;
  if (entry.createdAt && Date.now() - entry.createdAt > maxAgeMs) {
    console.log(`[cache stale-expired] ${key} (age > ${Math.round(maxAgeMs / 1000)}s)`);
    return null;
  }
  return entry.data;
};

// 列出当前所有缓存项的元信息（不读 data，避免占用解码开销）
const _listEntries = () => {
  let keys = [];
  try {
    keys = wx.getStorageInfoSync().keys || [];
  } catch (_) {
    return [];
  }
  const out = [];
  for (const k of keys) {
    if (!k.startsWith(PREFIX)) continue;
    try {
      const v = wx.getStorageSync(k);
      if (v && typeof v === 'object') {
        out.push({ key: k, createdAt: v.createdAt || 0, exp: v.exp || 0 });
      } else {
        // 异常数据视为最旧，优先淘汰
        out.push({ key: k, createdAt: 0, exp: 0 });
      }
    } catch (_) {
      out.push({ key: k, createdAt: 0, exp: 0 });
    }
  }
  return out;
};

// 裁剪到 targetCount 条：已过期的优先淘汰，其次按 createdAt 从旧到新
const _prune = (targetCount = PRUNE_TO) => {
  const entries = _listEntries();
  if (entries.length <= targetCount) return 0;
  const now = Date.now();
  entries.sort((a, b) => {
    const aLive = a.exp > now ? 1 : 0;
    const bLive = b.exp > now ? 1 : 0;
    if (aLive !== bLive) return aLive - bLive; // 已过期（live=0）排前面 = 优先淘汰
    return a.createdAt - b.createdAt;          // 同状态下旧的先淘汰
  });
  const toRemove = entries.length - targetCount;
  let removed = 0;
  for (let i = 0; i < toRemove; i++) {
    try {
      wx.removeStorageSync(entries[i].key);
      removed++;
    } catch (_) {}
  }
  return removed;
};

// 周期性抽检：条数或占用率触阈则 prune
const _maybePrune = () => {
  if (++_writeCounter < PRUNE_CHECK_INTERVAL) return;
  _writeCounter = 0;
  try {
    const info = wx.getStorageInfoSync();
    const entryCount = (info.keys || []).filter(k => k.startsWith(PREFIX)).length;
    const usageRatio = info.limitSize ? info.currentSize / info.limitSize : 0;
    if (entryCount > MAX_ENTRIES || usageRatio > USAGE_THRESHOLD) {
      const removed = _prune();
      if (removed) console.log(`[cache prune] removed=${removed} usage=${(usageRatio * 100).toFixed(1)}% count=${entryCount}`);
    }
  } catch (_) {}
};

const set = (key, data, ttl) => {
  const fullKey = PREFIX + key;
  const payload = { data, exp: Date.now() + ttl, createdAt: Date.now() };
  try {
    wx.setStorageSync(fullKey, payload);
    console.log(`[cache set] ${key} (TTL ${Math.round(ttl / 1000)}s)`);
  } catch (e) {
    // 写入失败多半因 storage 触顶：立刻 prune 后重试一次
    console.warn(`[cache set fail] ${key}`, e?.errMsg || e);
    try {
      const removed = _prune();
      console.log(`[cache prune-on-fail] removed=${removed}`);
      wx.setStorageSync(fullKey, payload);
    } catch (e2) {
      console.warn(`[cache set retry fail] ${key}`, e2?.errMsg || e2);
      return;
    }
  }
  _maybePrune();
};

// 清除所有天气缓存（用于手动强制刷新）；同时清理历史版本前缀残留
const ALL_PREFIXES = [PREFIX, 'qw_cache_'];
const clear = () => {
  try {
    const { keys } = wx.getStorageInfoSync();
    keys
      .filter(k => ALL_PREFIXES.some(p => k.startsWith(p)))
      .forEach(k => wx.removeStorageSync(k));
  } catch (e) {}
};

// 诊断信息：当前条数与占用率（供监控页或设置页使用）
const getStats = () => {
  try {
    const info = wx.getStorageInfoSync();
    const keys = info.keys || [];
    return {
      total: keys.length,
      cacheEntries: keys.filter(k => k.startsWith(PREFIX)).length,
      currentKB: info.currentSize || 0,
      limitKB: info.limitSize || 0,
      usageRatio: info.limitSize ? info.currentSize / info.limitSize : 0,
    };
  } catch (e) {
    return null;
  }
};

module.exports = { get, getStale, set, clear, getStats };
