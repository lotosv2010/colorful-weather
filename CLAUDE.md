# CLAUDE.md

本文件为 Claude Code 在本仓库工作时提供项目上下文。

## 项目概述

霁色天气：基于微信小程序原生框架开发的天气查询应用。通过微信定位获取当前位置，调用和风天气 API 展示实时天气、逐小时预报、7 天 / 30 天预报、空气质量、生活指数、天气预警、分钟级降水、天文信息（日出日落 / 月相）、台风路径等。

- AppID：`wx2d54933761654ca9`（见 `project.config.json`）
- 小程序基础库：`2.19.4`
- 入口页：`pages/index/index`

## 技术栈

- 微信小程序原生框架（WXML / WXSS / JS / JSON）
- 和风天气 API（`https://m97fbtc2ed.re.qweatherapi.com`）：实时、逐小时、逐日、30 天、分钟级降水、空气质量、生活指数、天文、台风、预警
- 腾讯位置服务 SDK（`libs/qqmap-wx-jssdk.min.js`）：逆地理编码（坐标转城市）
- WeUI 样式（`weui.wxss`）+ 和风天气图标字体（`static/qweather-icons.wxss`）

## 目录结构

```
app.js / app.json / app.wxss       小程序入口与全局配置
pages/
  index/                           首页：天气主视图
  life/                            生活指数详情页（16 种指数、时间轴、定义卡片）
  air/                             空气质量详情页（AQI 环图、污染物、逐小时 / 逐日预报）
  warning/                         天气预警详情页（颜色标识、紧急程度）
  weather30/                       30 天预报页（列表 / 图表双视图、统计摘要）
  hourly/                          逐小时预报详情页（温度 / 降水 / 风力三图表联动）
  minutely/                        分钟级降水页（Canvas 2D 柱状图）
  typhoon/                         台风路径页（原生地图、历史 / 预测轨迹、预测表格）
components/
  temp/                            当前温度 + 头部信息（预警横幅、分钟级 / 台风入口）
  hourly/                          24 小时预报横向滚动（首页摘要）
  daily/                           7 天预报列表（温度条可视化）
  air/                             空气质量 AQI 环图（Canvas 2D）
  life/                            生活指数四宫格（运动 / 穿衣 / 洗车 / 紫外线）
  icon/                            SVG 图标渲染（运行时替换 hex 颜色 → base64）
  astronomy/                       日出日落曲线 + 月相（Canvas 2D）
  city-search/                     城市搜索浮层（热门城市、搜索历史、防抖搜索）
  page-header/                     子页通用城市 / 省区头部
  solar/                           太阳辐射 GHI 图表（Canvas 2D）
  tide/                            潮汐高度图表（Canvas 2D，高低潮标记）
  hourly-temp-chart/               逐小时温度折线图（Canvas 2D，可滚动）
  hourly-precip-chart/             逐小时降水柱状 + 概率折线图（Canvas 2D）
  hourly-wind-chart/               逐小时风速图表 + 风向箭头（Canvas 2D）
  weather30-card/                  30 天预报单日卡片
  weather30-chart/                 30 天温度趋势双折线图（Canvas 2D）
utils/
  api.js                           和风天气接口封装（18 个函数，含缓存）
  cache.js                         wx.setStorage TTL 缓存层
  util.js                          日期格式化、RGBA 转 hex、亮度文字色
  lifeMeta.js                      生活指数定义与等级颜色映射
  airMeta.js                       AQI 等级定义与污染物元数据
  wind.js                          风向角度 → 8 方位箭头旋转
  iconColor.wxs                    WXS：天气图标 code → 颜色分类
  moonPhase.wxs                    WXS：月相 code → emoji / 名称
  fmt.wxs                          WXS：安全取值、UV 文本映射
libs/
  qqmap-wx-jssdk.min.js            腾讯地图 SDK
static/
  icons/                           生活指数 / 刷新 / 风向等 SVG 图标（19 个）
  qweather-icons.wxss              和风天气图标字体样式
  app.jpg                          项目预览图
```

## 关键约定

### 数据流（pages/index/index.js）

1. `onLoad` → `init()`：实例化腾讯地图 SDK，调用 `wx.getLocation()` 取经纬度。
2. `getNow()`：通过 `qqmapsdk.reverseGeocoder` 解析当前城市名，再触发 `getWeather()`。
3. `getWeather()`：使用 `Promise.all` 并发请求 9 个接口（实时 / 生活指数 / 24h / 7d / 空气 / 日出日落 / 月相 / 预警 / 分钟级降水），将结果分发到对应组件。
4. 城市切换通过 `city-search` 组件触发 `onSelectCity`，更新经纬度后再次拉取。

### 组件职责

所有展示组件均为受控展示组件：父页通过 properties 单向传入数据，组件内不发起请求。仅 `temp` 通过 `triggerEvent('getnow')` 通知父级刷新。

### 图标渲染

- 天气图标：使用和风天气字体类 `qi-{iconCode}-fill`（在 `static/qweather-icons.wxss` 中定义）。
- 生活类图标：通过 `components/icon` 读取本地 SVG，运行时替换 hex 颜色后以 base64 data URL 设为背景。

### 缓存策略（utils/cache.js）

所有 API 请求（GeoAPI 除外）均通过 `cache.js` 做 TTL 缓存，存储在 `wx.setStorage` 中。缓存 key 由 URL 路径 + 排序参数（排除 key）生成。GeoAPI 因版权限制不缓存。

### 全局配置（app.js）

`globalData.lbs` 中保存腾讯位置 key 和 referer，传给 `city-search` 组件使用。

## 安全与密钥

⚠️ 当前仓库中以下密钥**以明文形式硬编码**，建议处理：

- `utils/api.js`：和风天气 KEY
- `app.js`：腾讯地图 KEY

如需重构，应抽离至独立的非追踪配置文件，或通过云函数代理调用。

## 已知待办与潜在问题

- 温度 / 角度的 `o` 字符是用普通文本模拟的「°」，应改为真正的度数符号 `°`（`components/temp/index.wxml` 第 15、57 行，`components/hourly/index.wxml` 第 10 行）。
- `components/temp/index.wxml` 第 2 行使用相对路径 `../../utils/iconColor.wxs`，建议统一为绝对路径。

## 开发命令

本项目无 npm 脚本，使用微信开发者工具直接打开仓库根目录即可预览 / 上传。

- 开发者工具中导入项目：选择项目根目录，AppID 已在 `project.config.json` 中。
- 真机预览需要在和风天气、腾讯地图、微信小程序后台同时配置合法域名 `m97fbtc2ed.re.qweatherapi.com` 与 `apis.map.qq.com`。

## 编码风格

- 缩进：2 空格（`project.config.json` 中 `editorSetting` 已锁定）。
- ESLint：仅启用解析层，未声明 rules（`.eslintrc.js`）。
- 组件结构遵循微信原生四件套 `index.{js,json,wxml,wxss}`。
- 注释语言：中文（与现有代码保持一致）。

## 不要做的事

- 不要主动执行 `git commit` / `git push` / `git branch` 等操作，除非用户明确要求。
- 不要将 `project.private.config.json` 提交到远端，它含有本地开发者工具个人配置。
- 不要硬编码新增 key 到源码中，应通过配置 / 云函数注入。
