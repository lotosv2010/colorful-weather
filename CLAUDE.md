# CLAUDE.md

本文件为 Claude Code 在本仓库工作时提供项目上下文。

## 项目概述

霁色天气：基于微信小程序原生框架开发的天气查询应用。通过微信定位获取当前位置，调用和风天气 API 展示实时天气、逐小时预报、7 天 / 30 天预报、空气质量、生活指数、天气预警、分钟级降水、天文信息（日出日落 / 月相）、台风路径等，并内置 AI 天气助手（`skills/weather-skill`）。

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
AGENTS.md                          AI 助手系统提示（wx.modelContext）
pages/
  index/                           首页：原生地图底图 + 底部抽屉天气主视图
  settings/                        设置页：温度单位、主题色、默认城市、收藏城市管理
  life/                            生活指数详情页（16 种指数、时间轴、定义卡片）
  air/                             空气质量详情页（AQI 环图、污染物、逐小时 / 逐日预报）
  warning/                         天气预警详情页（颜色标识、紧急程度）
  weather30/                       30 天预报页（列表 / 图表 / 月历三视图、统计摘要）
  hourly/                          逐小时预报详情页（温度 / 降水 / 风力三图表联动）
  minutely/                        分钟级降水页（Canvas 2D 柱状图）
  typhoon/                         台风路径页（原生地图、历史 / 预测轨迹、预测表格）
  compare/                         城市对比页（2 城市实时 + 7 天温度趋势 + 空气质量对比）
  astronomy/                       天文详情页（日出日落弧线、太阳高度角全天、月相）
  trip/                            出行规划页（目标城市 + 日期 → 天气评分 + 建议）
  share/                           天气分享卡页（Canvas 绘制精美卡片 + 保存 / 分享朋友圈）
  camping/                         露营地探索页（地图 POI 搜索 + 营地列表 + 当地天气）
behaviors/
  campingBehavior.js               露营图层：POI 搜索、marker 合并、图层开关（首页）
  mapTipsBehavior.js               地图点击 tips：轻量天气查询、浮层展示与关闭（首页）
  cityPagesBehavior.js             多城市横划页：城市列表构建、滑动切换、概览面板（首页）
  locationBehavior.js              定位与城市解析：init / getLocation / getNow / getCity / _resolveCityId（首页）
  weatherFetchBehavior.js          天气数据拉取：getWeather（11 路并发）/ getIndices / _abortPending（首页）
  prefsBehavior.js                 用户偏好订阅：统一 subscribe / unsubscribe 生命周期（通用）
  outingBehavior.js                出行评分与建议（通用，供多页复用）
  chartCanvasBehavior.js           逐小时图表公共逻辑：Canvas 初始化、滚动同步、点击命中（5 个 hourly 图表复用）
components/
  temp/                            当前温度 + 头部信息（预警横幅、分钟级 / 台风入口）
  bottom-sheet/                    底部可拖拽抽屉（Apple Home Bar 风格，上拉展开 / 下拉折叠）
  hourly/                          24 小时预报横向滚动（首页摘要）
  daily/                           7 天预报列表（温度条可视化）
  air/                             空气质量 AQI 环图（Canvas 2D）
  life/                            生活指数四宫格（运动 / 穿衣 / 洗车 / 紫外线）
  icon/                            SVG 图标渲染（运行时替换 hex 颜色 → base64）
  astronomy/                       日出日落弧线 + 月相（Canvas 2D，复用 utils/astronomyCanvas.js）
  city-search/                     城市搜索浮层（热门城市、搜索历史、防抖搜索、收藏管理）
  city-overview/                   多城市概览面板（城市卡片列表、实时天气摘要）
  compact-weather/                 紧凑天气摘要卡片（多城市横划页用）
  page-header/                     子页通用城市 / 省区头部
  solar-term/                      节气 / 节日高亮卡片（首页 bottom-sheet）
  weather-particles/               全屏天气粒子动效层（Canvas 2D，雨 / 雪 / 雷暴等）
  weather-decor/                   卡片右上角天气装饰层（纯 CSS 动画）
  solar/                           太阳辐射 GHI 图表（Canvas 2D，当前未引用）
  tide/                            潮汐高度图表（Canvas 2D，高低潮标记，当前未引用）
  hourly-temp-chart/               逐小时温度折线图（Canvas 2D，可滚动）
  hourly-precip-chart/             逐小时降水柱状 + 概率折线图（Canvas 2D）
  hourly-wind-chart/               逐小时风速图表 + 风向箭头（Canvas 2D）
  hourly-humidity-chart/           逐小时湿度折线图（Canvas 2D）
  hourly-cloud-chart/              逐小时云量折线图（Canvas 2D）
  weather30-card/                  30 天预报单日卡片
  weather30-chart/                 30 天温度趋势双折线图（Canvas 2D）
  weather-calendar/                月历视图：每日天气图标 / 温度 / 月相，含历史 + 当月 + 未来 30 天，支持月份切换
  error-state/                     错误状态视图（错误文字 + 重试按钮，支持 compact 模式）
  timemachine/                     时光机：tabs 切换天气 / 空气，最近 10 天 + 24h Canvas 图表（骨架屏 + 异步竞态保护）
