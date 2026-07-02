import type { Config } from '@opencode-ai/sdk'
import { afterEach, describe, expect, it } from 'vitest'

import {
  mergeOpencodeRuntimeConfig,
  resolveOpencodeConfigDirectory,
  resolveOpencodeDatabasePath,
  resolveOpencodeRuntimeDirectory,
} from './runtime-context'

describe('mergeOpencodeRuntimeConfig', () => {
  it('merges provider and MCP entries without replacing unrelated runtime config', () => {
    const base: Config = {
      model: 'existing-provider/gpt',
      provider: {
        'existing-provider': {
          id: 'existing-provider',
          name: 'Existing Provider',
          api: 'openai-compatible',
          npm: '@ai-sdk/openai-compatible',
          options: {},
          models: {
            gpt: {
              id: 'gpt',
              name: 'GPT',
            },
          },
        },
      },
      mcp: {
        'existing-mcp': {
          type: 'local',
          command: ['node', '/existing/mcp.mjs'],
        },
      },
      small_model: 'existing-provider/gpt-mini',
    }
    const incoming: Config = {
      model: 'cradle-manual-target-1/gpt-5',
      provider: {
        'cradle-manual-target-1': {
          id: 'cradle-manual-target-1',
          name: 'Cradle Target',
          api: 'openai',
          npm: '@ai-sdk/openai',
          options: {
            apiKey: 'secret-value',
            timeout: false,
          },
          models: {
            'gpt-5': {
              id: 'gpt-5',
              name: 'GPT-5',
            },
          },
        },
      },
      mcp: {
        'browser-use': {
          type: 'local',
          command: ['node', '/plugins/browser-use/dist/mcp-server.mjs'],
          environment: { BROWSER_BACKEND_SOCKET: '/tmp/cradle-browser.sock' },
          enabled: true,
        },
        'nowledge-mem': {
          type: 'remote',
          url: 'https://nowledge.example.test/mcp',
          headers: { Authorization: 'Bearer nowledge-secret' },
          enabled: true,
        },
      },
    }

    expect(mergeOpencodeRuntimeConfig(base, incoming)).toEqual({
      model: 'existing-provider/gpt',
      provider: {
        ...base.provider,
        ...incoming.provider,
      },
      mcp: {
        ...base.mcp,
        ...incoming.mcp,
      },
      small_model: 'existing-provider/gpt-mini',
    })
  })
})

describe('resolveOpencodeRuntimeDirectory', () => {
  const previousDataDir = process.env.CRADLE_DATA_DIR

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.CRADLE_DATA_DIR
    }
    else {
      process.env.CRADLE_DATA_DIR = previousDataDir
    }
  })

  it('keeps opencode runtime files under the Cradle data directory', () => {
    process.env.CRADLE_DATA_DIR = '/tmp/cradle-data'

    expect(resolveOpencodeRuntimeDirectory()).toBe('/tmp/cradle-data/runtime/opencode')
    expect(resolveOpencodeConfigDirectory()).toBe('/tmp/cradle-data/runtime/opencode/config')
    expect(resolveOpencodeDatabasePath()).toBe('/tmp/cradle-data/runtime/opencode/opencode.db')
  })
})
