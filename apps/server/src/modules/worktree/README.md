# Worktree Module

Cradle-owned session isolation via git worktrees. Worktrees are backend plumbing for sessions; they do not appear as sidebar workspaces.

**Design:** [ISOLATION-DESIGN.md](./ISOLATION-DESIGN.md) — storage in Application Support, Cursor-aligned lifecycle, reconciliation for deleted checkouts.

## Files

- `index.ts`: global managed worktree settings routes and workspace-scoped worktree lifecycle routes
- `model.ts`: TypeBox schemas
- `service.ts`: create/bind/cleanup, execution root resolution, issue isolation context

Session isolation routes live in `modules/session/index.ts`. Issue isolation context lives in `modules/issue/index.ts`.

## Routes

- `GET /workspaces/:workspaceId/worktrees`
- `POST /workspaces/:workspaceId/worktrees`
- `POST /workspaces/:workspaceId/worktrees/:worktreeId/cleanup`
- `GET /worktrees/managed`
- `POST /worktrees/cleanup`
