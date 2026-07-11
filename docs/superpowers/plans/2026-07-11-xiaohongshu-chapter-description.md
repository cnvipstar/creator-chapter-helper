# 小红书章节描述升级实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让插件把章节简介写入小红书新版章节弹窗的“章节描述”字段。

**Architecture:** 沿用通用章节数据的 `summary` 字段，在平台配置和小红书策略中启用 100 字限制。适配器按占位符定位每章描述框，并将描述纳入保存前的一致性复核；不存在描述框时回退到旧版行为。

**Tech Stack:** Chrome Extension Manifest V3、原生 JavaScript、Node.js Test Runner

---

## Chunk 1：数据策略

### Task 1：启用小红书章节描述

**Files:**
- Modify: `src/platforms/platform-registry.js`
- Modify: `src/lib/xiaohongshu-policy.js`
- Test: `test/platform-registry.test.js`
- Test: `test/xiaohongshu-policy.test.js`

- [x] 写失败测试，覆盖 100 字限制和自动截断。
- [x] 运行测试并确认因功能缺失而失败。
- [x] 启用小红书简介支持并实现 100 字校验。
- [x] 运行目标测试并确认通过。

## Chunk 2：页面写入

### Task 2：写入并复核章节描述

**Files:**
- Modify: `src/lib/xiaohongshu-dom-policy.js`
- Modify: `src/content/xiaohongshu-adapter.js`
- Test: `test/xiaohongshu-dom-policy.test.js`

- [x] 写失败测试，覆盖描述不一致和旧页面兼容。
- [x] 运行测试并确认因功能缺失而失败。
- [x] 定位“输入章节描述”并写入 `summary`。
- [x] 将描述纳入保存前复核和错误日志。
- [x] 运行目标测试并确认通过。

## Chunk 3：发布准备

### Task 3：文档、版本和打包

**Files:**
- Modify: `README.md`
- Modify: `docs/chrome-web-store/listing.zh-CN.md`
- Modify: `manifest.json`
- Modify: `package.json`

- [x] 更新中文功能说明和商店文案。
- [x] 将版本提升到 `0.1.3`。
- [x] 执行完整测试和语法检查。
- [x] 生成 Chrome 应用商店安装包。
