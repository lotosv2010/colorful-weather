// 用户偏好 store：温度单位、主题色、默认城市、收藏城市
const STORAGE_KEY = 'user_prefs';

const THEME_PRESETS = [
  { name: '霁色蓝', color: '#1296db' },
  { name: '晚霞红', color: '#ff6b6b' },
  { name: '林荫绿', color: '#52c41a' },
  { name: '暮山紫', color: '#722ed1' },
  { name: '晨曦橙', color: '#fa8c16' },
  { name: '夜幕灰', color: 'rgba(255, 255, 255, 0.45)' },
];

const DEFAULTS = {
  tempUnit: 'C',
  themeColor: '#1296db',
  defaultCityId: null,
  cities: [],
};

let _cache = null;
const _listeners = new Set();

const load = () => {
  if (_cache) return _cache;
  try {
    const stored = wx.getStorageSync(STORAGE_KEY) || {};
    _cache = { ...DEFAULTS, ...stored, cities: Array.isArray(stored.cities) ? stored.cities : [] };
  } catch (e) {
    _cache = { ...DEFAULTS, cities: [] };
  }
  return _cache;
};

const persist = () => {
  try { wx.setStorageSync(STORAGE_KEY, _cache); } catch (e) {}
};

const notify = () => {
  _listeners.forEach(fn => { try { fn(_cache); } catch (_) {} });
};

const getPrefs = () => ({ ...load() });

// patch 中的每个字段都与当前值一致时，跳过持久化和通知，避免下游冗余 setData
const setPrefs = (patch) => {
  const cur = load();
  const keys = Object.keys(patch);
  if (keys.every(k => cur[k] === patch[k])) return getPrefs();
  _cache = { ...cur, ...patch };
  persist();
  notify();
  return getPrefs();
};

const subscribe = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

const _normalizeCity = (c) => ({
  id: String(c.id),
  name: c.name || '',
  adm1: c.adm1 || '',
  adm2: c.adm2 || '',
  lat: c.lat,
  lon: c.lon,
  pinned: !!c.pinned,
  addedAt: c.addedAt || Date.now(),
});

const addCity = (city) => {
  const cur = load();
  const norm = _normalizeCity(city);
  if (cur.cities.find(c => c.id === norm.id)) return getPrefs();
  return setPrefs({ cities: [...cur.cities, norm] });
};

const removeCity = (id) => {
  const cur = load();
  const target = String(id);
  const next = cur.cities.filter(c => c.id !== target);
  if (next.length === cur.cities.length) return getPrefs();
  const patch = { cities: next };
  if (cur.defaultCityId === target) patch.defaultCityId = null;
  return setPrefs(patch);
};

const togglePin = (id) => {
  const cur = load();
  const target = String(id);
  const cities = cur.cities
    .map(c => c.id === target ? { ...c, pinned: !c.pinned } : c)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
  return setPrefs({ cities });
};

const setDefaultCity = (id) => setPrefs({ defaultCityId: id == null ? null : String(id) });

const findCity = (id) => {
  if (id == null) return null;
  return load().cities.find(c => c.id === String(id)) || null;
};

module.exports = {
  THEME_PRESETS,
  getPrefs,
  setPrefs,
  subscribe,
  addCity,
  removeCity,
  togglePin,
  setDefaultCity,
  findCity,
};
