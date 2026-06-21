const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseChapterText,
  parseTimeToSeconds
} = require('../src/lib/chapter-parser');

test('parses the Douyin chapter format used by the user', () => {
  const input = [
    '- 00:05-00:28｜阶段二总结：把规划基石阶段串成一张考试作战地图。',
    '- 00:28-00:49｜阶段二从建体系到会规划：ISP 定方向，TOGAF 画蓝图。'
  ].join('\n');

  const result = parseChapterText(input);

  assert.equal(result.errors.length, 0);
  assert.equal(result.chapters.length, 2);
  assert.deepEqual(result.chapters[0], {
    rawLine: '- 00:05-00:28｜阶段二总结：把规划基石阶段串成一张考试作战地图。',
    lineNumber: 1,
    startSeconds: 5,
    endSeconds: 28,
    title: '阶段二总结',
    summary: '把规划基石阶段串成一张考试作战地图。',
    warnings: [],
    errors: []
  });
  assert.equal(result.chapters[1].startSeconds, 28);
  assert.equal(result.chapters[1].endSeconds, 49);
});

test('supports bullets, ASCII separators, whitespace, and hour timestamps', () => {
  const input = [
    '* 1:05 - 1:28 | Case Study: summary text',
    '1. 01:02:03-01:03:20  Long Session：跨小时章节'
  ].join('\n');

  const result = parseChapterText(input);

  assert.equal(result.errors.length, 0);
  assert.equal(result.chapters[0].startSeconds, 65);
  assert.equal(result.chapters[0].endSeconds, 88);
  assert.equal(result.chapters[0].title, 'Case Study');
  assert.equal(result.chapters[0].summary, 'summary text');
  assert.equal(result.chapters[1].startSeconds, 3723);
  assert.equal(result.chapters[1].endSeconds, 3800);
  assert.equal(result.chapters[1].title, 'Long Session');
  assert.equal(result.chapters[1].summary, '跨小时章节');
});

test('creates a warning and default title when title-summary separator is missing', () => {
  const input = '- 00:10-00:20｜没有分隔符的完整章节说明还有更多内容';

  const result = parseChapterText(input);

  assert.equal(result.errors.length, 0);
  assert.equal(result.chapters[0].title, '没有分隔符的完整章节说明');
  assert.equal(result.chapters[0].summary, '没有分隔符的完整章节说明还有更多内容');
  assert.match(result.chapters[0].warnings[0], /未找到章节名和简介分隔符/);
});

test('reports malformed lines without discarding line numbers', () => {
  const input = [
    '- 00:05-00:28｜有效标题：有效简介',
    '- 时间坏了｜标题：简介'
  ].join('\n');

  const result = parseChapterText(input);

  assert.equal(result.chapters.length, 2);
  assert.equal(result.chapters[1].lineNumber, 2);
  assert.equal(result.chapters[1].errors.length, 1);
  assert.match(result.chapters[1].errors[0], /无法识别时间范围/);
  assert.equal(result.errors.length, 1);
});

test('parses timestamps into seconds', () => {
  assert.equal(parseTimeToSeconds('00:05'), 5);
  assert.equal(parseTimeToSeconds('1:05'), 65);
  assert.equal(parseTimeToSeconds('01:02:03'), 3723);
  assert.equal(parseTimeToSeconds(' 03:07 '), 187);
  assert.equal(parseTimeToSeconds('bad'), null);
});
