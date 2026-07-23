# 霁色天气 — 项目现状

> 最后更新：2026-07-23

---

## 整体状态

功能开发阶段基本完结，主体功能全部实现。当前阶段重心已转向**代码质量 / 架构优化**。

---

## 已完成功能

### 页面（14 个）

| 页面 | 说明 | 完成日期 |
|------|------|---------|
| `pages/index` | 首页：原生地图 + 底部抽屉，天气主视图，多城市横划 | — |
| `pages/hourly` | 逐小时预报：温度 / 降水 / 风力 / 湿度 / 云量五图联动 | — |
| `pages/weather30` | 30 天预报：列表 / 折线图 / 月历三视图 | — |
| `pages/minutely` | 分钟级降水：未来 2 小时 Canvas 柱状图 | — |
| `pages/air` | 空气质量：AQI 环图 + 污染物 + 逐小时/逐日趋势 | — |
| `pages/life` | 生活指数：16 种指数 + 时间轴 + 定义卡片 | — |
| `pages/warning` | 天气预警：颜色分级 + 城市收藏快捷按钮 | 2026-07-22 |
| `pages/typhoon` | 台风路径：原生地图 + 历史/预测轨迹 + 预测表格 | — |
| `pages/astronomy` | 天文详情：日出日落弧线 + 太阳高度角 + 月相全天 | 2026-07-22 |
| `pages/compare` | 城市对比：2 城市实时 + 7 天趋势 + 空气质量 | 2026-07-21 |
| `pages/trip` | 出行规划：目标城市 + 日期 → 天气综合评分 + 建议 | 2026-07-21 |
| `pages/share` | 分享卡片：Canvas 精美天气卡 + 保存/朋友圈 | 2026-07-22 |
| `pages/camping` | 露营探索：地图 POI 搜索 + 营地列表 + 当地天气 | 2026-07-22 |
| `pages/settings` | 设置：温度单位 / 主题色 / 默认城市 / 收藏城市 | — |

### 组件与特性

- **天气月历**（`components/weather-calendar`）：按月展示每日天气 + 月相，历史 + 当月 + 未来 30 天，嵌入 weather30 页 ✅ 2026-07-21
- **节气 / 节日卡片**（`components/solar-term`）：二十四节气与传统节日高亮，首页 bottom-sheet ✅ 2026-07-22
- **天气粒子动效**（`components/weather-particles`）：雨/雪/雷暴等全屏 Canvas 粒子 ✅
- **卡片天气装饰**（`components/weather-decor`）：纯 CSS 动画，跟随天气类型 ✅
- **多城市横划**（`cityPagesBehavior`）：收藏城市 + GPS 城市横划切换，城市概览面板 ✅
- **自动主题色**（`utils/autoTheme.js`）：按天气分类 + 时段（日出前/日间/黄昏/夜间）自动切换 ✅
- **地图 POI 天气增强**（`mapTipsBehavior`）：点击地图显示当地实时天气 tips ✅ 2026-07-22
- **30 天降水热力格视图**（`pages/weather30`）：每格颜色 = 降水量高低 ✅ 2026-07-22
- **AI 天气助手**（`skills/weather-skill`）：微信 AI Skill，12 个原子接口，支持自然语言查询 + Handoff 跳转 ✅
- **离线降级**：断网时展示过期缓存 + 离线横幅 ✅
- **骨架屏**：首页 / timemachine 组件骨架屏，shimmer 动画 ✅
- **性能监控**（`utils/monitor.js`）：页面加载耗时、错误上报 ✅

---

## 架构优化（2026-07-23 本轮完成）

### 代码重构

| 改动 | 效果 |
|------|------|
| `chartCanvasBehavior` 扩展：吸收 `initSize / onTap / onScroll` + properties + observers | 5 个 hourly 图表组件合计 -335 行（-29%）|
| 首页拆分 `locationBehavior` + `weatherFetchBehavior` | `pages/index/index.js` 629 → 387 行（-38%）|
| `components/astronomy` 复用 `utils/astronomyCanvas.js` | 502 → 169 行（-66%）|

### 重复消除

| 问题 | 解法 |
|------|------|
| `toMin()` 在 `astronomyCanvas.js` 与 `skills/astronomy-card` 重复 | 创建 `skills/weather-skill/utils/time.js`，对齐 null 语义 |
| `MOON_PHASE_ICON` 月相名称→图标码内联于 `weather-calendar` | 提取至 `utils/moonPhaseMeta.js`，统一 JS 侧出口 |
| `skills/weatherSkill` 命名不合规 | 重命名为 `skills/weather-skill`（kebab-case），同步 `app.json` / `AGENTS.md` |

### SKILL 优化

- 补全缺失的 `getStationAirQuality` / `getSolarElevationAngle` 接口说明
- 添加 YAML frontmatter（`name` / `description`），启用触发机制
- 补充多意图并发调用、监测站使用限制、`getSolarElevationAngle` 参数说明

---

## 明确不实现的功能

| 功能 | 原因 |
|------|------|
| 深色模式 | 微信小程序原生框架暗色模式接口支持有限 |
| 桌面小组件（Widget）| API 成熟度不足，需额外审核 |
| 历史同期参考线 | 历史天气接口粒度/覆盖不足，意义有限 |
| 每日天气播报推送 | 微信订阅消息需每次重新授权，用户体验成本过高 |
| `solar` / `tide` 组件入口 | 后端付费接口未开放，组件保留但入口隐藏 |

---

## 已知潜在问题

- **密钥泄露风险**：API Key 随 wxapkg 打包可被逆向提取；建议后续迁移至云函数代理
- **moonPhase.wxs 与 moonPhaseMeta.js 并存**：WXS 运行时限制，无法 require JS，两者需独立维护（已在文件中注释说明）
- **skills 包与主应用 API 双轨**：`skills/weather-skill/apis/_request.js` 与 `utils/api.js` 是两套独立体系，设计上合理隔离（Skill 独立可发布），硬编码了同一个 API Host
