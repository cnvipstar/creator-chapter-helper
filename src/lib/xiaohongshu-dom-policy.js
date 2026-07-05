(function attachXiaohongshuDomPolicy(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.XiaohongshuDomPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createXiaohongshuDomPolicy() {
  function normalizeTimeField(value, size) {
    const text = String(value || '').trim();
    if (!/^\d+$/.test(text)) {
      return '';
    }
    return String(Number(text)).padStart(size, '0');
  }

  function chapterItemMatchesValues(values, chapter, options = {}) {
    const includeTitle = options.includeTitle !== false;
    const sameTime = (
      normalizeTimeField(values && values.minutes, 2) === normalizeTimeField(chapter && chapter.minutes, 2) &&
      normalizeTimeField(values && values.seconds, 2) === normalizeTimeField(chapter && chapter.seconds, 2)
    );

    if (!sameTime) {
      return false;
    }

    return !includeTitle || String((values && values.title) || '').trim() === String((chapter && chapter.title) || '').trim();
  }

  function findChapterItemByTime(items, chapter, readValues, options = {}) {
    return findChapterItemsByTime(items, chapter, readValues, options)[0] || null;
  }

  function findChapterItemsByTime(items, chapter, readValues, options = {}) {
    const isConnected = options.isConnected || (() => true);
    const reader = typeof readValues === 'function' ? readValues : (item) => item;

    return Array.from(items || []).filter((item) =>
      isConnected(item) &&
      chapterItemMatchesValues(reader(item), chapter, { includeTitle: false })
    );
  }

  function findMismatchedChapterIndexesByOrder(rows, chapters, options = {}) {
    const startIndex = options.startIndex || 0;
    const readValues = typeof options.readValues === 'function' ? options.readValues : (row) => row;

    return Array.from(chapters || []).reduce((indexes, chapter, index) => {
      const row = Array.from(rows || [])[startIndex + index];
      if (!chapterItemMatchesValues(readValues(row), chapter)) {
        indexes.push(index);
      }
      return indexes;
    }, []);
  }

  function resolveClickTarget(element) {
    if (!element || typeof element.closest !== 'function') {
      return element || null;
    }

    return element.closest('button, [role="button"], a') || element;
  }

  return {
    chapterItemMatchesValues,
    findChapterItemsByTime,
    findChapterItemByTime,
    findMismatchedChapterIndexesByOrder,
    normalizeTimeField,
    resolveClickTarget
  };
});
