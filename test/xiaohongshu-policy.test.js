const assert = require('node:assert/strict');
const test = require('node:test');

const {
  XIAOHONGSHU_SUMMARY_LIMIT,
  XIAOHONGSHU_TITLE_LIMIT,
  prepareXiaohongshuChapters
} = require('../src/lib/xiaohongshu-policy');

function chapter(overrides = {}) {
  return {
    rawLine: '- 01:05-01:28｜阶段二总结：把规划基石阶段串成一张考试作战地图。',
    lineNumber: 1,
    startSeconds: 65,
    endSeconds: 88,
    title: '阶段二总结',
    summary: '把规划基石阶段串成一张考试作战地图。',
    warnings: [],
    errors: [],
    ...overrides
  };
}

test('projects start seconds to Xiaohongshu minute and second fields', () => {
  const result = prepareXiaohongshuChapters([chapter({ startSeconds: 125 })]);

  assert.equal(result.errors.length, 0);
  assert.deepEqual(
    {
      minutes: result.chapters[0].minutes,
      seconds: result.chapters[0].seconds
    },
    {
      minutes: '02',
      seconds: '05'
    }
  );
});

test('uses parsed title as the Xiaohongshu chapter name', () => {
  const result = prepareXiaohongshuChapters([chapter({ title: '核心流程总览' })]);

  assert.equal(result.chapters[0].title, '核心流程总览');
});

test('uses summary when title is empty and truncates fallback to 11 chars', () => {
  const result = prepareXiaohongshuChapters([
    chapter({
      title: '',
      summary: '这是一个超过十一个字的小红书章节名'
    })
  ]);

  assert.equal(XIAOHONGSHU_TITLE_LIMIT, 11);
  assert.equal(result.errors.length, 0);
  assert.equal(result.chapters[0].title, '这是一个超过十一个字的');
  assert.match(result.warnings[0].message, /已使用简介前 11 个字/);
});

test('reports overlong titles unless truncation is enabled', () => {
  const overlong = chapter({ title: '一二三四五六七八九十甲乙丙丁戊' });

  const strict = prepareXiaohongshuChapters([overlong], {
    truncateTitle: false
  });
  assert.equal(strict.errors.length, 1);
  assert.match(strict.errors[0].message, /章节名超过 11 个字/);

  const truncated = prepareXiaohongshuChapters([overlong], {
    truncateTitle: true
  });
  assert.equal(truncated.errors.length, 0);
  assert.equal(truncated.chapters[0].title, '一二三四五六七八九十甲');
  assert.match(truncated.warnings[0].message, /章节名已自动截断/);
});

test('keeps chapter descriptions up to 100 chars', () => {
  const summary = '简'.repeat(100);
  const result = prepareXiaohongshuChapters([chapter({ summary })]);

  assert.equal(XIAOHONGSHU_SUMMARY_LIMIT, 100);
  assert.equal(result.errors.length, 0);
  assert.equal(result.chapters[0].summary, summary);
});

test('reports or truncates chapter descriptions over 100 chars', () => {
  const overlong = chapter({ summary: '长'.repeat(101) });
  const strict = prepareXiaohongshuChapters([overlong], {
    truncateSummary: false
  });
  assert.match(strict.errors[0].message, /章节简介超过 100 个字/);

  const truncated = prepareXiaohongshuChapters([overlong], {
    truncateSummary: true
  });
  assert.equal(truncated.errors.length, 0);
  assert.equal(truncated.chapters[0].summary, '长'.repeat(100));
  assert.match(truncated.warnings[0].message, /章节简介已自动截断/);
});
