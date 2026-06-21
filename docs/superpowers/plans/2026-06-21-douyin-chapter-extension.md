# 抖音视频章节助手 Chrome 插件实施计划

> **给执行代理的要求：** 按步骤执行。当前工作区不是 git 仓库，因此不执行提交步骤；如果后续初始化 git 或提交代码，必须先让用户确认 commit message，且提交信息不得包含任何 AI 或 Codex 署名。

**目标：** 构建一个本地可加载的 Chrome MV3 插件，把粘贴的章节文本解析、预览并写入抖音创作者中心视频章节弹窗。

**架构：** 采用无构建工具的 Manifest V3 插件。解析器和文本策略是可在 Node 测试与浏览器插件中复用的普通 JavaScript 模块；popup 负责输入、预览和下发命令；content script 负责抖音页面识别、章节弹窗操作和进度面板。

**技术栈：** Chrome Manifest V3、原生 HTML/CSS/JavaScript、Node.js 内置 `node:test`。

---

## 文件结构

- 创建 `package.json`：项目脚本和 Node 测试入口。
- 创建 `manifest.json`：Chrome 插件清单。
- 创建 `src/lib/chapter-parser.js`：解析章节文本，导出浏览器全局对象和 CommonJS API。
- 创建 `src/lib/text-policy.js`：校验和处理章节名/简介长度。
- 创建 `src/popup/popup.html`：插件弹窗结构。
- 创建 `src/popup/popup.css`：弹窗视觉样式。
- 创建 `src/popup/popup.js`：弹窗交互、预览和消息发送。
- 创建 `src/content/douyin.css`：页面内进度面板样式。
- 创建 `src/content/douyin.js`：抖音页面自动化。
- 创建 `test/chapter-parser.test.js`：解析器单元测试。
- 创建 `test/text-policy.test.js`：文本策略单元测试。
- 创建 `README.md`：中文安装和使用说明。

---

## Chunk 1：测试脚手架和解析器 TDD

### Task 1：创建项目脚本

**文件：**
- 创建：`package.json`

- [ ] 创建 `package.json`，加入 `npm test` 脚本。
- [ ] 运行 `npm test`，预期因为还没有测试文件而无有效覆盖；随后进入测试优先开发。

### Task 2：先写解析器失败测试

**文件：**
- 创建：`test/chapter-parser.test.js`

- [ ] 写测试覆盖用户样例格式、英文/中文分隔符、项目符号、`hh:mm:ss`、坏时间格式。
- [ ] 运行 `npm test`。
- [ ] 预期失败原因：`src/lib/chapter-parser.js` 尚不存在或导出函数不存在。

### Task 3：实现最小解析器

**文件：**
- 创建：`src/lib/chapter-parser.js`

- [ ] 实现 `parseChapterText(text)`。
- [ ] 实现 `parseTimeToSeconds(value)`。
- [ ] 同时支持 CommonJS 和浏览器全局 `DouyinChapterParser`。
- [ ] 运行 `npm test`，预期解析器测试通过。

---

## Chunk 2：文本策略 TDD

### Task 4：先写文本策略失败测试

**文件：**
- 创建：`test/text-policy.test.js`

- [ ] 写测试覆盖 12 字章节名、100 字简介、不开启截断时报错、开启截断时稳定截断。
- [ ] 运行 `npm test`。
- [ ] 预期失败原因：`src/lib/text-policy.js` 尚不存在或导出函数不存在。

### Task 5：实现文本策略

**文件：**
- 创建：`src/lib/text-policy.js`

- [ ] 实现 `applyTextPolicy(chapter, options)`。
- [ ] 实现 `validateChapters(chapters, options)`。
- [ ] 同时支持 CommonJS 和浏览器全局 `DouyinTextPolicy`。
- [ ] 运行 `npm test`，预期全部单元测试通过。

---

## Chunk 3：Chrome 插件清单和弹窗

### Task 6：创建插件清单

**文件：**
- 创建：`manifest.json`

- [ ] 定义 MV3 清单。
- [ ] 配置 `action.default_popup` 指向 `src/popup/popup.html`。
- [ ] 配置 `content_scripts` 匹配 `https://creator.douyin.com/*`，加载解析器、文本策略、content script 和 CSS。
- [ ] 配置最小权限：`activeTab` 和 `host_permissions`。

### Task 7：创建弹窗 UI

**文件：**
- 创建：`src/popup/popup.html`
- 创建：`src/popup/popup.css`
- 创建：`src/popup/popup.js`

- [ ] 弹窗包含粘贴区、预览表、选项和写入按钮。
- [ ] 输入变化时即时解析和校验。
- [ ] 无错误时允许点击“写入抖音章节”。
- [ ] 点击按钮后向当前标签页发送 `DCH_IMPORT_CHAPTERS` 消息。
- [ ] 如果当前页面不匹配或 content script 未响应，显示中文错误。

---

## Chunk 4：抖音 content script

### Task 8：页面检测和进度面板

**文件：**
- 创建：`src/content/douyin.css`
- 创建：`src/content/douyin.js`

- [ ] 实现 `isSupportedPage()`。
- [ ] 实现 `showPanel()`、`updatePanel()`、`finishPanel()`。
- [ ] 监听 popup 消息。
- [ ] 对 dry-run 只显示校验结果，不改动页面。

### Task 9：章节弹窗自动化

**文件：**
- 修改：`src/content/douyin.js`

- [ ] 实现查找“视频章节 / 去编辑”并打开弹窗。
- [ ] 实现切换“手动添加”。
- [ ] 实现读取 `video.duration` 和设置 `video.currentTime`。
- [ ] 实现填入章节名、简介并点击自定义“确定”。
- [ ] 实现可选清空已有章节。
- [ ] 实现点击弹窗底部“保存”。
- [ ] 所有失败都用中文错误返回，并保留弹窗现场。

---

## Chunk 5：说明文档和验证

### Task 10：中文 README

**文件：**
- 创建：`README.md`

- [ ] 写清楚本地加载方式。
- [ ] 写清楚使用流程。
- [ ] 写清楚已知限制：只支持抖音、不会点击发布、页面结构变化可能需要更新。

### Task 11：最终验证

**命令：**
- `npm test`
- `node --check src/lib/chapter-parser.js`
- `node --check src/lib/text-policy.js`
- `node --check src/popup/popup.js`
- `node --check src/content/douyin.js`

- [ ] 运行全部验证命令。
- [ ] 如果命令失败，先修复再继续。
- [ ] 输出最后状态和安装路径。

