<p align="center">
  <img src="./.github/Cradle.png" alt="Preview" width="182" />
  <h1 align="center"><b>Cradle</b></h1>
  <p align="center">
    AI agent management platform — unified interface for organizing information, 
    <br />
    managing agents, and human-AI collaboration.
    <br />
    <br />
    <img src='https://img.shields.io/github/stars/wibus-wee/cradle-app?style=flat-square'>
    <img src='https://img.shields.io/github/downloads/wibus-wee/cradle-app/total?style=flat-square'>
    <br />
    <br />
    <a href="https://github.com/wibus-wee/Cradle-app/releases">Download Latest Release</a>
  </p>
</p>

> The project is still in the early stages of development and I am not ready to accept contributions. If you have any ideas or suggestions, please feel free to open an issue. But anyways, thank you for your support and interest in this project ❤️.

## What's Cradle?

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
- **Multi-provider Support** — Anthropic, OpenAI, and any OpenAI-compatible endpoint

## Builtin Plugins

| Plugin | Description | Status |
|---|---|---|
| `@cradleapp/browser-use` | MCP plugin that controls Cradle's built-in browser, supporting navigation, clicking, input, screenshots, page text reading, and DOM structure inspection. | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |
| `@cradleapp/system-info` | Exposes system information capabilities through the plugin API and Web commands. | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |
| `@cradleapp/github-issues` | First-party plugin that reads GitHub Issues via REST API as an external issue source, with workspace-level repository bindings and local Kanban status overlays. | ![Beta](https://img.shields.io/badge/status-WIP-black) |
| `@cradleapp/slack-conversation-bridge` | Slack Socket Mode adapter and controls for the Cradle server-owned conversation bridge. | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |

### Integration Plugins

| Plugin | Description | Status |
|---|---|---|
| `@cradleapp/cc-switch` | Maps CC Switch provider data into Cradle as a read-only external provider source. | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |
| `@cradleapp/nowledge-mem` | Official Nowledge Mem adapter for guided memory, Working Memory, thread, and context operations. | ![Beta](https://img.shields.io/badge/status-Beta-yellow) |


## Packages

| Package | Description | Status |
|---|---|---|
| [`@cradle/ipc`](./packages/ipc) [^ipc-decorator] | Type-safe IPC communication layer for Electron apps, built on top of `electron-ipc-decorator`. Provides a structured way to define IPC services with decorators, automatic type inference, and error handling. | ![Stable](https://img.shields.io/badge/status-Stable-green) |

## Feedback

Have ideas, suggestions, or feedback? Join the Telegram channel [@wibusChannel](https://t.me/wibusChannel), or open an issue on GitHub.

## 🌻 Thanks

I have been deeply inspired by the following projects and communities:

- Thanks to [Codex](https://chatgpt.com/codex/) for its feature ideas.
- Thanks to [LobeHub](https://lobehub.com/) for its streamdown implementation.
- Thanks to [Yansu](https://yansu.app/) for its chronicle ideas.
- Thanks to [Linear](https://linear.com/) for its feature ideas and design ideas.
- Thanks to [agentation](https://github.com/benjitaylor/agentation) & [Cursor](https://cursor.com/) for its visual feedback ideas
- Thanks to [CC Switch](https://ccswitch.io) for our provider management plugin integration.
- Thanks to [Nowledge Mem](https://mem.nowledge.co/) for our plugin integration.

## License

Cradle © Wibus. Created on Apr 25, 2026.

> [Personal Website](http://wibus.ren/) · [Blog](https://blog.wibus.ren/) · GitHub [@wibus-wee](https://github.com/wibus-wee/) · Telegram [@wibus✪](https://t.me/wibus_wee)


[^ipc-decorator]: Thanks to [Innei/electron-ipc-decorator](https://github.com/Innei/electron-ipc-decorator) for the IPC decorator inspiration and some utility code patterns.
