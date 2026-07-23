# 霁色天气

基于微信小程序原生框架开发的天气查询应用，内置 AI 天气助手。通过微信定位获取当前城市，调用和风天气 API 展示全维度气象数据，并支持多城市管理、精美分享卡片、露营地探索等特色功能。

![霁色天气](./static/app.jpg)

## 功能特性

### 核心天气
- **实时天气**：温度、体感温度、湿度、能见度、风向风速、降水量、气压、紫外线
- **逐小时预报**：24 小时温度、降水概率、风力、湿度、云量五图联动（可滚动 Canvas）
- **7 天预报**：日 / 夜天气图标 + 温度区间可视化
- **30 天预报**：列表、趋势折线图、月历三视图切换
- **分钟级降水**：未来 2 小时分钟级降水柱状图
- **天气预警**：颜色标识 + 紧急程度分级

### 环境信息
- **空气质量**：AQI 环图、PM2.5 / PM10 / O₃ / CO / SO₂ / NO₂，逐小时 / 逐日趋势
- **生活指数**：16 种指数（运动、穿衣、洗车、紫外线等），时间轴 + 定义卡片
- **天文信息**：日出日落弧线、太阳高度角全天曲线、月升月落、月相动画
- **节气 / 节日**：二十四节气与传统节日高亮卡片

### 多城市与地图
- **多城市管理**：收藏城市横划切换、城市概览面板、2 城市天气对比
- **地图 POI**：原生地图底图，点击任意位置查询当地天气
- **露营地探索**：地图搜索附近营地 POI，展示营地列表与当地实时天气

### 个性化与分享
- **自动主题**：主题色与卡片背景跟随天气类型 + 时段（日出前 / 日间 / 黄昏 / 夜间）自动切换
- **天气动效**：雨、雪、雷暴等天气粒子动效 + 卡片装饰
- **精美分享卡**：Canvas 绘制天气卡片，保存相册或发布朋友圈
- **出行规划**：选择目标城市 + 日期，综合天气评分给出出行建议
- **历史时光机**：回溯最近 10 天天气与空气质量数据

### AI 助手
内置微信 AI Skill（`weather-skill`），支持自然语言查询天气，自动 GPS 定位或识别城市名，结果卡片直接展示在对话中，可一键跳转主应用查看详情。

## 技术栈

| 模块 | 说明 |
|------|------|
| 框架 | 微信小程序原生（基础库 2.19.4）|
| 天气接口 | [和风天气 v7 API](https://dev.qweather.com/) |
| 定位 SDK | [腾讯位置服务 JSSDK](https://lbs.qq.com/miniProgram/jsSdk/jsSdkGuide/jsSdkOverview) |
| 农历算法 | [6tail/lunar-javascript](https://github.com/6tail/lunar-javascript) |
| UI | WeUI + 和风天气字体图标 |
| AI Skill | 微信小程序 `wx.modelContext` AI Skill 能力 |

## 页面列表（14 个）

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `pages/index` | 地图底图 + 底部抽屉，天气主视图 |
| 逐小时 | `pages/hourly` | 5 种图表联动展示 |
| 30 天预报 | `pages/weather30` | 列表 / 图表 / 月历三视图 |
| 分钟降水 | `pages/minutely` | 未来 2 小时降水曲线 |
| 空气质量 | `pages/air` | AQI + 污染物 + 趋势 |
| 生活指数 | `pages/life` | 16 种指数详情 |
| 天气预警 | `pages/warning` | 预警列表 + 城市收藏 |
| 台风路径 | `pages/typhoon` | 实时台风轨迹地图 |
| 天文详情 | `pages/astronomy` | 日出日落 + 太阳高度角 + 月相 |
| 城市对比 | `pages/compare` | 2 城市天气横向对比 |
| 出行规划 | `pages/trip` | 目的地天气评分 |
| 分享卡片 | `pages/share` | Canvas 精美天气卡 |
| 露营探索 | `pages/camping` | 营地 POI + 天气 |
| 设置 | `pages/settings` | 偏好、城市、主题管理 |

## 快速开始

### 1. 准备 API Key

- **和风天气**：在 [dev.qweather.com](https://dev.qweather.com/) 注册，创建项目获取 KEY
- **腾讯位置服务**：在 [lbs.qq.com](https://lbs.qq.com/) 创建 WebServiceAPI 应用获取 KEY

### 2. 创建本地配置文件

参照 `utils/config.example.js` 创建 `utils/config.local.js`（已 gitignore）：

```js
// utils/config.local.js
module.exports = {
  qweatherKey: 'YOUR_QWEATHER_KEY',
  qqmapKey: 'YOUR_QQMAP_KEY',
  qqmapReferer: 'YOUR_APP_NAME',
};
```

AI Skill 另需创建 `skills/weather-skill/config.local.js`，参照同目录 `config.example.js`。

### 3. 配置合法域名

在小程序管理后台「开发设置 → 服务器域名」添加：

- `https://m97fbtc2ed.re.qweatherapi.com`（和风天气）
- `https://apis.map.qq.com`（腾讯位置）

### 4. 导入项目

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择「导入项目」，目录选择仓库根目录
3. AppID 已写入 `project.config.json`，可直接使用或替换为自己的测试号

## 架构说明

### 数据流

```
onLoad
  └─ init()                    ← locationBehavior
      ├─ AI Handoff 城市（优先）
      ├─ 默认城市（prefs.js）
      └─ GPS 定位
          ├─ wx.getLocation()
          ├─ reverseGeocoder()  坐标 → 城市名
          └─ getWeather()       ← weatherFetchBehavior
              └─ Promise.all（11 路并发）
                  ├─ now / indices / hourly / sevenDay
                  ├─ air / warning / minutely
                  ├─ sun / moon / solarElevationAngle
                  └─ historicalWeather（昨日气温对比）
```

### Behavior 架构

首页通过 5 个 Behavior 分离关注点：

| Behavior | 职责 |
|----------|------|
| `locationBehavior` | 定位、城市解析、init 入口 |
| `weatherFetchBehavior` | 数据拉取、请求取消 |
| `cityPagesBehavior` | 多城市横划、切换 |
| `campingBehavior` | 露营图层、POI 搜索 |
| `mapTipsBehavior` | 地图点击 tips |

## 权限说明

`app.json` 已声明：

- `scope.userLocation`：用于 GPS 定位当前城市
- `requiredPrivateInfos: getLocation`

## License

[MIT](./LICENSE) © 2024 Robin
