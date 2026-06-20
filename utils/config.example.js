// 配置示例：拷贝为 config.local.js 后填入真实密钥
// config.local.js 已被 .gitignore，不会进入版本库
module.exports = {
  // 和风天气 KEY：https://console.qweather.com/
  qweatherKey: 'YOUR_QWEATHER_KEY',
  // 腾讯位置服务（用于逆地理编码）：https://lbs.qq.com/
  tencentMap: {
    key: 'YOUR_TENCENT_MAP_KEY',
    referer: 'Colorful天气'
  }
};
