import { registerOperationCommand } from '../../../../runtime/operation-command'
import type { CliOperationSpec } from '../../../../runtime/types'
import type { Command } from 'commander'

const spec = {
  "arguments": [],
  "command": [
    "relay-transport",
    "host-enrollment",
    "list"
  ],
  "description": "List relay host enrollments",
  "flags": [],
  "method": "get",
  "path": "/relay-transport/host-enrollments"
} satisfies CliOperationSpec

export function register(program: Command): void {
  registerOperationCommand(program, spec)
}
