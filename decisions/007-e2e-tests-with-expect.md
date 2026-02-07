# ADR-007: E2E tests with expect for TTY simulation

## Status

Accepted

## Context

The interactive onboarding prompt (`requireUserEnv()` with `process.stdin.isTTY` check) can't be tested with `spawnSync` — it doesn't provide a TTY, so the CLI falls back to the error path. Unit tests only cover the non-TTY path. Full user journeys (onboard → set prefs → fetch news) need TTY simulation to test end-to-end.

## Decision

Add a separate `wsj.e2e.test.mjs` suite that uses macOS `expect` (built-in at `/usr/bin/expect`) to simulate TTY interaction. Each test:

1. Writes a shell wrapper script (unsets `WSJ_USER`, runs the CLI command)
2. Writes an `expect` script (spawns the wrapper, sends username at the prompt)
3. Spawns `expect` via `spawnSync` (safe — no user input in the command, test-authored strings only)
4. Asserts on the combined output
5. Cleans up temp files and test users (`_e2e_*` prefix)

Multi-step journeys (e.g. full digest flow) use `expect` for the first TTY step, then `spawnSync` with `WSJ_USER` set for subsequent non-interactive steps.

## Alternatives Considered

- **`node-pty`** — npm package that provides PTY from Node.js. More portable but adds a native dependency with compilation requirements. `expect` is zero-dependency on macOS.
- **Mock `process.stdin.isTTY`** — would require refactoring the CLI to accept injected dependencies. Invasive for a test concern.
- **Skip TTY testing** — rely on manual testing. Fragile and not repeatable.

## Consequences

- E2E tests only run on macOS (or systems with `expect`). Unit tests remain cross-platform.
- Two test commands: `npm test` (fast, unit) and `npm run test:e2e` (slower, journeys).
- Test users use `_e2e_*` prefix to avoid collisions with unit test users (`_test_*` prefix).
