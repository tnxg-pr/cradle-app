/**
 * Output: Cradle-owned builtin tool payloads projected from opencode-native tool parts.
 * Input: opencode tool part state.
 * Position: opencode provider package tool envelope mapper.
 */

import type { Permission, ToolPart } from '@opencode-ai/sdk'

import {
  createBuiltinToolCallInputPayload,
  createBuiltinToolCallResultPayload,
} from '../../tools/tool-call-payload'
import { OpencodeToolIdentifier } from './identity'

export function buildOpencodeToolInput(part: ToolPart) {
  return createBuiltinToolCallInputPayload({
    identifier: OpencodeToolIdentifier,
    apiName: part.tool,
    args: part.state.input,
  })
}

export function buildOpencodeToolOutput(part: ToolPart) {
  return createBuiltinToolCallResultPayload({
    identifier: OpencodeToolIdentifier,
    apiName: part.tool,
    args: part.state.input,
    result: projectToolResult(part),
  })
}

export function buildOpencodePermissionInput(permission: Permission) {
  return createBuiltinToolCallInputPayload({
    identifier: OpencodeToolIdentifier,
    apiName: 'approval.permissions',
    args: {
      id: permission.id,
      type: permission.type,
      title: permission.title,
      pattern: permission.pattern,
      sessionID: permission.sessionID,
      messageID: permission.messageID,
      callID: permission.callID ?? null,
      metadata: permission.metadata,
      createdAt: permission.time.created,
    },
  })
}

export function buildOpencodePermissionOutput(input: {
  permission: Permission
  response: 'once' | 'reject'
  approved: boolean
  reason?: string
}) {
  return createBuiltinToolCallResultPayload({
    identifier: OpencodeToolIdentifier,
    apiName: 'approval.permissions',
    args: {
      id: input.permission.id,
      type: input.permission.type,
      title: input.permission.title,
      pattern: input.permission.pattern,
      metadata: input.permission.metadata,
    },
    result: {
      response: input.response,
      approved: input.approved,
      ...(input.reason ? { reason: input.reason } : {}),
    },
  })
}

function projectToolResult(part: ToolPart): unknown {
  switch (part.state.status) {
    case 'completed':
      return {
        title: part.state.title,
        output: part.state.output,
        metadata: part.state.metadata,
        attachments: part.state.attachments ?? [],
      }
    case 'error':
      return {
        error: part.state.error,
        metadata: part.state.metadata ?? {},
      }
    case 'running':
      return {
        title: part.state.title ?? part.tool,
        metadata: part.state.metadata ?? {},
      }
    case 'pending':
      return {
        raw: part.state.raw,
      }
  }
}
