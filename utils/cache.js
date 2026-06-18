const PREFIX = 'qw_cache_';

const get = (key) => {
  try {
    const entry = wx.getStorageSync(PREFIX + key);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      wx.removeStorageSync(PREFIX + key);
      return null;
    }
    const remaining = Math.round((entry.exp - Date.now()) / 1000);
    console.log(`[cache hit] ${key} (剩余 ${remaining}s)`);
    return entry.data;
  } catch (e) {
    return null;
  }
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

module.exports = { get, set, clear };
