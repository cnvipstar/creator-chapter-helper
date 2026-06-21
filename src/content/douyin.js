(function initDouyinAdapter() {
  if (globalThis.CreatorChapterDouyinAdapter) {
    return;
  }
  let running = false;

  function progress() {
    if (!globalThis.CreatorChapterProgress) {
      throw new Error('缺少进度面板模块，请重新加载插件。');
    }
    return globalThis.CreatorChapterProgress;
  }

  function isSupportedPage() {
    return (
      location.hostname === 'creator.douyin.com' &&
      location.pathname.includes('/creator-micro/content/post/video')
    );
  }

  async function handleImport(payload = {}) {
    if (running) {
      throw new Error('章节写入正在执行，请等待当前任务完成。');
    }

    running = true;
    try {
      const chapters = Array.isArray(payload.chapters) ? payload.chapters : [];
      const options = payload.options || {};

      if (!isSupportedPage()) {
        throw new Error('当前页面不是抖音创作者中心视频发布页。');
      }
      if (chapters.length === 0) {
        throw new Error('没有可写入的章节。');
      }

      showPanel();
      updatePanel({
        state: 'working',
        status: '准备写入章节',
        detail: `共 ${chapters.length} 条章节`,
        current: 0,
        total: chapters.length
      });

      const modal = await openChapterModal();
      await ensureManualInputs(modal);

      const video = await waitFor(() => getVideo(modal), 5000, '未找到章节弹窗内的视频元素。');
      const durationSeconds = readDuration(video);

      const validated = globalThis.DouyinTextPolicy.validateChapters(chapters, {
        ...options,
        titleLimit: 12,
        summaryLimit: 100,
        supportsSummary: true,
        durationSeconds
      });

      if (validated.errors.length > 0) {
        throw new Error(formatIssues(validated.errors));
      }

      if (options.dryRun) {
        finishPanel('仅预览通过', `页面校验通过，共 ${validated.chapters.length} 条章节可写入。`);
        return {
          ok: true,
          message: `仅预览通过，共 ${validated.chapters.length} 条章节可写入。`
        };
      }

      if (options.replaceExisting) {
        updatePanel({
          state: 'working',
          status: '清空已有章节',
          detail: '正在检查右侧章节列表...',
          current: 0,
          total: validated.chapters.length
        });
        await clearExistingChapters(modal);
      }

      for (let index = 0; index < validated.chapters.length; index += 1) {
        const chapter = validated.chapters[index];
        updatePanel({
          state: 'working',
          status: `写入第 ${index + 1} 条 / ${validated.chapters.length} 条`,
          detail: `${formatTime(chapter.startSeconds)}  ${chapter.title}`,
          current: index,
          total: validated.chapters.length
        });
        await addChapter(modal, video, chapter);
      }

      updatePanel({
        state: 'working',
        status: '保存章节',
        detail: '正在保存抖音章节弹窗...',
        current: validated.chapters.length,
        total: validated.chapters.length
      });
      await saveModal(modal);

      finishPanel('章节已保存', `已写入 ${validated.chapters.length} 条章节；最终发布按钮未被点击。`);
      return {
        ok: true,
        message: `已写入 ${validated.chapters.length} 条章节。`
      };
    } finally {
      running = false;
    }
  }

  function showPanel() {
    return progress().showPanel();
  }

  function updatePanel(details) {
    return progress().updatePanel(details);
  }

  function finishPanel(status, detail) {
    return progress().finishPanel(status, detail);
  }

  async function openChapterModal() {
    const existing = findChapterModal();
    if (existing) {
      return existing;
    }

    const trigger = findVisibleByText(document, '去编辑', {
      selector: 'button, [role="button"], a, p, div, span'
    });

    if (!trigger) {
      throw new Error('找不到“视频章节 / 去编辑”入口，请确认视频已上传且页面已显示章节功能。');
    }

    clickElement(trigger);
    return waitFor(() => findChapterModal(), 6000, '点击“去编辑”后没有出现章节弹窗。');
  }

  async function ensureManualInputs(modal) {
    const manualButton = findManualTrigger(modal);
    const action = globalThis.DouyinAutomationPolicy.decideManualInputAction({
      hasTitleInput: Boolean(getTitleInput(modal)),
      hasSummaryInput: Boolean(getSummaryInput(modal)),
      hasManualTrigger: Boolean(manualButton)
    });

    if (action === 'ready') {
      return;
    }

    if (action === 'open-manual') {
      clickElement(manualButton);
    } else {
      throw new Error('找不到“手动添加”入口，也找不到章节输入框。');
    }

    await waitFor(
      () => getTitleInput(modal) && getSummaryInput(modal),
      4000,
      '无法打开“手动添加”输入区。'
    );
  }

  async function clearExistingChapters(modal) {
    const count = readChapterCount(modal);
    if (!count || count <= 0) {
      return;
    }

    const clearButton = findVisibleByText(modal, '清空', {
      selector: 'button, [role="button"], div, span'
    });
    if (!clearButton) {
      throw new Error('检测到已有章节，但找不到“清空”按钮。');
    }

    clickElement(clearButton);
    await sleep(350);
    await confirmSecondaryDialogIfPresent();

    await waitFor(() => readChapterCount(modal) === 0, 3000, '清空已有章节后，章节数没有变为 0。');
  }

  async function addChapter(modal, video, chapter) {
    const beforeCount = readChapterCount(modal);

    await seekVideo(video, chapter.startSeconds);
    await ensureManualInputs(modal);

    const titleInput = await waitFor(() => getTitleInput(modal), 3000, '找不到“输入章节名”输入框。');
    const summaryInput = await waitFor(() => getSummaryInput(modal), 3000, '找不到“输入章节简介”输入框。');

    fillValue(titleInput, chapter.title);
    fillValue(summaryInput, chapter.summary);

    const confirm = await waitFor(
      () => {
        const node = findManualConfirm(modal);
        return node && !isDisabled(node) ? node : null;
      },
      3000,
      '章节信息填写后，“确定”仍不可点击。'
    );

    clickElement(confirm);

    await waitFor(
      () => {
        const nextCount = readChapterCount(modal);
        if (typeof beforeCount === 'number' && typeof nextCount === 'number') {
          return nextCount > beforeCount;
        }
        return normalizeText(modal.textContent).includes(chapter.title);
      },
      5000,
      `第 ${chapter.lineNumber} 行章节没有出现在章节列表中。`
    );
  }

  async function saveModal(modal) {
    const saveButton = await waitFor(
      () => {
        const button = findVisibleByText(modal, '保存', {
          selector: 'button, [role="button"], div, span'
        });
        return button && !isDisabled(button) ? button : null;
      },
      5000,
      '保存按钮不可点击，页面可能没有接受章节改动。'
    );

    clickElement(saveButton);
    await waitFor(() => !findChapterModal(), 6000, '点击保存后，章节弹窗没有关闭。');
  }

  function findChapterModal() {
    const candidates = Array.from(
      document.querySelectorAll('[role="dialog"], .dy-creator-content-modal-content, .chapter-modal-eN8zOH')
    )
      .filter(isVisible)
      .filter((element) => {
        const text = normalizeText(element.textContent);
        return (
          element.querySelector('video') ||
          text.includes('章节数') ||
          text.includes('输入章节名') ||
          text.includes('手动添加')
        );
      });

    candidates.sort((a, b) => area(a) - area(b));
    return candidates[0] || null;
  }

  function getVideo(modal) {
    const video = modal.querySelector('video');
    return video || document.querySelector('video.chapter-video-newProgress') || document.querySelector('video');
  }

  function readDuration(video) {
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('无法读取视频时长，请等待视频加载完成后重试。');
    }
    return video.duration;
  }

  async function seekVideo(video, seconds) {
    video.pause();
    video.currentTime = Math.max(0, seconds);
    video.dispatchEvent(new Event('seeking', { bubbles: true }));
    video.dispatchEvent(new Event('timeupdate', { bubbles: true }));
    video.dispatchEvent(new Event('seeked', { bubbles: true }));
    await sleep(180);

    if (Math.abs(video.currentTime - seconds) > 1.25) {
      throw new Error(`无法把视频定位到 ${formatTime(seconds)}。`);
    }
  }

  function getTitleInput(modal) {
    return modal.querySelector('input[placeholder="输入章节名"]');
  }

  function getSummaryInput(modal) {
    return modal.querySelector('textarea[placeholder="输入章节简介"]');
  }

  function findManualTrigger(modal) {
    return findVisibleByText(modal, '手动添加', {
      selector: 'button, [role="button"], div, span'
    });
  }

  function findManualConfirm(modal) {
    const nodes = Array.from(modal.querySelectorAll('div, button, span'))
      .filter(isVisible)
      .filter((node) => normalizeText(node.textContent) === '确定')
      .filter((node) => !node.closest('.dy-creator-content-modal-footer'))
      .filter((node) => !node.closest('.custom-footer-KeUevy'));

    nodes.sort((a, b) => area(a) - area(b));
    return nodes[0] || null;
  }

  async function confirmSecondaryDialogIfPresent() {
    const dialog = Array.from(document.querySelectorAll('[role="dialog"], .semi-modal-content'))
      .filter(isVisible)
      .find((node) => {
        const text = normalizeText(node.textContent);
        return !node.querySelector('input[placeholder="输入章节名"]') && /确认|清空|删除/.test(text);
      });

    if (!dialog) {
      return;
    }

    const confirm = findVisibleByText(dialog, '确认', {
      selector: 'button, [role="button"], div, span'
    }) || findVisibleByText(dialog, '确定', {
      selector: 'button, [role="button"], div, span'
    });

    if (confirm && !isDisabled(confirm)) {
      clickElement(confirm);
      await sleep(300);
    }
  }

  function readChapterCount(modal) {
    const match = normalizeText(modal.textContent).match(/章节数[:：]\s*(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function fillValue(element, value) {
    element.focus();
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    const inputEvent = typeof InputEvent === 'function'
      ? new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value
      })
      : new Event('input', { bubbles: true, cancelable: true });

    element.dispatchEvent(inputEvent);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickElement(element) {
    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  function findVisibleByText(root, text, options = {}) {
    const selector = options.selector || 'button, [role="button"], a, div, span, p';
    const exact = options.exact !== false;
    const nodes = Array.from(root.querySelectorAll(selector))
      .filter(isVisible)
      .filter((node) => {
        const value = normalizeText(node.textContent);
        return exact ? value === text : value.includes(text);
      });

    nodes.sort((a, b) => area(a) - area(b));
    return nodes[0] || null;
  }

  async function waitFor(check, timeoutMs, timeoutMessage) {
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const value = check();
        if (value) {
          return value;
        }
      } catch (error) {
        lastError = error;
      }
      await sleep(100);
    }

    throw new Error(timeoutMessage || (lastError && lastError.message) || '等待页面状态超时。');
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function isDisabled(element) {
    const disabledAncestor = element.closest(
      'button[disabled], [aria-disabled="true"], .semi-button-disabled, .btn-disabled-ks4GAK'
    );

    return (
      Boolean(disabledAncestor) ||
      element.disabled === true ||
      element.getAttribute('aria-disabled') === 'true' ||
      /\bdisabled\b|btn-disabled|semi-button-disabled/.test(element.className || '')
    );
  }

  function area(element) {
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function formatIssues(issues) {
    return issues
      .slice(0, 8)
      .map((issue) => `第 ${issue.lineNumber} 行：${issue.message}`)
      .join('\n');
  }

  function formatTime(seconds) {
    const whole = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const rest = whole % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(rest).padStart(2, '0');
    return hours > 0 ? `${String(hours).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  globalThis.CreatorChapterDouyinAdapter = {
    id: 'douyin',
    displayName: '抖音',
    isSupportedPage,
    handleImport
  };
})();
