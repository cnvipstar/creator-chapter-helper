(function attachTextPolicy(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.DouyinTextPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTextPolicy() {
  const TITLE_LIMIT = 12;
  const SUMMARY_LIMIT = 100;

  function chars(value) {
    return Array.from(String(value || ''));
  }

  function truncate(value, limit) {
    return chars(value).slice(0, limit).join('');
  }

  function lengthOf(value) {
    return chars(value).length;
  }

  function cloneChapter(chapter) {
    return {
      ...chapter,
      warnings: Array.isArray(chapter.warnings) ? [...chapter.warnings] : [],
      errors: Array.isArray(chapter.errors) ? [...chapter.errors] : []
    };
  }

  function applyTextPolicy(chapter, options = {}) {
    const next = cloneChapter(chapter);
    const titleLimit = Number.isFinite(options.titleLimit) ? options.titleLimit : TITLE_LIMIT;
    const summaryLimit = Number.isFinite(options.summaryLimit) ? options.summaryLimit : SUMMARY_LIMIT;
    const supportsSummary = options.supportsSummary !== false;

    if (!String(next.title || '').trim()) {
      next.errors.push('章节名不能为空。');
    }

    if (lengthOf(next.title) > titleLimit) {
      if (options.truncateTitle) {
        next.title = truncate(next.title, titleLimit);
        next.warnings.push(`章节名已自动截断到 ${titleLimit} 个字。`);
      } else {
        next.errors.push(`章节名超过 ${titleLimit} 个字。`);
      }
    }

    if (supportsSummary && lengthOf(next.summary) > summaryLimit) {
      if (options.truncateSummary) {
        next.summary = truncate(next.summary, summaryLimit);
        next.warnings.push(`章节简介已自动截断到 ${summaryLimit} 个字。`);
      } else {
        next.errors.push(`章节简介超过 ${summaryLimit} 个字。`);
      }
    }

    return next;
  }

  function addError(chapter, message) {
    chapter.errors.push(message);
  }

  function validateChapters(chapters, options = {}) {
    const seenStarts = new Set();
    let previousStart = null;

    const nextChapters = chapters.map((chapter) => {
      const next = applyTextPolicy(chapter, options);
      const start = next.startSeconds;
      const end = next.endSeconds;

      if (typeof start === 'number') {
        if (seenStarts.has(start)) {
          addError(next, '章节开始时间重复。');
        }
        seenStarts.add(start);

        if (typeof previousStart === 'number' && start < previousStart) {
          addError(next, '章节开始时间早于上一条。');
        }
        previousStart = start;
      }

      if (typeof options.durationSeconds === 'number' && Number.isFinite(options.durationSeconds)) {
        if (typeof start === 'number' && start >= options.durationSeconds) {
          addError(next, '章节开始时间超出视频时长。');
        }
        if (typeof end === 'number' && end > options.durationSeconds) {
          addError(next, '章节结束时间超出视频时长。');
        }
      }

      return next;
    });

    return {
      chapters: nextChapters,
      warnings: collect(nextChapters, 'warnings'),
      errors: collect(nextChapters, 'errors')
    };
  }

  function collect(chapters, key) {
    return chapters.flatMap((chapter) =>
      chapter[key].map((message) => ({
        lineNumber: chapter.lineNumber,
        message
      }))
    );
  }

  return {
    TITLE_LIMIT,
    SUMMARY_LIMIT,
    applyTextPolicy,
    validateChapters
  };
});
