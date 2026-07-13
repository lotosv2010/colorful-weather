# 霁色天气 — 功能进度

> 最后更新：2026-07-13

## 已完成

### 首页（pages/index）
- [x] 微信定位 + 逆地理编码（腾讯地图 SDK）
- [x] 实时天气展示（温度、天气图标、风向风速、湿度、体感、能见度、气压）
- [x] 24 小时预报横向滚动
- [x] 7 天预报列表（温度条可视化）
- [x] 空气质量 AQI 环图（Canvas 2D）
- [x] 生活指数四宫格（运动 / 穿衣 / 洗车 / 紫外线）
- [x] 日出日落曲线 + 月相展示
- [x] 天气预警横幅
- [x] 分钟级降水入口
- [x] 台风路径入口
- [x] 城市搜索浮层（热门城市、搜索历史、防抖搜索）
- [x] 全屏地图底图（原生 map 组件，跟随定位）
- [x] 底部抽屉卡片（Apple Home Bar 风格，上拉展开 / 下拉折叠，独立组件 `components/bottom-sheet`）
- [x] 顶部搜索栏 + 定位按钮（随 sheet 进度淡入淡出）
- [x] 抽屉拖拽时禁用地图手势，避免事件冲突
- [x] 城市切换时 `abortPending()` 取消上一批未完成的 `wx.request`
- [x] 重新定位时 `cache.clear()` 清除旧位置缓存
- [x] 地图点击 tips：点击地图 → 轻量查询（位置 + 实时天气）→ cover-view tips 展示位置/温度/天气文字 → 点击 tips 展开抽屉全量查询，tips 背景色跟随主题

### 生活指数页（pages/life）
- [x] 16 种生活指数类型
- [x] Tab 切换 + 时间轴展示
- [x] 指数定义卡片 + 等级颜色映射
- [x] 加载 / 错误状态

### 空气质量页（pages/air）
- [x] 当前 AQI 环图 + 污染物网格
- [x] 逐小时预报柱状图
- [x] 逐日预报颜色编码卡片

### 天气预警页（pages/warning）
- [x] 预警详情展示（颜色标识、紧急程度 / 严重程度 / 确定性）
- [x] 时间格式化

### 30 天预报页（pages/weather30）
- [x] 列表 / 图表双视图切换
- [x] 温度趋势双折线图（Canvas 2D）
- [x] 空气质量合并展示
- [x] 统计摘要 + 温度变化描述

### 逐小时预报页（pages/hourly）
- [x] 温度折线图（Canvas 2D，可滚动）
- [x] 降水柱状 + 概率折线图（Canvas 2D）
- [x] 风速图表 + 风向箭头（Canvas 2D）
- [x] 三图表联动 + 点击选中详情面板

### 分钟级降水页（pages/minutely）
- [x] Canvas 2D 柱状图（雨 / 雪区分）

### 台风路径页（pages/typhoon）
- [x] 台风列表（活跃 / 非活跃标记）
- [x] 原生地图 + 历史轨迹实线 / 预测轨迹虚线
- [x] 缩放控件 + 预测表格

### 时光机卡片（components/timemachine）
- [x] tabs 切换：天气时光机 / 空气质量时光机
- [x] 最近 10 天日期横向选择（不含今天）
- [x] 天气视图：日最高/最低 + 日出日落 + 湿度 / 降水 / 气压 / 月相 + 24h 温度折线（Canvas 2D，渐变填充 + 最高低点标记）
- [x] 空气视图：日均 AQI 圆形指示（按等级取色）+ 峰值 / 主要污染物 + 24h AQI 柱状图（按等级配色）
- [x] 内置按日期 + tab 缓存，避免重复请求
- [x] 体验优化：固定内容区高度 + 骨架屏 + 切 tab 保留旧数据 + 右上角 spinner，解决 iOS 切 tab 滚动跳回与 Android 闪烁
- [x] hidden 切 tab 后失效 ctx + nextTick 重绘，修复 24h 温度图复显丢失
- [x] 异步竞态保护：tab/日期变化后丢弃过期请求结果

### 设置与多城市（pages/settings）
- [x] 用户偏好 store（`utils/prefs.js`）：温度单位 / 主题色 / 默认城市 / 收藏城市，订阅机制供页面响应
- [x] 设置页：℃/℉ 切换、主题色（5 种预设）、默认城市设置 / 清除 / 置顶 / 移除
- [x] city-search 收藏区：⭐ 切换收藏，收藏列表附实时天气
- [x] city-search 顶部「设置」入口
- [x] 启动加载默认城市（无默认时回落定位；手动点定位忽略默认）
- [x] 首页温度（紧凑卡 / weather-temp / hourly / daily）按 tempUnit 显示
- [x] 主题色通过 CSS 变量 `--theme` 注入页面根节点，作用于顶部定位按钮、设置页选中态

