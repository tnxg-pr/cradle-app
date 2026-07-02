/**
 * Output: opencode prompt parts projected from Chat Runtime input.
 * Input: Cradle UIMessage.
 * Position: opencode provider package boundary from Cradle message input to opencode session.prompt body.
 */

import type { UIMessage } from 'ai'
import type { FilePartInput, TextPartInput } from '@opencode-ai/sdk'

import type { StreamTurnInput } from '../../chat-runtime/runtime-provider-types'
import { extractUiMessageText, projectTextOnlyInput } from '../../chat-runtime/ui-message-input'

export type OpencodePromptPartInput = TextPartInput | FilePartInput

type MessagePart = UIMessage['parts'][number]

export function projectOpencodePromptParts(message: StreamTurnInput['message']): OpencodePromptPartInput[] {
  if (typeof message === 'string') {
    return [{
      type: 'text',
      text: projectTextOnlyInput(message, 'opencode provider'),
    }]
  }

  const unsupportedParts = message.parts.filter(part => part.type !== 'text' && part.type !== 'file')
  if (unsupportedParts.length > 0) {
    const details = unsupportedParts.map(part => part.type).join(', ')
    throw new Error(`opencode provider only supports text and file input; unsupported parts: ${details}`)
  }

  const parts: OpencodePromptPartInput[] = []
  const text = extractUiMessageText(message).trim()
  if (text) {
    parts.push({ type: 'text', text })
  }
  for (const part of message.parts) {
    if (isFilePart(part)) {
      parts.push(projectOpenCodeFilePart(part))
    }
  }
  if (parts.length === 0) {
    throw new Error('opencode provider requires non-empty text or file input')
  }
  return parts
}

export function readOpencodeSlashCommandInvocation(
  message: StreamTurnInput['message'],
): { command: string; arguments: string } | null {
  const text = projectTextOnlyInput(message, 'opencode slash command').trim()
  if (!text.startsWith('/')) {
    return null
  }
  const body = text.slice(1)
  const commandEnd = body.search(/\s/)
  const command = (commandEnd === -1 ? body : body.slice(0, commandEnd)).trim()
  if (!command) {
    return null
  }
  return {
    command,
    arguments: commandEnd === -1 ? '' : body.slice(commandEnd).trim(),
  }
}

export function projectOpencodeQuickQuestionParts(input: {
  question: string
  transcript: UIMessage[]
}): TextPartInput[] {
  return [{
    type: 'text',
    text: [
      'Answer the quick question using the transcript context below. Do not modify files or persist this as a normal chat turn.',
      '',
      '<transcript>',
      ...input.transcript.map(formatTranscriptMessage),
      '</transcript>',
      '',
      '<question>',
      input.question.trim(),
      '</question>',
    ].join('\n'),
  }]
}

function formatTranscriptMessage(message: UIMessage): string {
  const text = extractUiMessageText(message).trim()
  if (!text) {
    return `${message.role}: [non-text content omitted]`
  }
  return `${message.role}: ${text}`
}

function isFilePart(part: MessagePart): part is Extract<MessagePart, { type: 'file' }> {
  return part.type === 'file'
}

function projectOpenCodeFilePart(part: Extract<MessagePart, { type: 'file' }>): FilePartInput {
  return {
    type: 'file',
    mime: part.mediaType,
    ...(part.filename ? { filename: part.filename } : {}),
    url: part.url,
  }
}
