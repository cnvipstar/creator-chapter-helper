(function attachExtensionRuntime(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.DouyinExtensionRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createExtensionRuntime() {
  const CONTENT_STYLE_FILES = ['src/content/douyin.css'];
  const MAIN_WORLD_SCRIPT_FILES = ['src/content/xiaohongshu-main-world.js'];
  const CONTENT_SCRIPT_FILES = [
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
  ];

  function errorMessage(error) {
    if (!error) {
      return '';
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error.message || error);
  }

  function isMissingReceiverError(error) {
    return /Receiving end does not exist/i.test(errorMessage(error));
  }

  return {
    CONTENT_SCRIPT_FILES,
    MAIN_WORLD_SCRIPT_FILES,
    CONTENT_STYLE_FILES,
    isMissingReceiverError
  };
});
