import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

import { createRelayRoomId, mintRelayToken } from '../../src/modules/relay-servers/relay-token-service'
import { generateRelayKeyPair, relayPublicKeyFingerprint } from '../../src/modules/relay-transport/crypto'
import { startRelayControllerTransport } from '../../src/modules/relay-transport/controller-transport'
import { relayEnvelopeSchema } from '../../src/modules/relay-transport/protocol'
import { RelaySession } from '../../src/modules/relay-transport/session'

/**
 * End-to-end relay transport test: spawns a REAL relayd subprocess and drives
 * the full controller<->host tunnel through it — pairing, E2E handshake,
 * stream multiplexing, an HTTP request round-trip, and a pinned-pubkey
 * reconnect. This is the only test that exercises the WebSocket wiring against
 * the actual relay.
 */

const TEST_HMAC_SECRET = 'e2e-test-relay-hmac-secret'
const moduleDir = fileURLToPath(new URL('.', import.meta.url))
const relaydSourceDir = resolveRelaydSourceDir()

interface RelaydHandle {
  relayUrl: string
  child: ChildProcess
}

function resolveRelaydSourceDir(): string | null {
  const candidates = [
    resolve(process.cwd(), '../relayd'),
    resolve(process.cwd(), 'apps/relayd'),
    resolve(moduleDir, '../../../../relayd'),
  ]
  for (const candidate of candidates) {
    if (existsSyncSafe(join(candidate, 'go.mod')) && existsSyncSafe(join(candidate, 'cmd/relayd/main.go'))) {
      return candidate
    }
  }
  return null
}

function existsSyncSafe(path: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node:fs').existsSync(path)
  }
  catch {
    return false
  }
}

async function spawnRelayd(): Promise<RelaydHandle> {
  if (!relaydSourceDir) {
    throw new Error('relayd source tree not found; cannot run e2e test')
  }
  const port = await allocatePort()
  const listenAddr = `127.0.0.1:${port}`
  const relayUrl = `http://127.0.0.1:${port}`
  const child = spawn('go', ['run', './cmd/relayd'], {
    cwd: relaydSourceDir,
    env: {
      ...process.env,
      CRADLE_RELAYD_LISTEN: listenAddr,
      CRADLE_RELAYD_PUBLIC_URL: relayUrl,
      CRADLE_RELAYD_HMAC_SECRET: TEST_HMAC_SECRET,
      CRADLE_RELAYD_ROOM_TTL: '30s',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.on('data', () => {})
  child.stderr?.on('data', () => {})

  await waitForReady(relayUrl)
  return { relayUrl, child }
}

function allocatePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const net = require('node:net') as typeof import('node:net')
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolvePort(address.port)
      })
    })
  })
}

async function waitForReady(relayUrl: string): Promise<void> {
  const deadline = Date.now() + 30_000 // `go run` compiles on first launch
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL('/readyz', `${relayUrl}/`), { signal: AbortSignal.timeout(500) })
      if (response.ok) {
        return
      }
      lastError = new Error(`relayd ready check returned HTTP ${response.status}`)
    }
    catch (error) {
      lastError = error
    }
    await new Promise(r => setTimeout(r, 200))
  }
  throw lastError instanceof Error ? lastError : new Error('relayd did not become ready')
}

function killRelayd(child: ChildProcess): void {
  try {
    child.kill('SIGTERM')
  }
  catch {
    // ignore
  }
}

// ── Host-side bridge: connects /ws/host, runs a RelaySession, and bridges
//    each stream_open to a local TCP target (the fake host server). ──

interface HostBridge {
  session: RelaySession
  stop: () => Promise<void>
}

