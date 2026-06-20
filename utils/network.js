// 网络状态轻量 store：跟踪在线/离线 + 订阅通知
let _online = true;
let _networkType = 'unknown';
const _listeners = new Set();

const _notify = () => {
  _listeners.forEach(fn => { try { fn({ online: _online, networkType: _networkType }); } catch (_) {} });
};

const init = () => {
  try {
    wx.getNetworkType({
      success: (res) => {
        _networkType = res.networkType;
        _online = res.networkType !== 'none';
        _notify();
      }
    });
    wx.onNetworkStatusChange((res) => {
      _online = !!res.isConnected;
      _networkType = res.networkType;
      _notify();
    });
  } catch (e) {}
};

const isOnline = () => _online;

// 由 api 层在请求失败时调用，强制切换到离线状态
const markOffline = () => {
  if (!_online) return;
  _online = false;
  _notify();
};

const subscribe = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

module.exports = { init, isOnline, markOffline, subscribe };
