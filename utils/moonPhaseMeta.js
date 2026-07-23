// utils/moonPhaseMeta.js
// 月相元数据（JS 侧统一出口）。
//
// moonPhase.wxs 提供相同的 code→emoji/name 映射供 WXML 直接使用；
// 受 WXS 运行时限制，两者无法共享同一个文件——moonPhase.wxs 需保持独立。

// 月相名称 → 和风天气图标码（800~807，对齐 moonPhase.wxs 的体系）
// 接口有时返回"峨眉月"，有时返回"蛾眉月"（同音异字），均兼容
const MOON_PHASE_NAME_TO_CODE = {
  '新月':   '800',
  '蛾眉月': '801', '峨眉月': '801',
  '上弦月': '802',
  '盈凸月': '803',
  '满月':   '804',
  '亏凸月': '805',
  '下弦月': '806',
  '残月':   '807',
};

module.exports = { MOON_PHASE_NAME_TO_CODE };
