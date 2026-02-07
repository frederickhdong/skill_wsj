---
name: wsj
description: Fetches WSJ headlines via RSS, reads full articles, and searches archives. Maintains user preferences for personalized news. Use when user asks about news, WSJ, Wall Street Journal, market updates, or financial news.
argument-hint: "[section or query]"
allowed-tools: Bash
---

# WSJ Skill

Tools for WSJ access. User preferences are your cross-agent memory - learn from interactions and update silently.

## Tools

| Tool | Command | Auth |
|------|---------|------|
| prefs | `wsj prefs get/set/update` | No |
| user | `wsj user info/reset/delete` | No |
| rss | `wsj rss <section> --json` | No |
| read | `wsj read <url> --json` | CDP |
| search | `wsj search "<query>" --json` | CDP |
| status | `wsj status` | No |

Sections: `markets`, `tech`, `world`, `us`, `opinion`, `lifestyle`, `all`

## Quick Start

```bash
# Check user preferences
wsj prefs get

# Get headlines
wsj rss markets --json

# Read article
wsj read <url> --json

# Search
wsj search "Federal Reserve" --json
```

## User Required

All commands require `$WSJ_USER`. If not set, the CLI prompts interactively for a username, registers the user, and prints the `export` command to persist it. Users are auto-registered on first use.

If onboarding a new user, gather their preferences and set them:

```bash
wsj prefs set '{"topics": ["AI", "markets"], "instructions": "Exactly 5 items, flat list, no headers. Each item: • [2-4 WORD HEADLINE](article-url) - takeaway under 15 words. Use • as the bullet. Select the 5 most important across all sections."}'
```

## Learning (Critical)

User preferences are cross-agent memory. Update silently based on user behavior.

**When to update:**

| User signal | Update field |
|-------------|--------------|
| "give me bullets" / "more detail" / "skip opinion" | `instructions` |
| Asks about specific company/topic | `topics` |
| Focuses on certain sections | `sections_of_interest` |

**Rules:**
- Don't ask permission, don't announce
- Use `prefs update` (merge), not `prefs set` (overwrite)
- Be conservative - only update on clear signals
- Accumulate over time

See `references/passive-learning.md` for examples.

## Workflow

Work in cycles: load prefs → gather (rss/search) → dive deeper (read) → evaluate → loop or present.

See `references/workflow.md` for detailed examples.

## Auth

If `read` or `search` fails, check `wsj status`. If not connected: `wsj setup`.

## References

- Tool details: `references/tools.md`
- Profile examples: `references/example-profiles.md`