utils/
  api.js                           和风天气接口封装（19 个函数，含 TTL 缓存与任务取消）
  cache.js                         wx.setStorage TTL 缓存层（支持 stale 降级）
  network.js                       网络状态 store（在线/离线追踪 + 订阅通知）
  prefs.js                         用户偏好 store（温度单位 / 主题色 / 默认城市 / 收藏城市）
  autoTheme.js                     天气主题色 / 卡片背景自动计算（按天气分类 + 日出日落时段）
  weatherEffect.js                 天气动效映射（粒子类型 + 卡片装饰，对应 weather-particles / weather-decor 组件）
  weatherFormat.js                 API 原始数据格式化（formatHourly / formatDaily / formatAir / formatDateStr）
  summary.js                       自然语言天气摘要生成（buildSummary / buildShortDesc）
  astronomyCanvas.js               Canvas 绘制纯函数（drawSun / drawMoon），供 astronomy 组件和 astronomy 页复用
  shareCard.js                     分享卡片 Canvas 完整绘制逻辑
  tripAdvice.js                    出行建议评分（基于实时天气 + 今日预报 + 空气质量）
  lunar.js                         农历日期 + 二十四节气计算（基于 6tail/lunar-javascript）
  monitor.js                       性能监控与版本更新管理
  moonPhaseMeta.js                 月相名称 → 图标码映射（JS 侧统一出口，与 moonPhase.wxs 互补）
  lifeMeta.js                      生活指数定义与等级颜色映射
  airMeta.js                       AQI 等级定义与污染物元数据
  route.js                         页面跳转路径构造（buildPath / navigateTo / buildQuery）
  wind.js                          风向角度 → 8 方位箭头旋转
  date.js                          日期工具（WEEK_LABELS 等）
  temp.js                          温度单位换算（℃ ↔ ℉，与 tempUnit.wxs 一致）
  share.js                         分享辅助（卡片 / 朋友圈分享路径构造）
  util.js                          日期格式化、pad、RGBA 转 hex、亮度文字色
  config.local.js                  本地密钥配置（已 gitignore，不进版本库）
  config.example.js                配置示例（供新开发者参考）
  iconColor.js                     天气图标 code → 颜色分类（JS 版）
  iconColor.wxs                    WXS：天气图标 code → 颜色分类（WXML 内使用）
  moonPhase.wxs                    WXS：月相 code → emoji / 名称
  fmt.wxs                          WXS：安全取值、UV 文本映射
  tempUnit.wxs                     WXS：温度单位换算（供 WXML 内直接使用）
skills/
  weather-skill/                   微信 AI Skill 包（独立可发布，不依赖主应用 utils）
    SKILL.md                       Skill 定义（name / description / 接口路由规则）
    index.js                       注册 12 个原子接口
    apis/                          12 个接口函数（各自独立，含 resolveLocation 位置解析）
    utils/time.js                  skills 包内部时间工具（toMin）
    config.local.js                Skill 专用密钥（已 gitignore）
    config.example.js              Skill 密钥示例
libs/
  qqmap-wx-jssdk.min.js            腾讯地图 SDK
  lunar.js                         农历计算库（6tail/lunar-javascript）
static/
  icons/                           生活指数 / 刷新 / 风向等 SVG 图标（19 个）
  qweather-icons.wxss              和风天气图标字体样式
  app.jpg                          项目预览图
