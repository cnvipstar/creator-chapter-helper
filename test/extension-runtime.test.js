const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAIN_WORLD_SCRIPT_FILES,
  CONTENT_SCRIPT_FILES,
  CONTENT_STYLE_FILES,
  isMissingReceiverError
} = require('../src/lib/extension-runtime');

test('detects Chrome missing receiver errors', () => {
  assert.equal(
    isMissingReceiverError(new Error('Could not establish connection. Receiving end does not exist.')),
    true
  );
  assert.equal(isMissingReceiverError('Receiving end does not exist'), true);
  assert.equal(isMissingReceiverError(new Error('Some other extension error')), false);
  assert.equal(isMissingReceiverError(null), false);
});

test('keeps manual injection files in dependency order', () => {
  assert.deepEqual(CONTENT_STYLE_FILES, ['src/content/douyin.css']);
  assert.deepEqual(MAIN_WORLD_SCRIPT_FILES, ['src/content/xiaohongshu-main-world.js']);
  assert.deepEqual(CONTENT_SCRIPT_FILES, [
    'src/platforms/platform-registry.js',
    'src/lib/error-logger.js',
    'src/lib/chapter-parser.js',
    'src/lib/text-policy.js',
    'src/lib/xiaohongshu-policy.js',
    'src/lib/xiaohongshu-dom-policy.js',
    'src/lib/douyin-automation-policy.js',
    'src/content/platform-progress.js',
    'src/content/douyin.js',
    'src/content/xiaohongshu-adapter.js',
    'src/content/index.js'
  ]);
});
