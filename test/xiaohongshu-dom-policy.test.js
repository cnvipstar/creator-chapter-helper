const assert = require('node:assert/strict');
const test = require('node:test');

const {
  chapterItemMatchesValues,
  findChapterItemsByTime,
  findChapterItemByTime,
  findMismatchedChapterIndexesByOrder,
  normalizeTimeField
} = require('../src/lib/xiaohongshu-dom-policy');

test('normalizes Xiaohongshu time inputs before comparing rows', () => {
  assert.equal(normalizeTimeField('4', 2), '04');
  assert.equal(normalizeTimeField(' 10 ', 2), '10');
  assert.equal(normalizeTimeField('bad', 2), '');
});

test('finds the connected current row by chapter time instead of stale row references', () => {
  const staleRow = {
    connected: false,
    values: { minutes: '00', seconds: '10', title: '写在旧节点上的标题' }
  };
  const currentRow = {
    connected: true,
    values: { minutes: '0', seconds: '10', title: '' }
  };

  const result = findChapterItemByTime(
    [staleRow, currentRow],
    { minutes: '00', seconds: '10' },
    (row) => row.values,
    { isConnected: (row) => row.connected }
  );

  assert.equal(result, currentRow);
});

test('distinguishes time match from complete chapter match', () => {
  const row = { minutes: '00', seconds: '10', title: '' };
  const chapter = { minutes: '00', seconds: '10', title: '生命周期的四个阶段' };

  assert.equal(chapterItemMatchesValues(row, chapter, { includeTitle: false }), true);
  assert.equal(chapterItemMatchesValues(row, chapter), false);
});

test('returns every connected row matching the same time so duplicates can be synchronized', () => {
  const rows = [
    { connected: true, values: { minutes: '00', seconds: '13', title: '' } },
    { connected: true, values: { minutes: '0', seconds: '13', title: '写在另一份 DOM 上' } },
    { connected: true, values: { minutes: '00', seconds: '26', title: '' } }
  ];

  const result = findChapterItemsByTime(
    rows,
    { minutes: '00', seconds: '13' },
    (row) => row.values,
    { isConnected: (row) => row.connected }
  );

  assert.deepEqual(result, [rows[0], rows[1]]);
});

test('finds mismatched rows by current visual order after Xiaohongshu reuses DOM nodes', () => {
  const rows = [
    { minutes: '00', seconds: '05', title: 'ITIL（中）' },
    { minutes: '00', seconds: '20', title: '' },
    { minutes: '00', seconds: '26', title: '事件管理只追求一件事' }
  ];
  const chapters = [
    { minutes: '00', seconds: '05', title: 'ITIL（中）' },
    { minutes: '00', seconds: '20', title: '服务台是事件入口' },
    { minutes: '00', seconds: '26', title: '事件管理只追求一件事' }
  ];

  assert.deepEqual(findMismatchedChapterIndexesByOrder(rows, chapters), [1]);
});
