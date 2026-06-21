(function initPopup() {
  const runtime = globalThis.DouyinExtensionRuntime;
  const parser = globalThis.DouyinChapterParser;
  const textPolicy = globalThis.DouyinTextPolicy;
  const platformRegistry = globalThis.CreatorChapterPlatforms;
  const logger = globalThis.CreatorChapterErrorLogger;

  const chapterInput = document.getElementById('chapterInput');
  const replaceExisting = document.getElementById('replaceExisting');
  const truncateTitle = document.getElementById('truncateTitle');
  const truncateSummary = document.getElementById('truncateSummary');
  const dryRun = document.getElementById('dryRun');
  const previewBody = document.getElementById('previewBody');
  const countBadge = document.getElementById('countBadge');
  const healthText = document.getElementById('healthText');
  const messageBox = document.getElementById('messageBox');
  const importButton = document.getElementById('importButton');
  const copyLogsButton = document.getElementById('copyLogsButton');

  let currentResult = {
    chapters: [],
    errors: [],
    warnings: []
  };
  let activePlatform = platformRegistry && platformRegistry.getPlatformConfig('douyin');

  function platformOptions() {
    return {
      platformId: activePlatform && activePlatform.id,
      titleLimit: activePlatform && activePlatform.titleLimit,
      summaryLimit: activePlatform && activePlatform.summaryLimit,
      supportsSummary: !activePlatform || activePlatform.supportsSummary !== false
    };
  }

  function options() {
    return {
      replaceExisting: replaceExisting.checked,
      truncateTitle: truncateTitle.checked,
      truncateSummary: truncateSummary.checked,
      dryRun: dryRun.checked,
      ...platformOptions()
    };
  }

  function formatTime(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
      return '--:--';
    }
    const whole = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const rest = whole % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(rest).padStart(2, '0');
    return hours > 0 ? `${String(hours).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function setMessage(text, type = '') {
    messageBox.textContent = text;
    messageBox.className = `message-box${type ? ` is-${type}` : ''}`;
  }

  function setHealth(text, type = '') {
    healthText.textContent = text;
    healthText.className = `health-text${type ? ` is-${type}` : ''}`;
  }

  async function recordPopupError(error, tab, context = {}) {
    if (!logger) {
      return;
    }

    try {
      await logger.appendErrorLog({
        source: 'popup',
        platformId: activePlatform ? activePlatform.id : '',
        platformName: activePlatform ? activePlatform.displayName : '',
        url: tab && tab.url ? tab.url : '',
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? String(error.stack).slice(0, 2000) : '',
        context
      });
    } catch (_error) {
      // Logging must never hide the original import error.
    }
  }

  function renderPreview(result) {
    countBadge.textContent = `${result.chapters.length} 条`;
    previewBody.textContent = '';

    if (result.chapters.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 3;
      cell.className = 'empty-cell';
      cell.textContent = '粘贴章节后显示预览';
      row.append(cell);
      previewBody.append(row);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const chapter of result.chapters) {
      const row = document.createElement('tr');
      if (chapter.errors.length > 0) {
        row.classList.add('has-error');
      } else if (chapter.warnings.length > 0) {
        row.classList.add('has-warning');
      }

      const timeCell = document.createElement('td');
      timeCell.textContent = formatTime(chapter.startSeconds);

      const titleCell = document.createElement('td');
      titleCell.textContent = chapter.title || '未识别';

      const summaryCell = document.createElement('td');
      summaryCell.textContent = chapter.errors[0] || chapter.warnings[0] || chapter.summary || '无简介';

      row.append(timeCell, titleCell, summaryCell);
      fragment.append(row);
    }
    previewBody.append(fragment);
  }

  function recompute() {
    const parsed = parser.parseChapterText(chapterInput.value);
    currentResult = textPolicy.validateChapters(parsed.chapters, options());

    renderPreview(currentResult);

    if (!activePlatform) {
      setHealth('当前页面未支持', 'error');
      setMessage('请先切到抖音或小红书的视频发布页。', 'error');
      importButton.disabled = true;
      return;
    }

    if (currentResult.chapters.length === 0) {
      setHealth(activePlatform ? `${activePlatform.displayName}：等待输入` : '等待输入');
      setMessage('');
      importButton.disabled = true;
      return;
    }

    if (currentResult.errors.length > 0) {
      setHealth(`${currentResult.errors.length} 个错误`, 'error');
      setMessage(formatIssues(currentResult.errors), 'error');
      importButton.disabled = true;
      return;
    }

    if (currentResult.warnings.length > 0) {
      setHealth(`${currentResult.warnings.length} 个提醒`, 'ok');
      setMessage(formatIssues(currentResult.warnings), 'warning');
      importButton.disabled = false;
      return;
    }

    setHealth(activePlatform ? `${activePlatform.displayName}：可写入` : '可写入', 'ok');
    setMessage('');
    importButton.disabled = false;
  }

  function formatIssues(issues) {
    return issues
      .slice(0, 4)
      .map((issue) => `第 ${issue.lineNumber} 行：${issue.message}`)
      .join('\n');
  }

  function getActiveTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(tabs[0]);
      });
    });
  }

  function sendMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function insertCss(tabId, files) {
    return Promise.all(
      files.map((file) =>
        chrome.scripting.insertCSS({
          target: { tabId },
          files: [file]
        })
      )
    );
  }

  function executeScripts(tabId, files) {
    return chrome.scripting.executeScript({
      target: { tabId },
      files
    });
  }

  function executeMainWorldScripts(tabId, files) {
    if (!files || files.length === 0) {
      return Promise.resolve();
    }

    return chrome.scripting.executeScript({
      target: { tabId },
      files,
      world: 'MAIN'
    });
  }

  async function ensureContentScript(tabId) {
    if (!chrome.scripting || !runtime) {
      throw new Error('扩展缺少脚本注入能力，请在扩展管理页重新加载本插件。');
    }

    await insertCss(tabId, runtime.CONTENT_STYLE_FILES);
    await executeMainWorldScripts(tabId, runtime.MAIN_WORLD_SCRIPT_FILES);
    await executeScripts(tabId, runtime.CONTENT_SCRIPT_FILES);
  }

  async function sendImportMessage(tabId, message) {
    try {
      return await sendMessage(tabId, message);
    } catch (error) {
      if (!runtime || !runtime.isMissingReceiverError(error)) {
        throw error;
      }

      setMessage('当前页面还没有连接插件脚本，正在自动注入后重试...', 'warning');
      await ensureContentScript(tabId);
      return sendMessage(tabId, message);
    }
  }

  async function importChapters() {
    importButton.disabled = true;
    setMessage('正在连接当前页面...', 'ok');
    let tab = null;

    try {
      tab = await getActiveTab();
      setActivePlatform(tab && tab.url);
      recompute();

      if (currentResult.errors.length > 0 || currentResult.chapters.length === 0) {
        importButton.disabled = currentResult.errors.length > 0 || currentResult.chapters.length === 0;
        return;
      }

      if (!tab || !tab.id || !activePlatform) {
        throw new Error('请先切到已支持的创作者视频发布页。');
      }

      const response = await sendImportMessage(tab.id, {
        type: 'DCH_IMPORT_CHAPTERS',
        payload: {
          chapters: currentResult.chapters,
          options: options()
        }
      });

      if (!response || response.ok !== true) {
        throw new Error(response && response.error ? response.error : '页面脚本没有返回结果。');
      }

      setMessage(response.message || '已发送到页面执行。', 'ok');
    } catch (error) {
      await recordPopupError(error, tab, {
        action: 'importChapters',
        chapterCount: currentResult.chapters.length
      });
      setMessage(error.message || String(error), 'error');
      importButton.disabled = false;
    }
  }

  async function copyErrorLogs() {
    if (!logger) {
      setMessage('当前版本没有加载错误日志模块。', 'error');
      return;
    }

    try {
      const state = await logger.readErrorLogs();
      const text = logger.formatErrorLogs(state);
      await navigator.clipboard.writeText(text);
      setMessage('今天的错误日志已复制。', 'ok');
    } catch (error) {
      setMessage(error.message || String(error), 'error');
    }
  }

  function setActivePlatform(url) {
    activePlatform = platformRegistry ? platformRegistry.detectPlatform(url || '') : null;

    if (activePlatform) {
      importButton.textContent = `写入${activePlatform.displayName}章节`;
      setHealth(`${activePlatform.displayName}：等待输入`);
      return;
    }

    importButton.textContent = '写入章节';
    setHealth('当前页面未支持', 'error');
  }

  async function initializeActivePlatform() {
    try {
      const tab = await getActiveTab();
      setActivePlatform(tab && tab.url);
    } catch (_error) {
      setActivePlatform('');
    }
    recompute();
  }

  chapterInput.addEventListener('input', recompute);
  replaceExisting.addEventListener('change', recompute);
  truncateTitle.addEventListener('change', recompute);
  truncateSummary.addEventListener('change', recompute);
  dryRun.addEventListener('change', recompute);
  importButton.addEventListener('click', importChapters);
  copyLogsButton.addEventListener('click', copyErrorLogs);

  initializeActivePlatform();
})();
