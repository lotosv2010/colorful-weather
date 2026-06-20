// app.js
const config = require('./utils/config.local');
const network = require('./utils/network');

App({
  onLaunch() {
    network.init();
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },
  globalData: {
    lbs: config.tencentMap // 腾讯地图（用于逆地理编码当前位置）
  }
})
