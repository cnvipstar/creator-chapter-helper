(function attachChapterParser(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.DouyinChapterParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createChapterParser() {
  const TIME_PATTERN = '(?:\\d{1,2}:)?\\d{1,3}:\\d{2}';
  const RANGE_PATTERN = new RegExp(`^(${TIME_PATTERN})\\s*(?:-|–|—|~|至|到)\\s*(${TIME_PATTERN})(.*)$`);

  function toChars(value) {
    return Array.from(String(value || ''));
  }

  function stripListMarker(line) {
    return line
      .trim()
      .replace(/^(?:[-*•·]+|[0-9]+[.)、]|[一二三四五六七八九十]+[.)、])\s*/, '')
      .trim();
  }

  function parseTimeToSeconds(value) {
    const parts = String(value || '')
      .trim()
      .split(':');

    if (parts.length !== 2 && parts.length !== 3) {
      return null;
    }

    if (parts.some((part) => !/^\d+$/.test(part))) {
      return null;
    }

    const nums = parts.map(Number);

    if (nums.some((num) => !Number.isFinite(num) || num < 0)) {
      return null;
    }

    if (parts.length === 2) {
      const [minutes, seconds] = nums;
      if (seconds > 59) {
        return null;
      }
      return minutes * 60 + seconds;
    }

    const [hours, minutes, seconds] = nums;
    if (minutes > 59 || seconds > 59) {
      return null;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }

  function splitTitleAndSummary(rest) {
    const titleSummary = rest.replace(/^[|｜]\s*/, '').trim();
    const separators = [titleSummary.indexOf('：'), titleSummary.indexOf(':')]
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);

    if (separators.length === 0) {
      return {
        title: toChars(titleSummary).slice(0, 12).join(''),
        summary: titleSummary,
        warnings: ['未找到章节名和简介分隔符，已用正文前 12 个字作为章节名。']
      };
    }

    const separatorIndex = separators[0];
    const title = titleSummary.slice(0, separatorIndex).trim();
    const summary = titleSummary.slice(separatorIndex + 1).trim();

    return {
      title,
      summary,
      warnings: []
    };
  }

  function createMalformedChapter(rawLine, lineNumber, message) {
    return {
      rawLine,
      lineNumber,
      startSeconds: null,
      endSeconds: null,
      title: '',
      summary: '',
      warnings: [],
      errors: [message]
    };
  }

  function parseLine(rawLine, lineNumber) {
    const line = stripListMarker(rawLine);
    const rangeMatch = line.match(RANGE_PATTERN);

    if (!rangeMatch) {
      return createMalformedChapter(rawLine, lineNumber, '无法识别时间范围。');
    }

    const startSeconds = parseTimeToSeconds(rangeMatch[1]);
    const endSeconds = parseTimeToSeconds(rangeMatch[2]);

    if (startSeconds === null || endSeconds === null) {
      return createMalformedChapter(rawLine, lineNumber, '时间格式无效。');
    }

    const rest = rangeMatch[3].trim();
    if (!rest) {
      return createMalformedChapter(rawLine, lineNumber, '缺少章节名和简介。');
    }

    const errors = [];
    if (endSeconds <= startSeconds) {
      errors.push('时间范围结束必须晚于开始。');
    }

    const split = splitTitleAndSummary(rest);

    return {
      rawLine,
      lineNumber,
      startSeconds,
      endSeconds,
      title: split.title,
      summary: split.summary,
      warnings: split.warnings,
      errors
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

  function parseChapterText(text) {
    const chapters = String(text || '')
      .split(/\r?\n/)
      .map((line, index) => ({ rawLine: line.trim(), lineNumber: index + 1 }))
      .filter((item) => item.rawLine.length > 0)
      .map((item) => parseLine(item.rawLine, item.lineNumber));

    return {
      chapters,
      warnings: collect(chapters, 'warnings'),
      errors: collect(chapters, 'errors')
    };
  }

  return {
    parseChapterText,
    parseTimeToSeconds
  };
});
