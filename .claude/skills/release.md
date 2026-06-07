---
name: release
description: Trigger desktop release workflow and monitor until completion
---

# Release Desktop

Trigger the desktop release workflow for `wibus-wee/cradle-app` and monitor until completion.

## Usage

```
/release dev          # Dev channel: dev-YYYYMMDD.N
/release 1.2.0        # Release channel: v1.2.0
```

## Channel Logic

- **dev**: `dev-YYYYMMDD.N` (date + increment)
  - Auto-generates version based on today's date
  - Queries GitHub for existing dev tags to determine next increment
  - Example: `dev-20240529.1`, `dev-20240529.2`

- **release**: `vX.Y.Z` (semantic version)
  - User provides version number (without `v` prefix)
  - Example: `v1.2.0`

## Implementation Steps

When user runs `/release <arg>`, execute these steps in order:

### 1. Parse argument and generate version

```bash
# For dev channel
DATE=$(date +%Y%m%d)
EXISTING=$(gh release list --repo wibus-wee/cradle-app --json tagName --jq '.[].tagName' | grep "^dev-${DATE}" | wc -l)
INCREMENT=$((EXISTING + 1))
VERSION="${DATE}.${INCREMENT}"
TAG="dev-${VERSION}"
CHANNEL="dev"

# For release channel
VERSION="1.2.0"  # from user input
TAG="v${VERSION}"
CHANNEL="release"
```

### 2. Create and push tag

```bash
# Create annotated tag
git tag -a "$TAG" -m "Release $TAG"

# Push tag to trigger workflow
git push origin "$TAG"
```

### 3. Wait for workflow completion using cradle-cli

Use `cradle session await-create` to monitor the GitHub Actions workflow:

```bash
cradle session await-create \
  --chat-session-id "$CRADLE_CHAT_SESSION_ID" \
  --workspace-id "$CRADLE_WORKSPACE_ID" \
  --source github-ci \
  --filter-json "{\"repo\":\"wibus-wee/cradle-app\",\"sha\":\"$(git rev-parse HEAD)\"}" \
  --reason "Waiting for release workflow to complete for $TAG"
```

### 4. Report results

After the await completes, check the workflow status:

```bash
# Get workflow run status
gh run list --repo wibus-wee/cradle-app --workflow=release-desktop.yml --limit=1 --json status,conclusion,url
```

Report to user:
- If success: "Release $TAG completed successfully! [Link to release]"
- If failure: "Release $TAG failed. [Link to workflow run]"

## Complete Flow Example

```
User: /release dev

1. Generate version: dev-20240529.1
2. Create tag: git tag -a "dev-20240529.1" -m "Release dev-20240529.1"
3. Push tag: git push origin "dev-20240529.1"
4. Register await:
   cradle session await-create \
     --chat-session-id "$CRADLE_CHAT_SESSION_ID" \
     --workspace-id "$CRADLE_WORKSPACE_ID" \
     --source github-ci \
     --filter-json '{"repo":"wibus-wee/cradle-app","sha":"<commit-sha>"}' \
     --reason "Waiting for release workflow to complete for dev-20240529.1"
5. End turn and wait for cradle to resume session
6. When resumed, check workflow status and report results
```

## Notes

- The workflow builds desktop artifacts for mac-arm64.
- Release assets are uploaded directly to the tag release in `wibus-wee/cradle-app`.
- Release builds use `electron-updater` with a generic provider URL:
  `https://github.com/wibus-wee/cradle-app/releases/latest/download/`
- Dev builds use a rolling generic provider URL:
  `https://github.com/wibus-wee/cradle-app/releases/download/feed-dev/`
- The dev feed uses `latest-mac.yml`; app-side updater logic does not switch to `dev-mac.yml`.
- Each dev run publishes both its own `dev-*` release and the `feed-dev` update feed.
- Dev releases are marked as prerelease
- Release workflow timeout: 60 minutes
