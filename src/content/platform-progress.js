(function initPlatformProgress() {
  if (globalThis.CreatorChapterProgress) {
    return;
  }

  const PANEL_ID = 'dch-progress-panel';

  function showPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      return panel;
    }

    panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = [
      '<div class="dch-head">',
      '<span>创作者章节助手</span>',
      '<button class="dch-close" type="button" aria-label="关闭">×</button>',
      '</div>',
      '<div class="dch-body">',
      '<p class="dch-status">等待开始</p>',
      '<p class="dch-detail"></p>',
      '<div class="dch-meter" aria-hidden="true"><span></span></div>',
      '</div>'
    ].join('');
    panel.querySelector('.dch-close').addEventListener('click', () => panel.remove());
    document.documentElement.append(panel);
    return panel;
  }

  function updatePanel({ state = 'working', status = '', detail = '', current = 0, total = 1 }) {
    const panel = showPanel();
    panel.dataset.state = state;
    panel.querySelector('.dch-status').textContent = status;
    panel.querySelector('.dch-detail').textContent = detail;

    const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
    panel.style.setProperty('--dch-progress', `${percent}%`);
  }

  function finishPanel(status, detail) {
    updatePanel({
      state: 'done',
      status,
      detail,
      current: 1,
      total: 1
    });
  }

  globalThis.CreatorChapterProgress = {
    showPanel,
    updatePanel,
    finishPanel
  };
})();

