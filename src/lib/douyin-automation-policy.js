(function attachDouyinAutomationPolicy(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.DouyinAutomationPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createDouyinAutomationPolicy() {
  function decideManualInputAction(state = {}) {
    if (state.hasTitleInput && state.hasSummaryInput) {
      return 'ready';
    }

    if (state.hasManualTrigger) {
      return 'open-manual';
    }

    return 'missing';
  }

  return {
    decideManualInputAction
  };
});
