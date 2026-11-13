[English](README.md) | [Русский](README.ru.md) | 中文

---

# TestBlox

**无代码测试自动化，结合 AI 与 Git。** 无需编写代码即可创建、生成和运行 UI 与 API 测试。一切保存在仓库中，便于团队协作。

[![Windows](https://img.shields.io/badge/Windows-x64-blue?logo=windows)](https://github.com/arslan-ahmetjanov/testblox/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 为什么选择 TestBlox？

手工设计测试和搭建自动化既费时又费力。TestBlox 将以下能力集于一体：

- **无代码** — 在可视化编辑器中编写测试：添加步骤、元素和断言，无需编程。
- **AI 生成** — 描述页面或粘贴 Swagger/OpenAPI 地址；一键获得可运行测试场景。
- **原生 Git** — 测试存放在仓库（`.testblox/`）中，享受版本控制、代码评审和 CI 友好产物。
- **UI + API 一体** — 同一工作区处理 Web 流程与 API 校验，共享变量与结构。

目前没有其他免费桌面无代码工具能在**一个应用里同时提供 AI 测试生成与 Git 集成**。TestBlox 为希望快速上手的测试人员而设计。

---

## 功能

| 功能 | 说明 |
|------|------|
| **可视化测试构建** | 添加步骤，从解析后的页面选择元素，使用共享步骤和变量。 |
| **AI 测试生成** | 连接 OpenRouter（或兼容 API）；根据页面和 Swagger 生成 UI、API 场景。 |
| **页面解析** | 输入任意 URL；应用提取可点击元素并生成稳定选择器（如 `data-testid`、`data-qa`、`id`）。 |
| **Swagger/OpenAPI** | 通过 URL 导入规范；获取端点并生成 API 测试场景。 |
| **Playwright 执行** | 在 Chromium（内嵌）中运行 UI 测试。快速、稳定，无需额外安装。 |
| **API 测试运行** | 执行 HTTP 请求，断言状态与响应体（如 JSONPath）。 |
| **Git 集成** | 打开 Git 仓库目录；与团队一起提交和推送测试。 |
| **报告** | 在应用内查看运行结果与历史。 |

---

## 系统要求

- **系统：** Windows 10/11 (x64)
- **内存：** 至少 4 GB，建议 8 GB
- **磁盘：** 约 500 MB（应用 + 内嵌 Chromium）
- **AI（可选）：** OpenRouter API 密钥（或兼容 OpenAI 风格 API）用于 AI 测试生成

---

## 安装

### 方式一：下载发行版（推荐）

1. 打开 [Releases](https://github.com/arslan-ahmetjanov/testblox/releases)。
2. 下载：
   - **TestBlox Setup 1.1.0.exe** — 安装版（推荐），或  
   - **TestBlox 1.1.0.exe** — 便携版，无需安装。
3. 运行即可。便携版可从任意目录运行。

### 方式二：从源码构建

```bash
git clone https://github.com/arslan-ahmetjanov/testblox.git
cd testblox
npm ci
npm run build
```

输出：`dist/TestBlox Setup 1.1.0.exe` 与 `dist/TestBlox 1.1.0.exe`（便携版）。

---

## 快速开始

1. **打开或创建工作区**  
   - *打开：* 选择文件夹（如项目仓库）。  
   - *创建：* 新建文件夹并打开；TestBlox 将初始化 `.testblox` 结构。

2. **添加页面（用于 UI 测试）**  
   - 在应用中添加页面并输入 URL。  
   - 使用「Parse」加载页面；应用会列出元素与选择器。

3. **创建测试**  
   - 手动：添加测试、步骤，选择元素与操作。  
   - 使用 AI：打开设置 → 填写 OpenRouter API 密钥与模型 → 在页面上使用「Generate with AI」或对页面+Swagger 使用「Generate from selection」。

4. **运行测试**  
   - 选择一个或多个测试并运行。  
   - 在应用内查看报告。

5. **版本控制**  
   - 将 `.testblox/` 目录（以及可选 `pages/`、`tests/`）提交到 Git，便于团队复用与扩展测试。

---

## AI 配置（OpenRouter）

1. 在 [OpenRouter](https://openrouter.ai/) 获取 API 密钥。
2. 在 TestBlox 中：**设置** → **LLM**。
3. 填写：
   - **API URL：** `https://openrouter.ai/api/v1/chat/completions`
   - **API key：** 你的密钥
   - **Model：** 如 `openai/gpt-4o-mini` 或其他模型。
4. 保存。即可使用「Generate with AI」和「Generate from selection」。

**通过环境变量设置密钥：** 可设置 `TESTBLOX_LLM_API_KEY`（及可选的 `TESTBLOX_LLM_MODEL`、`TESTBLOX_LLM_API_BASE_URL`）于环境或工作区根目录的 `.env` 文件中。应用在调用 LLM 前会加载 `.env`，密钥不会保存在设置或 `.testblox/llm.json` 中。在 CI 中请在流水线中设置这些变量（如 GitHub Secrets、GitLab CI variables）。

---

## 项目结构（工作区）

将文件夹作为工作区打开时，TestBlox 会使用（并可能创建）：

```
你的项目/
├── .testblox/          # 工作区配置、操作、变量、共享步骤
├── pages/              # 解析后的页面（URL、元素、选择器）
├── tests/              # 测试用例（UI 与 API）
├── endpoints/          # API 端点（如来自 Swagger）
└── reports/            # 运行报告（通常加入 .gitignore）
```

若希望测试随项目版本化，请将 `.testblox/`、`pages/`、`tests/`、`endpoints/` 纳入 Git。

---

## 变量与密钥

变量值（登录名、密码、令牌）存放在工作区根目录的 **`.env`** 文件中。该文件在初始化项目或保存第一个变量时创建，且不提交（已列入 .gitignore）。

- **无 pattern 的变量** — 名称在 `.testblox/variables.json`，值在 `.env`。在步骤和 auth 字段中使用 `{{variableName}}`。
- **带 pattern 的变量**（正则）— variables.json 中仅存 pattern；值在每次运行时生成，不写入 .env。
- **在 CI 中** — 通过流水线环境变量设置相同变量名（如 GitHub Secrets、GitLab CI variables）。
- **直接引用 env** — 在任何字段（如 auth token 或 password）中可使用 `{{env:VAR_NAME}}` 从 `process.env.VAR_NAME`（来自 .env 或 CI env）取值。

---

## 技术栈

- **桌面：** Electron  
- **UI：** React、Vite、Material UI  
- **执行：** Playwright（Chromium）、内置 API 运行器  
- **AI：** OpenRouter 兼容 API（如 GPT-4o-mini）  
- **存储：** 工作区中的 JSON 文件  

---

## 参与贡献

欢迎贡献：问题反馈、想法、文档或代码。请提交 issue 或 pull request。

---

## 作者与动机

**作者：** 阿尔斯兰·艾哈迈特扎诺夫（Arslan Ahmetjanov）— 面向手动与自动化软件测试的 AI 解决方案开发者。

本项目目标：

1. **作品集** — 展示完整产品：无代码测试自动化、AI 与 Git 集于一体。  
2. **社区** — 为全球测试人员提供免费开源工具，结合 AI 生成场景与版本控制，目前尚无直接替代品。

若 TestBlox 对您有帮助，欢迎给仓库加星或分享给团队。

---

## 许可证

[MIT](LICENSE)