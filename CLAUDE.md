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
  index/                           首页：地图底图 + 底部抽屉天气主视图
  settings/                        设置页：温度单位、主题色、默认城市、收藏城市管理
  life/                            生活指数详情页（16 种指数、时间轴、定义卡片）
  air/                             空气质量详情页（AQI 环图、污染物、逐小时 / 逐日预报）
  warning/                         天气预警详情页（颜色标识、紧急程度）
  weather30/                       30 天预报页（列表 / 图表双视图、统计摘要）
  hourly/                          逐小时预报详情页（温度 / 降水 / 风力三图表联动）
  minutely/                        分钟级降水页（Canvas 2D 柱状图）
  typhoon/                         台风路径页（原生地图、历史 / 预测轨迹、预测表格）
components/
  temp/                            当前温度 + 头部信息（预警横幅、分钟级 / 台风入口）
  bottom-sheet/                    底部可拖拽抽屉（Apple Home Bar 风格，上拉展开 / 下拉折叠）
  hourly/                          24 小时预报横向滚动（首页摘要）
  daily/                           7 天预报列表（温度条可视化）
  air/                             空气质量 AQI 环图（Canvas 2D）
  life/                            生活指数四宫格（运动 / 穿衣 / 洗车 / 紫外线）
  icon/                            SVG 图标渲染（运行时替换 hex 颜色 → base64）
  astronomy/                       日出日落曲线 + 月相（Canvas 2D）
  city-search/                     城市搜索浮层（热门城市、搜索历史、防抖搜索、收藏管理）
  page-header/                     子页通用城市 / 省区头部
  solar/                           太阳辐射 GHI 图表（Canvas 2D，当前未引用）
  tide/                            潮汐高度图表（Canvas 2D，高低潮标记，当前未引用）
  hourly-temp-chart/               逐小时温度折线图（Canvas 2D，可滚动）
  hourly-precip-chart/             逐小时降水柱状 + 概率折线图（Canvas 2D）
  hourly-wind-chart/               逐小时风速图表 + 风向箭头（Canvas 2D）
  weather30-card/                  30 天预报单日卡片
  weather30-chart/                 30 天温度趋势双折线图（Canvas 2D）
  error-state/                     错误状态视图（错误文字 + 重试按钮，支持 compact 模式）
  timemachine/                     时光机：tabs 切换天气 / 空气，最近 10 天日期 + 24h Canvas 图表（骨架屏 + 异步竞态保护）
utils/
  api.js                           和风天气接口封装（19 个函数，含缓存与历史天气 / 空气）
  cache.js                         wx.setStorage TTL 缓存层（支持 stale 降级）
  network.js                       网络状态 store（在线/离线追踪 + 订阅通知）
  prefs.js                         用户偏好 store（温度单位 / 主题色 / 默认城市 / 收藏城市）
  share.js                         分享辅助（卡片 / 朋友圈分享路径构造）
  temp.js                          温度单位换算（℃ ↔ ℉，与 tempUnit.wxs 一致）
  config.local.js                  本地密钥配置（已 gitignore，不进版本库）
  config.example.js                配置示例（供新开发者参考）
  util.js                          日期格式化、RGBA 转 hex、亮度文字色
  lifeMeta.js                      生活指数定义与等级颜色映射
  airMeta.js                       AQI 等级定义与污染物元数据
  route.js                         页面跳转路径构造（buildPath / navigateTo / buildQuery）
  wind.js                          风向角度 → 8 方位箭头旋转
  iconColor.wxs                    WXS：天气图标 code → 颜色分类
  moonPhase.wxs                    WXS：月相 code → emoji / 名称
  fmt.wxs                          WXS：安全取值、UV 文本映射
  tempUnit.wxs                     WXS：温度单位换算（供 WXML 内直接使用）
libs/
  qqmap-wx-jssdk.min.js            腾讯地图 SDK
