const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TITLE_LIMIT,
  SUMMARY_LIMIT,
  applyTextPolicy,
  validateChapters
} = require('../src/lib/text-policy');

function chapter(overrides = {}) {
  return {
    rawLine: '- 00:05-00:28｜标题：简介',
    lineNumber: 1,
    startSeconds: 5,
    endSeconds: 28,
    title: '阶段二总结',
    summary: '把规划基石阶段串成一张考试作战地图。',
    warnings: [],
    errors: [],
    ...overrides
  };
}

test('keeps valid title and summary unchanged', () => {
  const valid = chapter({
    title: '一二三四五六七八九十甲乙',
    summary: 'a'.repeat(SUMMARY_LIMIT)
  });

  const result = applyTextPolicy(valid, {
    truncateTitle: false,
    truncateSummary: false
  });

  assert.equal(TITLE_LIMIT, 12);
  assert.equal(result.title, valid.title);
  assert.equal(result.summary, valid.summary);
  assert.deepEqual(result.errors, []);
});

test('reports title and summary length errors when truncation is disabled', () => {
  const invalid = chapter({
    title: '一二三四五六七八九十甲乙丙',
    summary: 'a'.repeat(SUMMARY_LIMIT + 1)
  });

  const result = applyTextPolicy(invalid, {
    truncateTitle: false,
    truncateSummary: false
  });

  assert.equal(result.title, invalid.title);
  assert.equal(result.summary, invalid.summary);
  assert.match(result.errors[0], /章节名超过 12 个字/);
  assert.match(result.errors[1], /章节简介超过 100 个字/);
});

test('truncates title and summary when truncation is enabled', () => {
  const invalid = chapter({
    title: '一二三四五六七八九十甲乙丙',
    summary: 'b'.repeat(SUMMARY_LIMIT + 5)
  });

  const result = applyTextPolicy(invalid, {
    truncateTitle: true,
    truncateSummary: true
  });

  assert.equal(result.title, '一二三四五六七八九十甲乙');
  assert.equal(result.summary, 'b'.repeat(SUMMARY_LIMIT));
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings[0], /章节名已自动截断/);
  assert.match(result.warnings[1], /章节简介已自动截断/);
});

test('validates duplicate starts, out-of-order starts, and video duration', () => {
  const chapters = [
    chapter({ lineNumber: 1, startSeconds: 10, endSeconds: 20 }),
    chapter({ lineNumber: 2, startSeconds: 10, endSeconds: 18 }),
    chapter({ lineNumber: 3, startSeconds: 8, endSeconds: 12 }),
    chapter({ lineNumber: 4, startSeconds: 90, endSeconds: 110 })
  ];

  const result = validateChapters(chapters, {
    truncateTitle: false,
    truncateSummary: false,
    durationSeconds: 100
  });

  assert.equal(result.chapters.length, 4);
  assert.equal(result.errors.length, 3);
  assert.deepEqual(
    result.errors.map((error) => error.lineNumber),
    [2, 3, 4]
  );
  assert.match(result.errors[0].message, /重复/);
  assert.match(result.errors[1].message, /早于上一条/);
  assert.match(result.errors[2].message, /超出视频时长/);
});

test('accepts platform-specific title limit and disables summary validation', () => {
  const xiaohongshuChapter = chapter({
    title: '一二三四五六七八九十甲乙丙丁',
    summary: 'a'.repeat(SUMMARY_LIMIT + 50)
  });

  const result = applyTextPolicy(xiaohongshuChapter, {
    titleLimit: 14,
    supportsSummary: false,
    truncateTitle: false,
    truncateSummary: false
  });

  assert.equal(result.title, xiaohongshuChapter.title);
  assert.deepEqual(result.errors, []);
});
