const assert = require('node:assert/strict');
const test = require('node:test');

const {
  appendEntryToState,
  formatErrorLogs,
  todayKey
} = require('../src/lib/error-logger');

test('keeps only logs from the current day', () => {
  const state = {
    date: '2026-06-20',
    entries: [{ message: '昨天的错误' }]
  };

  const next = appendEntryToState(state, { message: '今天的错误' }, {
    now: new Date('2026-06-21T08:00:00+08:00')
  });

  assert.equal(next.date, '2026-06-21');
  assert.equal(next.entries.length, 1);
  assert.equal(next.entries[0].message, '今天的错误');
});

test('caps error log entries to avoid unbounded local storage growth', () => {
  const entries = Array.from({ length: 120 }, (_, index) => ({ message: `错误 ${index}` }));
  const next = appendEntryToState({ date: '2026-06-21', entries }, { message: '最新错误' }, {
    maxEntries: 100,
    now: new Date('2026-06-21T08:00:00+08:00')
  });

  assert.equal(next.entries.length, 100);
  assert.equal(next.entries[0].message, '错误 21');
  assert.equal(next.entries[99].message, '最新错误');
});

test('formats logs as readable Chinese text for copying', () => {
  const text = formatErrorLogs({
    date: todayKey(),
    entries: [
      {
        time: '2026-06-21T00:00:00.000Z',
        platformName: '小红书',
        source: 'content',
        message: '写入失败',
        context: { emptyRows: [2, 4] }
      }
    ]
  });

  assert.match(text, /创作者章节助手错误日志/);
  assert.match(text, /小红书/);
  assert.match(text, /写入失败/);
  assert.match(text, /emptyRows/);
});
