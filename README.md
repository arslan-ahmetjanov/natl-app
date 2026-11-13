<p align="center">
  <img src="brand/natl-lockup.svg" alt="NATL — YAML test runner" width="360" />
</p>

# NATL

**Not Another Testing Language** — an open-source **test runner**: YAML scenarios for **web UI and API**.

Write one compact scenario (optional POM). Run it locally or in CI. Keep typical flows when the stack moves — swap `engine:` (`playwright` → `selenium`; `cypress` is **experimental** with a lower ceiling). Mix UI and HTTP in the same file.

[![npm v1.0.0](./brand/badges/npm.svg)](https://www.npmjs.com/package/@natl/cli)
[![License: MIT](./brand/badges/license.svg)](./LICENSE)
[![Docs](./brand/badges/docs.svg)](https://natl-dev.github.io/natl/)

## Production status (1.0)

NATL **1.0.0** freezes the public API for Playwright-based production use. Contract: [`core/docs/api-1.0.md`](./core/docs/api-1.0.md). Changelog: [`CHANGELOG.md`](./CHANGELOG.md).

| Ready | Notes |
|-------|--------|
| Playwright + CLI | Default path: `natl run`, tags/grep, retries, `--workers`, fail-fast / shard |
| Reporters | `console`, `junit` (retry/flaky properties), `json`, `allure` |
| Root CI | Package build/unit + offline sandbox **smoke** (see [`CONTRIBUTING.md`](./CONTRIBUTING.md)) |
| Consumer CI | Copy [`examples/.github/workflows/natl.yml`](./examples/.github/workflows/natl.yml) |
| Secrets | Process env + `.env` only — inject Vault/AWS in CI as env vars |
| Semver | Breaking changes to the frozen surface require a **major** bump |

Upgrade from 0.1.x: install `@natl/cli@^1` + `@natl/adapter-playwright@^1` — pilot YAML stays compatible.

### Adapter status

| Engine | Status | Ceiling |
|--------|--------|---------|
| **playwright** | **Supported** (1.0 default) | Trace / video / fullPage screenshots |
| **selenium** | **Supported with limits** | Screenshots yes; no Trace Viewer / video (warns) |
| **cypress** | **Experimental** | Not covered by the 1.0 stability promise |
| **http** | Built-in (`@natl/core`) | API-only scenarios / `with: http` |

### Known limits (not blocking 1.0)

- Language wave 6+: iframe, network mock, upload/download, tabs — see [`core/docs/canon.md`](./core/docs/canon.md)
- No TMS / dashboard product in the CLI
- `api:` steps remain as **deprecated** compat; prefer HTTP verbs / `with: http`

## Why NATL

| | |
|--|--|
| **Compact language** | Compact YAML, `elements` / `actions` / `do:` |
| **Fullstack** | Web UI + API in one file (`with: http`) |
| **One scenario, many contexts** | Stands (`--env`), vars, `cases:` — not `if: mobile` in steps |
| **Portable via adapters** | Same YAML; browsers = what the adapter supports |
| **Honest ceiling** | Most smoke/regression ports; engine-specific edges are escape hatches |
| **Runner, not a TMS** | CLI runs tests — no dashboard product |

Built for **QA, developers, and DevOps**.

## Quick start

```bash
npm install -g @natl/cli @natl/adapter-playwright
npx playwright install chromium
natl --version

mkdir my-tests && cd my-tests
natl init
natl run tests/
```

`natl init` scaffolds a smoke test against the live
[docs sandbox](https://natl-dev.github.io/natl/sandbox.html)
(`demo@natl.dev` / `secret`). Offline twin: [`examples/fixtures/sandbox.html`](./examples/fixtures/sandbox.html).

Or try the demos in [`examples/`](./examples/).

## Documentation

Site (EN / RU / 中文 / ES · light & dark): **https://natl-dev.github.io/natl/**  
Start with the [guide](https://natl-dev.github.io/natl/getting-started.html) — install first, then every language block on one page.  
Agent (draft tests from a git diff + CI): [agent.html](https://natl-dev.github.io/natl/agent.html).

## Packages

| Package | Role |
|---------|------|
| [`@natl/core`](./core/) | Language, interpreter, `EngineAdapter` contract, reporters |
| [`@natl/adapter-playwright`](./adapter-playwright/) | Default UI engine (**supported**) |
| [`@natl/adapter-selenium`](./adapter-selenium/) | Selenium WebDriver (**supported with limits**) |
| [`@natl/adapter-cypress`](./adapter-cypress/) | Cypress (**experimental** MVP; not PW parity) |
| [`@natl/cli`](./cli/) | `natl` CLI |

Same YAML — different `engine:` (`playwright` / `selenium` / `cypress` / `http`).

## Example

```yaml
name: Sandbox login smoke
engine: playwright
tags: [smoke]

vars:
  base_url: https://natl-dev.github.io/natl/sandbox.html
  user: demo@natl.dev
  pass: secret

steps:
  - goto: $base_url
  - fill: "#email"
    with: $user
  - fill: "#password"
    with: $pass
  - click: "#login-btn"
  - assert: ".welcome"
    text: "Welcome, demo"
```

## Repository layout

| Path | What |
|------|------|
| `core/` | language, interpreter, reporters — `@natl/core` |
| `adapter-*/` | UI engines: Playwright (default), Selenium, Cypress (experimental) |
| `cli/` | `natl` CLI — `@natl/cli` |
| `agent/` | LLM agent that drafts tests from a git diff — `@natl/agent` |
| `apps/desktop/` | NATL desktop app: record clicks, save YAML, watch the run |
| `examples/`, `docs/`, `brand/` | examples, docs site, brand assets |

The desktop app is the product: **self-service testing for teams without a QA resource**. Record a path through the app, get a YAML scenario in your repository, run it in the app or in CI via `natl run`. No cloud, no account, nothing leaves the machine.

Design docs:

- [`docs/design/2026-11-13-product.md`](./docs/design/2026-11-13-product.md) — positioning, USP, metrics, architecture.
- [`docs/design/2026-11-13-mvp.md`](./docs/design/2026-11-13-mvp.md) — MVP scope and boundaries.
- [`docs/adr/`](./docs/adr/) — decisions worth remembering.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](./LICENSE)
