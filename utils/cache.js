const PREFIX = 'qw_cache_';

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
const getStale = (key) => {
  const entry = _entry(key);
  if (!entry) return null;
  return entry.data;
};

const set = (key, data, ttl) => {
  try {
    wx.setStorageSync(PREFIX + key, { data, exp: Date.now() + ttl });
    console.log(`[cache set] ${key} (TTL ${Math.round(ttl / 1000)}s)`);
  } catch (e) {}
};

// 清除所有天气缓存（用于手动强制刷新）
const clear = () => {
  try {
    const { keys } = wx.getStorageInfoSync();
    keys.filter(k => k.startsWith(PREFIX)).forEach(k => wx.removeStorageSync(k));
  } catch (e) {}
};

module.exports = { get, getStale, set, clear };
