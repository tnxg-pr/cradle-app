/**
 * Changelog data — curated release manifest for the landing page.
 *
 * Each release body is a markdown string rendered via `marked`.
 * The leading `>` blockquote is styled as the tagline.
 */

export interface Release {
  version: string
  date: string // ISO yyyy-mm-dd
  /** Markdown body. A leading `>` blockquote is styled as the tagline. */
  body: string
  featured?: boolean
}

export const RELEASES: Release[] = [
  {
    version: '0.0.0-dev-20260621.1',
    date: '2026-06-21',
    featured: true,
    body: `> Conversation Bridge arrives, Diffs Preview opens up, and the composer keeps getting smoother.

## Features

1. Conversation Bridge is now available from Integration settings. Cradle can connect external conversation platforms to Chat Sessions, so work can continue outside the main desktop window.
2. The first Bridge plugin supports Slack. Follow the setup guide in Settings, bind a Slack conversation, and keep chatting with Cradle from Slack while the feature continues to evolve.
3. Cradle Diffs Preview is now available as an early review surface for reading code changes directly inside Cradle.
4. Agents can now be granted broader access to Cradle's local capabilities. When enabled, Cradle installs its skills into the local global skills directory; the About page explains what is written.
5. Composer Toolbar interactions continue to improve across model selection, Claude model aliases, and Thinking Effort controls.

## Improvements

1. Thinking Effort now has more responsive micro-interactions across click, press, hold, and drag gestures.
2. Claude model selection is clearer: the main composer model picker stays focused on the active model, while Haiku, Sonnet, and Opus remain configurable as alias defaults.
3. Conversation Bridge controls are integrated into the Slack flow, making bind, status, unbind, runtime, and model selection easier to manage from the connected conversation.
4. The review workflow is easier to keep in sight with Diffs Preview available during fast development cycles.

## Bug Fixes

1. Fixed several Conversation Bridge edge cases found while wiring the Slack plugin into live Chat Sessions.
2. Fixed additional composer toolbar and model-selection interaction issues.
3. Fixed several smaller UI and runtime stability issues across today's development cycle.`,
  },
  {
    version: '0.0.0-dev-20260620.1',
    date: '2026-06-20',
    body: `> More control over plugins, models, sessions, memory, and streaming reliability.

## Features

1. Plugin management is now available in Settings and the CLI. Plugins can be enabled or disabled, and disabled plugins are removed from their runtime surfaces instead of staying half-active.
2. Claude sessions gained a clearer model matrix. Set defaults for Haiku, Sonnet, and Opus, then override the model for a specific chat when needed.
3. Chat sessions now carry origin metadata, making it easier to separate manually started work from automations, issue agents, and review sessions.
4. Nowledge Mem can connect through streamable HTTP MCP, with safer handling for API URLs and secrets.
5. Nowledge Mem's web panel is now organized into focused views for Today, Memories, Threads, Config, and Quick Capture.
6. Diff Review is easier to follow, with better source refresh, target resolution, guide titles, walkthroughs, and tool-call presentation.
7. Codex Settings now shows richer account diagnostics, including usage, rate limit, reset credit, and related account state.
8. A new app-server log blocker setting helps keep local runtime logs under control when detailed logging is not needed.
9. Desktop update work has been split into clearer source, download, and installer stages, preparing the updater for a more reliable install flow.

## Improvements

1. Chat streaming now follows the run lifecycle more closely, so active streams are less likely to be mistaken for completed work.
2. Plugin activation policy is stricter: disabled plugins no longer leave routes, MCP servers, skills, or web panels registered.
3. Universal provider targets now project more consistently into runtime and Codex provider settings.
4. Claude todo events now map more cleanly into Cradle progress, titles, and session state.

## Bug Fixes

1. Fixed active Chat streams that could appear finished too early, collapse into execution details, or show a misleading zero-duration completion state.
2. Fixed live steer tail mapping and several run snapshot timing edge cases.
3. Fixed Appshot hotkeys so the target window is focused before capture.
4. Fixed Issue Agent delegation so selected model and thinking-effort defaults are preserved.
5. Fixed completed Codex goals being cleared incorrectly after goal-cleared notifications.
6. Fixed the Codex daily usage chart so the latest seven days are shown.
7. Fixed missing universal provider target projection for Codex configuration.`,
  },
  {
    version: '0.0.0-dev-20260619.1',
    date: '2026-06-19',
    body: `> Codex auth modes, a background terminal panel, account diagnostics, and a round of stability fixes.

## Features

1. Surface Bar now shows live running state; the torn-off header displays the current session title.
2. Codex Provider settings gained explicit auth modes: API Key, ChatGPT Login, Personal Access Token, AWS Bedrock API Key.
3. Settings adds a Codex account diagnostics panel — manually refresh rate limit, token usage, reset credit, and other account state.
4. The composer area adds a Codex background terminal list — inspect command, cwd, pid, CPU, memory, and terminate any background process individually.
5. Hack Codex Goal — use with caution.

## Performance

1. Server memory footprint reduced.
2. Chat Runtime recovery now follows a clearer recovery path, fixing CPU spikes caused by polling on large sessions.
3. Renderer context lifecycle refactored to cut dev-time exceptions from Jarvis context provider double-registration.

## Bug Fixes

1. Fixed Chat stream connection cleanup.
2. Fixed side conversation streams being incorrectly pulled into session retention.
3. Fixed provider thread deletion and Codex thread projection issues.
4. Fixed tool-call identification so Bash and similar tools are no longer misrendered as subagents.
5. Fixed Surface / app shell rendering instability.
6. Notification Center: quick reply now auto-refreshes the corresponding chat session and manages the notification lifecycle correctly.
7. Markdown / plan refine editor: fixed save races where blur-save and duplicate-save overwrote content with stale state.
8. Hosted web support is more complete: added CORS origin and private network preflight handling.
9. Fixed Model List selection behavior not matching expectations.`,
  },
  {
    version: '0.0.0-dev-20260618.1',
    date: '2026-06-18',
    body: `> Internal dev testing is now open.

_**After roughly two months of development, the first public dev build of Cradle Desktop is available for testing.**_

Cradle is an AI-native desktop client focused on providing a stable, practical environment for agent-driven workflows. Rather than introducing an entirely new workflow, the goal is to integrate naturally into the workflows people already use every day.

This release marks the beginning of broader testing. The application has not yet gone through large-scale validation, so bugs, edge cases, and rough edges should be expected. Feedback is highly encouraged.

## What We Are Testing

If there are aspects of Codex that feel particularly effective, or areas where Claude Code provides a better experience, we would love to hear about them. Cradle is still early in its development and many product decisions remain open.

## cc-switch Integration

The cc-switch plugin is enabled by default and bundled with the application.

Users who already use cc-switch should see their configured providers immediately after launching Cradle. However, model lists are not automatically refreshed on startup.

To load models for a provider, open Settings and manually select the provider once. This triggers a backend refresh and retrieves the latest model list.

While not ideal, this behavior is currently intentional to avoid generating a large number of /model requests automatically during application startup.

## Current Status

Cradle is still an early-stage project.

There are no particularly flashy features yet, and the focus remains on reliability, usability, and creating a solid foundation for future development.

Current support is centered around Codex-based workflows. Claude Code support is available, but some workflows may still exhibit compatibility issues.

HiJarvis, my personal agent runtime, will continue evolving alongside Cradle and is expected to become the default runtime experience in the future.

## Known Limitations

1. Application size is currently larger than desired
1. Packaging and distribution are still being optimized
1. Apple Developer ID signing is not yet available
1. Automatic update mechanisms are still under investigation

Thank you to everyone willing to spend time testing an unfinished product. Every bug report, workflow discussion, and piece of feedback helps shape where Cradle goes next.
`,
  },
]
