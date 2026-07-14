# weatherSkill

霁色天气的核心天气查询 SKILL，对接和风天气 API，提供 5 个原子接口。

## 原子接口

| 名称 | 说明 |
|------|------|
| `getCurrentWeather` | 查询实时天气（温度、体感温度、天气状况、湿度、风向风力、能见度等） |
| `getWeatherForecast` | 查询未来 1-7 天逐日天气预报（最高/最低温、白天/夜间天气、降水概率、紫外线） |
| `getLifeAdvice` | 查询今日生活指数（穿衣、运动、紫外线、洗车、旅游、感冒、晾晒、舒适度等） |
| `getAirQuality` | 查询实时空气质量（AQI、PM2.5、PM10、O₃、CO 等污染物浓度及等级） |
| `getWeatherWarnings` | 查询当前有效的天气预警（预警类型、级别、发布机构、预警全文） |

## 位置解析规则

所有接口的 `location` 参数均可选：

- **不传**：通过 `wx.getLocation` 获取当前 GPS 坐标，再经 GeoAPI 反查城市名。
- **城市名**（如 `"北京"`、`"上海浦东"`）：经 GeoAPI 查询返回城市 ID 和坐标。
- **经纬度字符串**（格式 `"lon,lat"`，如 `"116.41,39.92"`）：直接使用，同时查城市名。

## 接力页面

`getWeatherForecast` 返回的卡片点击后可接力到首页（`pages/index/index`），展示该城市的完整天气。
