import { registerOperationCommand } from '../../../../runtime/operation-command'
import type { CliOperationSpec } from '../../../../runtime/types'
import type { Command } from 'commander'

const spec = {
  "arguments": [],
  "command": [
    "relay-transport",
    "host-enrollment",
    "create"
  ],
  "description": "Create a relay host enrollment and start pairing",
  "flags": [
    {
      "name": "id",
      "required": false,
      "target": "body.id",
      "type": "string"
    },
    {
      "name": "displayName",
      "required": true,
      "target": "body.displayName",
      "type": "string"
    },
    {
      "name": "relayUrl",
      "required": true,
      "target": "body.relayUrl",
      "type": "string"
    }
  ],
  "method": "post",
  "path": "/relay-transport/host-enrollments"
} satisfies CliOperationSpec

export function register(program: Command): void {
  registerOperationCommand(program, spec)
}
