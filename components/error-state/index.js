Component({
  properties: {
    errorMsg: { type: String, value: '' },
    compact: { type: Boolean, value: false },
  },
  methods: {
    onRetry() {
      this.triggerEvent('retry');
    },
  },
});
