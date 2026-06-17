const { stormList, stormTrack, stormForecast } = require('../../utils/api');

// 台风等级配色（GBT 19201-2006）
const TYPE_COLORS = {
  TD: '#4CAF50',
  TS: '#FFC107',
  STS: '#FF9800',
  TY: '#F44336',
  STY: '#B71C1C',
  SuperTY: '#9C27B0'
};
const TYPE_NAMES = {
  TD: '热带气压',
  TS: '热带风暴',
  STS: '强热带风暴',
  TY: '台风',
  STY: '强台风',
  SuperTY: '超强台风'
};
const ICON_SIZE = 16;

Page({
  data: {
    loading: true,
    errorMsg: '',
    stormList: [],
    selectedStorm: null,
    track: [],
    forecast: [],
    isActive: false,
    mapCenter: { lat: 20, lon: 130 },
    mapZoom: 3,
    mapPolylines: [],
    mapMarkers: []
  },

  onLoad() {
    this._iconCache = {};
    this.fetchStormList();
  },

  async fetchStormList() {
    try {
      const year = new Date().getFullYear();
      const res = await stormList({ basin: 'NP', year });
      if (!res || res.code !== '200' || !res.storm) {
        this.setData({ loading: false, errorMsg: '暂无台风数据' });
        return;
      }
      // 活跃台风排前面，同组保持原序（后续按时间精确排序）
      const list = res.storm.sort((a, b) => Number(b.isActive) - Number(a.isActive));
      this.setData({ stormList: list, loading: false });

      // 默认选中列表第一个台风
      if (list.length) {
        this.onSelectStorm({ currentTarget: { dataset: { id: list[0].id } } });
      }

      // 并行拉取所有台风 track，按最早发生时间降序重排
      this._sortByTime(list);
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, errorMsg: '数据加载失败' });
    }
  },

  /** 并行获取 track，按最早出现时间降序重排列表 */
  async _sortByTime(list) {
    try {
      const results = await Promise.all(
        list.map(s => stormTrack({ stormid: s.id }).catch(() => null))
      );
      const timeMap = {};
      results.forEach((res, i) => {
        if (res?.track?.length) {
          const firstTime = new Date(res.track[0].time || 0).getTime();
          timeMap[list[i].id] = firstTime;
        }
      });
      const sorted = [...list].sort((a, b) => {
        if (a.isActive !== b.isActive) return Number(b.isActive) - Number(a.isActive);
        return (timeMap[b.id] || 0) - (timeMap[a.id] || 0);
      });
      this.setData({ stormList: sorted });
      // 重排后默认选中最新台风
      this.onSelectStorm({ currentTarget: { dataset: { id: sorted[0].id } } });
    } catch (e) {
      console.error('按时间排序失败', e);
    }
  },

  async onSelectStorm(e) {
    const stormId = e.currentTarget.dataset.id;
    if (!stormId) return;
    const storm = this.data.stormList.find(s => s.id === stormId);
    if (!storm) return;

    this.setData({ selectedStorm: storm, track: [], forecast: [] });

    try {
      const [trackRes, forecastRes] = await Promise.all([
        stormTrack({ stormid: stormId }).catch(() => null),
        stormForecast({ stormid: stormId }).catch(() => null)
      ]);

      const track = (trackRes?.track || []).map(t => ({
        ...t,
        lat: Number(t.lat),
        lon: Number(t.lon),
        windSpeed: Number(t.windSpeed),
        pressure: Number(t.pressure),
        color: TYPE_COLORS[t.type] || '#8C9AA5',
        typeName: TYPE_NAMES[t.type] || t.type,
        timeLabel: t.time ? t.time.substr(5, 11).replace('T', ' ') : ''
      }));

      const forecast = (forecastRes?.forecast || []).map(f => ({
        ...f,
        lat: Number(f.lat),
        lon: Number(f.lon),
        windSpeed: Number(f.windSpeed),
        pressure: Number(f.pressure),
        color: TYPE_COLORS[f.type] || '#8C9AA5',
        typeName: TYPE_NAMES[f.type] || f.type,
        timeLabel: f.fxTime ? f.fxTime.substr(5, 11).replace('T', ' ') : ''
      }));

      const isActive = trackRes?.isActive === '1';
      this.setData({ track, forecast, isActive });
      this.renderTrackMap();
    } catch (e) {
      console.error(e);
    }
  },

  /** 计算地图中心与缩放级别（查表法，避免公式偏差） */
  _calcMapBounds(points) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    points.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    });
    const center = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
    if (points.length <= 1) return { center, zoom: 5 };
    const span = Math.max(maxLat - minLat, maxLon - minLon);
    let zoom;
    if (span > 30) zoom = 3;
    else if (span > 15) zoom = 3;
    else if (span > 8) zoom = 4;
    else if (span > 4) zoom = 4;
    else if (span > 2) zoom = 5;
    else zoom = 5;
    return { center, zoom };
  },

  /** 渲染台风路径到地图 */
  renderTrackMap() {
    const { track, forecast } = this.data;
    if (!track.length) return;

    const allPoints = [...track, ...forecast];
    const { center, zoom } = this._calcMapBounds(allPoints);

    const last = track[track.length - 1];
    const polylines = [
      {
        points: track.map(p => ({ latitude: p.lat, longitude: p.lon })),
        color: last.color,
        width: 3
      }
    ];
    if (forecast.length) {
      polylines.push({
        points: [last, ...forecast].map(p => ({ latitude: p.lat, longitude: p.lon })),
        color: '#8C9AA5',
        width: 2,
        dottedLine: true
      });
    }

    const markers = track.map((p, i) => ({
      id: i,
      latitude: p.lat,
      longitude: p.lon,
      iconPath: this._getMarkerIcon(p.color),
      width: ICON_SIZE,
      height: ICON_SIZE,
      callout: {
        content: `${p.timeLabel}\n${p.typeName}  ${p.pressure}hPa  ${p.windSpeed}m/s`,
        color: '#ffffff',
        bgColor: '#222530',
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        display: 'BYCLICK'
      }
    }));
    forecast.forEach((p, i) => {
      markers.push({
        id: track.length + i,
        latitude: p.lat,
        longitude: p.lon,
        iconPath: this._getMarkerIcon('#8C9AA5'),
        width: ICON_SIZE,
        height: ICON_SIZE,
        callout: {
          content: `${p.timeLabel}\n${p.typeName}  ${p.pressure}hPa  ${p.windSpeed}m/s`,
          color: '#ffffff',
          bgColor: '#222530',
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          display: 'BYCLICK'
        }
      });
    });

    this.setData({
      mapCenter: center,
      mapZoom: zoom,
      mapPolylines: polylines,
      mapMarkers: markers
    });
    this._ctx = null;
  },

  onZoomIn() {
    this.setData({ mapZoom: Math.min(18, this.data.mapZoom + 1) });
  },
  onZoomOut() {
    this.setData({ mapZoom: Math.max(3, this.data.mapZoom - 1) });
  },
  onLocate() {
    const { track } = this.data;
    if (!track.length) return;
    const last = track[track.length - 1];
    this.setData({ mapCenter: { lat: last.lat, lon: last.lon } });
  },

  /** 生成纯色圆形 marker 图标（SVG data URI，无需 canvas） */
  _getMarkerIcon(color) {
    if (this._iconCache[color]) return this._iconCache[color];
    const r = ICON_SIZE / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}"><circle cx="${r}" cy="${r}" r="${r}" fill="${color}"/></svg>`;
    const icon = 'data:image/svg+xml,' + encodeURIComponent(svg);
    this._iconCache[color] = icon;
    return icon;
  }
});
