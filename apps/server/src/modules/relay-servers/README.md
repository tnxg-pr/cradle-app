# Relay Servers

This module owns Cradle's relay server registry.

Relay server rows are Cradle application data stored in `relay_servers`. A row names a relay URL,
whether it is enabled, and whether it is the default relay used by remote host pairing when
the request does not specify a relay server id.

Only this module writes the relay server registry and owns relay token signing secret resolution.
Other modules may read it to resolve relay URLs or mint relay tokens, but they should not duplicate
default-selection, lifecycle, or HMAC secret semantics.

The `relay-transport` module is the main consumer: host enrollment and
controller claim flows ask this module to mint `pairing_start`, `pairing_claim`,
`room_start`, and WebSocket tokens. The token HMAC secret must match the relayd
process that both Cradle Servers use.

## Built-in Local Relayd

`local-relayd-supervisor.ts` owns the local relayd process launched by Cradle Server.
It is a convenience for desktop/dev use:

- `CRADLE_RELAYD_AUTOSTART=0|false|no` disables it.
- `CRADLE_RELAYD_AUTOSTART=1|true|yes` forces it on.
- Without an explicit value, it starts outside `test` and `production`.
- `CRADLE_RELAYD_PATH` points at an explicit relayd executable.
- Packaged Desktop resolves `process.resourcesPath/relayd/<platform>-<arch>/relayd`.
- Dev source trees fall back to `go run ./cmd/relayd` from `apps/relayd`.

When the managed relayd is ready, the supervisor upserts the system row
`system:local-relayd` with display name `Built-in local relay`. It becomes default only when no
explicit default exists, so user-selected public relay servers remain authoritative.

Desktop users configure whether this managed relay only listens on localhost or accepts
connections from other devices through Settings > Network > Inbound access. The setting is stored
in `preferences/network.json` and is read on the next Cradle restart. Environment variables still
override this for development/deployment:

- `CRADLE_RELAYD_LISTEN` sets the child relayd listen address directly.
- `CRADLE_RELAYD_PUBLIC_URL` sets the relay URL advertised into the `system:local-relayd` row.

The supervisor injects Cradle Server's resolved relay HMAC secret into the relayd child process via
`CRADLE_RELAYD_DEV_HMAC_SECRET`, so the managed relay always validates the tokens minted by the same
server process.

The built-in HMAC secret fallback is non-production only. Production deployments must set
`CRADLE_RELAY_HMAC_SECRET` on Cradle Server and `CRADLE_RELAYD_DEV_HMAC_SECRET` (or
`CRADLE_RELAY_HMAC_SECRET`) for relayd.

relayd supports `POST /rooms/host-session` so a host connector can
idempotently recreate or renew its room after relayd restarts or an idle room
expires. Active rooms are renewed while peers remain connected, so a long-lived
relay transport tunnel is not disconnected just because the original room TTL
passes.

## Routes

- `GET /relay-servers`: list relay servers.
- `POST /relay-servers`: create a relay server.
- `PATCH /relay-servers/:relayServerId`: update a relay server.
- `DELETE /relay-servers/:relayServerId`: delete a relay server.

All routes include `x-cradle-cli` metadata under the `relay-server` command namespace.
