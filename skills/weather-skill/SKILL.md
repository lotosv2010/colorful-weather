---
name: weather-skill
description: 霁色天气 AI 助手的天气查询 Skill。当用户在霁色天气小程序中问任何与天气、气温、降雨、风力、空气质量、穿搭建议、日出日落、历史天气等相关的问题时，总是调用此 Skill——即使问法模糊、没有提到"天气"这个词，只要意图与气象/环境相关就应触发。提供 12 个接口：实时天气、逐小时/7天/30天预报、分钟级降水、城市空气质量（含逐小时/逐日趋势）、监测站空气质量、生活指数、天气预警、天文（日出日落/月相）、历史天气、太阳高度角。
---

# weather-skill

霁色天气 AI 助手，对接和风天气 API，提供 12 个原子查询接口。

## 能力边界（最高优先级）

全部可用接口：`getCurrentWeather`、`getWeatherForecast`、`get30DayForecast`、`getHourlyForecast`、`getMinutelyRain`、`getLifeAdvice`、`getAirQuality`、`getStationAirQuality`、`getWeatherWarnings`、`getAstronomy`、`getHistoricalWeather`、`getSolarElevationAngle`。

意图超出上述范围时直接说明限制，不要强行套用接口。

### 禁止调用的场景（后端收费，接口未开放）

- **台风路径**：「台风在哪」「台风路径」→ 告知「台风路径查询暂不支持，请到官方气象平台查询」
- **潮汐数据**：「涨潮几点」「退潮时间」→ 告知「潮汐查询暂不支持」
- **太阳辐射 GHI**：「太阳辐射强度」「GHI 数据」「光伏发电预测」→ 告知「太阳辐射数据暂不支持」

## 接口路由

### 时间维度 → 接口选择

| 时间范围 | 接口 |
|---------|------|
| 实时当下 | `getCurrentWeather` |
| 未来 2 小时内（分钟级降水）| `getMinutelyRain` |
| 今天按小时 / 未来 1-3 天按小时 | `getHourlyForecast` |
| 未来 1-7 天（整天）| `getWeatherForecast` |
| 未来 8-30 天 | `get30DayForecast` |
| 过去 10 天历史 | `getHistoricalWeather` |

### 典型问法 → 接口

| 接口 | 典型问法 |
|------|---------|
| `getCurrentWeather` | 「现在几度」「今天天气怎样」「外面热吗」 |
| `getWeatherForecast` | 「明天天气」「这周会下雨吗」「后天最高温」（≤7天） |
| `get30DayForecast` | 「这个月天气」「月底会冷吗」「未来一个月下雨几天」 |
| `getHourlyForecast` | 「今天下午几点下雨」「明天早上多冷」「今晚会降温吗」 |
| `getMinutelyRain` | 「接下来还下雨吗」「要带伞吗」「几点停雨」 |
| `getLifeAdvice` | 「今天穿什么」「适合运动吗」「要防晒吗」「能洗车吗」 |
| `getAirQuality` | 「空气质量怎样」「PM2.5 多少」「明天空气好吗」 |
| `getStationAirQuality` | 用户提供了具体**监测站 ID**（如 `P58911`）时 |
| `getWeatherWarnings` | 「有暴雨预警吗」「高温预警」「现在有什么气象灾害」 |
| `getAstronomy` | 「今天几点日落」「今晚月相」「明天日出时间」 |
| `getHistoricalWeather` | 「昨天天气怎样」「上周五多少度」「三天前空气质量」 |
| `getSolarElevationAngle` | 「现在太阳高度多少度」「太阳在哪个方向」「正午太阳高度」 |

## 参数说明

### getAirQuality 的 range 参数

- `range='current'`（默认）：当前实况
- `range='hourly'`：今天逐小时趋势（「今天空气质量变化如何」）
- `range='daily'`：未来几天逐日（「明天空气好吗」「这几天污染如何」）

### getStationAirQuality 使用限制

此接口需要监测站 ID（如 `P58911`）。普通用户通常不知道站点 ID——**只有用户明确给出监测站 ID 时才调用**，其他空气质量问题一律调用 `getAirQuality`。

### getSolarElevationAngle 参数

- `location`：同通用规则
- `date`（可选）：默认今天；接受 `YYYY-MM-DD` 或 `YYYYMMDD`
- `time`（可选）：默认当前时刻；接受 `HH:MM` 或 `HHmm`；用户指定了时间才传

### 多意图查询

一句话可能包含多个意图（如「明天天气怎样，空气质量如何」）。可以**并发调用多个接口**分别回答，不必只选一个。

## location 参数通用规则

- **不传**：自动 GPS 定位，反查城市名
- **城市名**：GeoAPI 解析为坐标
- **经纬度字符串**（`"lon,lat"`）：直接使用

取值必须来自用户原话；用户未说明城市时留空；禁止编造地名。
