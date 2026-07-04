// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ThreadBrowserState } from '~/store/browser-panel'
import { DEFAULT_BROWSER_PANEL_OWNER_ID, useBrowserPanelStore } from '~/store/browser-panel'

import { BrowserPanel } from './browser-panel'

const diffViewerRender = vi.hoisted(() => vi.fn())

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createTestThreadState(threadId: string, url = 'about:blank', version = 1): ThreadBrowserState {
  return {
    threadId,
    version,
    open: true,
    activeTabId: 'native-tab-1',
    tabs: [{
      id: 'native-tab-1',
      url,
      title: url === 'about:blank' ? 'New tab' : 'example.com',
      status: 'live',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      faviconUrl: null,
      lastCommittedUrl: url === 'about:blank' ? null : url,
      lastError: null,
    }],
    lastError: null,
  }
}

function createClosedThreadState(threadId: string): ThreadBrowserState {
  return {
    threadId,
    version: 0,
    open: false,
    activeTabId: null,
    tabs: [],
    lastError: null,
  }
}

function installTestBrowserBridge() {
  const states = new Map<string, ThreadBrowserState>()
  const listeners = new Set<(state: ThreadBrowserState) => void>()
  const open = vi.fn(async (input: { threadId: string, initialUrl?: string }) => {
    const state = createTestThreadState(input.threadId, input.initialUrl ?? 'about:blank')
    states.set(input.threadId, state)
    for (const listener of listeners) {
      listener(state)
    }
    return state
  })
  const getState = vi.fn(async (input: { threadId: string }) =>
    states.get(input.threadId) ?? createClosedThreadState(input.threadId))
  const bridge = {
    open,
    close: vi.fn(async (input: { threadId: string }) => {
      const state = createClosedThreadState(input.threadId)
      states.set(input.threadId, state)
      return state
    }),
    hide: vi.fn(async () => {}),
    getState,
    setBounds: vi.fn(),
    captureScreenshot: vi.fn(),
    copyScreenshotToClipboard: vi.fn(),
    executeCdp: vi.fn(),
    discoverLocalServers: vi.fn(async () => []),
    navigate: vi.fn(async (input: { threadId: string, url: string }) => {
      const state = createTestThreadState(input.threadId, input.url, 2)
      states.set(input.threadId, state)
      return state
    }),
    reload: vi.fn(async (input: { threadId: string }) => states.get(input.threadId) ?? createClosedThreadState(input.threadId)),
    goBack: vi.fn(async (input: { threadId: string }) => states.get(input.threadId) ?? createClosedThreadState(input.threadId)),
    goForward: vi.fn(async (input: { threadId: string }) => states.get(input.threadId) ?? createClosedThreadState(input.threadId)),
    newTab: vi.fn(async (input: { threadId: string, url?: string }) => {
      const state = createTestThreadState(input.threadId, input.url ?? 'about:blank', 2)
      states.set(input.threadId, state)
      return state
    }),
    closeTab: vi.fn(async (input: { threadId: string }) => states.get(input.threadId) ?? createClosedThreadState(input.threadId)),
    selectTab: vi.fn(async (input: { threadId: string }) => states.get(input.threadId) ?? createClosedThreadState(input.threadId)),
    openDevTools: vi.fn(async () => {}),
    onState: vi.fn((handler: (state: ThreadBrowserState) => void) => {
      listeners.add(handler)
      return () => {
        listeners.delete(handler)
      }
    }),
  }

  window.cradle = {
    browser: bridge,
  } as unknown as Window['cradle']

  return bridge
}

vi.mock('./workspace-diff-viewer', () => ({
  WorkspaceDiffViewer: (props: { tabId: string, workspaceId: string, repositoryPath?: string | null, paths?: string[] }) => {
    diffViewerRender(props)
    return null
  },
}))

vi.mock('~/lib/electron', () => ({
  getServerUrl: () => 'http://localhost:3000',
  getServerWebSocketUrl: (path: string) => new URL(path, 'ws://localhost:3000').toString(),
  isLocalMode: () => false,
  isTearoffWindow: false,
  isElectron: true,
  nativeIpc: {},
  platform: 'darwin',
  tearoffSurfaceId: null,
  tearoffSurfaceRoute: null,
}))

