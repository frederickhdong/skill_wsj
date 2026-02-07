# ADR-002: Output Template in Profile, Not SKILL.md

**Status:** Accepted

## Context

New users need a sensible default output format. The question is where this default lives:

1. **SKILL.md** — hardcoded in the skill definition that all agents read
2. **User preferences** — set as part of `instructions` during onboarding

If the default is in SKILL.md, it conflicts with user customization. An agent would see both the hardcoded format and the user's preferred format and have to decide which wins. Passive learning (ADR-001) would update the preferences, but the SKILL.md default would still be there.

## Decision

Set a default `instructions` in the user's preferences during onboarding:

```
• [POWER WORDS](article-url) - brief takeaway. Link text: 2-4 punchy words. Takeaway: under 15 words. 5 items total.
```

The default is format-only — no content filtering. Users add filtering (e.g. "skip opinion") through use, and passive learning refines `instructions` over time.

Previously, formatting lived in a separate `output_preference` field and behavior in `instructions`. These were merged into a single `instructions` field because the distinction was ambiguous — "5 items total" and "skip opinion" could reasonably go in either.

## Alternatives Considered

**Hardcode in SKILL.md** — simpler initial setup, but creates a conflict between the hardcoded format and any user-customized format. Agents would need precedence logic ("profile overrides SKILL.md") that adds complexity.

**No default** — let agents decide format on their own. Inconsistent experience across agents until the user explicitly sets a preference.

**Separate `output_preference` and `instructions` fields** — tried this; the boundary was confusing. Agents and users couldn't tell which field a given preference belonged in.

## Consequences

- Onboarding must set `instructions` — without it, agents have no format guidance until the user provides feedback
- Passive learning naturally refines `instructions` over time (ADR-001) — no conflict with a hardcoded default
- Single source of truth: the preferences. Agents read one place for all user guidance including format.
- One field (`instructions`) instead of three (`instructions` + `output_preference` + `detail_level`) — simpler for agents and users
