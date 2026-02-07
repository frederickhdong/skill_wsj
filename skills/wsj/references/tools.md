# WSJ Tools Reference

Detailed documentation for each WSJ CLI tool.

## Tool: prefs

Manages free-text user profiles. Agents interpret the JSON freely.

### Commands
```bash
wsj prefs get                            # Get preferences as JSON
wsj prefs set '<json>'                   # Set preferences (overwrites)
wsj prefs update <key> '<value>'         # Update single key
```

### Common Fields
- `instructions` - Format, filtering, and behavior guidance — all in one place (string)
- `topics` - Topics to track (array)
- `sections_of_interest` - RSS sections to prioritize (array)

### Example Profile
```json
{
  "instructions": "• [POWER WORDS](url) - brief takeaway. 2-4 punchy words, under 15 words. 10 items total unless breaking news. Focus on markets and tech. Skip opinion unless major. I follow NVDA closely - always include if mentioned.",
  "sections_of_interest": ["markets", "tech", "world"],
  "topics": ["AI", "Federal Reserve", "tariffs", "semiconductors", "NVDA", "TSLA"]
}
```

### Storage
- Location: `~/.config/wsj/credentials.json`
- Env var: `$WSJ_USER` identifies current user

---

## Tool: rss

Fetches headlines from WSJ public RSS feeds. No authentication needed.

### Commands
```bash
wsj rss <section>           # Get headlines from one section
wsj rss <section> --json    # Output as JSON for agent processing
wsj rss all --json          # Get all sections as JSON
```

### Available Sections
- `world` - World News
- `us` - US Business
- `markets` - Markets
- `opinion` - Opinion
- `tech` - Technology
- `lifestyle` - Lifestyle

### JSON Output Format
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

### All Sections JSON Format
```json
{
  "fetched_at": "2026-02-04T10:30:00Z",
  "sections": [
    { "section": "world", "fetched_at": "...", "articles": [...] },
    { "section": "us", "fetched_at": "...", "articles": [...] },
    ...
  ]
}
```

---

## Tool: read

Extracts full article content using CDP (requires logged-in Chrome session).

### Commands
```bash
wsj read <url>              # Read article, output markdown
wsj read <url> --json       # Output as JSON
```

### JSON Output Format
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

---

## Tool: search

Searches WSJ for articles matching a query.

### Commands
```bash
wsj search "<query>"        # Search, output markdown
wsj search "<query>" --json # Output as JSON
```

### JSON Output Format
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

---

## Tool: status

Check CDP connection status.

### Commands
```bash
wsj status
```

### Output
```
Connected: true
Port: 9222
Browser: Chrome/120.0.0.0
```

Or if not connected:
```
Connected: false

Run "wsj setup" to start Chrome with CDP enabled.
```

---

## Tool: setup

Initialize Chrome for CDP connection.

### Commands
```bash
wsj setup
```

Starts Chrome with:
- Remote debugging on port 9222
- Dedicated user data directory (`~/.wsj/chrome`)
- Opens WSJ homepage

### Next Steps After Setup
1. Log into WSJ in the Chrome window
2. Keep Chrome running in background
3. Use `wsj read` and `wsj search` commands
