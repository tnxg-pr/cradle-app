<!-- Once this directory changes, update this README.md -->

# Features/browser

Electron-only right-side panel. This feature owns the mixed BrowserPanel tab host for native browser tabs, TUI shell tabs, workspace file preview/editor tabs, and workspace diff tabs. Browser web contents stay native in Electron main; TUI shell execution remains owned by the TUI/terminal APIs; workspace file and diff surfaces keep their own feature ownership and are rendered here only as panel tab content.
Subagent tabs are a Browser Panel presentation of Chat Runtime provider-native threads. They hydrate provider thread turns through chat-owned APIs and consume the same AI SDK chunk streaming path used by Chat Session rendering; Browser does not poll runtime UI slot snapshots or scrape parent tool output to synthesize subagent messages.
Side conversation tabs are a Browser Panel presentation of Chat Runtime live side conversation handles. They use the renderer-only live chat store, stream side turns through the live side endpoint, and release the server handle only when the tab is closed.

## Native surface layering

Native browser tabs are Electron `WebContentsView` children, so they paint above renderer DOM regardless of CSS `z-index`. Large or modal renderer overlays that must cover the browser, such as the command palette or keyboard shortcuts overlay, should call `useSuppressNativeBrowserSurface(open)` from `native-surface-suppression.ts` while open; this hides the native view and restores it when all suppressors release.

Browser-owned chrome that sits on an edge of the viewport, such as address suggestions, should use `BROWSER_NATIVE_SURFACE_OCCLUSION_PROPS` from `native-surface-occlusion.ts` so bounds sync trims the native view around that chrome. Short-lived small overlays such as tooltips and context menus should not suppress the whole browser surface; avoid anchoring them over the browser viewport when possible.

## Files

- **browser-panel.logic.ts**: Pure address-bar logic copied from Synara; owns display value normalization, browser-style search/URL coercion, tab/history suggestions, chrome status, and address sync decisions.
- **browser-panel-loader.ts**: Shared lazy loader and preload hook for the Electron browser panel.
- **browser-panel.tsx**: Mixed right-side panel UI scoped to the owning route surface id; renders native browser tabs, a chooser launcher tab, TUI shell tabs, workspace file preview/editor tabs, workspace diff tabs, browser navigation controls, address suggestions, composer screenshot attachment, browser comment controls/tray, and a native viewport anchor whose bounds are synchronized to desktop `WebContentsView`. Active browser comment interaction is owned by the page preload runtime inside the real browser `WebContents`; renderer state stores runtime events, selected elements, draft design payloads, and screenshots captured only when saving or sending evidence.
- **browser-panel.test.tsx**: Regression tests for BrowserPanel shell render boundaries, workspace diff scroll commands, cross-session browser tab source markers, and native browser tab request handling.
- **browser-tab-scripts.ts**: Legacy script preset catalog retained for old script injection surfaces; native BrowserPanel no longer renders the preset/custom script toolbar.
- **index.ts**: Browser feature barrel export.
- **native-surface-occlusion.ts**: Attribute helpers for DOM chrome that should trim the native browser viewport bounds.
- **native-surface-suppression.ts**: Reference-counted suppression store and hook for modal DOM overlays that must hide native browser views.
- **subagent-output-panel.tsx**: Browser Panel subagent tab content; reads provider-native thread metadata and turn history from Chat Runtime, stores projected messages in the renderer-only live chat store under a synthetic provider-thread view id, subscribes to provider-thread AI SDK chunk SSE, and renders the standard Chat `MessageBubble` surface without implementing a separate chat renderer.
- **side-conversation-panel.tsx**: Browser Panel side conversation tab content; stores messages in the renderer-only live chat store under `side:{sideConversationId}`, submits live-only side turns, consumes AI SDK chunk SSE through the standard chat streaming handler, and renders `MessageBubbleById` against the renderer store without creating a Chat Session.
- **workspace-diff-viewer.tsx**: Workspace Git diff rendering surface backed by Pierre's diff viewer and worker pool; rendered by BrowserPanel workspace-diff tabs and consumes owner-scoped scroll-to-file commands without making the tab shell subscribe to those transient events.