vi.mock('~/features/workspace/workspace-file-editor', () => ({
  WorkspaceFileEditor: () => <div data-testid="workspace-file-editor" />,
}))

vi.mock('~/features/workspace/workspace-file-preview', () => ({
  WorkspaceFilePreview: () => <div data-testid="workspace-file-preview" />,
}))

describe('browserPanel rendering', () => {
  let browserBridge: ReturnType<typeof installTestBrowserBridge>

  beforeEach(() => {
    cleanup()
    diffViewerRender.mockClear()
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    browserBridge = installTestBrowserBridge()
    useBrowserPanelStore.setState({
      activeOwnerId: DEFAULT_BROWSER_PANEL_OWNER_ID,
      owners: {},
      tabs: [],
      activeTabId: null,
      requestedTab: null,
      scrollToFilePath: null,
    })
  })

  it('does not repaint the panel shell for diff scroll commands', () => {
    const tabId = useBrowserPanelStore.getState().openWorkspaceDiffTab({
      workspaceId: 'workspace-1',
      title: 'All Changes',
    })

    render(<BrowserPanel />)
    expect(diffViewerRender).toHaveBeenCalledTimes(1)

    act(() => {
      useBrowserPanelStore.getState().requestScrollToFilePath({
        path: 'src/index.ts',
        tabId,
      })
    })

    expect(diffViewerRender).toHaveBeenCalledTimes(1)
  })

  it('shows the source session marker for browser tabs from another session', () => {
    useBrowserPanelStore.getState().createTab('https://example.com', {
      sessionId: 'session-a',
      sessionTitle: 'Session A',
    })

    render(<BrowserPanel activeSessionId="session-b" activeSessionTitle="Session B" />)

    expect(screen.getByLabelText('From Session A')).not.toBeNull()
  })

  it('does not show a source marker for browser tabs from the active session', () => {
    useBrowserPanelStore.getState().createTab('https://example.com', {
      sessionId: 'session-a',
      sessionTitle: 'Session A',
    })

    render(<BrowserPanel activeSessionId="session-a" activeSessionTitle="Session A" />)

    expect(screen.queryByLabelText('From Session A')).toBeNull()
  })

  it('does not show a source marker for workspace tabs', () => {
    useBrowserPanelStore.getState().openWorkspaceFileTab({
      workspaceId: 'workspace-1',
      path: 'src/index.ts',
      view: 'preview',
    })
    useBrowserPanelStore.getState().openWorkspaceDiffTab({
      workspaceId: 'workspace-1',
      title: 'All Changes',
    })

    render(<BrowserPanel activeSessionId="session-b" activeSessionTitle="Session B" />)

    expect(screen.queryByLabelText(/From /)).toBeNull()
  })

  it('marks the rendered fallback tab active when active tab state is missing', () => {
    const tabId = useBrowserPanelStore.getState().createTab('https://example.com')
    useBrowserPanelStore.setState(state => ({
      ...state,
      owners: {
        ...state.owners,
        [DEFAULT_BROWSER_PANEL_OWNER_ID]: {
          ...state.owners[DEFAULT_BROWSER_PANEL_OWNER_ID]!,
          activeTabId: null,
        },
      },
      activeTabId: null,
    }))

    render(<BrowserPanel />)

    expect(screen.getByRole('button', { name: 'https://example.com' }).getAttribute('aria-current')).toBe('page')
    expect(useBrowserPanelStore.getState().activeTabId).toBe(tabId)
  })

  it('opens requested native browser tabs once after unrelated tab state updates', async () => {
    useBrowserPanelStore.getState().requestTab('https://example.com')

    render(<BrowserPanel />)

    await waitFor(() => {
      expect(browserBridge.open).toHaveBeenCalledTimes(1)
    })
    expect(browserBridge.open).toHaveBeenCalledWith({
      threadId: DEFAULT_BROWSER_PANEL_OWNER_ID,
      initialUrl: 'https://example.com',
    })

    act(() => {
      useBrowserPanelStore.getState().updateTab('native-tab-1', { loading: true })
    })

    expect(browserBridge.open).toHaveBeenCalledTimes(1)
  })
})
