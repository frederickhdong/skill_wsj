# ADR-006: Interactive onboarding when WSJ_USER is not set

## Status

Accepted

## Context

When `$WSJ_USER` is not set, the CLI exits with a terse error: `Error: $WSJ_USER not set. Run: export WSJ_USER=<your-username>`. New users hitting this on their first run get no guidance — they have to read the help text, pick a username, and manually export it before they can do anything.

## Decision

When `$WSJ_USER` is missing and stdin is a TTY, prompt interactively for a username using `node:readline/promises`. After the user enters a name:

1. Register the user immediately
2. Print `export WSJ_USER=<name>` so they can persist it
3. Set `process.env.WSJ_USER` and continue with the command (don't exit)

When stdin is **not** a TTY (piped, scripted, CI, tests via `spawnSync`), keep the existing error-and-exit behavior. This is gated on `process.stdin.isTTY`.

This made `requireUserEnv()` and `requireUser()` async, which propagated `async/await` to `handlePrefs`, `handleUser`, and their callers in the main switch.

## Alternatives Considered

- **Keep the error-only approach.** Simplest, but poor first-run experience for new users.
- **Always prompt (no TTY check).** Would break non-interactive callers (tests, scripts, agents piping input). The TTY check preserves backward compatibility.
- **Config file or `wsj init` command.** More ceremony than needed — a single readline prompt is lighter weight and doesn't require learning a separate setup step.

## Consequences

- New users can run any command immediately and get onboarded inline.
- Existing tests are unaffected — `spawnSync` doesn't provide a TTY, so they still see the error message.
- `requireUserEnv()` and `requireUser()` are now async; all call sites use `await`.
- PRD updated to document both TTY and non-TTY behavior (see `git log -- PRD.md`).
