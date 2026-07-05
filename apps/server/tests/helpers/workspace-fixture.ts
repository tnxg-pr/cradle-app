import { localWorkspaceLocator, serializeWorkspaceLocator } from '../../src/modules/workspace/workspace-locator'

export function localWorkspaceLocatorJson(path: string): string {
  return serializeWorkspaceLocator(localWorkspaceLocator(path))
}

export function workspaceFixture(input: {
  id: string
  name: string
  path: string
  identifier?: string
}) {
  return {
    id: input.id,
    name: input.name,
    locatorJson: localWorkspaceLocatorJson(input.path),
    ...(input.identifier !== undefined ? { identifier: input.identifier } : {}),
  }
}
