# Colorful 天气

基于微信小程序原生框架的天气查询应用。自动定位获取当前城市天气，展示实时天气、24 小时与 7 天预报、空气质量及生活指数，并支持城市搜索切换。

![Colorful天气](./static/app.jpg)

## 功能特性

- 自动定位：通过 `wx.getLocation` + 腾讯地图逆地理编码定位到区/县级城市
- 实时天气：温度、体感、湿度、能见度、风向风速、降水量、气压、紫外线
- 24 小时预报：横向滚动展示逐小时天气与风速
- 7 天预报：日 / 夜图标 + 最高最低温
- 空气质量：AQI、PM2.5、PM10、O₃、CO、SO₂、NO₂
- 生活指数：运动、穿衣、洗车、紫外线
- 城市搜索：集成微信官方城市选择器插件

## 技术栈

| 模块 | 说明 |
| ---- | ---- |
| 框架 | 微信小程序原生（基础库 2.19.4） |
| 天气接口 | [和风天气 v7](https://dev.qweather.com/) |
| 定位 SDK | [腾讯位置服务 微信小程序 JSSDK](https://lbs.qq.com/miniProgram/jsSdk/jsSdkGuide/jsSdkOverview) |
| 城市选择器 | 微信小程序插件 `citySelector` (`wx63ffb7b7894e99ae`) |
| UI | WeUI + 和风天气字体图标 |

## 目录结构

```
.
├── app.js / app.json / app.wxss   小程序入口与全局配置
├── pages/
│   ├── index/                     首页：天气主视图
│   └── life/                      生活指数详情页（占位）
├── components/
│   ├── temp/                      当前温度与头部信息
│   ├── hourly/                    24 小时预报
│   ├── daily/                     7 天预报
│   ├── air/                       空气质量
│   ├── life/                      生活指数
│   └── icon/                      SVG 图标渲染（支持动态换色）
├── utils/
│   ├── api.js                     和风天气接口封装
│   └── util.js                    日期格式化
├── libs/
│   └── qqmap-wx-jssdk.min.js      腾讯地图 SDK
├── static/
│   ├── icons/                     SVG 图标
│   ├── qweather-icons.wxss        和风天气字体样式
│   └── app.jpg                    项目预览图
├── project.config.json
├── sitemap.json
└── weui.wxss
```

## 快速开始

### 1. 准备 API Key

- 和风天气：在 [dev.qweather.com](https://dev.qweather.com/) 注册并创建项目，获取开发版 KEY
- 腾讯位置服务：在 [lbs.qq.com](https://lbs.qq.com/) 创建 WebServiceAPI 应用，获取 Key

### 2. 替换密钥

替换以下文件中的占位 KEY：

- `utils/api.js` → `KEY`（和风天气）
- `app.js` → `globalData.lbs.key`（腾讯地图）
- `pages/index/index.js` → `init()` 内 `new QQMapWX({ key })`（腾讯地图）

> 当前仓库中的 KEY 仅供学习演示，生产环境请勿直接使用。建议通过云函数代理或独立配置文件管理密钥。

### 3. 配置合法域名

在小程序管理后台「开发设置 → 服务器域名」中添加 request 合法域名：

- `https://devapi.qweather.com`
- `https://apis.map.qq.com`

### 4. 导入项目

1. 安装微信开发者工具
2. 选择「导入项目」，目录选择仓库根目录
3. AppID 已写入 `project.config.json`，可直接使用或替换为自己的测试号

## 数据流

```
onLoad
  └─ init()
      ├─ 实例化 QQMapWX
      ├─ wx.getLocation()       获取经纬度
      └─ getNow()
          ├─ reverseGeocoder()  坐标 → 城市名
          └─ getWeather()       Promise.all 并发拉取
              ├─ now      实时天气
              ├─ indices  生活指数
              ├─ hourly   24 小时
              ├─ 7d       7 天预报
              └─ air      空气质量
```

## 权限说明

`app.json` 已声明使用以下权限：

- `scope.userLocation`：用于定位当前城市
- `requiredPrivateInfos: getLocation`

## License

[MIT](./LICENSE) © 2022 Robin
