# weatherSkill

霁色天气的核心天气查询 SKILL，对接和风天气 API，提供 11 个原子接口。

## 能力边界（最高优先级）

本 SKILL 只能完成天气相关查询。以下接口是**全部能力**：`getCurrentWeather`、`getWeatherForecast`、`get30DayForecast`、`getHourlyForecast`、`getMinutelyRain`、`getLifeAdvice`、`getAirQuality`、`getWeatherWarnings`、`getAstronomy`、`getHistoricalWeather`。

**当用户意图超出上述范围时，直接告知用户「霁色天气只支持天气相关查询」，禁止强行套用任何接口。**

### 明确禁止调用的场景（以下功能后端收费，接口未开放）

- **台风路径**：用户问「台风在哪」「台风路径」「几号台风动态」→ 直接告知「台风路径查询暂不支持，请到官方气象平台查询」，**禁止调用任何接口**。
- **潮汐数据**：用户问「涨潮几点」「退潮时间」「潮汐预报」→ 直接告知「潮汐查询暂不支持」，**禁止调用任何接口**。
- **太阳辐射（GHI）**：用户问「太阳辐射强度」「GHI 数据」「光伏发电预测」→ 直接告知「太阳辐射数据暂不支持」，**禁止调用任何接口**。

## 原子接口与意图分流

| 接口 | 典型问法 |
|------|---------|
| `getCurrentWeather` | 「现在几度」「今天天气怎样」「外面热吗」 |
| `getWeatherForecast` | 「明天天气」「这周会下雨吗」「后天最高温」（≤7天） |
| `get30DayForecast` | 「这个月天气」「月底会冷吗」「未来一个月下雨几天」 |
| `getHourlyForecast` | 「今天下午几点下雨」「明天早上多冷」「今晚降温吗」 |
| `getMinutelyRain` | 「接下来还下雨吗」「要带伞吗」「几点停雨」 |
| `getLifeAdvice` | 「今天穿什么」「适合运动吗」「要防晒吗」「能洗车吗」 |
| `getAirQuality` | 「空气质量怎样」「PM2.5 多少」「明天空气好吗」 |
| `getWeatherWarnings` | 「有暴雨预警吗」「高温预警」「现在有什么气象灾害」 |
| `getAstronomy` | 「今天几点日落」「今晚月相」「明天日出时间」 |
| `getHistoricalWeather` | 「昨天天气怎样」「上周五多少度」「三天前空气质量」 |

## 接口选择约束

### 时间维度

- 实时当下 → `getCurrentWeather`
- 未来 2 小时内分钟级 → `getMinutelyRain`
- 今天某时段 / 未来几天按小时 → `getHourlyForecast`
- 未来 1-7 天整体 → `getWeatherForecast`
- 未来 8-30 天 → `get30DayForecast`
- 最近 10 天历史 → `getHistoricalWeather`

### getAirQuality 的 range 参数

- `range='current'`（默认）：当前实况
- `range='hourly'`：今天逐小时趋势（「今天空气质量变化」）
- `range='daily'`：未来几天逐日（「明天空气质量好吗」「这几天污染」）

## location 参数通用规则

- **不传**：自动 GPS 定位，反查城市名
- **城市名**：GeoAPI 解析为坐标
- **经纬度字符串**（`"lon,lat"`）：直接使用

**取值必须来自用户原话；用户未说明城市时留空；禁止编造地名。**
