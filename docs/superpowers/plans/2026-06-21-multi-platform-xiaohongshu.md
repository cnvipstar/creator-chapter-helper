# 多平台与小红书章节支持实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将插件升级为“创作者章节助手”，保留抖音支持并新增小红书章节批量写入。

**Architecture:** 先抽出平台识别和平台数据策略，再把 content script 入口改成平台分发。抖音沿用现有自动化逻辑，小红书新增 adapter，popup 复用同一份解析和校验能力。

**Tech Stack:** Chrome Manifest V3、原生 HTML/CSS/JavaScript、Node.js `node:test`。

---

## Chunk 1：平台策略 TDD

### Task 1：平台识别和配置

**Files:**
- Create: `test/platform-registry.test.js`
- Create: `src/platforms/platform-registry.js`

- [ ] 写失败测试：识别抖音 URL、小红书 URL、未知 URL。
- [ ] 写失败测试：抖音标题限制 12，小红书标题限制 14，小红书不支持简介。
- [ ] 运行 `npm test`，确认失败。
- [ ] 实现 `detectPlatform(url)`、`getPlatformConfig(id)`。
- [ ] 运行 `npm test`，确认通过。

### Task 2：小红书章节投影

**Files:**
- Create: `test/xiaohongshu-policy.test.js`
- Create: `src/lib/xiaohongshu-policy.js`

- [ ] 写失败测试：开始秒数转分钟/秒字段。
- [ ] 写失败测试：章节名优先用 title。
- [ ] 写失败测试：title 为空时用 summary 前 14 字。
- [ ] 写失败测试：超长 title 在不开启截断时报错，开启截断时截断。
- [ ] 运行 `npm test`，确认失败。
- [ ] 实现 `prepareXiaohongshuChapters(chapters, options)`。
- [ ] 运行 `npm test`，确认通过。

---

## Chunk 2：content script 架构

### Task 3：抽公共进度面板

**Files:**
- Create: `src/content/platform-progress.js`
- Modify: `src/content/douyin.js`

- [ ] 把进度面板函数抽到 `platform-progress.js`。
- [ ] 保持抖音导入流程行为不变。
- [ ] 更新 manifest 和 extension runtime 注入顺序。
- [ ] 运行 `npm run check`。

### Task 4：新增统一入口

**Files:**
- Create: `src/content/index.js`
- Modify: `manifest.json`
- Modify: `src/lib/extension-runtime.js`

- [ ] 新增统一消息监听入口。
- [ ] 根据当前 URL 分发到抖音或小红书 adapter。
- [ ] 把原 `douyin.js` 暴露为 adapter API。
- [ ] 运行 `npm test` 和 `npm run check`。

---

## Chunk 3：小红书 adapter

### Task 5：实现小红书页面写入

**Files:**
- Create: `src/content/xiaohongshu-adapter.js`
- Modify: `manifest.json`
- Modify: `src/lib/extension-runtime.js`

- [ ] 实现打开“去添加”弹窗。
- [ ] 实现读取视频时长。
- [ ] 实现逐条点击“+ 添加章节”。
- [ ] 实现填分钟、秒和章节名。
- [ ] 实现点击“保存章节”。
- [ ] 对清空已有章节先做保守处理：如果已有章节且用户要求清空但找不到删除控件，给出中文错误。
- [ ] 运行 `npm run check`。

---

## Chunk 4：品牌与发布材料

### Task 6：重命名为创作者章节助手

**Files:**
- Modify: `manifest.json`
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `docs/chrome-web-store/listing.zh-CN.md`
- Modify: `docs/chrome-web-store/release-checklist.zh-CN.md`
- Modify: `package.json`
- Modify: `scripts/package-extension.sh`

- [ ] 把显示名改成“创作者章节助手”。
- [ ] 把包名改成 `creator-chapter-helper`。
- [ ] 文档说明支持抖音和小红书。
- [ ] 打包产物改成 `creator-chapter-helper-v<version>.zip`。

### Task 7：最终验证和打包

**Commands:**
- `npm test`
- `npm run check`
- `npm run package`
- `unzip -l dist/creator-chapter-helper-v0.1.0.zip`

- [ ] 运行全部验证。
- [ ] 检查 zip 只包含运行所需文件。
- [ ] 不提交 git，等待用户确认 commit message。

