import { randomBytes } from 'node:crypto'

import { relayHostEnrollments } from '@cradle/db'

import { db } from '../../infra'
import { readSecret, upsertSecret } from '../secrets/service'

const RELAY_AUTH_TOKEN_BYTES = 32
const RELAY_AUTH_TOKEN_SECRET_KIND = 'system-relay-host-auth-token'

export function relayHostAuthTokenSecretId(enrollmentId: string): string {
  return `relay-host-auth-token:${enrollmentId}`
}

export function mintRelayAuthToken(): string {
  return randomBytes(RELAY_AUTH_TOKEN_BYTES).toString('base64url')
}

export function upsertHostRelayAuthToken(input: {
  enrollmentId: string
  displayName: string
  token?: string
}): string {
  const token = input.token ?? mintRelayAuthToken()
  upsertSecret({
    id: relayHostAuthTokenSecretId(input.enrollmentId),
    kind: RELAY_AUTH_TOKEN_SECRET_KIND,
    label: `Relay host auth token (${input.displayName})`,
    secret: token,
  })
  return token
}

export function readOrCreateHostRelayAuthToken(input: {
  enrollmentId: string
  displayName: string
}): string {
  try {
    return readSecret(relayHostAuthTokenSecretId(input.enrollmentId))
  }
  catch {
    return upsertHostRelayAuthToken(input)
  }
}

export function listActiveRelayAuthTokens(): string[] {
  const enrollments = db()
    .select({
      id: relayHostEnrollments.id,
    })
    .from(relayHostEnrollments)
    .all()

  const tokens: string[] = []
  for (const enrollment of enrollments) {
    try {
      tokens.push(readSecret(relayHostAuthTokenSecretId(enrollment.id)))
    }
    catch {
      // Older enrollments may not have a token yet; the host connector mints
      // one lazily before it can carry tunneled traffic.
    }
  }
  return tokens
}
