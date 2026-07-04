import { registerOperationCommand } from '../../../../runtime/operation-command'
import type { CliOperationSpec } from '../../../../runtime/types'
import type { Command } from 'commander'

const spec = {
  "arguments": [
    {
      "name": "enrollmentId",
      "required": true,
      "target": "path.enrollmentId",
      "type": "string"
    }
  ],
  "command": [
    "relay-transport",
    "host-enrollment",
    "pairing-string"
  ],
  "description": "Re-read the pairing string for an enrollment",
  "flags": [],
  "method": "get",
  "path": "/relay-transport/host-enrollments/{enrollmentId}/pairing-string"
} satisfies CliOperationSpec

export function register(program: Command): void {
  registerOperationCommand(program, spec)
}
