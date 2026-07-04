import { beforeEach, describe, expect, it } from 'vitest'

import { useNativeBrowserSurfaceSuppressionStore } from './native-surface-suppression'

describe('native browser surface suppression', () => {
  beforeEach(() => {
    useNativeBrowserSurfaceSuppressionStore.setState({ suppressCount: 0 })
  })

  it('reference-counts active suppressors', () => {
    const firstRelease = useNativeBrowserSurfaceSuppressionStore.getState().acquire()
    const secondRelease = useNativeBrowserSurfaceSuppressionStore.getState().acquire()

    expect(useNativeBrowserSurfaceSuppressionStore.getState().suppressCount).toBe(2)

    firstRelease()
    expect(useNativeBrowserSurfaceSuppressionStore.getState().suppressCount).toBe(1)

    secondRelease()
    expect(useNativeBrowserSurfaceSuppressionStore.getState().suppressCount).toBe(0)
  })

  it('ignores duplicate releases', () => {
    const release = useNativeBrowserSurfaceSuppressionStore.getState().acquire()

    release()
    release()

    expect(useNativeBrowserSurfaceSuppressionStore.getState().suppressCount).toBe(0)
  })
})
