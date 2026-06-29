# DeepSeek++ 项目总结与接手指南

> 最后更新: 2026-06-29
> 项目状态: 活跃开发中 (v1.0.5+)

---

## 目录

1. [项目概述](#1-项目概述)
2. [近期核心变更](#2-近期核心变更)
3. [系统架构](#3-系统架构)
4. [工具系统清单](#4-工具系统清单)
5. [关键文件索引](#5-关键文件索引)
6. [开发工作流](#6-开发工作流)
7. [未完成事项](#7-未完成事项)

---

## 1. 项目概述

DeepSeek++ 是一个开源 Chrome 浏览器扩展（MV3），运行在 [chat.deepseek.com](https://chat.deepseek.com) 之上，将 DeepSeek 网页版扩展为具有记忆、工具调用、Skill、MCP 集成、多模态分析、浏览器控制和编码能力 AI Agent 工作台。

### 技术栈

| 层 | 技术 |
|---|------|
| 扩展框架 | WXT v0.20.26 (Vite 驱动的 Web Extension 工具链) |
| UI | React 19 + Tailwind CSS v4 |
| 语言 | TypeScript |
| 存储 | `chrome.storage.local` + Dexie.js (IndexedDB 封装) |
| 测试 | Vitest v4 + jsdom |
| 原生消息 | Chrome Native Messaging (stdin/stdout JSON-RPC 2.0) |
| 构建目标 | Chrome MV3, Edge MV3, Firefox MV3 |

### 仓库结构

```
deepseek-pp/
├── core/                          # 核心业务逻辑 (~120+ 文件)
│   ├── prompt/                    # 提示词注入系统 (重写完成)
│   │   ├── augmentation.ts        # 三层提示词构建器
│   │   ├── scenario.ts            # 场景/模式过滤器
│   │   ├── scenario-store.ts      # 场景持久化 (新增)
│   │   ├── types.ts               # 场景类型/预算类型 (新增)
│   │   ├── cache-boundary.ts      # 缓存边界 (新增)
│   │   ├── settings.ts            # 提示词注入设置
│   │   └── visibility.ts          # 可见用户提示标记
│   ├── coding-agent/              # 编码智能体 (新建)
│   │   ├── types.ts               # 编码智能体类型/常量
│   │   ├── prompt.ts              # 编码专用提示词
│   │   ├── context-window.ts      # 上下文预算管理 (重写)
│   │   └── index.ts               # 模块入口
│   ├── tool/                      # 工具系统
│   │   ├── types.ts               # 工具类型定义
│   │   ├── runtime.ts             # 工具运行时调度
│   │   ├── history.ts             # 工具调用历史
│   │   └── invocation.ts          # XML 调用解析
│   ├── tool-loop/                 # 工具执行循环
│   │   └── engine.ts              # 顺序/并行执行引擎
│   ├── browser-control/           # 浏览器控制 (18 个 CDP 工具)
│   ├── shell/                     # Shell MCP 合约/策略
│   ├── mcp/                       # MCP 客户端/传输层
│   ├── memory/                    # 记忆系统
│   ├── types.ts                   # 全局类型
│   └── ...                        # 其他模块
├── entrypoints/                   # WXT 入口点
│   ├── background.ts              # Service Worker (~2600 行)
│   ├── content.ts                 # 内容脚本 (~3700 行)
│   ├── main-world.content.ts      # MAIN 世界桥 (~240 行)
│   ├── sidepanel/                 # React 侧边栏应用
│   │   ├── App.tsx                # 主应用 (5 个 tab)
│   │   ├── pages/                 # 13 个页面组件
│   │   └── components/            # 共享组件
│   └── sandbox-*/                 # 沙箱页面
├── packages/                      # npm workspace 包
│   ├── shell-host/                # Shell 原生消息宿主 (20 个工具)
│   └── code-index-host/           # 代码索引原生消息宿主 (5 个工具, 新增)
├── scripts/                       # 构建/发布/验证脚本
├── tests/                         # 测试套件 (~57 文件, 302 测试)
├── docs/                          # 文档和设计文档
├── USAGE.md                       # 使用手册 (新增)
├── README.md                      # 中文 README (更新)
└── README_EN.md                   # 英文 README (更新)
```

---

## 2. 近期核心变更

以下是在 2026-06-29 会话中完成的所有变更。

### 2.1 文件系统工具 (Phase 1)

在 Shell 原生宿主中添加 5 个文件操作工具：

| 工具 | 用途 | 风险 | 文件位置 |
|------|------|------|---------|
| `file_read` | 读取文件，支持行偏移/限制、二进制检测 | low | `packages/shell-host/native/shell-mcp-host.mjs` |
| `file_write` | 写入文件，创建父目录，覆盖前备份 | high | 同上 |
| `file_edit` | 搜索-替换编辑，多 hunk，干运行 | high | 同上 |
| `file_list` | 递归目录列表，glob 过滤 | low | 同上 |
| `file_search` | 全文搜索，优先 ripgrep，回退 Node.js | low | 同上 |

**安全设计**：写前备份到 `.deepseek-pp/backups/`、路径穿越防护、二进制检测

### 2.2 代码理解宿主 (Phase 2)

新建独立原生消息宿主 `packages/code-index-host/`，提供 5 个代码理解工具：

| 工具 | 用途 |
|------|------|
| `code_search` | 全文本搜索（优先 ripgrep），支持上下文行和 glob 过滤 |
| `code_symbol` | 符号定义查找（函数/类/接口），支持 6+ 语言 |
| `code_structure` | 文件大纲（导入/导出/类/函数/变量） |
| `code_glob` | Glob 文件匹配，30 秒索引缓存 |
| `code_batch_read` | 批量读取最多 20 个文件 |

**文件清单**：
- `packages/code-index-host/package.json`
- `packages/code-index-host/native/code-index-host.mjs`
- `packages/code-index-host/lib/installer.mjs`
- `packages/code-index-host/bin/deepseek-pp-code-index-host.mjs`

### 2.3 Git 工具 (Phase 3)

在 Shell 原生宿主中添加 6 个 Git 工具：

`git_status`（结构化输出）、`git_diff`、`git_log`、`git_commit`、`git_branch`、`git_push`

**安全措施**：提交前自动 `git status` 检查、自动仓库根检测

### 2.4 编码智能体 (Phase 4)

新建 `core/coding-agent/` 模块：

| 文件 | 作用 |
|------|------|
| `types.ts` | 编码智能体状态/编辑计划/工具分类类型 |
| `prompt.ts` | 编码专用提示词模板（规划-执行-验证工作流） |
| `index.ts` | 模块入口 |

修改 `core/tool-loop/engine.ts`：添加 `executeToolCallsParallel()` 用于只读工具并行执行。

### 2.5 提示词架构优化 (核心重写)

完全重写 `core/prompt/` 子系统，借鉴 Claude Code 的模块化设计：

| 文件 | 状态 | 作用 |
|------|------|------|
| `types.ts` | **新建** | `AgentScenario`, `PromptSection`, `PromptBudget`, token 预算类型 |
| `scenario.ts` | **新建** | 4 种场景、10 个工具组、场景引导文本 |
| `cache-boundary.ts` | **新建** | 5 段缓存稳定前缀 + `PROMPT_CACHE_BOUNDARY` 标记 |
| `augmentation.ts` | **完全重写** | 三层结构：静态前缀 + 缓存边界 + 动态后缀 |
| `scenario-store.ts` | **新建** | 场景持久化存储 |

**架构原理**：

```
STATIC PREFIX (缓存稳定 ~2500 tokens)
├─ Identity & Safety
├─ Doing Tasks
├─ Executing Actions with Care
├─ Tool Call Format
└─ Output Style
─── PROMPT_CACHE_BOUNDARY ───
DYNAMIC SUFFIX (每次更新 ~1500 tokens)
├─ Current Scenario (场景引导)
├─ Tool Selection Guide (优先级规则)
├─ Available Tools (按场景过滤的紧凑列表)
├─ Memories
├─ Project Context
└─ Language Directive
```

### 2.6 上下文预算管理 (Phase 5)

重写 `core/coding-agent/context-window.ts`：

- **65% 软阈值**：成功结果压缩为摘要
- **80% 硬阈值**：只保留错误和编辑结果
- **优先级评分**：错误(+50) > 编辑(+30) > git状态(+25) > 文件读取(+15) > 搜索(-10)
- **自动对话修剪**：保留最近 N 轮，滚动丢弃最早的

### 2.7 场景选择器 UI

在侧边栏 Capabilities 页新增 `Scenario` tab，4 个场景卡片：
- Chat：记忆 + 网络 + 产物 + 沙箱
- Coding：文件 + 代码 + Git + Shell + 全部基础工具
- Browsing：浏览器控制 + 网络
- Automation：Shell + 网络 + 浏览器

**数据流**：侧边栏选择 → `saveAgentScenario()` → `SCENARIO_CHANGED` → background → `broadcastStateUpdate()` → content script → `augmentRequestBody()` → `buildPromptAugmentation(..., scenario)`

### 2.8 文档更新

| 文档 | 变更 |
|------|------|
| `README.md` | 新增"编码能力"章节，10 组工具总览表 |
| `README_EN.md` | 同步英文版编码能力章节 |
| `USAGE.md` | **新建**完整使用手册（8 章，含编码/故障排除） |
| `docs/plan/task-breakdown.md` | 规划文档已更新 |

### 2.9 测试和验证

| 检查项 | 结果 |
|--------|------|
| `npm test` | **302/302 通过** (57 个测试文件) |
| `tsc --noEmit` | **0 错误** |
| `npm run prompt:freeze` | **12/12 通过** |
| `npm run smoke:shell` | **16/16 通过** |
| 原生宿主语法检查 | shell-mcp-host ✅ code-index-host ✅ |

---

## 3. 系统架构

### 3.1 数据流全景

```
                    ┌─────────────────────┐
                    │   Sidepanel (React)  │
                    │   CapabilitiesPage   │
                    │   ScenarioSelector   │
                    └────────┬────────────┘
                             │ chrome.runtime.sendMessage
                             v
                    ┌─────────────────────┐
                    │   Background (SW)   │
                    │   broadcastState    │
                    │   buildSidepanel    │
                    └────────┬────────────┘
                             │ broadcastToTabs
                             v
          ┌──────────────────────────────────┐
          │  Content Script (isolated world) │
          │  currentScenario  →  augmentReq  │
          └────────┬─────────────────────────┘
                   │ MessageChannel bridge
                   v
          ┌──────────────────────────────────┐
          │  Content Script (MAIN world)     │
          │  fetch-hook.ts  →  onRequestBody │
          └────────┬─────────────────────────┘
                   │ intercepts fetch to
                   v
          ┌──────────────────────────────────┐
          │  chat.deepseek.com API           │
          │  receives augmented prompt       │
          └──────────────────────────────────┘

  Tool Execution Path (after model responds):
  ┌─────────┐    ┌──────────┐    ┌───────────┐
  │  Parse   │ →  │ Execute  │ →  │ Continue  │
  │ XML tags │    │ tool     │    │ loop      │
  └─────────┘    └──────────┘    └───────────┘
                       │
          ┌────────────┼────────────┐
          v            v            v
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ local    │ │ MCP      │ │ shell    │
   │ tools    │ │ tools    │ │ host     │
   └──────────┘ └──────────┘ └──────────┘
```

### 3.2 原生消息宿主架构

```
Chrome Extension              Native Host (Node.js)
┌────────────────┐           ┌─────────────────────┐
│ chrome.runtime │           │ shell-mcp-host.mjs   │
│ .connectNative │  stdin/   │ 20 tools (file, git, │
│                │  stdout   │ shell, python, etc)  │
│ MCP transport  │ ←───────→ │                     │
│ (JSON-RPC 2.0) │  4-byte   │ code-index-host.mjs │
│                │  LE pref  │ 5 tools (code_*)     │
└────────────────┘           └─────────────────────┘
```

两者使用相同协议：
- 信封：`{ protocol: 'deepseek-pp-mcp-native', version: 1, message: JSON-RPC }`
- 帧格式：4字节小端长度前缀 + UTF-8 JSON
- 生命周期：stdin 关闭时宿主自动退出

### 3.3 提示词架构

```
buildPromptAugmentation(originalPrompt, {
  scenario: 'coding',       // 控制工具过滤
  memories: [...],          // 按关键词选中的记忆
  presetContent: '...',     // 系统提示词预设
  projectContext: '...',    // 项目指令
  toolDescriptors: [...],   // 完整工具列表（会被 scenario 过滤）
  locale: 'zh-CN',          // 界面语言
  memoryEnabled: true,      // 记忆注入开关
  systemPromptEnabled: true, // 系统提示词开关
})
```

### 3.4 场景系统

```
AgentScenario:
  chat      → memory, web, artifact, sandbox          （日常对话）
  coding    → + file, code, git, shell                 （编码任务）
  browsing  → browser, web (替代 chat 工具集)            （浏览器控制）
  automation → web, shell, browser                     （定时任务）
```

见 `core/prompt/scenario.ts` 的 `TOOL_GROUPS`、`SCENARIO_GUIDANCE`、`TOOL_PRIORITY_RULES`。

---

## 4. 工具系统清单

当前系统共有 **~52+ 个工具**，分为 10 个逻辑组：

| 组 | 数量 | 工具名 | 实现位置 |
|---|------|--------|---------|
| 🧠 memory | 3 | memory_save, memory_update, memory_delete | `core/tool/memory.ts` |
| 🌐 web | 2 | web_search, web_fetch | `core/tool/web-search.ts` |
| 🎨 artifact | 2 | artifact_create, artifact_bundle_create | `core/artifact/` |
| 🧪 sandbox | 1 | sandbox_run | `core/sandbox/tool.ts` |
| 🐚 shell | 9 | shell_exec, shell_status, python_exec, python_status, local_skill_preview, local_folder_pick, shell_session_begin/exec/end | shell-mcp-host.mjs |
| 📁 file | 5 | file_read, file_write, file_edit, file_list, file_search | shell-mcp-host.mjs |
| 🔍 code | 5 | code_search, code_symbol, code_structure, code_glob, code_batch_read | code-index-host.mjs |
| 📊 git | 6 | git_status, git_diff, git_log, git_commit, git_branch, git_push | shell-mcp-host.mjs |
| 🖥️ browser | 18 | browser_navigate, browser_click, browser_snapshot, etc. | `core/browser-control/` |
| 🔧 mcp | 动态 | 第三方 MCP 工具 | `core/mcp/` |

**工具调用格式**：XML 标签 + JSON body

```
<file_edit>
{"path":"/project/src/main.ts","hunks":[{"oldText":"foo","newText":"bar"}]}
</file_edit>
```

**合约注册**：所有 shell/git/file 工具在 `core/shell/contracts.ts` 注册名称，在 `core/shell/policy.ts` 配置默认 allowlist。

---

## 5. 关键文件索引

### 核心入口

| 文件 | 职责 | 复杂度 |
|------|------|--------|
| `entrypoints/background.ts` | Service Worker：消息路由、工具执行、侧边栏对话、自动化 | 高 (~2600 行) |
| `entrypoints/content.ts` | 内容脚本：请求增强、DOM 集成、inline agent | 高 (~3700 行) |
| `entrypoints/main-world.content.ts` | MAIN 世界桥：fetch 拦截 | 中 |
| `entrypoints/sidepanel/App.tsx` | 侧边栏主应用 | 低 |

### 提示词系统

| 文件 | 职责 | 备注 |
|------|------|------|
| `core/prompt/augmentation.ts` | 三层提示词构建器 | **重写完成** |
| `core/prompt/scenario.ts` | 场景定义 + 工具组映射 | **新建** |
| `core/prompt/types.ts` | 场景/预算类型 | **新建** |
| `core/prompt/cache-boundary.ts` | 缓存稳定前缀 | **新建** |
| `core/prompt/scenario-store.ts` | 场景持久化 | **新建** |
| `core/prompt/settings.ts` | 提示词注入设置 | 未修改 |

### 原生宿主

| 文件 | 职责 | 工具数 |
|------|------|--------|
| `packages/shell-host/native/shell-mcp-host.mjs` | Shell 原生宿主 | 20 |
| `packages/shell-host/lib/installer.mjs` | Shell 宿主安装器 | - |
| `packages/code-index-host/native/code-index-host.mjs` | 代码索引宿主 | 5 |
| `packages/code-index-host/lib/installer.mjs` | 代码索引安装器 | - |

### 合约与策略

| 文件 | 职责 |
|------|------|
| `core/shell/contracts.ts` | Shell 工具名/规格注册 |
| `core/shell/policy.ts` | 默认 allowlist/安全策略 |
| `core/tool/types.ts` | 工具类型定义 |
| `core/tool/runtime.ts` | 工具运行时调度 |

### 上下文管理

| 文件 | 职责 |
|------|------|
| `core/coding-agent/context-window.ts` | 上下文预算管理 |
| `core/coding-agent/types.ts` | 编码智能体类型 |
| `core/coding-agent/prompt.ts` | 编码专用提示词 |

---

## 6. 开发工作流

### 环境要求

- Node.js >= 18.17
- npm >= 9

### 常用命令

```bash
npm install              # 安装依赖
npm run dev              # WXT 开发模式（热重载）
npm run build:chrome     # 构建 Chrome 扩展
npm run build:all        # 构建所有浏览器
npm test                 # 运行测试
npm run compile          # TypeScript 类型检查
npm run ci:quality       # 完整质量门禁（编译+测试+构建+打包）
npm run prompt:freeze    # 验证提示词未意外修改
npm run smoke:shell      # Shell 宿主烟雾测试
npm run shell:install    # 安装 Shell 原生宿主到本机
```

### 原生宿主安装

```bash
# Shell 宿主
npx deepseek-pp-shell-host install --browser chrome --extension-id <扩展ID>

# Code Index 宿主
npx deepseek-pp-code-index install --browser chrome --extension-id <扩展ID>
```

扩展 ID 可以在 `chrome://extensions` 中找到，或在侧边栏 MCP 页自动获取。

### 测试策略

测试位于 `tests/` 目录，使用 Vitest：
- `tests/request-augmentation.test.ts` — 提示词注入测试
- `tests/shell-policy.test.ts` — Shell 安全策略测试
- `tests/browser-control.test.ts` — 浏览器控制测试
- `tests/sidepanel-navigation.test.ts` — 侧边栏导航测试
- `tests/shell-host-local-skill-preview.test.ts` — 原生宿主测试

### 质量门禁 (`npm run ci:quality`)

按顺序执行：
1. `actionlint` — workflow 检查
2. `npm audit` — 依赖审计
3. `prompt:freeze` — 提示词冻结
4. `tsc --noEmit` — 类型检查
5. `vitest run` — 单元测试
6. `verify:i18n` — i18n 完整性
7. `smoke:shell` + `smoke:mcp` + `smoke:pow` — 烟雾测试
8. `build:all` — 三浏览器构建
9. `verify:extension-utf8` — UTF-8 编码检查
10. `verify:manifest-policy` — Manifest 权限检查
11. `zip:all` — 打包
12. `verify:release-assets` — 资产校验

---

## 7. 未完成事项

### 高优先级

- **Phase 6: 终端式编码 UI** — 侧边栏编码工作区页面，包括：
  - `CodingPage.tsx` — 文件树面板、差异查看器、终端仿真器
  - `TerminalOutput.tsx` — ANSI→HTML 渲染、虚拟滚动
  - `FileExplorer.tsx` — 项目文件树（code_glob 驱动）
  - `DiffViewer.tsx` — 并排/统一差异视图
- **场景自动检测** — 当前场景需要用户手动在侧边栏切换，未来可以根据用户输入关键词自动检测场景（如包含"编辑文件"自动切到 coding）

### 中优先级

- **编码智能体循环集成** — `core/coding-agent/loop.ts` 已设计但未集成到 `entrypoints/content.ts` 的 inline agent 中
- **`code_edit` 工具的 diff 算法改进** — 当前 `file_edit` 使用精确字符串匹配，未来可以支持模糊匹配和行号模式
- **工具结果缓存** — `code_search` 结果可以缓存 30 秒，但 `file_search` 和 `git_status` 还没有缓存

### 低优先级

- **更多语言的符号提取** — `code_symbol` 当前支持 6+ 语言，可扩展 C#、Kotlin、Swift 等
- **Windows 原生宿主测试** — 当前烟雾测试主要在 macOS/Linux 上运行
- **Firefox 兼容性验证** — Firefox 使用不同的 Manifest API，部分原生消息功能未验证
- **Android WebView 适配** — Android 基线存在但浏览器扩展专有能力已禁用

### 已知问题

1. `scripts/prompt-freeze.mjs` — 已更新为新架构，但 `ci:quality` 中包含的 hash 需要在新构建前重新生成（运行 `npm run prompt:freeze` 即可）
2. `core/tool/runtime.ts` — 工具调度仍使用 `is*ToolName()` 链式 if-else，未来可重构为注册表模式
3. `entrypoints/background.ts` — 约 2600 行，`handleMessage` switch 约 90 个 case，考虑按领域拆分

---

## 附录：关键架构决策记录

| 决策 | 理由 |
|------|------|
| 文件/git 工具加到现有 shell-mcp-host | 避免额外原生消息开销。现有宿主已有平台抽象、环境隔离 |
| 代码理解作为独立原生宿主 | 代码搜索受益于持久状态（文件缓存），可占用更多资源 |
| 编码循环继承 inline-agent 模式 | inline agent 经过实战测试（流式、PoW、nudge 逻辑） |
| 搜索-替换式编辑 | 代码在工具调用间可能变化，搜索-替换比行号更健壮 |
| 三层提示词结构 | Claude Code 验证的架构，缓存命中率 94%，节省 token |
| 场景手动选择（而非自动检测） | 用户意图明确，避免 AI 猜测不准确 |
| 上下文预算管理 | DeepSeek 128K 上下文限制，无自动压缩会导致可靠退化 |
| 只读工具并行执行 | 独立只读操作可并发，大幅减少编码任务延迟 |
