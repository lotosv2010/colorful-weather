// components/weather-decor/index.js
// 卡片右上方天气装饰层（纯 CSS 动画）
Component({
  properties: {
    // 动效类型字符串，如 'drops'、'sun-spots'、'snowflakes' 等
    weatherEffect: {
      type: String,
      value: '',
    },
    // compact | full
    mode: {
      type: String,
      value: 'compact',
    },
  },
});
