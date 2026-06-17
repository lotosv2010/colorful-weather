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
const ICON_SIZE = 20;
const ICON_SIZE_LAST = 28;

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
    mapScale: 5,
    mapPolylines: [],
    mapMarkers: []
  },

  onLoad() {
    this._iconCache = {};
    this._mapScale = 5;
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
      const list = res.storm.sort((a, b) => Number(b.isActive) - Number(a.isActive));
      this.setData({ stormList: list, loading: false });

      if (list.length) {
        this.onSelectStorm({ currentTarget: { dataset: { id: list[0].id } } });
      }

      this._sortByTime(list);
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, errorMsg: '数据加载失败' });
    }
  },

  async _sortByTime(list) {
    try {
      const results = await Promise.all(
        list.map(s => stormTrack({ stormid: s.id }).catch(() => null))
      );
      const timeMap = {};
      results.forEach((res, i) => {
        if (res?.track?.length) {
          timeMap[list[i].id] = new Date(res.track[0].time || 0).getTime();
        }
      });
      const sorted = [...list].sort((a, b) => {
        if (a.isActive !== b.isActive) return Number(b.isActive) - Number(a.isActive);
        return (timeMap[b.id] || 0) - (timeMap[a.id] || 0);
      });
      this.setData({ stormList: sorted });
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
    if (points.length <= 1) return { center, scale: 6 };
    const span = Math.max(maxLat - minLat, maxLon - minLon);
    let scale;
    if (span > 40) scale = 3;
    else if (span > 20) scale = 4;
    else if (span > 10) scale = 5;
    else if (span > 5) scale = 6;
    else if (span > 2) scale = 7;
    else scale = 8;
    return { center, scale };
  },

  async renderTrackMap() {
    const { track, forecast } = this.data;
    if (!track.length) return;

    const allPoints = [...track, ...forecast];
    const { center, scale } = this._calcMapBounds(allPoints);

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

    const trackColors = track.map(p => p.color);
    await this._prepareIcons([...trackColors, '#8C9AA5']);

    const markers = track.map((p, i) => {
      const isLast = i === track.length - 1;
      const sz = isLast ? ICON_SIZE_LAST : ICON_SIZE;
      return {
        id: i,
        latitude: p.lat,
        longitude: p.lon,
        iconPath: this._iconCache[isLast ? p.color + '_last' : p.color] || '',
        width: sz,
        height: sz,
        anchor: { x: 0.5, y: 0.5 },
        callout: {
          content: `${p.timeLabel}\n${p.typeName}  ${p.pressure}hPa  ${p.windSpeed}m/s`,
          color: '#ffffff',
          bgColor: '#222530',
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          display: 'BYCLICK'
        }
      };
    });
    forecast.forEach((p, i) => {
      markers.push({
        id: track.length + i,
        latitude: p.lat,
        longitude: p.lon,
        iconPath: this._iconCache['#8C9AA5'] || '',
        width: ICON_SIZE,
        height: ICON_SIZE,
        anchor: { x: 0.5, y: 0.5 },
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
      mapScale: scale,
      mapPolylines: polylines,
      mapMarkers: markers
    });
    this._mapScale = scale;
  },

  onZoomIn() {
    this._mapScale = Math.min(20, this._mapScale + 1);
    this.setData({ mapScale: this._mapScale });
  },
  onZoomOut() {
    this._mapScale = Math.max(3, this._mapScale - 1);
    this.setData({ mapScale: this._mapScale });
  },
  onLocate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          mapCenter: { lat: res.latitude, lon: res.longitude },
          mapScale: 8
        });
        this._mapScale = 8;
      },
      fail: () => {
        wx.showToast({ title: '无法获取位置', icon: 'none' });
      }
    });
  },

  /** 用离屏 canvas 画圆后导出 PNG 临时文件 */
  _drawCircleIcon(color, size, isLast) {
    return new Promise((resolve) => {
      const canvas = wx.createOffscreenCanvas({ type: '2d', width: size, height: size });
      const ctx = canvas.getContext('2d');
      const cx = size / 2;
      if (isLast) {
        ctx.beginPath();
        ctx.arc(cx, cx, cx - 1, 0, Math.PI * 2);
        ctx.fillStyle = color + '4D';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cx, cx - 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cx, cx - 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      wx.canvasToTempFilePath({
        canvas,
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve('')
      });
    });
  },

  async _prepareIcons(colors) {
    const unique = [...new Set(colors)];
    await Promise.all(unique.map(async (color) => {
      if (!this._iconCache[color]) {
        this._iconCache[color] = await this._drawCircleIcon(color, ICON_SIZE, false);
      }
      const lastKey = color + '_last';
      if (!this._iconCache[lastKey]) {
        this._iconCache[lastKey] = await this._drawCircleIcon(color, ICON_SIZE_LAST, true);
      }
    }));
  }
});
