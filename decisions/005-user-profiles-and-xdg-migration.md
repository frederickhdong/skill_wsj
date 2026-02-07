# ADR-005: User Profiles and XDG Migration

**Status:** Accepted

## Context

Two problems converged:

1. **Storage location**: User data was in `~/.wsj/` with individual profile files (`~/.wsj/profiles/<name>.json`). This doesn't follow the XDG Base Directory spec — macOS and Linux tools expect config in `~/.config/`.

2. **Profile schema**: The profile required `name` and `instructions` fields. This caused friction with auto-registration (new users start with empty preferences) and passive learning (ADR-001) where agents add fields incrementally. An agent that just wants to note a topic shouldn't need to also set `instructions`.

Multiple agents on the same machine need to serve multiple users. Individual files per user made management complex, and the `name` field was redundant with the filename.

## Decision

**Storage:**
- Move config from `~/.wsj/` to `~/.config/wsj/`
- Replace individual profile files with a single `credentials.json` keyed by username
- Share Chrome user data at `~/.config/wsj/chrome/` across all agents
- Switch environment variable from `$WSJ_PROFILE` to `$WSJ_USER`
- Auto-register users on first command — no explicit sign-up step

**Schema:**
- No required fields in the preferences object — `{}` is valid
- `name` field removed (redundant with the username key in credentials.json)
- `instructions` is a common convention but not enforced
- Validation only checks that preferences is a JSON object

## Alternatives Considered

**Keep `~/.wsj/` with centralized file** — simpler migration but still non-standard path. Chose XDG since we were already making a breaking change.

**Database (SQLite)** — more powerful querying but overkill for a JSON config file with a handful of users. A plain JSON file is simpler to debug and edit by hand.

**Keep `instructions` as required, drop only `name`** — half-measure. Agents doing passive learning still need to set `instructions` before they can update anything else, which defeats the point of silent updates.

## Consequences

- Breaking change: `~/.wsj/` data must be migrated manually
- Breaking change: `$WSJ_PROFILE` renamed to `$WSJ_USER`
- Auto-registered users start with `{}` preferences — no friction
- Agents can add any field at any time via `prefs update`
- Single `credentials.json` makes it easy to add new user-level fields (registration date, context, etc.)
- Agents must handle missing fields gracefully (check before reading)
