// app.js
App({
  onLaunch() {
    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    });
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },
  globalData: {
    lbs: { // 腾讯地图（用于逆地理编码当前位置）
      key: 'LY2BZ-2PECQ-4VD5L-GS33R-VGQO5-RQB3Z',
      referer: 'Colorful天气'
    }
  }
})
