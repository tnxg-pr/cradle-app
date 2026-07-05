import { createCipheriv, createHash, randomBytes } from 'node:crypto'

import { agentCredentials } from '@cradle/db'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../infra'
import {
  readSecret,
  rotateEncryptionKey,
  saveSecret,
} from './service'

const IV_BYTES = 12

const originalCredentialSecret = process.env.CRADLE_CREDENTIAL_SECRET

function encryptLegacyCredential(plainText: string, secret: string): string {
  const key = createHash('sha256').update(secret).digest()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`
}

function readCredentialRow(id: string) {
  const row = db().select().from(agentCredentials).where(eq(agentCredentials.id, id)).get()
  if (!row) {
    throw new Error(`Missing credential row ${id}`)
  }
  return row
}

describe('secrets encryption', () => {
  beforeEach(() => {
    process.env.CRADLE_CREDENTIAL_SECRET = 'old-secret'
    db().delete(agentCredentials).run()
  })

  afterEach(() => {
    db().delete(agentCredentials).run()
    if (originalCredentialSecret === undefined) {
      delete process.env.CRADLE_CREDENTIAL_SECRET
      return
    }
    process.env.CRADLE_CREDENTIAL_SECRET = originalCredentialSecret
  })

  it('decrypts legacy unversioned credential payloads as version 1', () => {
    db().insert(agentCredentials).values({
      id: 'legacy-credential',
      kind: 'openai-compatible',
      label: 'Legacy Credential',
      encryptedSecret: encryptLegacyCredential('legacy-value', 'old-secret'),
      createdAt: 1,
      updatedAt: 1,
    }).run()

    expect(readSecret('legacy-credential')).toBe('legacy-value')
    expect(readCredentialRow('legacy-credential').keyVersion).toBe(1)
  })

  it('writes versioned credential envelopes with the active key version', () => {
    const saved = saveSecret({
      kind: 'openai-compatible',
      label: 'Primary',
      secret: 'sk-test-secret',
    })
    const row = readCredentialRow(saved.id)

    expect(row.keyVersion).toBe(1)
    expect(row.encryptedSecret.startsWith('v1:')).toBe(true)
    expect(readSecret(saved.id)).toBe('sk-test-secret')
  })

  it('rotates all credentials to a bumped key version', () => {
    const first = saveSecret({
      kind: 'openai-compatible',
      label: 'First',
      secret: 'first-secret',
    })
    const second = saveSecret({
      kind: 'openai-compatible',
      label: 'Second',
      secret: 'second-secret',
    })
    const firstBefore = readCredentialRow(first.id).encryptedSecret

    const result = rotateEncryptionKey({ from: 'old-secret', to: 'new-secret' })

    expect(result).toEqual({
      rotated: 2,
      fromVersion: 1,
      toVersion: 2,
    })
    expect(() => readSecret(first.id)).toThrow()

    process.env.CRADLE_CREDENTIAL_SECRET = 'new-secret'
    expect(readSecret(first.id)).toBe('first-secret')
    expect(readSecret(second.id)).toBe('second-secret')

    const firstAfter = readCredentialRow(first.id)
    expect(firstAfter.keyVersion).toBe(2)
    expect(firstAfter.encryptedSecret.startsWith('v2:')).toBe(true)
    expect(firstAfter.encryptedSecret).not.toBe(firstBefore)

    const third = saveSecret({
      kind: 'openai-compatible',
      label: 'Third',
      secret: 'third-secret',
    })
    const thirdRow = readCredentialRow(third.id)
    expect(thirdRow.keyVersion).toBe(2)
    expect(thirdRow.encryptedSecret.startsWith('v2:')).toBe(true)
  })

  it('rolls back all credential writes when rotation fails midway', () => {
    const good = saveSecret({
      kind: 'openai-compatible',
      label: 'a-good',
      secret: 'good-secret',
    })
    db().insert(agentCredentials).values({
      id: 'z-broken',
      kind: 'openai-compatible',
      label: 'z-broken',
      encryptedSecret: 'v1:not-valid',
      keyVersion: 1,
      createdAt: 1,
      updatedAt: 1,
    }).run()
    const goodBefore = readCredentialRow(good.id)

    expect(() => rotateEncryptionKey({ from: 'old-secret', to: 'new-secret' })).toThrow()

    const goodAfter = readCredentialRow(good.id)
    expect(goodAfter.encryptedSecret).toBe(goodBefore.encryptedSecret)
    expect(goodAfter.keyVersion).toBe(goodBefore.keyVersion)
    expect(readSecret(good.id)).toBe('good-secret')
  })
})
