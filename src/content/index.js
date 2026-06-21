(function initCreatorChapterContentScript() {
  if (globalThis.__CCH_CONTENT_SCRIPT_READY__) {
    return;
  }
  globalThis.__CCH_CONTENT_SCRIPT_READY__ = true;

  const IMPORT_MESSAGE = 'DCH_IMPORT_CHAPTERS';

  function adapters() {
    return {
      douyin: globalThis.CreatorChapterDouyinAdapter,
      xiaohongshu: globalThis.CreatorChapterXiaohongshuAdapter
    };
  }

  function getMessageText(error) {
    return error && error.message ? error.message : String(error);
  }

  function getCurrentPlatform() {
    if (!globalThis.CreatorChapterPlatforms) {
      throw new Error('缺少平台识别模块，请重新加载插件。');
    }
    return globalThis.CreatorChapterPlatforms.detectPlatform(location.href);
  }

  function getAdapter(platform) {
    const adapter = platform && adapters()[platform.id];
    if (!adapter) {
      throw new Error('当前平台暂未支持章节自动写入。');
    }
    return adapter;
  }

  function getLogger() {
    return globalThis.CreatorChapterErrorLogger || null;
  }

  async function importChapters(payload) {
    const platform = getCurrentPlatform();
    if (!platform) {
      throw new Error('请先切到已支持的创作者视频发布页。');
    }

    const adapter = getAdapter(platform);
    if (adapter.isSupportedPage && !adapter.isSupportedPage()) {
      throw new Error(`当前页面不是${platform.displayName}视频发布页。`);
    }

    return adapter.handleImport(payload);
  }

  function showError(error) {
    if (!globalThis.CreatorChapterProgress) {
      return;
    }

    globalThis.CreatorChapterProgress.updatePanel({
      state: 'error',
      status: '写入失败',
      detail: getMessageText(error)
    });
  }

  async function recordError(error, payload) {
    const logger = getLogger();
    if (!logger) {
      return;
    }

    let platform = null;
    let adapter = null;
    let context = null;

    try {
      platform = getCurrentPlatform();
      adapter = getAdapter(platform);
      context = adapter && adapter.createErrorContext ? adapter.createErrorContext(payload) : null;
    } catch (_error) {
      context = null;
    }

    try {
      await logger.appendErrorLog({
        source: 'content',
        platformId: platform ? platform.id : '',
        platformName: platform ? platform.displayName : '',
        url: location.href,
        message: getMessageText(error),
        stack: error && error.stack ? String(error.stack).slice(0, 2000) : '',
        context
      });
    } catch (_error) {
      // Logging must never block the user-facing error response.
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== IMPORT_MESSAGE) {
        return false;
      }

      importChapters(message.payload)
        .then((result) => sendResponse(result))
        .catch(async (error) => {
          await recordError(error, message.payload);
          showError(error);
          sendResponse({ ok: false, error: getMessageText(error) });
        });

      return true;
    });
  }
})();
