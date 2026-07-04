import { randomUUID } from 'node:crypto'

import { relayHostEnrollments } from '@cradle/db'
import { asc, eq } from 'drizzle-orm'

import { AppError } from '../../errors/app-error'
import { db } from '../../infra'
import { upsertSecret } from '../secrets/service'
import { createRelayRoomId, mintRelayToken } from '../relay-servers/relay-token-service'
import { generateRelayKeyPair, relayPublicKeyFingerprint } from './crypto'
import { getHostConnectorService, type HostEnrollmentLiveState } from './host-connector'

/**
 * Host-side enrollment service.
 *
 * Creating an enrollment = generating an X25519 keypair, asking relayd to mint
 * a pairing code + room via `POST /pairing/start`, persisting the enrollment
 * (with the private key in the secrets store), and starting the always-on
 * host-connector for it. The returned pairing string
 * `<pairingCode>#<hostKeyFingerprint>` is shown to the user and typed into a
 * controller to claim.
 */

export interface CreateHostEnrollmentInput {
  id?: string
  displayName: string
  relayUrl: string
}

export interface HostEnrollmentView {
  id: string
  displayName: string
  relayUrl: string
  roomId: string
  hostPubkey: string
  hostKeyFingerprint: string
  pinnedControllerPubkey: string | null
  status: 'pending' | 'paired' | 'offline'
  pairingCode: string | null
  lastError: string | null
  createdAt: number
  updatedAt: number
  /** Live in-memory state from the host-connector, or null if it isn't running. */
  live: HostEnrollmentLiveState | null
}

export interface CreatedHostEnrollment extends HostEnrollmentView {
  /** `<pairingCode>#<hostKeyFingerprint>` — show to the user, input on a controller. */
  pairingString: string
  pairingCodeExpiresAt: string | null
}

const RELAY_HOST_KEY_SECRET_KIND = 'system-relay-host-key'

export function listHostEnrollments(): HostEnrollmentView[] {
  return db()
    .select()
    .from(relayHostEnrollments)
    .orderBy(asc(relayHostEnrollments.displayName), asc(relayHostEnrollments.id))
    .all()
    .map(toView)
}

export function readHostEnrollment(id: string): HostEnrollmentView {
  const row = db()
    .select()
    .from(relayHostEnrollments)
    .where(eq(relayHostEnrollments.id, id))
    .get()
  if (!row) {
    throw new AppError({ code: 'relay_host_enrollment_not_found', status: 404, message: 'Relay host enrollment not found.', details: { id } })
  }
  return toView(row)
}

