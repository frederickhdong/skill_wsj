# Iterative Workflow

Work in cycles - don't try to do everything in one pass.

## Flow

```
0. Check $WSJ_USER exists
   NO  → Onboard user first
   YES → Continue

1. Load prefs, understand task

2. Gather: rss/search

3. Dive deeper: read articles

4. Enough?
   YES → Format per instructions
   NO  → Loop to step 2
```

## Example Cycles

### Simple: "What's in the news?"

1. Load prefs → get preferred sections
2. `wsj rss <section> --json`
3. Format per `instructions`

### Medium: "Morning briefing"

1. Load prefs → check `sections_of_interest`, `topics`
2. `wsj rss markets --json` + `wsj rss tech --json`
3. Filter by topics
4. Format per `instructions`

### Complex: "What's happening with the Fed?"

1. Load prefs
2. `wsj search "Federal Reserve" --json` → article list
3. `wsj read <url> --json` → full content
4. Need more? → `wsj rss markets --json`
5. Synthesize per `instructions`
