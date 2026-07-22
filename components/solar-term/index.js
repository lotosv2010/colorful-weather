// components/solar-term/index.js

// 节气 emoji 映射
const SOLAR_TERM_EMOJI = {
  '立春': '🌱', '雨水': '🌧️', '惊蛰': '⚡', '春分': '🌸', '清明': '🌿', '谷雨': '🌦️',
  '立夏': '☘️', '小满': '🌾', '芒种': '🌾', '夏至': '☀️', '小暑': '🌡️', '大暑': '🌡️',
  '立秋': '🍂', '处暑': '🌤️', '白露': '💧', '秋分': '🍁', '寒露': '🌬️', '霜降': '🍂',
  '立冬': '🍃', '小雪': '🌨️', '大雪': '❄️', '冬至': '⛄', '小寒': '🌨️', '大寒': '❄️',
};

// 传统节日 emoji 映射
const FESTIVAL_EMOJI = {
  '春节': '🧧', '元宵节': '🏮', '清明节': '🌿', '寒食节': '🌿',
  '端午节': '🐉', '七夕节': '💫', '七夕': '💫',
  '中秋节': '🌕', '重阳节': '🏔️', '腊八节': '🥣', '除夕': '🎆',
  '元旦节': '🎉', '国庆节': '🎇', '劳动节': '🎉', '儿童节': '🎈',
  '妇女节': '🌷', '青年节': '✊', '建党节': '⭐', '建军节': '⭐',
  '植树节': '🌲', '教师节': '📚',
};

Component({
  properties: {
    solarTermInfo: {
      type: Object,
      value: null,
    },
    themeColor: {
      type: String,
      value: '#1296db',
    },
  },

  computed: {},

  methods: {
    // 获取节气 emoji
    _termEmoji(name) {
      return SOLAR_TERM_EMOJI[name] || '🌿';
    },
    // 获取节日 emoji
    _festEmoji(name) {
      return FESTIVAL_EMOJI[name] || '🎊';
    },
  },

  observers: {
    'solarTermInfo': function(info) {
      if (!info) return;
      const todaySolarTerm = info.todaySolarTerm || '';
      const todayFestivals = info.todayFestivals || [];

      // 今日高亮（节气优先于节日）
      let todayHighlight = null;
      if (todaySolarTerm) {
        todayHighlight = {
          emoji: this._termEmoji(todaySolarTerm),
          name: todaySolarTerm,
          label: '今日节气',
          isSolarTerm: true,
        };
      } else if (todayFestivals.length) {
        todayHighlight = {
          emoji: this._festEmoji(todayFestivals[0]),
          name: todayFestivals[0],
          label: '今日节日',
          isSolarTerm: false,
        };
      }

      // 下一节气 emoji
      const nextSTEmoji = info.nextSolarTerm ? this._termEmoji(info.nextSolarTerm.name) : '';

      // 下一节日 emoji
      const nextFestEmoji = info.nextFestival ? this._festEmoji(info.nextFestival.name) : '';

      this.setData({ todayHighlight, nextSTEmoji, nextFestEmoji });
    },
  },

  data: {
    todayHighlight: null,
    nextSTEmoji: '',
    nextFestEmoji: '',
  },
});