export async function createHostEnrollment(input: CreateHostEnrollmentInput): Promise<CreatedHostEnrollment> {
  const relayUrl = input.relayUrl.trim().replace(/\/+$/, '')
  if (!relayUrl) {
    throw new AppError({ code: 'relay_host_enrollment_relay_url_required', status: 400, message: 'Relay URL is required.' })
  }
  new URL(relayUrl) // throws on invalid

  const id = input.id ?? randomUUID()
  const keypair = generateRelayKeyPair()
  const roomId = createRelayRoomId()
  const fingerprint = relayPublicKeyFingerprint(keypair.publicKeyBase64)

  // Mint the tokens the host needs: a pairing_start token (to call
  // POST /pairing/start) and a host ws token (validated by relayd during
  // pairing start, then reused for the actual /ws/host connection).
  const pairingStart = mintRelayToken({
    subject: `host:${id}`,
    purpose: 'pairing_start',
    roomId,
    ttlMs: 5 * 60 * 1000,
  })
  const hostWs = mintRelayToken({
    subject: `host:${id}`,
    role: 'host',
    purpose: 'ws',
    roomId,
    ttlMs: 5 * 60 * 1000,
  })

  const startResponse = await callPairingStart(relayUrl, {
    pairingStartToken: pairingStart.token,
    hostToken: hostWs.token,
    roomId,
  })

  // Persist the private key as a managed secret.
  const secretId = `relay-host-key:${id}`
  upsertSecret({
    id: secretId,
    kind: RELAY_HOST_KEY_SECRET_KIND,
    label: `Relay host key (${input.displayName.trim()})`,
    secret: keypair.privateKeyBase64,
  })

  const now = Math.floor(Date.now() / 1000)
  db()
    .insert(relayHostEnrollments)
    .values({
      id,
      displayName: input.displayName.trim(),
      relayUrl,
      roomId,
      hostPubkey: keypair.publicKeyBase64,
      hostPrivateKeySecretId: secretId,
      pinnedControllerPubkey: null,
      status: 'pending',
      pairingCode: startResponse.pairingCode,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // Start the always-on connector so the host is ready when a controller claims.
  getHostConnectorService()?.startForEnrollment(id)

  const view = readHostEnrollment(id)
  return {
    ...view,
    pairingString: `${startResponse.pairingCode}#${fingerprint}`,
    pairingCodeExpiresAt: startResponse.expiresAt,
  }
}

export async function deleteHostEnrollment(id: string): Promise<void> {
  const row = db()
    .select()
    .from(relayHostEnrollments)
    .where(eq(relayHostEnrollments.id, id))
    .get()
  if (!row) {
    return
  }
  getHostConnectorService()?.stopForEnrollment(id)
  db().delete(relayHostEnrollments).where(eq(relayHostEnrollments.id, id)).run()
}

export function readHostEnrollmentPairingString(id: string): { pairingString: string, pairingCode: string, hostKeyFingerprint: string } {
  const row = db()
    .select()
    .from(relayHostEnrollments)
    .where(eq(relayHostEnrollments.id, id))
    .get()
  if (!row) {
    throw new AppError({ code: 'relay_host_enrollment_not_found', status: 404, message: 'Relay host enrollment not found.', details: { id } })
  }
  if (!row.pairingCode) {
    throw new AppError({ code: 'relay_host_enrollment_not_pairable', status: 409, message: 'Enrollment is not in the pairing window.' })
  }
  const fingerprint = relayPublicKeyFingerprint(row.hostPubkey)
  return {
    pairingString: `${row.pairingCode}#${fingerprint}`,
    pairingCode: row.pairingCode,
    hostKeyFingerprint: fingerprint,
  }
}

interface PairingStartResponse {
  roomId: string
  pairingCode: string
  hostToken?: string
  expiresAt: string
}

async function callPairingStart(relayUrl: string, body: { pairingStartToken: string, hostToken: string, roomId: string }): Promise<PairingStartResponse> {
  const url = new URL('/pairing/start', `${relayUrl.replace(/\/+$/, '')}/`)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.pairingStartToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hostToken: body.hostToken, roomId: body.roomId }),
      signal: AbortSignal.timeout(10_000),
    })
  }
  catch (error) {
    throw new AppError({
      code: 'relay_pairing_start_unreachable',
      status: 502,
      message: `Could not reach relayd /pairing/start: ${error instanceof Error ? error.message : String(error)}`,
    })
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new AppError({
      code: 'relay_pairing_start_failed',
      status: 502,
      message: `relayd /pairing/start returned ${response.status}: ${text}`,
    })
  }
  return await response.json() as PairingStartResponse
}

function toView(row: typeof relayHostEnrollments.$inferSelect): HostEnrollmentView {
  return {
    id: row.id,
    displayName: row.displayName,
    relayUrl: row.relayUrl,
    roomId: row.roomId,
    hostPubkey: row.hostPubkey,
    hostKeyFingerprint: relayPublicKeyFingerprint(row.hostPubkey),
    pinnedControllerPubkey: row.pinnedControllerPubkey,
    status: row.status as 'pending' | 'paired' | 'offline',
    pairingCode: row.pairingCode,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    live: getHostConnectorService()?.getLiveState(row.id) ?? null,
  }
}
