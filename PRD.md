# WSJ Skill - Product Requirements

## Overview

Modular CLI tools for WSJ access with profile-based personalization. Individual, composable tools that agents orchestrate flexibly — the personalized news feed is just one possible use case.

**Design principles:**
- **Modular tools** — agents decide which to use, in what order, and how to iterate
- **User preferences** — free-form JSON that agents read and interpret
- **Iterative workflow** — agents cycle through tools (search → read → search more → summarize)

## User Management

Every command requires a username. If `$WSJ_USER` is set, it's used directly. If not, the CLI checks whether stdin is a TTY:

- **Interactive (TTY):** Prompts for a username, registers the user, and prints `export WSJ_USER=<name>` so they can persist it. The command then continues normally.
- **Non-interactive (piped/scripted):** Exits with an error telling the user to set `$WSJ_USER`.

Users are auto-registered on first use — no explicit sign-up step.

| Environment Variable | Purpose |
|---|---|
| `$WSJ_USER` | Identifies the current user (required, or prompted interactively) |

### Commands

| Command | Purpose |
|---|---|
| `wsj user info` | Show username, registration date, preferences |
| `wsj user reset` | Clear preferences and context |
| `wsj user delete` | Remove user entirely |

### Storage

All user data lives in a single `credentials.json` file keyed by username:

```
~/.config/wsj/
├── credentials.json    # All user data by username
└── chrome/             # Shared Chrome user data
```

```json
{
  "users": {
    "alice": {
      "registered": "2024-01-15T10:30:00Z",
      "preferences": {
        "topics": ["tech", "markets"],
        "instructions": "Focus on AI and startup news"
      }
    }
  }
}
```

## Preferences (`wsj prefs`)

User preferences are a free-form JSON object — no required fields. Agents interpret the structure freely.

### Commands

| Command | Usage |
|---|---|
| `wsj prefs get` | Returns current user's preferences as JSON |
| `wsj prefs set '<json>'` | Overwrites current user's preferences |
| `wsj prefs update <key> '<value>'` | Updates a single preference key |

All commands operate on the `$WSJ_USER` user. There is no name argument — see [ADR-004](decisions/004-profile-access-control.md).

`prefs list` is removed — see [ADR-004](decisions/004-profile-access-control.md).

### Preference Schema

Entirely flexible. Common fields used by agents:

| Field | Example | Purpose |
|---|---|---|
| `instructions` | `"• [POWER WORDS](url) - brief takeaway. 5 items total."` | Format, filtering, and behavior guidance — all in one place |
| `topics` | `["AI", "Fed", "NVDA"]` | Topics to track |
| `sections_of_interest` | `["markets", "tech"]` | RSS sections to prioritize |

Users and agents can add any fields. See [ADR-005](decisions/005-user-profiles-and-xdg-migration.md) for why there are no required fields.

## RSS Headlines (`wsj rss`)

Fetches headlines from WSJ public RSS feeds at `feeds.content.dowjones.io`. No authentication needed.

### Commands

```bash
wsj rss <section> [--json]    # One section
wsj rss all [--json]          # All sections in parallel
```

### Sections

`world`, `us`, `markets`, `opinion`, `tech`, `lifestyle`

### JSON Output

```json
{
  "section": "markets",
  "fetched_at": "2026-02-04T10:30:00Z",
  "articles": [
    {
      "title": "Fed Signals Rate Hold Amid Inflation Concerns",
      "url": "https://wsj.com/articles/...",
      "description": "The Federal Reserve indicated...",
      "category": "Economy",
      "pubDate": "2026-02-04T08:30:00Z",
      "age": "2h ago"
    }
  ]
}
```

For `rss all`, the envelope wraps an array of section results:

```json
{
  "fetched_at": "2026-02-04T10:30:00Z",
  "sections": [ /* array of section objects */ ]
}
```

## Article Reader (`wsj read`)

Extracts full article content via CDP. Requires a logged-in Chrome session.

### Commands

```bash
wsj read <url> [--json]
```

### JSON Output

