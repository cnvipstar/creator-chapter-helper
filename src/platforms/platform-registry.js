(function attachPlatformRegistry(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.CreatorChapterPlatforms = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPlatformRegistry() {
  const PLATFORMS = [
    {
      id: 'douyin',
      displayName: '抖音',
      titleLimit: 12,
      summaryLimit: 100,
      supportsSummary: true,
      urlPatterns: ['https://creator.douyin.com/']
    },
    {
      id: 'xiaohongshu',
      displayName: '小红书',
      titleLimit: 11,
      summaryLimit: 100,
      supportsSummary: true,
      urlPatterns: ['https://creator.xiaohongshu.com/']
    }
  ];

  function normalizeUrl(url) {
    if (url && typeof url === 'object' && typeof url.href === 'string') {
      return url.href;
    }
    return String(url || '');
  }

  function clonePlatform(platform) {
    return platform ? { ...platform, urlPatterns: [...platform.urlPatterns] } : null;
  }

  function detectPlatform(url) {
    const href = normalizeUrl(url);
    const platform = PLATFORMS.find((candidate) =>
      candidate.urlPatterns.some((pattern) => href.startsWith(pattern))
    );

    return clonePlatform(platform);
  }

  function getPlatformConfig(id) {
    return clonePlatform(PLATFORMS.find((platform) => platform.id === id));
  }

  return {
    detectPlatform,
    getPlatformConfig
  };
});
