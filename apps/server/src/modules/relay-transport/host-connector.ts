import net from 'node:net'

import WebSocket from 'ws'
import { eq } from 'drizzle-orm'

import { relayHostEnrollments } from '@cradle/db'

import { AppError } from '../../errors/app-error'
import { db } from '../../infra'
import { createChildLogger } from '../../logging/logger'
import { readSecret } from '../secrets/service'
import { mintRelayToken } from '../relay-servers/relay-token-service'
import { loadPrivateKeyBytes, publicKeyFromPrivate } from './crypto'
import { relayEnvelopeSchema, type RelayEnvelope } from './protocol'
import { RelaySession } from './session'

const logger = createChildLogger({ module: 'relay-host-connector' })

/**
 * Host-side always-on background service.
 *
 * For each `relay_host_enrollments` row, maintains a /ws/host connection to
 * relayd with exponential-backoff reconnect. On first pairing it uses the
 * stored pairing code; once paired it reconnects via the pinned controller
 * pubkey (no human intervention). Each `stream_open` from the controller is
 * bridged to a `net.connect` against this Cradle Server's own HTTP port, so
 * the controller's `RemoteCradleClient` reaches the host server end-to-end.
 */

export interface HostConnectorConfig {
  /** The host's own Cradle Server address (where stream_open connects to). */
  localServerHost: string
  localServerPort: number
}

/**
 * In-memory snapshot of a host enrollment's live connection state. Not persisted
 * — re-learned from the controller's `hello` on each reconnect, so it's null
 * until the first handshake after a Cradle Server restart.
 */
export interface HostEnrollmentLiveState {
  /** True when the E2E session is currently ready (controller connected right now). */
  connected: boolean
  /** Controller label learned from its `hello.name`, or null if not yet known. */
  controllerName: string | null
  /** Unix ms of the most recent successful handshake, or null if never. */
  lastReadyAt: number | null
  /** Currently open tunneled streams (a controller with active traffic has ≥1). */
  activeStreams: number
}

interface ActiveStream {
  socket: net.Socket
  streamId: string
}

class HostConnection {
  private streams = new Map<string, ActiveStream>()
  private session: RelaySession | null = null
  private ws: WebSocket | null = null
  private stopped = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private backoffMs = 1_000
  private readonly maxBackoffMs = 30_000
  /** Unix ms of the most recent `onReady` (controller connected + handshake done). */
  private lastReadyAt: number | null = null
  /** Controller label learned from its `hello.name`. Cleared on teardown. */
  private controllerName: string | null = null

  constructor(
    private readonly enrollmentId: string,
    private readonly config: HostConnectorConfig,
    private readonly reloadEnrollment: () => Promise<HostEnrollmentRecord>,
    private readonly onPaired: (controllerPubkey: string) => void,
    private readonly onStatus: (status: 'pending' | 'paired' | 'offline', lastError?: string) => void,
  ) {}

  start(): void {
    this.stopped = false
    void this.loop()
  }

  stop(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    void this.teardown()
  }

  /** Snapshot of the in-memory connection state for UI surfacing. */
  getLiveState(): HostEnrollmentLiveState {
    return {
      connected: this.session?.isReady ?? false,
      controllerName: this.controllerName,
      lastReadyAt: this.lastReadyAt,
      activeStreams: this.streams.size,
    }
  }

