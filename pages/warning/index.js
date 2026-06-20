// pages/warning/index.js
const { warning } = require('../../utils/api');
const share = require('../../utils/share');
const monitor = require('../../utils/monitor');

// RGBA 对象 → CSS 颜色值
const toRgba = (c = {}) => `rgba(${c.red || 0},${c.green || 0},${c.blue || 0},${c.alpha != null ? c.alpha : 1})`;

// 根据背景色亮度计算文字颜色
const getTextColor = (r, g, b) => {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#333' : '#fff';
};

// 格式化时间：ISO → YYYY-MM-DD HH:mm
const fmtTime = (t) => {
  if (!t) return '';
  const match = t.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}` : t;
};

// 紧迫程度中文映射
const URGENCY_MAP = {
  immediate: '立即行动',
  expected: '尽快行动',
  future: '近期行动',
  past: '已过期',
  unknown: '未知'
};

// 严重程度中文映射
const SEVERITY_MAP = {
  unknown: '未知',
  minor: '轻微',
  moderate: '中等',
  severe: '严重',
  extreme: '极端'
};

// 确定性中文映射
const CERTAINTY_MAP = {
  observed: '已发生',
  likely: '较可能',
  possible: '可能',
  unlikely: '不太可能',
  unknown: '未知'
};

// 信息类型中文映射
const MSG_TYPE_MAP = {
  alert: '新发布',
  update: '更新',
  cancel: '取消'
};

Page({
  data: {
    location: '',
    province: '',
    city: '',
    district: '',
    alerts: [],
    attributions: '',
    loading: false,
    errorMsg: ''
  },

  onLoad(options = {}) {
    this._loadStart = Date.now();
    const location = options.location || '';
    const province = options.province ? decodeURIComponent(options.province) : '';
    const city = options.city ? decodeURIComponent(options.city) : '';
    const district = options.district ? decodeURIComponent(options.district) : '';
    this.setData({ location, province, city, district });
    if (location) {
      this.loadData();
    } else {
      this.setData({ errorMsg: '缺少城市定位' });
    }
  },

  onReady() {
    monitor.recordPageLoad('/pages/warning/index', this._loadStart);
  },

  async loadData() {
    this.setData({ loading: true, errorMsg: '' });
    try {
      const { location } = this.data;
      const res = await warning(location);

      if (!res || res.metadata?.zeroResult || !res.alerts || !res.alerts.length) {
        this.setData({ errorMsg: '当前地区暂无预警信息', loading: false });
        return;
      }

      const alerts = res.alerts.map(a => {
        const c = a.color || {};
        const bgColor = toRgba(c);
        const textColor = getTextColor(c.red || 0, c.green || 0, c.blue || 0);
        const code = a.messageType?.code;
        return {
          ...a,
          bgColor,
          textColor,
          colorHex: c.code || '',
          senderDisplay: a.senderName || '',
          urgencyDisplay: URGENCY_MAP[a.urgency] || a.urgency || '',
          severityDisplay: SEVERITY_MAP[a.severity] || a.severity || '',
          certaintyDisplay: CERTAINTY_MAP[a.certainty] || a.certainty || '',
          typeLabel: MSG_TYPE_MAP[code] || code || '',
          effectiveTimeFmt: fmtTime(a.effectiveTime),
          onsetTimeFmt: fmtTime(a.onsetTime),
          expireTimeFmt: fmtTime(a.expireTime),
          issuedTimeFmt: fmtTime(a.issuedTime)
        };
      });

      const attributions = res.metadata?.attributions || '';

      this.setData({ alerts, attributions });
    } catch (e) {
      console.log(e);
      monitor.recordError('page', e?.message || '预警数据加载失败', { page: '/pages/warning/index', stack: e?.stack });
      this.setData({ errorMsg: '网络异常，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 重试：清除错误并重新加载
  onRetry() {
    this.setData({ loading: true, errorMsg: '' });
    this.loadData();
  },

  _shareParams() {
    const { location, province, city, district } = this.data;
    return { location, province, city, district };
  },
  onShareAppMessage() {
    const { district, city, alerts } = this.data;
    const headline = alerts && alerts.length ? alerts[0].headline : '天气预警';
    return share.card('/pages/warning/index', this._shareParams(), `${district || city || ''} ${headline}`);
  },
  onShareTimeline() {
    const { district, city, alerts } = this.data;
    const headline = alerts && alerts.length ? alerts[0].headline : '天气预警';
    return share.timeline('/pages/warning/index', this._shareParams(), `${district || city || ''} ${headline}`);
  }
});
