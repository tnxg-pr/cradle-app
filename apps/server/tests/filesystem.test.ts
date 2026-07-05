import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, parse } from 'node:path'

import { workspaces } from '@cradle/db'
import { describe, expect, it } from 'vitest'

import { createServerApp } from '../src/app'
import { db, shutdownInfra } from '../src/infra'
import { workspaceFixture } from './helpers/workspace-fixture'

type ElysiaApp = Awaited<ReturnType<typeof createServerApp>>

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

function insertWorkspace(id: string, name: string, path: string): void {
  db().insert(workspaces).values(workspaceFixture({ id, name, path })).run()
}

async function withFilesystemApp(
  run: (input: { app: ElysiaApp, homeDir: string, workspaceRoot: string }) => Promise<void>,
): Promise<void> {
  const dataDir = createTempDir('cradle-data-')
  const homeDir = createTempDir('cradle-home-')
  const workspaceRoot = createTempDir('cradle-filesystem-workspace-')
  const previousDataDir = process.env.CRADLE_DATA_DIR
  const previousHome = process.env.HOME
  process.env.CRADLE_DATA_DIR = dataDir
  process.env.HOME = homeDir
  shutdownInfra()

  try {
    const app = await createServerApp()
    await run({ app, homeDir, workspaceRoot })
  }
  finally {
    shutdownInfra()
    rmSync(dataDir, { recursive: true, force: true })
    rmSync(homeDir, { recursive: true, force: true })
    rmSync(workspaceRoot, { recursive: true, force: true })
    if (previousDataDir === undefined) {
      delete process.env.CRADLE_DATA_DIR
    }
    else {
      process.env.CRADLE_DATA_DIR = previousDataDir
    }
    if (previousHome === undefined) {
      delete process.env.HOME
    }
    else {
      process.env.HOME = previousHome
    }
  }
}

describe('filesystem browse boundaries', () => {
  it('rejects browse paths outside home and registered workspace roots', async () => {
    await withFilesystemApp(async ({ app }) => {
      const outsideRoot = parse(process.cwd()).root
      const response = await app.handle(new Request(`http://localhost/filesystem/browse?path=${encodeURIComponent(outsideRoot)}`))

      expect(response.status).toBe(403)
      expect((await response.json()).code).toBe('filesystem_path_outside_allowed_roots')
    })
  })

  it('accepts home and registered workspace descendants without exposing parents above roots', async () => {
    await withFilesystemApp(async ({ app, homeDir, workspaceRoot }) => {
      const workspaceChild = join(workspaceRoot, 'child')
      mkdirSync(workspaceChild)
      insertWorkspace('workspace-filesystem', 'Workspace Filesystem', workspaceRoot)

      const homeResponse = await app.handle(new Request(`http://localhost/filesystem/browse?path=${encodeURIComponent(homeDir)}`))
      expect(homeResponse.status).toBe(200)
      expect(await homeResponse.json()).toEqual(expect.objectContaining({
        current: homeDir,
        parent: null,
      }))

      const childResponse = await app.handle(new Request(`http://localhost/filesystem/browse?path=${encodeURIComponent(workspaceChild)}`))
      expect(childResponse.status).toBe(200)
      expect(await childResponse.json()).toEqual(expect.objectContaining({
        current: workspaceChild,
        parent: workspaceRoot,
      }))
    })
  })
})
