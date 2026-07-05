import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'

import { agentCredentials } from '@cradle/db'
import { asc, eq } from 'drizzle-orm'

import { AppError } from '../../errors/app-error'
import { db } from '../../infra'

// ── types ──

export interface SecretMetadata {
  id: string
  kind: string
  label: string
  maskedSecret: string
  chatgpt?: ChatgptCredentialSummary | null
  createdAt: number
  updatedAt: number
}

export interface ChatgptCredentialSummary {
  chatgptAccountId: string
  chatgptPlanType: string | null
  updatedAt: number
}

export interface SaveSecretInput {
  kind: string
  label: string
  secret: string
}

export interface UpsertSecretInput extends SaveSecretInput {
  id: string
}

export interface SecretValueWithMetadata {
  id: string
  kind: string
  label: string
  secret: string
}

// ── cipher ──

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const SYSTEM_SECRET_KIND_PREFIX = 'system-'
const LEGACY_KEY_VERSION = 1

type CredentialRow = typeof agentCredentials.$inferSelect

interface EncryptedCredentialEnvelope {
  version: number
  ivPart: string
  payloadPart: string
  tagPart: string
}

export interface RotateEncryptionKeyInput {
  from: string
  to: string
}

export interface RotateEncryptionKeyResult {
  rotated: number
  fromVersion: number
  toVersion: number
}

function getCredentialSecret(): string | null {
  return process.env.CRADLE_CREDENTIAL_SECRET?.trim() || null
}

