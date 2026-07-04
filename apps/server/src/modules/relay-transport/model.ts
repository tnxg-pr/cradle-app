import { t } from 'elysia'

const nullableString = t.Union([t.String(), t.Null()])
const enrollmentStatus = t.Union([
  t.Literal('pending'),
  t.Literal('paired'),
  t.Literal('offline'),
])

const hostEnrollmentLive = t.Object({
  connected: t.Boolean(),
  controllerName: nullableString,
  lastReadyAt: t.Union([t.Number(), t.Null()]),
  activeStreams: t.Number(),
}, { additionalProperties: false })

const hostEnrollment = t.Object({
  id: t.String(),
  displayName: t.String(),
  relayUrl: t.String(),
  roomId: t.String(),
  hostPubkey: t.String(),
  hostKeyFingerprint: t.String(),
  pinnedControllerPubkey: nullableString,
  status: enrollmentStatus,
  pairingCode: nullableString,
  lastError: nullableString,
  createdAt: t.Number(),
  updatedAt: t.Number(),
  live: t.Union([hostEnrollmentLive, t.Null()]),
}, { additionalProperties: false })

export const RelayHostEnrollmentModel = {
  enrollmentIdParams: t.Object({
    enrollmentId: t.String({ minLength: 1 }),
  }, { additionalProperties: false }),

  hostEnrollment,

  createEnrollmentBody: t.Object({
    id: t.Optional(t.String({ minLength: 1 })),
    displayName: t.String({ minLength: 1 }),
    relayUrl: t.String({ minLength: 1 }),
  }, { additionalProperties: false }),

  createdEnrollment: t.Object({
    ...hostEnrollment.properties,
    pairingString: t.String({ minLength: 1 }),
    pairingCodeExpiresAt: nullableString,
  }, { additionalProperties: false }),

  pairingString: t.Object({
    pairingString: t.String({ minLength: 1 }),
    pairingCode: t.String({ minLength: 1 }),
    hostKeyFingerprint: t.String({ minLength: 1 }),
  }, { additionalProperties: false }),

  ok: t.Object({
    ok: t.Literal(true),
  }, { additionalProperties: false }),
} as const
