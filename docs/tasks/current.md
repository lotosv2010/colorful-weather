# 霁色天气 — 功能进度

> 最后更新：2026-06-19

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
- [x] 分享菜单（AppMessage + Timeline）
- [x] 全屏地图底图（原生 map 组件 + 天气标记点）
- [x] 底部抽屉卡片（Apple Home Bar 风格，上拉展开 / 下拉折叠）
- [x] 地图控件（缩放 + 定位，cover-view 实现）

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

### 基础设施
- [x] 本地缓存层（utils/cache.js，TTL 基于 wx.setStorage）
- [x] 18 个 API 封装函数（utils/api.js）
- [x] WXS 工具模块（iconColor / moonPhase / fmt）
- [x] 生活指数元数据（utils/lifeMeta.js）
- [x] AQI 等级元数据（utils/airMeta.js）
- [x] 风向角度转方位工具（utils/wind.js）

---

## 未完成 / 待改进

### Bug 修复
- [x] 温度符号用字母 `o` 代替度数符号 `°`（`components/temp/index.wxml` 第 15、57 行，`components/hourly/index.wxml` 第 10 行）
- [x] `components/temp/index.wxml` 第 2 行使用相对路径 `../../utils/iconColor.wxs`，应统一为绝对路径

### 功能增强
- [ ] 多城市管理：收藏 / 固定多个城市快速切换
- [ ] 用户设置页：温度单位切换（℃/℉）、主题色选择、默认城市
- [ ] 离线降级 UI：断网时展示缓存数据 + 明确提示
- [ ] 页面级分享定制：各页面自定义分享标题、图片、路径
- [ ] 天气时光机：查询历史某天的天气实况（温度、天气现象、风向风速等）
- [ ] 空气质量时光机：查询历史某天的空气质量（AQI、污染物浓度等）

### 工程化
- [ ] ESLint 配置实际可用的 rules（当前仅启用 parser）
- [ ] `project.private.config.json` 确认已加入 `.gitignore`
- [ ] 版本号管理 / 小程序更新提示机制
- [ ] 性能监控 / 埋点（页面加载耗时、API 成功率）
- [ ] 无障碍适配（aria 属性）
