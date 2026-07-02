import { describe, expect, it } from 'vitest'

import { projectOpencodePromptParts, projectOpencodeQuickQuestionParts, readOpencodeSlashCommandInvocation } from './input-projector'

describe('projectOpencodePromptParts', () => {
  it('preserves AI SDK file parts as OpenCode file parts', () => {
    expect(projectOpencodePromptParts({
      id: 'user-1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Inspect this screenshot.' },
        {
          type: 'file',
          mediaType: 'image/png',
          filename: 'screenshot.png',
          url: 'data:image/png;base64,abc123',
        },
      ],
    })).toEqual([
      { type: 'text', text: 'Inspect this screenshot.' },
      {
        type: 'file',
        mime: 'image/png',
        filename: 'screenshot.png',
        url: 'data:image/png;base64,abc123',
      },
    ])
  })
})

describe('projectOpencodeQuickQuestionParts', () => {
  it('wraps transcript and question in a single text prompt part', () => {
    const parts = projectOpencodeQuickQuestionParts({
      question: 'What did we decide?',
      transcript: [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Use opencode for this session.' }],
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Understood.' }],
        },
      ],
    })

    expect(parts).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('<transcript>'),
      },
    ])
    expect(parts[0].text).toContain('user: Use opencode for this session.')
    expect(parts[0].text).toContain('assistant: Understood.')
    expect(parts[0].text).toContain('<question>\nWhat did we decide?\n</question>')
  })
})

describe('readOpencodeSlashCommandInvocation', () => {
  it('extracts a slash command while preserving argument text', () => {
    expect(readOpencodeSlashCommandInvocation({
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: '/review src/index.ts\nfocus on errors' }],
    })).toEqual({
      command: 'review',
      arguments: 'src/index.ts\nfocus on errors',
    })
  })

  it('ignores normal prompt text', () => {
    expect(readOpencodeSlashCommandInvocation({
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'review this file' }],
    })).toBeNull()
  })
})
