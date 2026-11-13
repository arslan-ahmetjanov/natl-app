English | [Русский](README.ru.md) | [中文](README.zh-CN.md)

---

# TestBlox

**No-code test automation with AI and Git.** Create, generate, and run UI and API tests without writing code. Keep everything in your repository and collaborate with your team.

[![Windows](https://img.shields.io/badge/Windows-x64-blue?logo=windows)](https://github.com/arslan-ahmetjanov/testblox/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Why TestBlox?

Manual test design and automation setup take time. TestBlox combines:

- **No-code** — build tests in a visual editor: add steps, elements, and assertions without coding.
- **AI-powered generation** — describe a page or paste a Swagger/OpenAPI URL; get ready-to-run test scenarios in one click.
- **Git-native** — tests live in your repo (`.testblox/`), so you get version control, code review, and CI-friendly artifacts.
- **UI + API in one place** — one workspace for web flows and API checks, with shared variables and structure.

There is no other free, desktop, no-code tool that does **AI test generation + Git integration** in a single app. TestBlox is built for testers who want to move fast without leaving their workflow.

---

## Features

| Feature | Description |
|--------|-------------|
| **Visual test builder** | Add steps, pick elements from parsed pages, use shared steps and variables. |
| **AI test generation** | Connect OpenRouter (or compatible API); generate UI and API scenarios from pages and Swagger. |
| **Page parser** | Open any URL; the app extracts clickable elements and builds stable selectors (e.g. `data-testid`, `data-qa`, `id`). |
| **Swagger/OpenAPI** | Import spec by URL; get endpoints and generate API test scenarios. |
| **Playwright execution** | Run UI tests in Chromium-based browsers using the executable path from Settings. |
| **API test runner** | Execute HTTP requests, assert status and body (e.g. JSONPath). |
| **Git integration** | Open a folder that is a Git repo; commit and push tests with your team. |
| **Reports** | View run results and history inside the app. |
| **Bulk run & workers** | Run many tests in parallel (up to 10 workers); per-test progress, optional file logs under `.testblox/run-logs/`. |
| **Git UI** | Clone, pull, push, branch, and commit from the workspace without leaving the app. |

### What’s new in 1.1.0

- **Run screen:** Per-test progress with titles; progress stages (screenshot, closing browser/resources, saving report); optional **write run logs to disk** (session `run.log`, `meta.json`, one file per test); open log folder from the UI; workers up to 10.
- **Test editor:** Insert **shared steps** via searchable **Autocomplete** (same idea as element/action pickers); **Add shared step** opens Shared Steps when the catalog is empty.
- **Shared step editor:** **Add API step** matches the test editor (text button + icon instead of a dropdown).
- **App shell:** Custom title bar, dedicated **Git** and **AI generate** flows, page parse / Swagger import request options where applicable.
- **Build & tooling:** `scripts/` helpers documented below; app icon normalization; `.gitignore` excludes `.testblox/run-logs/`.

---

## Requirements

- **OS:** Windows 10/11 (x64)
- **RAM:** 4 GB minimum, 8 GB recommended
- **Browser for UI runs:** Any installed Chromium-based browser (set executable path in Settings)
- **AI (optional):** OpenRouter API key (or compatible OpenAI-style API) for AI test generation

---

## Installation

### Option 1: Download release (recommended)

1. Go to [Releases](https://github.com/arslan-ahmetjanov/testblox/releases).
2. Download:
   - **TestBlox Setup 1.1.0.exe** — installer (recommended), or  
   - **TestBlox 1.1.0.exe** — portable, no install.
3. Run the executable. For the portable version, run it from any folder.

### Option 2: Build from source

```bash
git clone https://github.com/arslan-ahmetjanov/testblox.git
cd testblox
npm ci
npm run build
```

Output: `dist/TestBlox Setup 1.1.0.exe` and `dist/TestBlox 1.1.0.exe` (portable).

---

## Quick start

1. **Open or create a workspace**  
   - *Open:* choose a folder (e.g. your project repo).  
   - *Create:* create a folder and open it; TestBlox will init a `.testblox` structure.

2. **Add a page (for UI tests)**  
   - In the app, add a page and enter a URL.  
   - Use "Parse" to load the page; the app will list elements and selectors.

3. **Create tests**  
   - Manually: add a test, add steps, pick elements and actions.  
   - With AI: open Settings → set OpenRouter API key and model → use "Generate with AI" on a page or "Generate from selection" for pages + Swagger.

4. **Run tests**  
   - Open **Settings** once and set your browser executable path (used globally for all test runs).  
   - Select one or more tests and run.  
   - Check the report in the app.

5. **Version control**  
   - Commit the `.testblox/` folder (and optionally `pages/`, `tests/` if you use that layout) to Git so the team can reuse and extend tests.

---

## AI setup (OpenRouter)

1. Get an API key from [OpenRouter](https://openrouter.ai/).
2. In TestBlox: **Settings** → **LLM**.
3. Set:
   - **API URL:** displayed in Settings (fixed by build config for custom builds)
   - **API key:** your key
   - **Model:** e.g. `openai/gpt-4o-mini` or another model you prefer.
4. Save. You can now use "Generate with AI" and "Generate from selection".

**Using env instead of storing the key:** You can set `TESTBLOX_LLM_API_KEY` (and optionally `TESTBLOX_LLM_MODEL`) in your environment or in a `.env` file in the workspace root. The app loads workspace `.env` before calling the LLM, so the key is never saved in Settings or in `.testblox/llm.json`. In CI, set these variables in your pipeline (e.g. GitHub Secrets, GitLab CI variables).

## Custom build release tagging

- Custom builds are published only from Git tags in format `custom-v*`.
- Workflow file: `.github/workflows/custom-release.yml`.
- For custom builds, the LLM base URL is embedded during build via `TESTBLOX_BUILD_LLM_API_BASE_URL` and shown as read-only in Settings.

---

## Project structure (workspace)

When you open a folder as a workspace, TestBlox uses (and may create):

```
your-project/
├── .testblox/          # workspace config, actions, variables, shared steps; may contain run-logs/ when debug logging is enabled (ignored by git)
├── pages/              # parsed pages (URL, elements, selectors)
├── tests/              # test cases (UI and API)
├── endpoints/          # API endpoints (e.g. from Swagger)
└── reports/            # run reports (often in .gitignore)
```

Keep `.testblox/`, `pages/`, `tests/`, and `endpoints/` in Git if you want tests versioned with the project.

---

## Variables and secrets

Variable values (logins, passwords, tokens) are stored in a **`.env`** file in the workspace root. The file is created when you init a workspace or when you save your first variable. It is listed in `.gitignore`, so secrets are not committed.

- **Variables without a pattern** — name and value: name in `.testblox/variables.json`, value in `.env`. Use `{{variableName}}` in steps and auth fields.
- **Variables with a pattern** (regex) — only the pattern is stored; the value is generated on each run. They are not written to `.env`.
- **In CI** — set the same variable names as environment variables (e.g. GitHub Secrets → env, GitLab CI variables).
- **Direct env reference** — in any field (e.g. auth token or password) you can use `{{env:VAR_NAME}}` to read from `process.env.VAR_NAME` (from `.env` or CI env).

---

## Tech stack

- **Desktop:** Electron  
- **UI:** React, Vite, Material UI  
- **Execution:** Playwright (Chromium), in-app API runner  
- **AI:** OpenRouter-compatible API (e.g. GPT-4o-mini)  
- **Storage:** JSON files in the workspace

---

## Repo scripts (`scripts/`)

These Node scripts support packaging and CI. They are **not** required for normal app use.

| Script | npm command | Purpose |
|--------|-------------|---------|
| [`scripts/write-build-config.js`](scripts/write-build-config.js) | `npm run write-build-config` | Writes `electron/config/buildConfig.json`: `flavor` (`default` or `custom` via `--flavor=custom`), LLM API base URL from `--llm-url=` or env `TESTBLOX_BUILD_LLM_API_BASE_URL`. Used by `npm run build`, `build:dir`, and `build:custom*`. |
| [`scripts/copy-release-exe.js`](scripts/copy-release-exe.js) | (after `electron-builder` in `npm run build`) | Copies built `.exe` files from `dist/` to `release/`. |
| [`scripts/llm-config-smoke.js`](scripts/llm-config-smoke.js) | `npm run smoke:llm-config` | Smoke test for LLM / build-config resolution across flavors. |
| [`scripts/normalize-app-icon.js`](scripts/normalize-app-icon.js) | `npm run icons:app` | Resizes `electron/assets/icon.png` to 512×512 PNG for packaging (requires devDependency `sharp`). |

For a standard Windows release, run `npm ci` then `npm run build` from the repo root. Custom builds that embed a different LLM base URL use `npm run build:custom` and tags `custom-v*` (see **Custom build release tagging** above).

---

## Contributing

Contributions are welcome: bug reports, ideas, docs, or code. Please open an issue or a pull request.

---

## Author and motivation

**Author:** Arslan Ahmetjanov (Арслан Ахметжанов) — developer of AI solutions for manual and automated software testing.

Goals of this project:

1. **Portfolio** — to showcase a full product: no-code test automation, AI, and Git in one desktop app.  
2. **Community** — to give testers worldwide a free, open tool that combines AI-generated scenarios with version control, with no direct analogue today.

If TestBlox helps you in your work, consider starring the repo or sharing it with your team.

---

## License

[MIT](LICENSE)