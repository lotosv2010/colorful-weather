// utils/lifeMeta.js
// 和风天气生活指数 - 定义与等级颜色
// 文档：https://dev.qweather.com/docs/resource/indices-info/

// type → 名称 + 说明
const definitions = {
  '1':  { name: '运动指数',          desc: '综合气温、湿度、风力、降水等条件，评估当日是否适合户外运动。' },
  '2':  { name: '洗车指数',          desc: '基于近 24 小时及未来天气，评估清洗车辆后能否保持洁净。' },
  '3':  { name: '穿衣指数',          desc: '依据气温、风力、湿度等因素，给出适合的穿着厚度建议。' },
  '4':  { name: '钓鱼指数',          desc: '综合气压、温度、风力等条件，评估当日垂钓的舒适度与鱼情。' },
  '5':  { name: '紫外线指数',        desc: '反映太阳紫外线辐射强度，数值越高对皮肤伤害越大，需注意防护。' },
  '6':  { name: '旅游指数',          desc: '综合气象条件评估当日旅游的舒适程度。' },
  '7':  { name: '花粉过敏指数',      desc: '基于气象条件评估花粉过敏的发生概率。' },
  '8':  { name: '舒适度指数',        desc: '综合温湿度等指标，反映人体的体感舒适程度。' },
  '9':  { name: '感冒指数',          desc: '基于温度变化与湿度，评估感冒发生的概率。' },
  '10': { name: '空气污染扩散条件',  desc: '反映大气污染物扩散与稀释的气象条件。' },
  '11': { name: '空调开启指数',      desc: '基于气温与湿度，建议空调使用方式。' },
  '12': { name: '太阳镜指数',        desc: '基于紫外线与光照强度，建议太阳镜佩戴必要性。' },
  '13': { name: '化妆指数',          desc: '基于温湿度与紫外线，给出化妆品类型建议。' },
  '14': { name: '晾晒指数',          desc: '基于天气与风力，评估当日衣物晾晒效果。' },
  '15': { name: '交通指数',          desc: '基于天气对道路通行的影响，评估出行交通条件。' },
  '16': { name: '防晒指数',          desc: '基于紫外线强度，给出防晒措施的强度建议。' }
};

// 5 档色阶（绿 → 黄绿 → 黄 → 橙 → 红 → 深红）
const C = {
  green:    '#4caf50',
  lime:     '#8bc34a',
  yellow:   '#ffb300',
  orange:   '#ff9800',
  red:      '#f44336',
  darkRed:  '#b71c1c',
  blue:     '#3f51b5',
  blueMid:  '#5c6bc0',
  blueLite: '#7986cb',
  gray:     '#607d8b'
};

// 每个 type 的 level（字符串 '1'~）→ 颜色
// 同时把 category 文本作为 fallback
const levelColorByType = {
  '1':  { '1': C.green,  '2': C.lime,   '3': C.orange },
  '2':  { '1': C.green,  '2': C.lime,   '3': C.orange,  '4': C.red },
  // 穿衣：冷蓝 → 适宜绿 → 热橙红
  '3':  { '1': C.blue,   '2': C.blueMid, '3': C.blueLite, '4': C.lime, '5': C.green, '6': C.orange, '7': C.red },
  '4':  { '1': C.green,  '2': C.lime,   '3': C.orange },
  '5':  { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red },
  '6':  { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red },
  '7':  { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red },
  '8':  { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red, '6': C.darkRed, '7': C.darkRed },
  '9':  { '1': C.green,  '2': C.yellow, '3': C.orange, '4': C.red },
  '10': { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red },
  '11': { '1': C.red,    '2': C.orange, '3': C.green,  '4': C.blue },
  '12': { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red },
  '13': { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red, '6': C.green, '7': C.lime, '8': C.lime },
  '14': { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red, '6': C.darkRed },
  '15': { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red },
  '16': { '1': C.green,  '2': C.lime,   '3': C.yellow, '4': C.orange, '5': C.red }
};

// category 文本兜底映射（与 type 无关）
const categoryColorFallback = {
  '适宜': C.green, '较适宜': C.lime, '一般': C.yellow, '较不宜': C.orange, '不宜': C.red, '不适宜': C.red,
  '极适宜': C.green, '基本适宜': C.lime, '不太适宜': C.orange,
  '优': C.green, '良': C.lime, '中': C.yellow, '较差': C.orange, '很差': C.red,
  '良好': C.green, '较好': C.lime,
  '寒冷': C.blue, '冷': C.blueMid, '较冷': C.blueLite, '较舒适': C.lime, '舒适': C.green, '热': C.orange, '炎热': C.red,
  '最弱': C.green, '弱': C.lime, '较弱': C.lime, '中等': C.yellow, '强': C.orange, '很强': C.red, '极强': C.darkRed,
  '少发': C.green, '较易发': C.yellow, '易发': C.orange, '极易发': C.red,
  '极不易发': C.green, '不易发': C.lime,
  '较不舒适': C.yellow, '很不舒适': C.orange, '极不舒适': C.red, '不舒适': C.red, '非常不舒适': C.darkRed,
  '长时间开启': C.red, '部分时间开启': C.orange, '较少开启': C.green, '开启制暖空调': C.blue,
  '不需要': C.green, '需要': C.yellow, '必要': C.orange, '很必要': C.red, '非常必要': C.darkRed,
  '保湿': C.green, '保湿防晒': C.lime, '去油防晒': C.yellow, '防脱水防晒': C.orange, '去油': C.lime, '防脱水': C.green, '防晒': C.lime, '滋润保湿': C.green
};

const getDefinition = (type) =>
  definitions[String(type)] || { name: '生活指数', desc: '' };

// 优先按 type+level 取色，未命中则按 category 文本兜底
const getColor = (type, level, category) => {
  const byLevel = levelColorByType[String(type)];
  if (byLevel && byLevel[String(level)]) return byLevel[String(level)];
  if (category && categoryColorFallback[category]) return categoryColorFallback[category];
  return C.gray;
};

module.exports = {
  definitions,
  getDefinition,
  getColor
};
