// utils/airMeta.js
// 空气质量等级 - 描述、健康建议与颜色映射
// 文档：https://dev.qweather.com/docs/resource/air-info/

// AQI 等级 → { category, description, healthAdvice, color }
const AQI_LEVELS = {
  '1': {
    category: '优',
    description: '空气质量令人满意，基本无空气污染。',
    healthAdvice: '各类人群可正常活动，无需特殊防护。',
    color: '#4caf50'
  },
  '2': {
    category: '良',
    description: '空气质量尚可，某些污染物可能对少数人健康有轻微影响。',
    healthAdvice: '敏感人群应减少户外活动，一般人群可正常出行。',
    color: '#8bc34a'
  },
  '3': {
    category: '轻度污染',
    description: '敏感人群症状有轻度加剧，健康人群出现刺激症状。',
    healthAdvice: '敏感人群应避免长时间户外运动，一般人可适当减少户外活动。',
    color: '#ffb300'
  },
  '4': {
    category: '中度污染',
    description: '进一步加剧敏感人群症状，可能对心脏和呼吸系统有影响。',
    healthAdvice: '敏感人群应停止户外运动，一般人应减少户外活动。',
    color: '#ff9800'
  },
  '5': {
    category: '重度污染',
    description: '健康人群运动耐力下降，明显感到不适。',
    healthAdvice: '所有人应避免户外活动，关闭门窗，外出佩戴防护口罩。',
    color: '#f44336'
  },
  '6': {
    category: '严重污染',
    description: '健康人群出现严重症状，影响正常活动。',
    healthAdvice: '所有人应留在室内，避免一切户外活动。',
    color: '#b71c1c'
  }
};

// 污染物名称映射
const POLLUTANT_NAMES = {
  pm2p5: 'PM2.5',
  pm10: 'PM10',
  o3: 'O₃',
  co: 'CO',
  so2: 'SO₂',
  no2: 'NO₂'
};

// 污染物单位
const POLLUTANT_UNITS = {
  pm2p5: 'μg/m³',
  pm10: 'μg/m³',
  o3: 'μg/m³',
  co: 'mg/m³',
  so2: 'μg/m³',
  no2: 'μg/m³'
};

// AQI 数值 → 等级信息
const getAirLevel = (aqi) => {
  if (!aqi && aqi !== 0) return null;
  if (aqi <= 50)  return AQI_LEVELS['1'];
  if (aqi <= 100) return AQI_LEVELS['2'];
  if (aqi <= 150) return AQI_LEVELS['3'];
  if (aqi <= 200) return AQI_LEVELS['4'];
  if (aqi <= 300) return AQI_LEVELS['5'];
  return AQI_LEVELS['6'];
};

module.exports = {
  AQI_LEVELS,
  POLLUTANT_NAMES,
  POLLUTANT_UNITS,
  getAirLevel
};
