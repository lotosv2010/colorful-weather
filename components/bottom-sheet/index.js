Component({
  options: {
    multipleSlots: true,
  },
  data: {
    progress: 0,
    expanded: false,
    dragging: false,
    _maxDrag: 400,
  },
  lifetimes: {
    attached() {
      const info = wx.getSystemInfoSync();
      this.setData({ _maxDrag: Math.max(220, info.windowHeight * 0.5) });
      this._scrollTop = 0;
    },
  },
  methods: {
    // —— 主拖拽：compact-layer / full-handle ——
    onTouchStart(e) {
      this._startY = e.touches[0].clientY;
      this._startProgress = this.data.progress;
      this.setData({ dragging: true });
      this.triggerEvent('dragstart');
    },
    onTouchMove(e) {
      if (!this.data.dragging) return;
      const dy = e.touches[0].clientY - this._startY;
      let p = this._startProgress - dy / this.data._maxDrag;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      this.setData({ progress: p });
      this.triggerEvent('progress', { progress: p });
    },
    onTouchEnd() {
      if (!this.data.dragging) return;
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
      this._svReady = (this._scrollTop || 0) <= 0;
      this._svDragging = false;
    },
    onScrollTouchMove(e) {
      if (!this._svReady) return;
      const dy = e.touches[0].clientY - this._svStartY;
      if (dy <= 0) return;
      if (!this._svDragging) {
        this._svDragging = true;
        this._startY = this._svStartY;
        this._startProgress = this.data.progress;
        this.setData({ dragging: true });
      }
      let p = this._startProgress - (e.touches[0].clientY - this._startY) / this.data._maxDrag;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      this.setData({ progress: p });
      this.triggerEvent('progress', { progress: p });
    },
    onScrollTouchEnd() {
      if (this._svDragging) this.onTouchEnd();
      this._svDragging = false;
      this._svReady = false;
    },

    expand() { this._snap(1); },
    collapse() { this._snap(0); },
    _snap(target) {
      const expanded = target === 1;
      // 释放 dragging 一帧后再更新 progress，确保 CSS transition 生效
      this.setData({ dragging: false }, () => {
        this.setData({ progress: target, expanded });
        this.triggerEvent('progress', { progress: target });
        this.triggerEvent('change', { expanded });
      });
    },
  },
});