function isConfigured(): boolean {
  return Boolean(getCredentialSecret())
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

function readCredentialKeyVersion(secret: Pick<CredentialRow, 'keyVersion'>): number {
  return secret.keyVersion ?? LEGACY_KEY_VERSION
}

function readActiveKeyVersion(database: ReturnType<typeof db> = db()): number {
  const versions = database
    .select({ keyVersion: agentCredentials.keyVersion })
    .from(agentCredentials)
    .all()
    .map(row => row.keyVersion ?? LEGACY_KEY_VERSION)

  return Math.max(LEGACY_KEY_VERSION, ...versions)
}

function encryptWithSecret(plainText: string, secret: string, keyVersion: number): string {
  const key = deriveKey(secret)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v${keyVersion}:${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`
}

function encrypt(plainText: string, keyVersion = readActiveKeyVersion()): string {
  const secret = getCredentialSecret()
  if (!secret) {
    throw new Error('CRADLE_CREDENTIAL_SECRET is not configured')
  }
  return encryptWithSecret(plainText, secret, keyVersion)
}

function parseEncryptedCredential(encryptedText: string): EncryptedCredentialEnvelope {
  const parts = encryptedText.split(':')
  if (parts.length === 3) {
    const [ivPart, payloadPart, tagPart] = parts
    if (!ivPart || !payloadPart || !tagPart) {
      throw new Error('Invalid encrypted credential payload')
    }
    return {
      version: LEGACY_KEY_VERSION,
      ivPart,
      payloadPart,
      tagPart,
    }
  }

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted credential payload')
  }

  const [versionPart, ivPart, payloadPart, tagPart] = parts
  const version = versionPart?.startsWith('v')
    ? Number.parseInt(versionPart.slice(1), 10)
    : Number.NaN

  if (!Number.isInteger(version) || version <= 0 || !ivPart || !payloadPart || !tagPart) {
    throw new Error('Invalid encrypted credential payload')
  }

  return {
    version,
    ivPart,
    payloadPart,
    tagPart,
  }
}

function decryptWithSecret(encryptedText: string, secret: string, expectedVersion?: number): string {
  const envelope = parseEncryptedCredential(encryptedText)
  if (expectedVersion && envelope.version !== expectedVersion) {
    throw new Error('Encrypted credential key version mismatch')
  }
  const key = deriveKey(secret)
  const { ivPart, payloadPart, tagPart } = envelope
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadPart, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

function decryptCredential(secret: CredentialRow): string {
  const credentialSecret = getCredentialSecret()
  if (!credentialSecret) {
    throw new Error('CRADLE_CREDENTIAL_SECRET is not configured')
  }
  return decryptWithSecret(secret.encryptedSecret, credentialSecret, readCredentialKeyVersion(secret))
}

function maskSecret(secret: string): string {
  const chatgpt = readChatgptCredentialSummary(secret)
  if (chatgpt) {
    return `ChatGPT ${chatgpt.chatgptAccountId.slice(0, 6)}...${chatgpt.chatgptAccountId.slice(-4)}`
  }
  if (secret.length <= 4) {
    return '...'
  }
  if (secret.startsWith('sk-') && secret.length > 7) {
    return `sk-...${secret.slice(-4)}`
  }
  return `...${secret.slice(-4)}`
}

// ── ensure configured guard ──

function ensureConfigured(): void {
  if (!isConfigured()) {
    throw new AppError({
      code: 'secret_not_configured',
      status: 500,
      message: 'CRADLE_CREDENTIAL_SECRET is required to manage secrets',
    })
  }
}

// ── public API ──

export function saveSecret(input: SaveSecretInput): SecretMetadata {
  ensureConfigured()
  const now = Math.floor(Date.now() / 1000)
  const id = randomUUID()
  const keyVersion = readActiveKeyVersion()
  const encryptedSecret = encrypt(input.secret, keyVersion)

  db().insert(agentCredentials).values({
    id,
    kind: input.kind,
    label: input.label,
    encryptedSecret,
    keyVersion,
    createdAt: now,
    updatedAt: now,
  }).run()

  return {
    id,
    kind: input.kind,
    label: input.label,
    maskedSecret: maskSecret(input.secret),
    chatgpt: readChatgptCredentialSummary(input.secret),
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertSecretInDb(database: ReturnType<typeof db>, input: UpsertSecretInput): SecretMetadata {
  ensureConfigured()
  const now = Math.floor(Date.now() / 1000)

  // Check if secret already exists and decrypt it
  const existing = database.select().from(agentCredentials).where(eq(agentCredentials.id, input.id)).get()
  let encryptedSecret: string
  let existingDecrypted: string | null = null
  const keyVersion = readActiveKeyVersion(database)

  if (existing) {
    try {
      existingDecrypted = decryptCredential(existing)
    }
    catch {
      // Failed to decrypt - will re-encrypt with current key
    }
  }

  // Only re-encrypt if the secret value has changed or decryption failed
  if (existing && existingDecrypted === input.secret && readCredentialKeyVersion(existing) === keyVersion) {
    encryptedSecret = existing.encryptedSecret
  }
  else {
    encryptedSecret = encrypt(input.secret, keyVersion)
  }

  database.insert(agentCredentials).values({
      id: input.id,
      kind: input.kind,
      label: input.label,
      encryptedSecret,
      keyVersion,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: agentCredentials.id,
      set: {
        kind: input.kind,
        label: input.label,
        encryptedSecret,
        keyVersion,
        updatedAt: now,
      },
    }).run()

  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    maskedSecret: maskSecret(input.secret),
    chatgpt: readChatgptCredentialSummary(input.secret),
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertSecret(input: UpsertSecretInput): SecretMetadata {
  return upsertSecretInDb(db(), input)
}

export function updateSecretValue(id: string, secret: string): void {
  ensureConfigured()
  const keyVersion = readActiveKeyVersion()
  const encryptedSecret = encrypt(secret, keyVersion)
  const result = db().update(agentCredentials).set({
      encryptedSecret,
      keyVersion,
      updatedAt: Math.floor(Date.now() / 1000),
    }).where(eq(agentCredentials.id, id)).run()
  if (result.changes === 0) {
    throw new AppError({
      code: 'secret_not_found',
      status: 400,
      message: 'Secret not found',
      details: { id },
    })
  }
}

export function removeSecret(id: string): void {
  db().delete(agentCredentials).where(eq(agentCredentials.id, id)).run()
}

export function listSecrets(): SecretMetadata[] {
  ensureConfigured()
  return db()
    .select()
    .from(agentCredentials)
    .orderBy(agentCredentials.label)
    .all()
    .filter(secret => !secret.kind.startsWith(SYSTEM_SECRET_KIND_PREFIX))
    .map((secret) => {
      try {
        const plainText = decryptCredential(secret)
        return {
          id: secret.id,
          kind: secret.kind,
          label: secret.label,
          maskedSecret: maskSecret(plainText),
          chatgpt: readChatgptCredentialSummary(plainText),
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt,
        }
      }
      catch {
        return {
          id: secret.id,
          kind: secret.kind,
          label: secret.label,
          maskedSecret: 'Unreadable credential',
          chatgpt: null,
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt,
        }
      }
    })
}

export function readSecret(id: string): string {
  ensureConfigured()
  const secret = db().select().from(agentCredentials).where(eq(agentCredentials.id, id)).get()
  if (!secret) {
    throw new AppError({
      code: 'secret_not_found',
      status: 400,
      message: 'Secret not found',
      details: { id },
    })
  }
  return decryptCredential(secret)
}

export function readSecretValueWithMetadata(id: string): SecretValueWithMetadata {
  ensureConfigured()
  const secret = db().select().from(agentCredentials).where(eq(agentCredentials.id, id)).get()
  if (!secret) {
    throw new AppError({
      code: 'secret_not_found',
      status: 400,
      message: 'Secret not found',
      details: { id },
    })
  }
  return {
    id: secret.id,
    kind: secret.kind,
    label: secret.label,
    secret: decryptCredential(secret),
  }
}

export function rotateEncryptionKey(input: RotateEncryptionKeyInput): RotateEncryptionKeyResult {
  ensureConfigured()
  const from = input.from.trim()
  const to = input.to.trim()
  if (!from || !to) {
    throw new AppError({
      code: 'invalid_secret_rotation_input',
      status: 400,
      message: 'Both source and target credential secrets are required',
    })
  }
  if (from === to) {
    throw new AppError({
      code: 'invalid_secret_rotation_input',
      status: 400,
      message: 'Source and target credential secrets must differ',
    })
  }

  return db().transaction((tx) => {
    const rows = tx
      .select()
      .from(agentCredentials)
      .orderBy(asc(agentCredentials.label), asc(agentCredentials.id))
      .all()
    const fromVersion = rows.reduce(
      (version, row) => Math.max(version, readCredentialKeyVersion(row)),
      LEGACY_KEY_VERSION,
    )
    const toVersion = fromVersion + 1
    const now = Math.floor(Date.now() / 1000)

    for (const row of rows) {
      const plainText = decryptWithSecret(row.encryptedSecret, from, readCredentialKeyVersion(row))
      tx.update(agentCredentials)
        .set({
          encryptedSecret: encryptWithSecret(plainText, to, toVersion),
          keyVersion: toVersion,
          updatedAt: now,
        })
        .where(eq(agentCredentials.id, row.id))
        .run()
    }

    return {
      rotated: rows.length,
      fromVersion,
      toVersion,
    }
  })
}

function readChatgptCredentialSummary(rawSecret: string): ChatgptCredentialSummary | null {
  try {
    const parsed = JSON.parse(rawSecret) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (record.kind !== 'chatgpt-auth') {
      return null
    }
    const chatgptAccountId = typeof record.chatgptAccountId === 'string' && record.chatgptAccountId.trim()
      ? record.chatgptAccountId
      : null
    if (!chatgptAccountId) {
      return null
    }
    return {
      chatgptAccountId,
      chatgptPlanType: typeof record.chatgptPlanType === 'string' && record.chatgptPlanType.trim()
        ? record.chatgptPlanType
        : null,
      updatedAt: typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : 0,
    }
  }
  catch {
    return null
  }
}
