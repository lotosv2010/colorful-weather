Component({
  options: {
    multipleSlots: true,
  },
  properties: {
    weatherBg: {
      type: String,
      value: ''
    }
  },
  data: {
    progress: 0,
    expanded: false,
    dragging: false,
    _maxDrag: 400,
    weatherBgStyle: '',
    fullLayerStyle: 'transform:translateY(100%);background-color:rgba(20,22,30,0)',
  },
  observers: {
    'weatherBg': function(bg) {
      this.setData({ weatherBgStyle: bg ? `background:${bg}` : '' });
    }
  },
  lifetimes: {
    attached() {
      const { windowHeight } = wx.getWindowInfo();
      this.setData({ _maxDrag: Math.max(220, windowHeight * 0.5) });
      this._scrollTop = 0;
    },
  },
  methods: {
    // —— 主拖拽：compact-layer / full-handle ——
    onTouchStart(e) {
      this._startX = e.touches[0].clientX;
      this._startY = e.touches[0].clientY;
      this._startProgress = this.data.progress;
      this._isHorizontalSwipe = false;
      this.setData({ dragging: true });
      this.triggerEvent('dragstart');
    },
    onTouchMove(e) {
      if (!this.data.dragging) return;
      const dx = e.touches[0].clientX - this._startX;
      const dy = e.touches[0].clientY - this._startY;
      // 方向锁定：移动超过 8px 后一次性确定水平或垂直
      if (!this._isHorizontalSwipe && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        this._isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
      }
      if (this._isHorizontalSwipe) return;
      const startProgress = this._startProgress ?? this.data.progress;
      const maxDrag = this.data._maxDrag || 400;
      let p = startProgress - dy / maxDrag;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      this.setData({ progress: p, fullLayerStyle: this._fullLayerStyle(p) });
      this.triggerEvent('progress', { progress: p });
    },
    onTouchEnd(e) {
      if (!this.data.dragging) return;
      if (this._isHorizontalSwipe) {
        const endX = e && e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : this._startX;
        const dx = endX - this._startX;
        this._isHorizontalSwipe = false;
        if (Math.abs(dx) > 50 && !this.data.expanded) {
          // 有效水平翻页：直接释放 dragging，不改变抽屉展开状态
          this.setData({ dragging: false });
          this.triggerEvent('dragend');
          this.triggerEvent('swipe', { direction: dx < 0 ? 'left' : 'right' });
        } else {
          // 无效水平滑动：恢复抽屉原位
          this._snap(this._startProgress >= 0.5 ? 1 : 0);
          this.triggerEvent('dragend');
        }
        return;
      }
      this._isHorizontalSwipe = false;
      const dragged = this.data.progress - this._startProgress;
      let target;
      if (Math.abs(dragged) < 0.05) {
        target = this._startProgress >= 0.5 ? 1 : 0;
      } else {
        target = dragged > 0 ? 1 : 0;
      }
      this._snap(target);
      this.triggerEvent('dragend');
    },

    // —— scroll-view 顶部下拉触发收起 ——
    onScroll(e) {
      this._scrollTop = e.detail.scrollTop;
    },
    onScrollTouchStart(e) {
      this._svStartY = e.touches[0].clientY;
      this._svDragging = false;
      // 异步同步真实 scrollTop：防止页面切换后 scroll-view 被系统重置但 _scrollTop 仍为旧值
      this.createSelectorQuery().select('.full-scroll').scrollOffset(res => {
        if (res && !this._svDragging) {
          this._scrollTop = res.scrollTop || 0;
        }
      }).exec();
    },
    onScrollTouchMove(e) {
      if (this._svDragging) {
        // 已激活拖拽：持续跟踪
        let p = (this._startProgress ?? this.data.progress) - (e.touches[0].clientY - this._startY) / (this.data._maxDrag || 400);
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        this.setData({ progress: p, fullLayerStyle: this._fullLayerStyle(p) });
        this.triggerEvent('progress', { progress: p });
        return;
      }
      // 未激活：实时检查 scrollTop，scrollTop=0 且向下拖才激活
      // 不依赖 touchStart 时的快照，这样页面切换导致的 scrollTop 不同步也能正确处理
      if ((this._scrollTop || 0) > 0) return;
      const dy = e.touches[0].clientY - this._svStartY;
      if (dy <= 0) return;
      this._svDragging = true;
      this._startY = this._svStartY;
      this._startProgress = this.data.progress;
      this.setData({ dragging: true });
      // 处理激活当帧的位移
      let p = this._startProgress - dy / (this.data._maxDrag || 400);
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      this.setData({ progress: p, fullLayerStyle: this._fullLayerStyle(p) });
      this.triggerEvent('progress', { progress: p });
    },
    onScrollTouchEnd() {
      if (this._svDragging) this.onTouchEnd();
      this._svDragging = false;
    },

    _fullLayerStyle(p) {
      return `transform:translateY(${(1 - p) * 100}%);background-color:rgba(20,22,30,${p * 0.98})`;
    },
    expand() { this._snap(1); },
    collapse() { this._snap(0); },
    _snap(target) {
      const expanded = target === 1;
      // 收起时 scroll-y 变为 false，scroll-view 内部会重置到 scrollTop=0
      // 同步更新 _scrollTop，避免下次展开时判断失误
      if (!expanded) this._scrollTop = 0;
      // 释放 dragging 一帧后再更新 progress，确保 CSS transition 生效
      this.setData({ dragging: false }, () => {
        this.setData({ progress: target, expanded, fullLayerStyle: this._fullLayerStyle(target) });
        this.triggerEvent('progress', { progress: target });
        this.triggerEvent('change', { expanded });
      });
    },
  },
});