async function startHostBridge(opts: {
  relayUrl: string
  roomId: string
  hostWsToken: string
  hostPrivateKey: string
  hostPublicKey: string
  pairingCode: string
  targetHost: string
  targetPort: number
}): Promise<HostBridge> {
  const streams = new Map<string, import('node:net').Socket>()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const net = require('node:net') as typeof import('node:net')
  const wsUrl = toWsUrl(opts.relayUrl, '/ws/host')
  const ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${opts.hostWsToken}` } })

  const session = new RelaySession(
    'host',
    opts.hostPrivateKey,
    { roomId: opts.roomId, ourPublicKeyBase64: opts.hostPublicKey, pairingCode: opts.pairingCode },
    {
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      },
      onStreamOpen: (streamId) => {
        const socket = net.connect({ host: opts.targetHost, port: opts.targetPort })
        streams.set(streamId, socket)
        socket.on('data', (chunk: Buffer) => session.writeStreamData(streamId, new Uint8Array(chunk)))
        socket.on('close', () => { session.closeStream(streamId, 'target closed'); streams.delete(streamId) })
        socket.on('error', () => { session.closeStream(streamId, 'target error'); streams.delete(streamId) })
      },
      onStreamData: (streamId, data) => {
        const socket = streams.get(streamId)
        if (socket) {
          socket.write(Buffer.from(data))
        }
      },
      onStreamClose: (streamId) => {
        const socket = streams.get(streamId)
        if (socket) {
          socket.destroy()
          streams.delete(streamId)
        }
      },
      onError: () => {},
    },
  )
  ws.on('message', (data: WebSocket.RawData) => {
    const env = relayEnvelopeSchema.parse(JSON.parse(data.toString('utf8')))
    session.handleEnvelope(env)
  })

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => {
      session.start()
      resolve()
    })
    ws.once('error', reject)
  })

  return {
    session,
    stop: async () => {
      session.close()
      for (const socket of streams.values()) {
        socket.destroy()
      }
      streams.clear()
      ws.removeAllListeners()
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    },
  }
}

function toWsUrl(relayUrl: string, path: string): string {
  const url = new URL(path, `${relayUrl.replace(/\/+$/, '')}/`)
  if (url.protocol === 'http:') {
    url.protocol = 'ws:'
  }
  else if (url.protocol === 'https:') {
    url.protocol = 'wss:'
  }
  return url.toString()
}

async function callPairingStart(relayUrl: string, pairingStartToken: string, hostToken: string, roomId: string): Promise<{ pairingCode: string, roomId: string }> {
  const response = await fetch(new URL('/pairing/start', `${relayUrl}/`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${pairingStartToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, roomId }),
  })
  if (!response.ok) {
    throw new Error(`/pairing/start returned ${response.status}: ${await response.text()}`)
  }
  return await response.json() as { pairingCode: string, roomId: string }
}

async function callPairingClaim(relayUrl: string, claimToken: string, pairingCode: string, controllerToken: string): Promise<{ roomId: string }> {
  const response = await fetch(new URL('/pairing/claim', `${relayUrl}/`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${claimToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingCode, controllerToken }),
  })
  if (!response.ok) {
    throw new Error(`/pairing/claim returned ${response.status}: ${await response.text()}`)
  }
  return await response.json() as { roomId: string }
}

function startFakeHostServer(): Promise<{ baseUrl: string, server: Server, requests: string[] }> {
  const requests: string[] = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk.toString() })
    req.on('end', () => {
      requests.push(`${req.method} ${req.url} ${body}`)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, echo: body, path: req.url }))
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({ baseUrl: `http://127.0.0.1:${address.port}`, server, requests })
    })
  })
}

