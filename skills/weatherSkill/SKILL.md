# weatherSkill

霁色天气的核心天气查询 SKILL，对接和风天气 API，提供 8 个原子接口。

## 能力边界（最高优先级）

本 SKILL 只能完成天气相关查询：实时天气、逐日/逐小时预报、分钟级降水、生活指数、空气质量、气象预警、日出日落/月相。

**当用户意图超出上述范围时，直接用一句话告知用户「霁色天气只支持天气相关查询」，禁止强行套用任何接口。**

## 原子接口与意图分流

| 接口 | 典型问法 |
|------|---------|
| `getCurrentWeather` | 「现在几度」「今天天气怎样」「外面热吗」 |
| `getWeatherForecast` | 「明天天气」「这周会下雨吗」「后天最高温」 |
| `getHourlyForecast` | 「今天下午几点下雨」「明天早上多冷」「今晚降温吗」 |
| `getMinutelyRain` | 「接下来还下雨吗」「要带伞吗」「几点停雨」 |
| `getLifeAdvice` | 「今天穿什么」「适合运动吗」「要防晒吗」「能洗车吗」 |
| `getAirQuality` | 「空气质量怎样」「PM2.5 多少」「有雾霾吗」 |
| `getWeatherWarnings` | 「有暴雨预警吗」「台风预警」「现在有什么气象灾害」 |
| `getAstronomy` | 「今天几点日落」「今晚月相」「明天日出时间」 |

## 接口选择约束

### 时间维度

- 实时当下 → `getCurrentWeather`
- 未来 2 小时内分钟级 → `getMinutelyRain`（最精准）
- 今天某时段 / 未来几天按小时 → `getHourlyForecast`
- 未来几天整体 → `getWeatherForecast`

### 内容维度

- 纯天气数值（温度/降雨/风力）→ `getCurrentWeather` / `getWeatherForecast` / `getHourlyForecast`
- 生活决策（穿衣/运动/洗车）→ `getLifeAdvice`
- 污染物 / AQI → `getAirQuality`
- 灾害预警 → `getWeatherWarnings`
- 日出日落 / 月相 → `getAstronomy`

## location 参数通用规则

所有接口的 `location` 均为选填：
- **不传**：自动 `wx.getLocation()` 取当前 GPS，反查城市名
- **城市名**（如 `"成都"`）：GeoAPI 解析为坐标
- **经纬度字符串**（`"lon,lat"` 格式）：直接使用

**取值必须来自用户原话；用户未说明城市时留空；禁止编造地名。**
