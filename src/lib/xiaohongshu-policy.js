(function attachXiaohongshuPolicy(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.XiaohongshuChapterPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createXiaohongshuPolicy() {
  const XIAOHONGSHU_TITLE_LIMIT = 11;
  const XIAOHONGSHU_SUMMARY_LIMIT = 100;

  function chars(value) {
    return Array.from(String(value || ''));
  }

  function lengthOf(value) {
    return chars(value).length;
  }

  function truncate(value, limit) {
    return chars(value).slice(0, limit).join('');
  }

  function padTime(value, size) {
    return String(value).padStart(size, '0');
  }

  function collect(chapters, key) {
    return chapters.flatMap((chapter) =>
      chapter[key].map((message) => ({
        lineNumber: chapter.lineNumber,
        message
      }))
    );
  }

  function addWarning(chapter, message) {
    chapter.warnings.push(message);
  }

  function addError(chapter, message) {
    chapter.errors.push(message);
  }

  function selectTitle(source, target) {
    const title = String(source.title || '').trim();
    if (title) {
      return title;
    }

    const fallback = String(source.summary || '').trim();
    if (!fallback) {
      addError(target, '章节名不能为空。');
      return '';
    }

    addWarning(target, `章节名为空，已使用简介前 ${XIAOHONGSHU_TITLE_LIMIT} 个字。`);
    return truncate(fallback, XIAOHONGSHU_TITLE_LIMIT);
  }

  function prepareChapter(source, options) {
    const startSeconds = Number(source.startSeconds);
    const minutes = Math.floor(startSeconds / 60);
    const seconds = startSeconds % 60;
    const target = {
      ...source,
      title: '',
      minutes: padTime(minutes, 2),
      seconds: padTime(seconds, 2),
      warnings: Array.isArray(source.warnings) ? [...source.warnings] : [],
      errors: Array.isArray(source.errors) ? [...source.errors] : []
    };

    if (!Number.isFinite(startSeconds) || startSeconds < 0) {
      addError(target, '章节开始时间无效。');
      return target;
    }

    target.title = selectTitle(source, target);

    if (lengthOf(target.title) > XIAOHONGSHU_TITLE_LIMIT) {
      if (options.truncateTitle) {
        target.title = truncate(target.title, XIAOHONGSHU_TITLE_LIMIT);
        addWarning(target, `章节名已自动截断到 ${XIAOHONGSHU_TITLE_LIMIT} 个字。`);
      } else {
        addError(target, `章节名超过 ${XIAOHONGSHU_TITLE_LIMIT} 个字。`);
      }
    }

    if (lengthOf(target.summary) > XIAOHONGSHU_SUMMARY_LIMIT) {
      if (options.truncateSummary) {
        target.summary = truncate(target.summary, XIAOHONGSHU_SUMMARY_LIMIT);
        addWarning(target, `章节简介已自动截断到 ${XIAOHONGSHU_SUMMARY_LIMIT} 个字。`);
      } else {
        addError(target, `章节简介超过 ${XIAOHONGSHU_SUMMARY_LIMIT} 个字。`);
      }
    }

    return target;
  }

  function prepareXiaohongshuChapters(chapters, options = {}) {
    const nextChapters = chapters.map((chapter) => prepareChapter(chapter, options));

    return {
      chapters: nextChapters,
      warnings: collect(nextChapters, 'warnings'),
      errors: collect(nextChapters, 'errors')
    };
  }

  return {
    XIAOHONGSHU_SUMMARY_LIMIT,
    XIAOHONGSHU_TITLE_LIMIT,
    prepareXiaohongshuChapters
  };
});