describe.skipIf(!relaydSourceDir)('relay transport e2e (real relayd)', () => {
  let relayd: RelaydHandle
  let fakeHost: { baseUrl: string, server: Server, requests: string[] }
  let dataDir: string
  const previousHmac = process.env.CRADLE_RELAY_HMAC_SECRET

  beforeAll(async () => {
    process.env.CRADLE_RELAY_HMAC_SECRET = TEST_HMAC_SECRET
    dataDir = mkdtempSync(join(tmpdir(), 'cradle-relay-e2e-'))
    process.env.CRADLE_DATA_DIR = dataDir
    relayd = await spawnRelayd()
    fakeHost = await startFakeHostServer()
  }, 60_000)

  afterAll(async () => {
    killRelayd(relayd.child)
    await new Promise<void>((resolve) => fakeHost.server.close(() => resolve()))
    rmSync(dataDir, { recursive: true, force: true })
    if (previousHmac === undefined) {
      delete process.env.CRADLE_RELAY_HMAC_SECRET
    }
    else {
      process.env.CRADLE_RELAY_HMAC_SECRET = previousHmac
    }
  })

  it('pairs, tunnels an HTTP request end-to-end, and reconnects with pinned pubkeys', async () => {
    // ── Host: create room + pairing code ──
    const hostKeys = generateRelayKeyPair()
    const controllerKeys = generateRelayKeyPair()
    const roomId = createRelayRoomId()
    const hostFingerprint = relayPublicKeyFingerprint(hostKeys.publicKeyBase64)

    const pairingStart = mintRelayToken({ subject: 'host:e2e', purpose: 'pairing_start', roomId, ttlMs: 5 * 60 * 1000 })
    const hostWs = mintRelayToken({ subject: 'host:e2e', role: 'host', purpose: 'ws', roomId, ttlMs: 5 * 60 * 1000 })
    const { pairingCode } = await callPairingStart(relayd.relayUrl, pairingStart.token, hostWs.token, roomId)

    // ── Host: start the bridge (WS + session + TCP target = fake host server).
    //    The host session won't be ready until the controller connects and the
    //    handshake completes — that happens in startRelayControllerTransport
    //    below, which retries until both sides are ready. ──
    const fakeHostPort = Number(new URL(fakeHost.baseUrl).port)
    const hostBridge = await startHostBridge({
      relayUrl: relayd.relayUrl,
      roomId,
      hostWsToken: hostWs.token,
      hostPrivateKey: hostKeys.privateKeyBase64,
      hostPublicKey: hostKeys.publicKeyBase64,
      pairingCode,
      targetHost: '127.0.0.1',
      targetPort: fakeHostPort,
    })

    // ── Controller: claim the pairing ──
    const claimToken = mintRelayToken({ subject: 'controller:e2e', purpose: 'pairing_claim', ttlMs: 5 * 60 * 1000 })
    const lookup = await callPairingClaim(relayd.relayUrl, claimToken.token, pairingCode, '')
    expect(lookup.roomId).toBe(roomId)
    const controllerWs = mintRelayToken({ subject: 'controller:e2e', role: 'controller', purpose: 'ws', roomId, ttlMs: 5 * 60 * 1000 })
    await callPairingClaim(relayd.relayUrl, claimToken.token, pairingCode, controllerWs.token)

    // ── Controller: start the relay transport (first pairing) ──
    const handle = await startRelayControllerTransport({
      hostId: 'e2e-host',
      relayUrl: relayd.relayUrl,
      roomId,
      wsToken: controllerWs.token,
      controllerPrivateKeyBase64: controllerKeys.privateKeyBase64,
      controllerPublicKeyBase64: controllerKeys.publicKeyBase64,
      pairingCode,
      readyTimeoutMs: 15_000,
    })

    expect(handle.hostPublicKeyBase64).toBe(hostKeys.publicKeyBase64)
    expect(relayPublicKeyFingerprint(handle.hostPublicKeyBase64!)).toBe(hostFingerprint)

    // ── Tunnel an HTTP request through the controller's local port ──
    const response = await fetch(`${handle.localBaseUrl}/hello`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'ping',
    })
    expect(response.status).toBe(200)
    const json = await response.json() as { ok: boolean, echo: string, path: string }
    expect(json.ok).toBe(true)
    expect(json.echo).toBe('ping')
    expect(json.path).toBe('/hello')
    expect(fakeHost.requests).toContain('POST /hello ping')

    await handle.close()
    await hostBridge.stop()

    // ── Reconnect with pinned pubkeys (no pairing code) ──
    // Re-create the room (host-session) and reconnect both sides.
    const roomStart = mintRelayToken({ subject: 'host:e2e', purpose: 'room_start', roomId, ttlMs: 5 * 60 * 1000 })
    const hostWs2 = mintRelayToken({ subject: 'host:e2e', role: 'host', purpose: 'ws', roomId, ttlMs: 5 * 60 * 1000 })
    const renewResponse = await fetch(new URL('/rooms/host-session', `${relayd.relayUrl}/`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${roomStart.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostToken: hostWs2.token }),
    })
    expect(renewResponse.ok).toBe(true)

    const hostBridgeReconnect = await startHostBridgePinned({
      relayUrl: relayd.relayUrl,
      roomId,
      hostWsToken: hostWs2.token,
      hostPrivateKey: hostKeys.privateKeyBase64,
      hostPublicKey: hostKeys.publicKeyBase64,
      pinnedControllerPubkey: controllerKeys.publicKeyBase64,
      targetHost: '127.0.0.1',
      targetPort: fakeHostPort,
    })

    const controllerWs2 = mintRelayToken({ subject: 'controller:e2e', role: 'controller', purpose: 'ws', roomId, ttlMs: 60 * 1000 })
    const handle2 = await startRelayControllerTransport({
      hostId: 'e2e-host',
      relayUrl: relayd.relayUrl,
      roomId,
      wsToken: controllerWs2.token,
      controllerPrivateKeyBase64: controllerKeys.privateKeyBase64,
      controllerPublicKeyBase64: controllerKeys.publicKeyBase64,
      pinnedHostPubkey: hostKeys.publicKeyBase64,
      readyTimeoutMs: 15_000,
    })

    const response2 = await fetch(`${handle2.localBaseUrl}/again`, { method: 'GET' })
    expect(response2.status).toBe(200)
    const json2 = await response2.json() as { ok: boolean, path: string }
    expect(json2.ok).toBe(true)
    expect(json2.path).toBe('/again')

    await handle2.close()
    await hostBridgeReconnect.stop()
  }, 60_000)
})

