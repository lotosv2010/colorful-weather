// app.js
const config = require('./utils/config.local');
const network = require('./utils/network');
const monitor = require('./utils/monitor');

// 切后台超过该时长后，回到前台视为「重新启动」需强刷数据
const FORCE_REFRESH_THRESHOLD = 15 * 60 * 1000; // 15 分钟

App({
  onLaunch() {
    network.init();
    this._registerAgentHandoff();
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    monitor.checkUpdate();
    monitor.initGlobalErrors();
    // 冷启动：默认强刷
    this.globalData.needForceRefresh = true;
  },
  onShow() {
    // 热启动：根据离开时长决定是否强刷
    const last = this.globalData.lastHideAt;
    if (last && Date.now() - last >= FORCE_REFRESH_THRESHOLD) {
      this.globalData.needForceRefresh = true;
    }
  },
  onHide() {
    this.globalData.lastHideAt = Date.now();
  },
  // 注册 AI Handoff 监听（须早于 handoff 触发的 onBeforeAppRoute）
  _registerAgentHandoff() {
    if (!wx.onAgentHandoff) return;
    wx.onAgentHandoff(({ pageId, path, query, payload }) => {
      this.globalData.agentHandoffs[pageId] = { path, query, payload };
    });
  },

  // 接力页取走 handoff（取后删除，避免重复消费）
  takeAgentHandoff(pageId) {
    const map = this.globalData.agentHandoffs;
    const handoff = map[pageId];
    if (handoff) delete map[pageId];
    return handoff || null;
  },

  globalData: {
    lbs: config.tencentMap, // 腾讯地图（用于逆地理编码当前位置）
    lastHideAt: 0,
    needForceRefresh: false,
    agentHandoffs: {},
    shareData: null,         // 天气分享快照（index → share 页单次传递）
  }
})
