import { registerOperationCommand } from '../../../../runtime/operation-command'
import type { CliOperationSpec } from '../../../../runtime/types'
import type { Command } from 'commander'

const spec = {
  "arguments": [
    {
      "name": "hostId",
      "required": true,
      "target": "path.hostId",
      "type": "string"
    }
  ],
  "command": [
    "remote-host",
    "relay",
    "claim"
  ],
  "description": "Claim a relay pairing for a remote host",
  "flags": [
    {
      "name": "pairingString",
      "required": true,
      "target": "body.pairingString",
      "type": "string"
    }
  ],
  "method": "post",
  "path": "/remote-hosts/{hostId}/relay/claim"
} satisfies CliOperationSpec

export function register(program: Command): void {
  registerOperationCommand(program, spec)
}
