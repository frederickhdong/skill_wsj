# ADR-008: E2E LLM tests via `claude -p` CLI

## Status

Accepted

## Context

Three e2e test suites in `wsj.e2e.test.mjs` call an undefined `generateFeed()` function. The WSJ skill normally runs via Claude Code, which orchestrates `wsj` CLI commands and formats output per user preferences. We need these tests to exercise the full agent pipeline end-to-end, not just formatting.

## Decision

Use `claude -p --output-format text` with SKILL.md loaded as prompt context. The test helper `runWithSkill()` reads SKILL.md, wraps it with the user prompt, and pipes it to `claude -p` via `spawnSync`. Claude handles the full workflow (load prefs, fetch RSS, format output), and the tests evaluate structural properties of the final output.

Assertions use ranges (e.g., 3-7 items instead of exactly 5) to tolerate LLM non-determinism. Test timeouts are increased to 120s to accommodate CLI + LLM latency.

## Alternatives Considered

- **`generateFeed()` calling Anthropic API directly** — adds API key management, doesn't test the real skill pipeline.
- **Rule-based formatter** — doesn't test real LLM compliance with user instructions.

## Consequences

- Tests require `claude` CLI installed and authenticated.
- LLM non-determinism may cause occasional flakiness — assertions use ranges and structural checks rather than exact matches.
- Test timeouts increased to 120s via `--test-timeout=120000`.
- Tests validate the entire agent pipeline: SKILL.md instructions → CLI tool usage → LLM formatting.
