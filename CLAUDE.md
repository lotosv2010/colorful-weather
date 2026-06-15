# CLAUDE.md

本文件为 Claude Code 在本仓库工作时提供项目上下文。

## 项目概述

Colorful 天气：基于微信小程序原生框架开发的天气查询应用。通过微信定位获取当前位置，调用和风天气 API 展示实时天气、24 小时预报、7 天预报、空气质量与生活指数。

- AppID：`wx2d54933761654ca9`（见 `project.config.json`）
- 小程序基础库：`2.19.4`
- 入口页：`pages/index/index`

## 技术栈

- 微信小程序原生框架（WXML / WXSS / JS / JSON）
- 和风天气 API（`https://devapi.qweather.com/v7`）：实时、逐小时、逐日、空气质量、生活指数
- 腾讯位置服务 SDK（`libs/qqmap-wx-jssdk.min.js`）：逆地理编码（坐标转城市）
- 城市选择器插件（`citySelector`，provider `wx63ffb7b7894e99ae`）
- WeUI 样式（`weui.wxss`）+ 和风天气图标字体（`static/qweather-icons.wxss`）

## 目录结构

```
app.js / app.json / app.wxss   小程序入口与全局配置
pages/
  index/                       首页：天气主视图
  life/                        生活指数详情页（占位，未实现）
components/
  temp/                        当前温度 + 头部信息
  hourly/                      24 小时预报横向滚动
  daily/                       7 天预报列表
  air/                         空气质量（AQI、PM2.5、PM10、O3、CO、SO2、NO2）
  life/                        生活指数四宫格（运动 / 穿衣 / 洗车 / 紫外线）
  icon/                        SVG 图标渲染（支持动态换色）
utils/
  api.js                       和风天气接口封装（now / 7d / 24h / indices / air）
  util.js                      日期格式化工具
libs/
  qqmap-wx-jssdk.min.js        腾讯地图 SDK
static/
  icons/                       生活指数 / 刷新 / 风向等 SVG 图标
  qweather-icons.wxss          和风天气图标字体样式
  app.jpg                      项目预览图
```

## 关键约定

### 数据流（pages/index/index.js）

1. `onLoad` → `init()`：实例化腾讯地图 SDK，调用 `getLocation()` 取经纬度。
2. `getNow()`：通过 `qqmapsdk.reverseGeocoder` 解析当前城市名，再触发 `getWeather()`。
3. `getWeather()`：使用 `Promise.all` 并发请求 5 个接口（实时 / 生活指数 / 24h / 7d / 空气），将结果分发到对应组件。
4. 城市切换通过插件 `selector-component` 触发 `onSelectCity`，更新经纬度后再次拉取。

### 组件职责

所有展示组件均为受控展示组件：父页通过 properties 单向传入数据，组件内不发起请求。仅 `temp` 通过 `triggerEvent('getnow')` 通知父级刷新。

### 图标渲染

- 天气图标：使用和风天气字体类 `qi-{iconCode}-fill`（在 `static/qweather-icons.wxss` 中定义）。
- 生活类图标：通过 `components/icon` 读取本地 SVG，运行时替换 hex 颜色后以 base64 data URL 设为背景。

### 全局配置（app.js）

`globalData.lbs` 中保存腾讯位置 key、referer 与热门城市列表，传给 `selector-component` 使用。

## 安全与密钥

⚠️ 当前仓库中以下密钥**以明文形式硬编码**，建议处理：

- `utils/api.js`：和风天气 KEY
- `app.js` 与 `pages/index/index.js`：腾讯地图 KEY（且在两处重复）

如需重构，应抽离至独立的非追踪配置文件，或通过云函数代理调用。

## 已知待办与潜在问题

- `pages/life/index` 仅为占位（默认模板），路由可达但无内容。
- `daily/index.wxml` 第 10 行：`<tex>` 应为 `<text>` 拼写错误。
- 温度 / 角度的 `o` 字符是用普通文本模拟的「°」，未使用真正的度数符号。
- `components/temp/index.wxml` 同时使用了相对路径 `../../static/icons/...` 与绝对路径 `/static/...`，建议统一。
- `pages/index/index.js` 直接 `require` `qqmap-wx-jssdk.min` 并硬编码 key，应改为从 `app.globalData.lbs` 注入。

## 开发命令

本项目无 npm 脚本，使用微信开发者工具直接打开仓库根目录即可预览 / 上传。

- 开发者工具中导入项目：选择项目根目录 `D:\github\colorful-weather`，AppID 已在 `project.config.json` 中。
- 真机预览需要在和风天气、腾讯地图、微信小程序后台同时配置合法域名 `devapi.qweather.com` 与 `apis.map.qq.com`。

## 编码风格

- 缩进：2 空格（`project.config.json` 中 `editorSetting` 已锁定）。
- ESLint：仅启用解析层，未声明 rules（`.eslintrc.js`）。
- 组件结构遵循微信原生四件套 `index.{js,json,wxml,wxss}`。
- 注释语言：中文（与现有代码保持一致）。

## 不要做的事

- 不要主动执行 `git commit` / `git push` / `git branch` 等操作，除非用户明确要求。
- 不要将 `project.private.config.json` 提交到远端，它含有本地开发者工具个人配置。
- 不要硬编码新增 key 到源码中，应通过配置 / 云函数注入。