### 基础设施
- [x] 本地缓存层（utils/cache.js，TTL 基于 wx.setStorage，支持 stale 降级）
- [x] API 封装函数（utils/api.js：19 个函数，天气 / 空气 / 生活 / 天文 / 预警 / 分钟级 / 30 天 / 台风 / 潮汐 / 太阳辐射 / GeoAPI / 历史天气 / 历史空气）
- [x] 网络状态管理（utils/network.js，在线/离线追踪 + 订阅通知）
- [x] 用户偏好 store（utils/prefs.js，温度单位 / 主题色 / 默认城市 / 收藏城市）
- [x] 分享辅助（utils/share.js，卡片 / 朋友圈路径构造）
- [x] 温度单位换算（utils/temp.js + utils/tempUnit.wxs，JS/WXML 双版本）
- [x] WXS 工具模块（iconColor / moonPhase / fmt / tempUnit）
- [x] 生活指数元数据（utils/lifeMeta.js）
- [x] AQI 等级元数据（utils/airMeta.js）
- [x] 风向角度转方位工具（utils/wind.js）
- [x] 按需注入：`lazyCodeLoading: requiredComponents`
- [x] 直辖市 / 重名行政区去重（`_buildLocationLabel`）

### 已修复 Bug
- [x] 温度符号用字母 `o` 代替度数符号 `°`（components/temp、components/hourly）
- [x] components/temp `iconColor.wxs` 路径统一为绝对路径

---

## 未完成 / 待改进

### 安全与密钥（P0）
- [x] `utils/api.js` 和风天气 KEY 抽离至 `utils/config.local.js`（已 gitignore）
- [x] `app.js` 腾讯地图 KEY 抽离至 `utils/config.local.js`
- [x] `project.private.config.json` 加入 `.gitignore` 并 `git rm --cached`
- [x] 新增 `utils/config.example.js` 配置示例供新开发者参考
- [-] 进一步：迁移到云函数代理，避免密钥随 wxapkg 泄露（P1）

### 功能增强
- [x] 多城市管理：收藏 / 置顶 / 取消
- [x] 用户设置页：温度单位切换（℃/℉）、主题色选择、默认城市
- [x] 温度单位接入子页（hourly / weather30 chart）：通过 `utils/temp.js` + 组件 `tempUnit` 属性下发
- [x] 主题色作用范围扩展：bottom-sheet 把手、weather30/life 子页 tab 高亮
- [x] 主题色新增「夜幕灰」预设（与 home bar 同色）
- [x] 离线降级 UI：断网时回落 stale 缓存（`cache.getStale`）+ 顶部「离线模式」横幅
- [x] 分享菜单：开启 `onShareAppMessage` / `onShareTimeline`，覆盖首页 / hourly / weather30 / air / warning / minutely / typhoon / life
- [x] city-search 顶部「当前定位」行（样式与历史 / 收藏一致）
- [-] ~~订阅消息：降水提醒、预警推送（`wx.requestSubscribeMessage`）~~ —— 不做
- [x] 天气时光机：最近 10 天历史天气实况，集成在首页时光机卡片
- [x] 空气质量时光机：最近 10 天历史 AQI，集成在首页时光机卡片
- [x] 多城市横划切换：紧凑卡片左右滑动在定位城市与收藏城市间切换，圆点指示器显示当前位置，支持点击圆点直接跳转

### UI / 体验
- [x] 天气动效背景（雨滴 / 雪花 / 晴天光斑），替代静态地图
- [x] 主题色随天气 / 时段（白天 / 黄昏 / 夜晚）动态切换
- [x] 卡片背景随天气类型变化（晴天暖色、雨天冷色、大雾灰色等）
- [x] 紧凑卡片组件化（components/compact-weather）
- [x] 首屏骨架屏 / 占位，替代全屏 `wx.showLoading`
- [x] 错误恢复 UI：API 失败时提供重试按钮 / 错误状态视图（首页 + 7 个子页统一改造）
- [x] 定位权限拒绝兜底：定位失败时自动弹出城市搜索面板

### 重构 / 待决策
- [-] `solar` / `tide` 组件去留：组件代码保留，`pages/index/index.json` 中已注册但 `index.wxml` 无引用（commit b60a065 隐藏入口），决定恢复 / 删除
- [x] 抽 `utils/route.js`：统一页面跳转路径构造（`buildPath` / `navigateTo` / `buildQuery`）

### 付费 API 功能（代码保留，暂不对外展示）

以下功能依赖和风天气付费接口，代码完整保留，但入口暂时隐藏，不在演示 / 开源版本中对外展示：

| 功能 | 组件 / 页面 | 状态 |
|------|-------------|------|
| 太阳辐射（GHI）| `components/solar` | 已实现，首页无入口 |
| 潮汐高度图表 | `components/tide` | 已实现，首页无入口 |
| 台风路径 | `pages/typhoon` | 已实现，首页有入口，保持现状 |

### 工程化
- [x] 版本号管理 / 小程序更新提示（`wx.getUpdateManager`）
- [x] 性能监控 / 埋点（页面加载耗时、API 成功率、错误上报）
