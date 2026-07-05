import { randomUUID } from 'node:crypto'

import { trustGrants } from '@cradle/db'
import { and, eq, sql } from 'drizzle-orm'

import { db } from '../infra'

export interface PluginTrustGrant {
  pluginName: string
  checksum: string
  reason: string | null
  updatedAt: number
}

function toGrant(row: typeof trustGrants.$inferSelect): PluginTrustGrant {
  return {
    pluginName: row.subjectKey,
    checksum: row.checksum,
    reason: row.reason,
    updatedAt: row.updatedAt,
  }
}

export function readPluginTrustGrant(pluginName: string, checksum: string): PluginTrustGrant | null {
  const row = db()
    .select()
    .from(trustGrants)
    .where(and(
      eq(trustGrants.subjectType, 'plugin_package'),
      eq(trustGrants.subjectKey, pluginName),
      eq(trustGrants.checksum, checksum),
    ))
    .get()
  return row ? toGrant(row) : null
}

export function grantPluginTrust(
  pluginName: string,
  checksum: string,
  reason?: string | null,
): PluginTrustGrant {
  db()
    .insert(trustGrants)
    .values({
      id: randomUUID(),
      subjectType: 'plugin_package',
      subjectKey: pluginName,
      checksum,
      reason: reason ?? null,
    })
    .onConflictDoUpdate({
      target: [trustGrants.subjectType, trustGrants.subjectKey, trustGrants.checksum],
      set: {
        reason: reason ?? null,
        updatedAt: sql`(unixepoch())`,
      },
    })
    .run()

  return readPluginTrustGrant(pluginName, checksum)!
}

export function deletePluginTrustGrantsForPlugin(pluginName: string): void {
  db()
    .delete(trustGrants)
    .where(and(
      eq(trustGrants.subjectType, 'plugin_package'),
      eq(trustGrants.subjectKey, pluginName),
    ))
    .run()
}