```

## 关键约定

### 数据流（pages/index/index.js + behaviors）

1. `onLoad` → `this.init()`（来自 `locationBehavior`）：优先 AI Handoff 城市 → 默认城市 → GPS 定位。
2. `getLocation()` + `getNow()`（`locationBehavior`）：`wx.getLocation` 获取坐标，`reverseGeocoder` 解析城市名，`_resolveCityId` 通过 GeoAPI 补全 cityId。
3. `getWeather()`（`weatherFetchBehavior`）：`Promise.all` 并发 11 路请求（实时 / 生活指数 / 24h / 7d / 空气 / 日出日落 / 月相 / 预警 / 分钟级降水 / 历史昨日 / 太阳高度角），结果分发到对应组件。切换城市时先 `_abortPending()` 取消未完成请求。
4. 城市切换三种触发：① `city-search` 组件 `onSelectCity`；② 定位按钮 `onLocateTap`（`locationBehavior.init`）；③ 地图点击 `onMapTap`（轻量查询：实时天气 → cover-view tips → 点击展开全量查询）。
5. 温度单位通过 `prefs.js` 订阅机制下发，子页通过 `tempUnit` 属性接收。

### 组件职责

所有展示组件均为受控展示组件：父页通过 properties 单向传入数据，组件内不发起请求。仅 `temp` 通过 `triggerEvent('getnow')` 通知父级刷新，`city-search` 通过 `triggerEvent('selectcity')` 通知城市切换。

### 用户偏好（utils/prefs.js）

提供 `tempUnit`（℃/℉）、`themeColor`（6 种预设 + 自动模式）、`cardBgMode`（自动 / 固定）、`defaultCityId`、`cities`（收藏列表）。通过 `subscribe(fn)` 订阅变更，页面响应式更新。主题色通过 CSS 变量 `--theme` 注入页面根节点。

### 自动主题（utils/autoTheme.js）

`themeMode === 'auto'` 时：`resolveTheme(icon, sunrise, sunset)` 根据天气分类 + 当前时段（日出前 / 日间 / 黄昏 / 夜间）计算主题色；`resolveThemeBg` 计算卡片背景色。每次 `getWeather` 完成后和 10 分钟定时器触发时均重新计算。

### 天气动效（utils/weatherEffect.js）

`resolveWeatherEffect(icon)` 返回 `{ particle, decor }` 配置，分别驱动 `weather-particles`（全屏 Canvas 粒子）和 `weather-decor`（卡片 CSS 装饰）组件。

### 离线降级

`network.js` 追踪在线/离线状态。断网时 `cache.getStale()` 返回过期缓存，首页显示「离线模式」横幅。

### 骨架屏

首页加载时显示骨架屏替代 `wx.showLoading`。`loading` 状态控制 compact 卡片和 full-list 区域在骨架屏与真实内容间切换。shimmer 动画定义在 `index.wxss`（`@keyframes sk-shimmer`），timemachine 组件有独立的骨架屏实现。

### 错误恢复

首页和所有子页统一使用 `components/error-state` 组件展示错误状态 + 重试按钮。首页定位失败时自动弹出城市搜索面板（`selectorVisible`），引导用户手动选城。各子页 JS 实现 `onRetry()` 方法处理重试。

### 图标渲染

- 天气图标：使用和风天气字体类 `qi-{iconCode}-fill`（`static/qweather-icons.wxss`）。
- 生活类图标：通过 `components/icon` 读取本地 SVG，运行时替换 hex 颜色后以 base64 data URL 设为背景。

### 缓存策略（utils/cache.js）

所有 API 请求（GeoAPI 除外）均通过 `cache.js` 做 TTL 缓存，存储在 `wx.setStorage` 中。缓存 key 由 URL 路径 + 排序参数（排除 key）生成。GeoAPI 因版权限制不缓存。

### 全局配置（app.js）

`globalData.lbs` 保存腾讯位置 key 和 referer；`globalData.agentHandoffCity` 用于 AI Skill → 主应用城市接力；`globalData.campingSession` 用于露营页 → 首页选点回传。

## AI Skill（skills/weather-skill）

`skills/weather-skill/` 是微信 AI Skill 独立包，通过 `wx.modelContext` 注册。设计为**独立可发布**，不 require 主应用 `utils/`。提供 12 个原子接口，每个接口返回 `{ isError, content, structuredContent, handoff }` 格式，用于 AI 对话回答 + Skill 卡片渲染 + 接力跳转主应用。详见 `skills/weather-skill/SKILL.md`。

## 安全与密钥

密钥已抽离至 `utils/config.local.js`（已加入 `.gitignore`，不进版本库）：

- `utils/api.js` 通过 `require('./config.local')` 读取和风天气 KEY
- `app.js` 通过 `require('./utils/config.local')` 读取腾讯地图 KEY
- `skills/weather-skill/config.local.js` 单独存放 Skill 专用 KEY（已 gitignore）
- 新开发者参考 `utils/config.example.js` / `skills/weather-skill/config.example.js` 创建本地配置

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
