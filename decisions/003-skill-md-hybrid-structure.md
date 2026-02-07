# ADR-003: SKILL.md Hybrid Structure

**Status:** Accepted

## Context

SKILL.md grew to include detailed examples, workflow descriptions, and behavioral rules. Per Claude skills guidance, SKILL.md should be under 500 lines and focused — detailed docs should go in reference files that Claude loads on demand.

The risk with moving everything to references is that agents might skip loading them. Critical behavioral rules (like passive learning triggers, or "don't ask before updating preferences") need to be seen every time.

## Decision

Use a hybrid approach:

- **Critical behavioral rules** stay inline in SKILL.md — agents always see them
- **Detailed examples and verbose descriptions** go in `references/` — loaded when needed

Specifically:
- Learning triggers table → inline (agents must know when to update)
- Learning examples and flow diagrams → `references/passive-learning.md`
- Iterative workflow summary → inline (agents must know the cycle)
- Detailed workflow examples → `references/workflow.md`
- Profile examples → `references/example-profiles.md`
- Tool documentation → `references/tools.md`

SKILL.md also gets frontmatter:
- `argument-hint: "[section or query]"` for autocomplete
- `allowed-tools: Bash` to restrict tool access

## Alternatives Considered

**Everything inline** — simpler but SKILL.md grows unbounded. Large skill files slow down agent loading and dilute critical instructions with verbose examples.

**Everything in references** — maximally concise SKILL.md but agents may not load references for common operations, missing critical behavioral rules like "update silently."

**Strict line budget with no refs** — forces conciseness but sacrifices useful examples and documentation that help agents make better decisions.

## Consequences

- SKILL.md stays under ~100 lines, focused on what agents must always know
- Reference files provide depth when agents need it
- Judgment call required for each new piece of content: inline or reference?
- File structure: `skills/wsj/SKILL.md` + `skills/wsj/references/*.md`