```json
{
  "url": "https://wsj.com/articles/...",
  "title": "Fed Signals Rate Hold",
  "subtitle": "Central bank maintains cautious stance",
  "author": "Nick Timiraos",
  "date": "February 4, 2026",
  "content": "Full article text...",
  "word_count": 850
}
```

## Search (`wsj search`)

Searches WSJ for articles matching a query via CDP.

### Commands

```bash
wsj search "<query>" [--json]
```

### JSON Output

```json
{
  "query": "Federal Reserve",
  "results": [
    {
      "title": "Fed Signals Rate Hold",
      "url": "https://wsj.com/articles/...",
      "snippet": "The Federal Reserve indicated..."
    }
  ]
}
```

## Status & Setup

| Command | Purpose |
|---|---|
| `wsj status` | Check CDP connection (connected, port, browser) |
| `wsj setup` | Start Chrome with CDP on port 9222 (macOS only) |

`setup` launches Chrome with `--remote-debugging-port=9222` and a shared user data dir at `~/.config/wsj/chrome`. The user must log into WSJ in that Chrome window.

## Authentication

| Tool | Auth Required |
|---|---|
| `rss` | No |
| `read` | Yes (CDP) |
| `search` | Yes (CDP) |
| `prefs` | No |
| `user` | No |
| `status` | No |
| `setup` | No |

If a CDP-dependent command fails, check `wsj status`. If not connected, run `wsj setup`.

## Passive Learning

Agents silently update user preferences based on interaction patterns — no explicit prompts or announcements.

**Key behaviors:**
1. **Silent updates** — agents update preferences without asking
2. **Cross-agent persistence** — any agent reads/writes the same user's preferences
3. **Accumulative** — preferences build over time, not overwritten wholesale

### Learning Triggers

| User Signal | Preference Update |
|---|---|
| "Just bullets" / "more detail" / "skip opinion" | Update `instructions` |
| Asks about specific topic repeatedly | Add to `topics` |
| Focuses on certain sections | `sections_of_interest` |

Agents use `wsj prefs update <key> '<value>'` to modify individual fields.

## Default Instructions

During onboarding, agents set initial `instructions`:

```
• [POWER WORDS](article-url) - brief takeaway. Link text: 2-4 punchy words. Takeaway: under 15 words. 5 items total.
```

This lives in the user's preferences (not in SKILL.md) so passive learning can refine it over time. The default is format-only — no content filtering (e.g. no "skip opinion"). Users add filtering preferences through use.

## Backward Compatibility

Old command names are aliased but hidden from help:
- `headlines` → `rss`
- `article` → `read`
- `profile` → `prefs` (with deprecation notice)

## Testing

Two test suites, both using `node:test`:

| Suite | Command | What it tests |
|---|---|---|
| Unit | `npm test` | Individual commands via `spawnSync` (no TTY, no network for prefs/user) |
| E2E | `npm run test:e2e` | Full user journeys with TTY simulation via `expect` |

### E2E Journeys

E2E tests use macOS `expect` to simulate interactive TTY input (e.g. the onboarding prompt). Each test uses a `_e2e_*` username prefix, cleaned up after each test.

| Journey | Flow |
|---|---|
| Interactive onboarding | No `WSJ_USER` → prompt → register → export hint → command continues |
| Onboard + set prefs | Prompt → register → preferences saved → verified via `prefs get` |
| Onboard + fetch news | Prompt → register → `rss markets --json` returns articles |
| Full digest flow | Onboard → set prefs → fetch markets → fetch tech → verify persistence |
| Returning user | Pre-existing user → no prompt, no re-register, headlines returned |

## File Structure

```
skills/wsj/
├── SKILL.md                      # Skill definition (~100 lines)
└── references/
    ├── passive-learning.md       # Detailed learning behavior
    ├── workflow.md               # Iterative workflow details
    ├── example-profiles.md       # Profile examples
    └── tools.md                  # Tool documentation

~/.config/wsj/
├── credentials.json              # User data by username
└── chrome/                       # Shared Chrome user data
```