// Pinned-pubkey variant of startHostBridge for the reconnect phase.
async function startHostBridgePinned(opts: {
  relayUrl: string
  roomId: string
  hostWsToken: string
  hostPrivateKey: string
  hostPublicKey: string
  pinnedControllerPubkey: string
  targetHost: string
  targetPort: number
}): Promise<HostBridge> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const net = require('node:net') as typeof import('node:net')
  const streams = new Map<string, import('node:net').Socket>()
  const wsUrl = toWsUrl(opts.relayUrl, '/ws/host')
  const ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${opts.hostWsToken}` } })

  const session = new RelaySession(
    'host',
    opts.hostPrivateKey,
    { roomId: opts.roomId, ourPublicKeyBase64: opts.hostPublicKey, pinnedPeerPubkey: opts.pinnedControllerPubkey },
    {
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      },
      onStreamOpen: (streamId) => {
        const socket = net.connect({ host: opts.targetHost, port: opts.targetPort })
        streams.set(streamId, socket)
        socket.on('data', (chunk: Buffer) => session.writeStreamData(streamId, new Uint8Array(chunk)))
        socket.on('close', () => { session.closeStream(streamId, 'target closed'); streams.delete(streamId) })
        socket.on('error', () => { session.closeStream(streamId, 'target error'); streams.delete(streamId) })
      },
      onStreamData: (streamId, data) => {
        streams.get(streamId)?.write(Buffer.from(data))
      },
      onStreamClose: (streamId) => {
        const socket = streams.get(streamId)
        if (socket) {
          socket.destroy()
          streams.delete(streamId)
        }
      },
      onError: () => {},
    },
  )
  ws.on('message', (data: WebSocket.RawData) => {
    const env = relayEnvelopeSchema.parse(JSON.parse(data.toString('utf8')))
    session.handleEnvelope(env)
  })

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => {
      session.start()
      resolve()
    })
    ws.once('error', reject)
  })

  return {
    session,
    stop: async () => {
      session.close()
      for (const socket of streams.values()) {
        socket.destroy()
      }
      streams.clear()
      ws.removeAllListeners()
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    },
  }
}
