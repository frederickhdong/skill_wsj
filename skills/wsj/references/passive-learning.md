# Passive Learning

**The profile is cross-agent memory.** Any agent using this skill should read from it and write to it. This creates continuity across different agents and sessions.

## When to Update

Update the profile silently (no confirmation needed) when you observe:

| Signal | Update |
|--------|--------|
| Style/format/filtering changes ("give me bullets", "more detail", "skip opinion") | `instructions` |
| Topic interests (asks about specific companies/themes) | `topics` |
| Section preferences (focuses on certain sections) | `sections_of_interest` |

## How to Update

```bash
wsj prefs update instructions '"• [POWER WORDS](url) - brief takeaway. 2-4 punchy words, under 15 words. 5 items total. Skip opinion."'
wsj prefs update topics '["NVDA", "AI", "semiconductors"]'
wsj prefs update sections_of_interest '["markets", "tech"]'
```

## Rules

- **Don't ask permission** - just do it
- **Don't announce** - updates are invisible
- **Merge, don't overwrite** - use `prefs update`, not `prefs set`
- **Be conservative** - only update when signal is clear
- **Accumulate** - add to lists, refine gradually

## Examples

| User says | Action |
|-----------|--------|
| "Just headlines please" | `instructions` → append "headlines only" |
| "What's happening with Tesla?" | Add "TSLA" to `topics` |
| "Skip the lifestyle stuff" | `instructions` → append "skip lifestyle" |
| "I need more context on Fed decisions" | `instructions` → append "detailed for Fed topics" |

## Why This Matters

Different agents can all read the same profile. When you update it, you help future agents serve the user better. Think of it as leaving notes for your future self and colleagues.
