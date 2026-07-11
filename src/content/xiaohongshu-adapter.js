(function initXiaohongshuAdapter() {
  if (globalThis.CreatorChapterXiaohongshuAdapter) {
    return;
  }

  let running = false;
  let fillSequence = 0;

  function isSupportedPage() {
    return (
      location.hostname === 'creator.xiaohongshu.com' &&
      location.pathname.includes('/publish')
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
        throw new Error('当前页面不是小红书创作服务平台视频发布页。');
      }
      if (chapters.length === 0) {
        throw new Error('没有可写入的章节。');
      }

      progress().showPanel();
      progress().updatePanel({
        state: 'working',
        status: '准备写入小红书章节',
        detail: `共 ${chapters.length} 条章节`,
        current: 0,
        total: chapters.length
      });

      const modal = await openChapterModal();
      const durationSeconds = readDuration(modal);
      const prepared = globalThis.XiaohongshuChapterPolicy.prepareXiaohongshuChapters(chapters, options);
      const durationIssues = durationSeconds
        ? findDurationIssues(prepared.chapters, durationSeconds)
        : [];

      if (prepared.errors.length > 0 || durationIssues.length > 0) {
        throw new Error(formatIssues([...prepared.errors, ...durationIssues]));
      }

      if (options.dryRun) {
        progress().finishPanel(
          '仅预览通过',
          `页面校验通过，共 ${prepared.chapters.length} 条章节可写入。`
        );
        return {
          ok: true,
          message: `仅预览通过，共 ${prepared.chapters.length} 条章节可写入。`
        };
      }

      if (options.replaceExisting) {
        progress().updatePanel({
          state: 'working',
          status: '清空已有章节',
          detail: '正在检查小红书章节列表...',
          current: 0,
          total: prepared.chapters.length
        });
        await clearExistingChapters(modal);
      }

      const firstNewItemIndex = getChapterItems(modal).length;
      for (let index = 0; index < prepared.chapters.length; index += 1) {
        const chapter = prepared.chapters[index];
        progress().updatePanel({
          state: 'working',
          status: `写入第 ${index + 1} 条 / ${prepared.chapters.length} 条`,
          detail: `${chapter.minutes}:${chapter.seconds}  ${chapter.title}`,
          current: index,
          total: prepared.chapters.length
        });
        await addChapter(modal, chapter);
      }

      progress().updatePanel({
        state: 'working',
        status: '确认章节内容',
        detail: '正在同步小红书输入状态...',
        current: prepared.chapters.length,
        total: prepared.chapters.length
      });
      await synchronizeChapters(modal, prepared.chapters, firstNewItemIndex);

      progress().updatePanel({
        state: 'working',
        status: '保存章节',
        detail: '正在保存小红书章节弹窗...',
        current: prepared.chapters.length,
        total: prepared.chapters.length
      });
      await saveModal(modal);

      progress().finishPanel('章节已保存', `已写入 ${prepared.chapters.length} 条章节；最终发布按钮未被点击。`);
      return {
        ok: true,
        message: `已写入 ${prepared.chapters.length} 条章节。`
      };
    } finally {
      running = false;
    }
  }

  function progress() {
    if (!globalThis.CreatorChapterProgress) {
      throw new Error('缺少进度面板模块，请重新加载插件。');
    }
    return globalThis.CreatorChapterProgress;
  }

  async function openChapterModal() {
    const existing = findChapterModal();
    if (existing) {
      return existing;
    }

    const trigger = findVisibleByText(document, '去添加', {
      selector: 'button, [role="button"], a, div, span'
    }) || findVisibleByText(document, '添加章节', {
      selector: 'button, [role="button"], a, div, span'
    });

    if (!trigger) {
      throw new Error('找不到“添加章节 / 去添加”入口，请确认视频已上传且页面已显示章节功能。');
    }

    clickElement(trigger);
    return waitFor(() => findChapterModal(), 6000, '点击“添加章节”后没有出现小红书章节弹窗。');
  }

  async function clearExistingChapters(modal) {
    const count = readChapterCount(modal);
    if (!count || count <= 0) {
      return;
    }

    const deleteButtons = findDeleteButtons(modal);
    if (deleteButtons.length < count) {
      throw new Error('小红书已有章节，但当前页面没有暴露稳定的删除控件。请先在弹窗里手动清空已有章节后重试。');
    }

    for (const button of deleteButtons.slice(0, count).reverse()) {
      clickElement(button);
      await sleep(200);
      await confirmSecondaryDialogIfPresent();
    }

    await waitFor(() => readChapterCount(modal) === 0, 3000, '清空已有章节后，章节数没有变为 0。');
  }

  async function addChapter(modal, chapter) {
    const beforeItems = getChapterItems(modal).length;
    const item = await addChapterItemWithRetry(modal, beforeItems);

    const minuteInput = await waitFor(() => getMinuteInput(item), 3000, '找不到分钟输入框。');
    const secondInput = await waitFor(() => getSecondInput(item), 3000, '找不到秒数输入框。');

    await fillValue(minuteInput, chapter.minutes);
    await fillValue(secondInput, chapter.seconds);

    await waitFor(
      () => findChapterItemsByTime(modal, chapter).length > 0,
      2000,
      `第 ${chapter.lineNumber} 行章节时间写入后，无法在小红书列表中重新定位当前行。`
    );
    await fillChapterTextByTime(modal, chapter);
    await sleep(120);
  }

  async function addChapterItemWithRetry(modal, beforeItems) {
    const startedAt = Date.now();
    let attempted = false;

    while (Date.now() - startedAt < 7000) {
      const existing = getChapterItems(modal);
      if (existing.length > beforeItems) {
        return existing[existing.length - 1];
      }

      const addButton = findAddChapterButton(modal);
      if (!addButton || isDisabled(addButton)) {
        await sleep(120);
        continue;
      }

      attempted = true;
      clickElement(addButton);

      const responseStartedAt = Date.now();
      while (Date.now() - responseStartedAt < 850) {
        const items = getChapterItems(modal);
        if (items.length > beforeItems) {
          return items[items.length - 1];
        }
        await sleep(100);
      }
    }

    throw new Error(attempted ? '点击“+ 添加章节”后没有出现新的章节输入行。' : '找不到“+ 添加章节”按钮。');
  }

  async function synchronizeChapters(modal, chapters, startIndex) {
    await waitFor(
      () => {
        const currentItems = getChapterItems(modal);
        return currentItems.length >= startIndex + chapters.length ? currentItems : null;
      },
      3000,
      '小红书章节行数量与待写入章节数量不一致。'
    );

    const maxPasses = 6;
    for (let pass = 0; pass < maxPasses; pass += 1) {
      const mismatches = findMismatchedIndexesByOrder(modal, chapters, startIndex);
      if (mismatches.length === 0) {
        await sleep(260);
        if (findMismatchedIndexesByOrder(modal, chapters, startIndex).length === 0) {
          return;
        }
      }

      for (const index of mismatches) {
        await fillChapterItemByOrder(modal, startIndex + index, chapters[index]);
      }
      await sleep(320);
    }

    const remaining = findMismatchedIndexesByOrder(modal, chapters, startIndex);
    throw new Error(`小红书页面没有保留全部章节输入值，未稳定行：${remaining.map((index) => index + 1).join('、')}。`);
  }

  async function fillChapterItemByOrder(modal, rowIndex, chapter) {
    let item = getChapterItems(modal)[rowIndex];

    if (!item) {
      throw new Error(`第 ${chapter.lineNumber} 行章节输入行不存在。`);
    }

    const minuteInput = getMinuteInput(item);
    const secondInput = getSecondInput(item);

    if (!minuteInput || !secondInput) {
      throw new Error(`第 ${chapter.lineNumber} 行章节输入框不完整。`);
    }

    if (!globalThis.XiaohongshuDomPolicy.chapterItemMatchesValues(readChapterItemValues(item), chapter, { includeTitle: false })) {
      await fillValue(minuteInput, chapter.minutes);
      await fillValue(secondInput, chapter.seconds);
      await sleep(160);
      item = getChapterItems(modal)[rowIndex] || item;
    }

    const titleInput = getTitleInput(item);
    if (!titleInput) {
      throw new Error(`第 ${chapter.lineNumber} 行章节名输入框不存在。`);
    }

    await fillValue(titleInput, chapter.title);
    titleInput.blur();

    const summaryInput = getSummaryInput(item);
    if (summaryInput) {
      await fillValue(summaryInput, chapter.summary);
      summaryInput.blur();
    }
  }

  async function fillChapterTextByTime(modal, chapter) {
    const items = findChapterItemsByTime(modal, chapter);
    if (items.length === 0) {
      throw new Error(`第 ${chapter.lineNumber} 行章节时间写入后，找不到对应章节行。`);
    }

    for (const item of items) {
      const titleInput = getTitleInput(item);
      if (!titleInput) {
        continue;
      }
      if (String(titleInput.value || '').trim() !== chapter.title) {
        await fillValue(titleInput, chapter.title);
        titleInput.blur();
      }

      const summaryInput = getSummaryInput(item);
      if (summaryInput && String(summaryInput.value || '').trim() !== chapter.summary) {
        await fillValue(summaryInput, chapter.summary);
        summaryInput.blur();
      }
    }
  }

  function chapterItemMatches(item, chapter) {
    if (!item || !globalThis.XiaohongshuDomPolicy) {
      return false;
    }

    return globalThis.XiaohongshuDomPolicy.chapterItemMatchesValues(readChapterItemValues(item), chapter);
  }

  async function saveModal(modal) {
    const saveButton = await waitFor(
      () => {
        const button = findVisibleByText(modal, '保存章节', {
          selector: 'button, [role="button"], div, span'
        }) || findVisibleByText(modal, '保存', {
          selector: 'button, [role="button"], div, span'
        });
        return button && !isDisabled(button) ? button : null;
      },
      5000,
      '保存章节按钮不可点击，页面可能没有接受章节改动。'
    );

    clickElement(saveButton);

    const startedAt = Date.now();
    while (Date.now() - startedAt < 6000) {
      const currentModal = findChapterModal();
      if (!currentModal) {
        return;
      }

      const validationProblems = findValidationProblems(currentModal);
      if (validationProblems.length > 0) {
        throw new Error(`小红书章节保存失败：${validationProblems.slice(0, 4).join('；')}。`);
      }

      await sleep(120);
    }

    throw new Error('点击保存后，小红书章节弹窗没有关闭；如果章节已经保存，请手动关闭弹窗。');
  }

  function findChapterModal() {
    const candidates = Array.from(
      document.querySelectorAll('.creator-chapter-content, [role="dialog"], .reds-modal, .semi-modal-content')
    )
      .filter(isVisible)
      .filter((element) => {
        const text = normalizeText(element.textContent);
        return (
          text.includes('章节信息') ||
          text.includes('已添加') ||
          text.includes('保存章节') ||
          Boolean(element.querySelector('input[placeholder="输入章节名称"]'))
        );
      });

    candidates.sort((a, b) => area(a) - area(b));
    return candidates[0] || null;
  }

  function getChapterItems(modal) {
    const classItems = Array.from(modal.querySelectorAll('.chapter-item')).filter(isVisible);
    if (classItems.length > 0) {
      return classItems;
    }

    const titleInputs = Array.from(modal.querySelectorAll('input[placeholder="输入章节名称"]')).filter(isVisible);
    return unique(
      titleInputs
        .map((input) => input.closest('.chapter-item') || input.closest('li') || input.parentElement)
        .filter(Boolean)
        .filter(isVisible)
    );
  }

  function findAddChapterButton(modal) {
    const nodes = Array.from(modal.querySelectorAll('button, [role="button"], div, span'))
      .filter(isVisible)
      .filter((node) => normalizeText(node.textContent).includes('添加章节'))
      .filter((node) => !node.closest('.chapter-item'));

    nodes.sort((a, b) => area(a) - area(b));
    return nodes[0] || null;
  }

  function findDeleteButtons(modal) {
    return Array.from(modal.querySelectorAll('button, [role="button"], [aria-label], svg, i'))
      .filter(isVisible)
      .filter((node) => {
        const text = normalizeText(node.textContent);
        const label = node.getAttribute('aria-label') || node.getAttribute('title') || '';
        const classes = String(node.className || '');
        return /删除|移除|delete|remove/i.test(`${text} ${label} ${classes}`);
      });
  }

  function getMinuteInput(item) {
    return item.querySelector('input.minutes-field') || item.querySelectorAll('input.time-field')[0] || null;
  }

  function getSecondInput(item) {
    const inputs = Array.from(item.querySelectorAll('input.time-field')).filter((input) => !input.classList.contains('minutes-field'));
    return inputs[0] || item.querySelectorAll('input[type="text"]')[1] || null;
  }

  function getTitleInput(item) {
    return item.querySelector('input[placeholder="输入章节名称"], input.title-field');
  }

  function getSummaryInput(item) {
    return item.querySelector(
      'textarea[placeholder="输入章节描述"], input[placeholder="输入章节描述"], textarea.summary-field, input.summary-field'
    );
  }

  function readChapterItemValues(item) {
    const minuteInput = item && getMinuteInput(item);
    const secondInput = item && getSecondInput(item);
    const titleInput = item && getTitleInput(item);
    const summaryInput = item && getSummaryInput(item);

    return {
      minutes: minuteInput ? minuteInput.value : '',
      seconds: secondInput ? secondInput.value : '',
      title: titleInput ? titleInput.value : '',
      summary: summaryInput ? summaryInput.value : ''
    };
  }

  function findChapterItemByTime(modal, chapter) {
    return findChapterItemsByTime(modal, chapter)[0] || null;
  }

  function findChapterItemsByTime(modal, chapter) {
    if (!globalThis.XiaohongshuDomPolicy) {
      return [];
    }

    return globalThis.XiaohongshuDomPolicy.findChapterItemsByTime(
      getChapterItems(modal),
      chapter,
      readChapterItemValues,
      { isConnected: (item) => Boolean(item && item.isConnected) }
    );
  }

  function findMismatchedIndexesByOrder(modal, chapters, startIndex) {
    if (!globalThis.XiaohongshuDomPolicy) {
      return chapters.map((_chapter, index) => index);
    }

    return globalThis.XiaohongshuDomPolicy.findMismatchedChapterIndexesByOrder(
      getChapterItems(modal),
      chapters,
      {
        startIndex,
        readValues: readChapterItemValues,
        includeSummary: supportsChapterSummary(modal)
      }
    );
  }

  function supportsChapterSummary(modal) {
    return Boolean(modal.querySelector(
      'textarea[placeholder="输入章节描述"], input[placeholder="输入章节描述"]'
    ));
  }

  function findValidationProblems(modal) {
    const problems = [];
    const items = getChapterItems(modal);

    items.forEach((item, index) => {
      const titleInput = getTitleInput(item);
      const minuteInput = getMinuteInput(item);
      const secondInput = getSecondInput(item);

      if (item.classList.contains('has-error')) {
        problems.push(`第 ${index + 1} 条章节有页面校验错误`);
      }
      if (titleInput && !String(titleInput.value || '').trim()) {
        problems.push(`第 ${index + 1} 条章节名为空`);
      }
      if (minuteInput && !/^\d+$/.test(String(minuteInput.value || ''))) {
        problems.push(`第 ${index + 1} 条分钟无效`);
      }
      if (secondInput && !/^\d+$/.test(String(secondInput.value || ''))) {
        problems.push(`第 ${index + 1} 条秒数无效`);
      }
    });

    return unique(problems);
  }

  function readChapterCount(modal) {
    const text = normalizeText(modal.textContent);
    const match = text.match(/已添加\s*(\d+)\s*个章节/);
    if (match) {
      return Number(match[1]);
    }
    return getChapterItems(modal).length;
  }

  function readDuration(modal) {
    const video = getVideo(modal);
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      return video.duration;
    }

    const text = normalizeText(modal.textContent);
    const match = text.match(/\d{1,2}:\d{2}(?::\d{2})?\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
    return match ? parseTimecode(match[1]) : null;
  }

  function getVideo(modal) {
    const candidates = unique([
      ...Array.from(modal.querySelectorAll('video')),
      ...Array.from(document.querySelectorAll('video'))
    ])
      .filter(isVisible)
      .filter((video) => Number.isFinite(video.duration) && video.duration > 0);

    candidates.sort((a, b) => area(b) - area(a));
    return candidates[0] || null;
  }

  function parseTimecode(value) {
    const parts = String(value || '').split(':').map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part))) {
      return null;
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  }

  function findDurationIssues(chapters, durationSeconds) {
    return chapters
      .filter((chapter) => typeof chapter.startSeconds === 'number' && chapter.startSeconds >= durationSeconds)
      .map((chapter) => ({
        lineNumber: chapter.lineNumber,
        message: '章节开始时间超出视频时长。'
      }));
  }

  async function confirmSecondaryDialogIfPresent() {
    const dialog = Array.from(document.querySelectorAll('[role="dialog"], .reds-modal, .semi-modal-content'))
      .filter(isVisible)
      .find((node) => {
        const text = normalizeText(node.textContent);
        return !node.querySelector('input[placeholder="输入章节名称"]') && /确认|清空|删除/.test(text);
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

  async function fillValue(element, value) {
    const text = String(value || '');
    element.focus();
    element.select();

    if (tryMainWorldFill(element, text)) {
      await sleep(60);
      if (String(element.value || '') === text) {
        clearFillAttributes(element);
        return;
      }
    }

    isolatedFillValue(element, text);
    await sleep(30);
    clearFillAttributes(element);
  }

  function tryMainWorldFill(element, value) {
    try {
      fillSequence += 1;
      const id = `cch-${Date.now()}-${fillSequence}`;
      element.setAttribute('data-cch-xhs-fill-id', id);
      element.setAttribute('data-cch-xhs-fill-value', value);
      window.dispatchEvent(new CustomEvent('cch:xhs-fill-value', { detail: id }));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function isolatedFillValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'value');
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

  function clearFillAttributes(element) {
    element.removeAttribute('data-cch-xhs-fill-id');
    element.removeAttribute('data-cch-xhs-fill-value');
  }

  function clickElement(element) {
    const target = globalThis.XiaohongshuDomPolicy && globalThis.XiaohongshuDomPolicy.resolveClickTarget
      ? globalThis.XiaohongshuDomPolicy.resolveClickTarget(element)
      : element;

    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
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
    if (!element || !(element instanceof Element) || !element.isConnected) {
      return false;
    }
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function isDisabled(element) {
    const disabledAncestor = element.closest(
      'button[disabled], [aria-disabled="true"], .disabled, .is-disabled'
    );

    return (
      Boolean(disabledAncestor) ||
      element.disabled === true ||
      element.getAttribute('aria-disabled') === 'true' ||
      /\bdisabled\b|is-disabled/.test(String(element.className || ''))
    );
  }

  function unique(values) {
    return [...new Set(values)];
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

  function createErrorContext(payload = {}) {
    const modal = findChapterModal();
    const prepared = (() => {
      try {
        const result = globalThis.XiaohongshuChapterPolicy.prepareXiaohongshuChapters(
          Array.isArray(payload.chapters) ? payload.chapters : [],
          payload.options || {}
        );
        return result.chapters.map((chapter, index) => ({
          index: index + 1,
          lineNumber: chapter.lineNumber,
          minutes: chapter.minutes,
          seconds: chapter.seconds,
          title: chapter.title,
          summary: chapter.summary
        }));
      } catch (_error) {
        return [];
      }
    })();
    const rows = modal ? getChapterItems(modal).map((item, index) => ({
      index: index + 1,
      className: String(item.className || ''),
      connected: Boolean(item.isConnected),
      values: readChapterItemValues(item),
      hasErrorClass: item.classList.contains('has-error'),
      rect: (() => {
        const rect = item.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })()
    })) : [];

    return {
      modalFound: Boolean(modal),
      chapterCountText: modal ? normalizeText(modal.textContent).match(/已添加\s*\d+\s*个章节/)?.[0] || '' : '',
      addButton: modal ? describeElement(findAddChapterButton(modal)) : null,
      rows,
      emptyRows: rows.filter((row) => !String(row.values.title || '').trim()).map((row) => row.index),
      expectedChapters: prepared,
      mismatchedRows: modal && prepared.length > 0 ? findMismatchedIndexesByOrder(modal, prepared, 0).map((index) => index + 1) : [],
      payloadChapterCount: Array.isArray(payload.chapters) ? payload.chapters.length : 0,
      options: payload.options || {}
    };
  }

  function describeElement(element) {
    if (!element) {
      return null;
    }

    const target = globalThis.XiaohongshuDomPolicy && globalThis.XiaohongshuDomPolicy.resolveClickTarget
      ? globalThis.XiaohongshuDomPolicy.resolveClickTarget(element)
      : element;
    const rect = target.getBoundingClientRect();

    return {
      text: normalizeText(element.textContent),
      targetTagName: target.tagName ? target.tagName.toLowerCase() : '',
      className: String(target.className || ''),
      disabled: isDisabled(target),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  }

  globalThis.CreatorChapterXiaohongshuAdapter = {
    id: 'xiaohongshu',
    displayName: '小红书',
    isSupportedPage,
    createErrorContext,
    handleImport
  };
})();
