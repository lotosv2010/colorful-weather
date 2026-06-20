// app.js
const config = require('./utils/config.local');

App({
  onLaunch() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },
  globalData: {
    lbs: config.tencentMap // 腾讯地图（用于逆地理编码当前位置）
  }
})
