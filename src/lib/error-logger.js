(function attachErrorLogger(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.CreatorChapterErrorLogger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createErrorLogger() {
  const STORAGE_KEY = 'creatorChapterErrorLogs';
  const DEFAULT_MAX_ENTRIES = 100;

  function todayKey(now = new Date()) {
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function normalizeState(state, now = new Date()) {
    const today = todayKey(now);
    if (!state || state.date !== today || !Array.isArray(state.entries)) {
      return { date: today, entries: [] };
    }
    return {
      date: today,
      entries: state.entries
    };
  }

  function appendEntryToState(state, entry, options = {}) {
    const now = options.now || new Date();
    const maxEntries = options.maxEntries || DEFAULT_MAX_ENTRIES;
    const next = normalizeState(state, now);
    const normalizedEntry = {
      time: entry.time || now.toISOString(),
      source: entry.source || 'unknown',
      platformId: entry.platformId || '',
      platformName: entry.platformName || '',
      url: entry.url || '',
      message: entry.message || '',
      stack: entry.stack || '',
      context: entry.context || null
    };

    return {
      date: next.date,
      entries: [...next.entries, normalizedEntry].slice(-maxEntries)
    };
  }

  function storageArea() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return null;
    }
    return chrome.storage.local;
  }

  function getState() {
    const storage = storageArea();
    if (!storage) {
      return Promise.resolve(normalizeState(null));
    }

    return new Promise((resolve) => {
      storage.get([STORAGE_KEY], (result) => {
        resolve(normalizeState(result && result[STORAGE_KEY]));
      });
    });
  }

  function saveState(state) {
    const storage = storageArea();
    if (!storage) {
      return Promise.resolve(state);
    }

    return new Promise((resolve) => {
      storage.set({ [STORAGE_KEY]: state }, () => resolve(state));
    });
  }

  async function appendErrorLog(entry, options = {}) {
    const state = await getState();
    const next = appendEntryToState(state, entry, options);
    await saveState(next);
    return next;
  }

  async function readErrorLogs() {
    const state = await getState();
    await saveState(state);
    return state;
  }

  async function clearErrorLogs() {
    const state = normalizeState(null);
    await saveState(state);
    return state;
  }

  function stringifyContext(context) {
    if (!context) {
      return '';
    }

    try {
      return JSON.stringify(context, null, 2);
    } catch (_error) {
      return String(context);
    }
  }

  function formatErrorLogs(state) {
    const normalized = normalizeState(state);
    const lines = [
      `创作者章节助手错误日志（${normalized.date}）`,
      ''
    ];

    if (normalized.entries.length === 0) {
      lines.push('今天暂无错误日志。');
      return lines.join('\n');
    }

    normalized.entries.forEach((entry, index) => {
      lines.push(`#${index + 1}`);
      lines.push(`时间：${entry.time || ''}`);
      lines.push(`来源：${entry.source || ''}`);
      lines.push(`平台：${entry.platformName || entry.platformId || ''}`);
      lines.push(`页面：${entry.url || ''}`);
      lines.push(`错误：${entry.message || ''}`);
      if (entry.stack) {
        lines.push(`堆栈：${entry.stack}`);
      }
      const context = stringifyContext(entry.context);
      if (context) {
        lines.push('上下文：');
        lines.push(context);
      }
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  return {
    STORAGE_KEY,
    appendEntryToState,
    appendErrorLog,
    clearErrorLogs,
    formatErrorLogs,
    readErrorLogs,
    todayKey
  };
});

