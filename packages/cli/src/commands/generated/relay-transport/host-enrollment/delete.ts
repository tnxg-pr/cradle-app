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
    "delete"
  ],
  "description": "Delete a relay host enrollment",
  "flags": [],
  "method": "delete",
  "path": "/relay-transport/host-enrollments/{enrollmentId}"
} satisfies CliOperationSpec

export function register(program: Command): void {
  registerOperationCommand(program, spec)
}