  private async loop(): Promise<void> {
    if (this.stopped) {
      return
    }
    try {
      const enrollment = await this.reloadEnrollment()
      await this.ensureRoom(enrollment)
      await this.connectAndServe(enrollment)
      // If connectAndServe returns normally, the connection dropped; schedule reconnect.
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn('relay host connection dropped', { enrollmentId: this.enrollmentId, err: message })
      this.onStatus('offline', message)
    }
    await this.teardown()
    if (this.stopped) {
      return
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.loop()
    }, this.backoffMs)
    this.reconnectTimer.unref?.()
    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs)
  }

  private async ensureRoom(enrollment: HostEnrollmentRecord): Promise<void> {
    // Re-create/renew the room idempotently so a reconnect after a relayd
    // restart (or after RoomTTL with no peers) succeeds.
    const roomStart = mintRelayToken({
      subject: `host:${enrollment.id}`,
      purpose: 'room_start',
      roomId: enrollment.roomId,
      ttlMs: 2 * 60 * 1000,
    })
    const hostWs = mintRelayToken({
      subject: `host:${enrollment.id}`,
      role: 'host',
      purpose: 'ws',
      roomId: enrollment.roomId,
      ttlMs: 60 * 1000,
    })
    const url = new URL('/rooms/host-session', `${enrollment.relayUrl.replace(/\/+$/, '')}/`)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${roomStart.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hostToken: hostWs.token }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new AppError({
        code: 'relay_host_session_failed',
        status: 502,
        message: `relayd /rooms/host-session returned ${response.status}: ${text}`,
      })
    }
  }

  private connectAndServe(enrollment: HostEnrollmentRecord): Promise<void> {
    const wsUrl = toWebSocketUrl(enrollment.relayUrl, '/ws/host')
    return new Promise<void>((resolve, reject) => {
      let settled = false
      const drop = (error: Error) => {
        if (settled) {
          return
        }
        settled = true
        reject(error)
      }

      const hostWs = mintRelayToken({
        subject: `host:${enrollment.id}`,
        role: 'host',
        purpose: 'ws',
        roomId: enrollment.roomId,
        ttlMs: 60 * 1000,
      })

      let ws: WebSocket
      try {
        ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${hostWs.token}` } })
      }
      catch (error) {
        drop(error instanceof Error ? error : new Error(String(error)))
        return
      }
      this.ws = ws

      const isReconnect = Boolean(enrollment.pinnedControllerPubkey)
      let learnedControllerPubkey: string | null = null
      const session = new RelaySession(
        'host',
        enrollment.hostPrivateKey,
        {
          roomId: enrollment.roomId,
          ourPublicKeyBase64: enrollment.hostPubkey,
          ...(isReconnect ? { pinnedPeerPubkey: enrollment.pinnedControllerPubkey! } : { pairingCode: enrollment.pairingCode ?? '' }),
        },
        {
          send: (data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data)
            }
          },
          onReady: () => {
            ws.removeAllListeners('close')
            ws.removeAllListeners('error')
            ws.on('close', () => drop(new Error('relayd closed the host websocket')))
            ws.on('error', () => drop(new Error('relayd host websocket error')))
            this.backoffMs = 1_000 // reset backoff after a clean ready
            this.lastReadyAt = Date.now()
            if (!enrollment.pinnedControllerPubkey && learnedControllerPubkey) {
              this.onPaired(learnedControllerPubkey)
            }
            this.onStatus('paired')
          },
          onPeerPubkey: (controllerPubkey) => {
            if (!enrollment.pinnedControllerPubkey) {
              learnedControllerPubkey = controllerPubkey
            }
          },
          onPeerInfo: (info) => {
            if (info.name) {
              this.controllerName = info.name
            }
          },
          onStreamOpen: (streamId) => this.openLocalStream(streamId),
          onStreamData: (streamId, data) => this.handleStreamData(streamId, data),
          onStreamClose: (streamId) => this.handleStreamClose(streamId),
          onPeerClosed: () => drop(new Error('controller peer closed')),
          onError: error => drop(error),
          onPauseStream: (streamId) => this.streams.get(streamId)?.socket.pause(),
          onResumeStream: (streamId) => this.streams.get(streamId)?.socket.resume(),
        },
      )
      this.session = session

      ws.once('open', () => session.start())
      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const env = relayEnvelopeSchema.parse(JSON.parse(data.toString('utf8')))
          session.handleEnvelope(env as RelayEnvelope)
        }
        catch (error) {
          drop(error instanceof Error ? error : new Error(String(error)))
        }
      })
      ws.once('close', () => drop(new Error('relayd closed the host websocket before ready')))
      ws.once('error', error => drop(error))
    })
  }

  private openLocalStream(streamId: string): void {
    const session = this.session
    if (!session) {
      return
    }
    const socket = net.connect({ host: this.config.localServerHost, port: this.config.localServerPort })
    this.streams.set(streamId, { socket, streamId })

    socket.on('data', (chunk: Buffer) => {
      session.writeStreamData(streamId, new Uint8Array(chunk))
    })
    socket.on('close', () => {
      session.closeStream(streamId, 'local server socket closed')
      this.streams.delete(streamId)
    })
    socket.on('error', () => {
      session.closeStream(streamId, 'local server socket error')
      this.streams.delete(streamId)
    })
  }

  private handleStreamData(streamId: string, data: Uint8Array): void {
    const stream = this.streams.get(streamId)
    if (!stream) {
      return
    }
    stream.socket.write(Buffer.from(data), (error) => {
      if (error) {
        stream.socket.destroy()
      }
    })
  }

  private handleStreamClose(streamId: string): void {
    const stream = this.streams.get(streamId)
    if (!stream) {
      return
    }
    stream.socket.destroy()
    this.streams.delete(streamId)
  }

  private async teardown(): Promise<void> {
    this.session?.close()
    this.session = null
    if (this.ws) {
      this.ws.removeAllListeners()
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }
    for (const { socket } of this.streams.values()) {
      socket.destroy()
    }
    this.streams.clear()
  }
}

interface HostEnrollmentRecord {
  id: string
  relayUrl: string
  roomId: string
  hostPubkey: string
  hostPrivateKey: string
  pinnedControllerPubkey: string | null
  pairingCode: string | null
}

export class HostConnectorService {
  private readonly connections = new Map<string, HostConnection>()

  constructor(private readonly config: HostConnectorConfig) {}
  startAll(): void {
    const enrollments = db()
      .select()
      .from(relayHostEnrollments)
      .all()
    for (const enrollment of enrollments) {
      this.startForEnrollment(enrollment.id)
    }
  }

  stopAll(): void {
    for (const id of [...this.connections.keys()]) {
      this.stopForEnrollment(id)
    }
  }

  startForEnrollment(enrollmentId: string): void {
    if (this.connections.has(enrollmentId)) {
      return
    }
    const reload = async (): Promise<HostEnrollmentRecord> => {
      const row = db()
        .select()
        .from(relayHostEnrollments)
        .where(eq(relayHostEnrollments.id, enrollmentId))
        .get()
      if (!row) {
        throw new AppError({ code: 'relay_host_enrollment_not_found', status: 404, message: 'Relay host enrollment not found.' })
      }
      return {
        id: row.id,
        relayUrl: row.relayUrl,
        roomId: row.roomId,
        hostPubkey: row.hostPubkey,
        hostPrivateKey: readHostPrivateKey(row.hostPrivateKeySecretId, row.hostPubkey),
        pinnedControllerPubkey: row.pinnedControllerPubkey,
        pairingCode: row.pairingCode,
      }
    }
    const onPaired = (controllerPubkey: string) => {
      const now = Math.floor(Date.now() / 1000)
      db()
        .update(relayHostEnrollments)
        .set({ pinnedControllerPubkey: controllerPubkey, status: 'paired', pairingCode: null, lastError: null, updatedAt: now })
        .where(eq(relayHostEnrollments.id, enrollmentId))
        .run()
      logger.info('relay host enrollment paired', { enrollmentId, controllerPubkeyFingerprint: controllerPubkey.slice(0, 16) })
    }
    const onStatus = (status, lastError) => {
      const now = Math.floor(Date.now() / 1000)
      db()
        .update(relayHostEnrollments)
        .set({ status, lastError: lastError ?? null, updatedAt: now })
        .where(eq(relayHostEnrollments.id, enrollmentId))
        .run()
    }
    const connection = new HostConnection(enrollmentId, this.config, reload, onPaired, onStatus)
    this.connections.set(enrollmentId, connection)
    connection.start()
  }

  stopForEnrollment(enrollmentId: string): void {
    const connection = this.connections.get(enrollmentId)
    if (!connection) {
      return
    }
    this.connections.delete(enrollmentId)
    connection.stop()
  }

  restartForEnrollment(enrollmentId: string): void {
    this.stopForEnrollment(enrollmentId)
    this.startForEnrollment(enrollmentId)
  }

  /** Live in-memory state for an enrollment, or null if no connector is running for it. */
  getLiveState(enrollmentId: string): HostEnrollmentLiveState | null {
    return this.connections.get(enrollmentId)?.getLiveState() ?? null
  }
}

function readHostPrivateKey(secretId: string, expectedPublicKey: string): string {
  const privateKey = readSecret(secretId)
  // Sanity check: the stored private key must derive the stored public key.
  if (publicKeyFromPrivate(privateKey) !== expectedPublicKey) {
    throw new AppError({
      code: 'relay_host_enrollment_key_mismatch',
      status: 500,
      message: 'Stored host private key does not match the enrollment public key.',
    })
  }
  return privateKey
}

// Re-export for callers (e.g. enrollment service) that need to load the key.
export { loadPrivateKeyBytes }

// ── singleton accessor ──

let hostConnectorSingleton: HostConnectorService | null = null

export function initHostConnectorService(config: HostConnectorConfig): HostConnectorService {
  hostConnectorSingleton = new HostConnectorService(config)
  return hostConnectorSingleton
}

export function getHostConnectorService(): HostConnectorService | null {
  return hostConnectorSingleton
}

function toWebSocketUrl(relayUrl: string, path: string): string {
  const url = new URL(path, `${relayUrl.replace(/\/+$/, '')}/`)
  if (url.protocol === 'http:') {
    url.protocol = 'ws:'
  }
  else if (url.protocol === 'https:') {
    url.protocol = 'wss:'
  }
  return url.toString()
}
