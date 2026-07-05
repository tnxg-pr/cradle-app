import { describe, expect, it } from 'vitest'

import {
  AGENT_MODELS_QUERY_KEY,
  agentModelsQueryKey,
  providerTargetModelsQueryKey,
  shouldRefreshProviderTargetModelsOnCacheMiss,
} from './use-agent-models'

describe('agentModelsQueryKey', () => {
  it('uses one stable cache slot per profile', () => {
    expect(agentModelsQueryKey('profile-1')).toEqual([...AGENT_MODELS_QUERY_KEY, 'profile-1'])
  })

  it('uses a stable disabled-query key for empty profile selection', () => {
    expect(agentModelsQueryKey(null)).toEqual([...AGENT_MODELS_QUERY_KEY, 'no-profile'])
  })
})

describe('providerTargetModelsQueryKey', () => {
  it('uses one stable cache slot per provider target', () => {
    expect(providerTargetModelsQueryKey({ kind: 'external', id: 'target-1' })).toEqual([
      ...AGENT_MODELS_QUERY_KEY,
      'provider-target:target-1',
    ])
  })

  it('uses a stable disabled-query key for empty target selection', () => {
    expect(providerTargetModelsQueryKey(null)).toEqual([
      ...AGENT_MODELS_QUERY_KEY,
      'no-provider-target',
    ])
  })

  it('can scope provider target cache by workspace', () => {
    expect(providerTargetModelsQueryKey({ kind: 'external', id: 'target-1' }, 'workspace-1')).toEqual([
      ...AGENT_MODELS_QUERY_KEY,
      'provider-target:target-1',
      'workspace:workspace-1',
    ])
  })
})

describe('shouldRefreshProviderTargetModelsOnCacheMiss', () => {
  it('refreshes runtime-owned provider targets on cache miss', () => {
    expect(shouldRefreshProviderTargetModelsOnCacheMiss({
      id: 'runtime-native:opencode:opencode-go',
    })).toBe(true)
  })

  it('refreshes provider targets from runtime-owned sources on cache miss', () => {
    expect(shouldRefreshProviderTargetModelsOnCacheMiss({
      id: 'projected-provider',
      sourceKey: 'runtime-native:opencode',
    })).toBe(true)
  })

  it('keeps ordinary provider targets cache-only until the user explicitly refreshes', () => {
    expect(shouldRefreshProviderTargetModelsOnCacheMiss({
      id: 'manual-provider',
      sourceKey: 'external-source:local-agent-config',
    })).toBe(false)
  })
})
