<p align="center">
  <img src="./.github/Cradle.png" alt="Preview" width="182" />
  <h1 align="center"><b>Cradle</b></h1>
  <p align="center">
    AI agent management platform — unified interface for organizing information, managing agents, and human-AI collaboration.
    <br />
    <br />
    <a href="https://github.com/wibus-wee/Cradle/releases">Download Latest Release</a>
  </p>
</p>

<pre align="center">
🧪 Work In Progress
</pre>

Cradle is a desktop-first platform for managing AI agents and their workflows. It provides a unified environment where you can run agents, track issues, manage sessions, and integrate multiple LLM providers — all from a single native application.

## Features

- **Agent Management** — Create and configure agent profiles with custom identities, provider bindings, and skill sets
- **Chat Runtime** — Real-time chat with multi-provider support: Claude, OpenAI-compatible, Codex, and more
- **Issue Tracking** — Built-in Kanban board with workflow statuses, milestones, comments, and agent delegation
- **Session Management** — Persistent sessions with await support for external events like CI or human approval
- **Long-term Memory** — Persistent agent knowledge that carries across sessions
- **Git Integration** — Repository status, branch management, and commits from within the app
- **Terminal** — Shell interaction inside the desktop app
- **Plugin System** — Extend Cradle with official and community plugins
- **Multi-provider Support** — Anthropic, OpenAI, Google, and any OpenAI-compatible endpoint

## Official Plugins

| Plugin | Description | Status |
|---|---|---|
| [`@cradle/browser-use`](./plugins/browser-use) | 控制 Cradle 内置浏览器的 MCP 插件，支持导航、点击、输入、截图、页面文本读取和 DOM 结构检查。 | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |
| [`@cradle/cc-switch`](./plugins/cc-switch) | 将 CC Switch provider 数据以只读 external provider source 的方式映射到 Cradle。 | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |
| [`@cradle/system-info`](./plugins/system-info) | 通过插件 API 和 Web command 暴露系统信息能力。 | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |

## Packages

| Package | Description | Status |
|---|---|---|
| [`@cradle/tabs-next`](./packages/tabs-next) | Navigation-context tab runtime for React desktop apps — retained tab history, bounded Activity rendering, hash-based URL sync, and `<Link>` routing. | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |
| [`@cradle/ipc`](./packages/ipc) [^ipc-decorator] | Type-safe IPC communication layer for Electron apps, built on top of `electron-ipc-decorator`. Provides a structured way to define IPC services with decorators, automatic type inference, and error handling. | ![Stable](https://img.shields.io/badge/status-Stable-green) |

## Thanks

I have been deeply inspired by the following projects and communities:

- [LobeHub](https://lobehub.com/)
- [Codex](https://chatgpt.com/codex/)
- [Yansu](https://yansu.app/)
- [Alma](https://alma.now/)


## License

Cradle © Wibus, Released under AGPLv3. Created on Apr 25, 2026

> [Personal Website](http://wibus.ren/) · [Blog](https://blog.wibus.ren/) · GitHub [@wibus-wee](https://github.com/wibus-wee/) · Telegram [@wibus✪](https://t.me/wibus_wee)

[^ipc-decorator]: Thanks to [Innei/electron-ipc-decorator](https://github.com/Innei/electron-ipc-decorator) for the IPC decorator inspiration and some utility code patterns.
