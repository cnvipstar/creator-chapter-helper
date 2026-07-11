const assert = require('node:assert/strict');
const test = require('node:test');

const {
  detectPlatform,
  getPlatformConfig
} = require('../src/platforms/platform-registry');

test('detects supported creator center URLs', () => {
  assert.equal(
    detectPlatform('https://creator.douyin.com/creator-micro/content/post/video?enter_from=publish_page').id,
    'douyin'
  );
  assert.equal(
    detectPlatform('https://creator.xiaohongshu.com/publish/publish?from=menu&target=video').id,
    'xiaohongshu'
  );
  assert.equal(detectPlatform('https://example.com/upload'), null);
});

test('returns platform-specific chapter limits', () => {
  const douyin = getPlatformConfig('douyin');
  const xiaohongshu = getPlatformConfig('xiaohongshu');

  assert.equal(douyin.displayName, '抖音');
  assert.equal(douyin.titleLimit, 12);
  assert.equal(douyin.summaryLimit, 100);
  assert.equal(douyin.supportsSummary, true);

  assert.equal(xiaohongshu.displayName, '小红书');
  assert.equal(xiaohongshu.titleLimit, 11);
  assert.equal(xiaohongshu.summaryLimit, 100);
  assert.equal(xiaohongshu.supportsSummary, true);
});
