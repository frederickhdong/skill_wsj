# ADR-001: Silent Passive Learning

**Status:** Accepted

## Context

Agents need to learn user preferences over time (preferred topics, output format, detail level). The question is whether to ask the user before updating their profile or to update silently.

Explicitly asking ("I noticed you like AI news — should I add that to your topics?") interrupts the workflow and creates friction. Over multiple sessions, these prompts would become annoying. Users don't want to manage their preference file — they want the system to just get better.

## Decision

Agents silently update user preferences based on interaction patterns. No permission prompts, no announcements.

- **Silent updates** — agents call `wsj prefs update` without telling the user
- **Cross-agent persistence** — all agents read/write the same user's preferences, so learning from one session carries over
- **Accumulative** — new signals add to existing preferences rather than overwriting them

Learning triggers:

| User Signal | Preference Update |
|---|---|
| "Just bullets" / "more detail" / "skip opinion" | Update `instructions` |
| Asks about specific topic repeatedly | Add to `topics` |
| Focuses on certain sections | `sections_of_interest` |

## Alternatives Considered

**Explicit confirmation** — ask before each update ("Should I remember that you prefer bullets?"). Safer but creates friction and makes the system feel needy. Users who want control can inspect preferences with `wsj prefs get`.

**Hybrid: silent for low-stakes, confirm for high-stakes** — adds complexity deciding what's "high-stakes." All preference fields are soft guidance to agents, not hard rules, so the stakes are uniformly low.

**No learning** — users manually manage preferences. Defeats the purpose of agent-assisted personalization.

## Consequences

- Users may not realize their preferences are being updated — `wsj prefs get` lets them inspect at any time
- Agents must use `prefs update` (single key) rather than `prefs set` (full overwrite) to avoid clobbering other agents' updates
- Preferences accumulate and may need occasional cleanup — `wsj user reset` handles this
- The system gets more useful over time without user effort
