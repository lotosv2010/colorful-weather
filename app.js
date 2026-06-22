// app.js
const config = require('./utils/config.local');
const network = require('./utils/network');
const monitor = require('./utils/monitor');

// 切后台超过该时长后，回到前台视为「重新启动」需强刷数据
const FORCE_REFRESH_THRESHOLD = 15 * 60 * 1000; // 15 分钟

App({
  onLaunch() {
    network.init();
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
  globalData: {
    lbs: config.tencentMap, // 腾讯地图（用于逆地理编码当前位置）
    lastHideAt: 0,
    needForceRefresh: false,
  }
})