static/
  icons/                           生活指数 / 刷新 / 风向等 SVG 图标（19 个）
  qweather-icons.wxss              和风天气图标字体样式
  app.jpg                          项目预览图
```

## 关键约定

### 数据流（pages/index/index.js）

1. `onLoad` → `init()`：检查默认城市（`prefs.js`），有则直接加载；无则调用 `wx.getLocation()` 定位。
2. `getNow()`：通过 `qqmapsdk.reverseGeocoder` 解析当前城市名，再触发 `getWeather()`。
3. `getWeather()`：使用 `Promise.all` 并发请求 9 个接口（实时 / 生活指数 / 24h / 7d / 空气 / 日出日落 / 月相 / 预警 / 分钟级降水），将结果分发到对应组件。切换城市时先 `abortPending()` 取消未完成请求。
4. 城市切换有三种触发方式：① `city-search` 组件 `onSelectCity`；② 定位按钮 `onLocateTap`；③ 地图点击 `onMapTap`（取 tap 坐标 → 逆地理编码 → 更新 markers + callout → 加载天气）。重新定位和搜索选城时清除 markers。
5. 温度单位通过 `prefs.js` 订阅机制下发，子页通过 `tempUnit` 属性接收。

### 组件职责

所有展示组件均为受控展示组件：父页通过 properties 单向传入数据，组件内不发起请求。仅 `temp` 通过 `triggerEvent('getnow')` 通知父级刷新，`city-search` 通过 `triggerEvent('selectcity')` 通知城市切换。

### 用户偏好（utils/prefs.js）

`prefs.js` 提供 `tempUnit`（℃/℉）、`themeColor`（6 种预设）、`defaultCityId`、`cities`（收藏列表）。通过 `subscribe(fn)` 订阅变更，页面响应式更新。主题色通过 CSS 变量 `--theme` 注入页面根节点。

### 离线降级

`network.js` 追踪在线/离线状态。断网时 `cache.getStale()` 返回过期缓存，首页显示「离线模式」横幅。

### 骨架屏

首页加载时显示骨架屏替代 `wx.showLoading`。`loading` 状态控制 compact 卡片和 full-list 区域在骨架屏与真实内容间切换。shimmer 动画定义在 `index.wxss`（`@keyframes sk-shimmer`），timemachine 组件有独立的骨架屏实现。

### 错误恢复

首页和所有子页统一使用 `components/error-state` 组件展示错误状态 + 重试按钮。首页定位失败时自动弹出城市搜索面板（`selectorVisible`），引导用户手动选城。各子页 JS 中实现 `onRetry()` 方法处理重试逻辑。

### 图标渲染

- 天气图标：使用和风天气字体类 `qi-{iconCode}-fill`（在 `static/qweather-icons.wxss` 中定义）。
- 生活类图标：通过 `components/icon` 读取本地 SVG，运行时替换 hex 颜色后以 base64 data URL 设为背景。

### 缓存策略（utils/cache.js）

所有 API 请求（GeoAPI 除外）均通过 `cache.js` 做 TTL 缓存，存储在 `wx.setStorage` 中。缓存 key 由 URL 路径 + 排序参数（排除 key）生成。GeoAPI 因版权限制不缓存。

### 全局配置（app.js）

`globalData.lbs` 中保存腾讯位置 key 和 referer，传给 `city-search` 组件使用。

## 安全与密钥

密钥已抽离至 `utils/config.local.js`（已加入 `.gitignore`，不进版本库）：

- `utils/api.js` 通过 `require('./config.local')` 读取和风天气 KEY
- `app.js` 通过 `require('./utils/config.local')` 读取腾讯地图 KEY
- 新开发者参考 `utils/config.example.js` 创建本地配置

⚠️ 密钥仍会随 wxapkg 包泄露，后续可考虑迁移至云函数代理。

## 已知待办与潜在问题

详见 `docs/tasks/current.md`。

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
