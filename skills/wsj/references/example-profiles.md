# Example User Profiles

Example profiles showing different use cases and preferences.

## Morning Briefing User

```json
{
  "instructions": "• [POWER WORDS](url) - brief takeaway. 2-4 punchy words, under 15 words. 10 items total unless breaking news. Focus on markets and tech. Skip opinion unless major. If something big is happening, give more detail. I follow NVDA closely - always include if mentioned.",
  "sections_of_interest": ["markets", "tech", "world"],
  "topics": ["AI", "Federal Reserve", "tariffs", "semiconductors", "NVDA", "TSLA"]
}
```

**How an agent might use this:**
1. Load prefs with `wsj prefs get`
2. Fetch `markets` and `tech` RSS feeds
3. Filter articles matching topics
4. Format as brief bullets with URLs per `instructions`
5. Expand on anything about NVDA

---

## Deep Research User

```json
{
  "instructions": "Detailed analysis with quotes and citations. Thorough coverage with multiple perspectives. Pull full article content when relevant. Synthesize into coherent analysis. Max 5 articles per query.",
  "topics": []
}
```

**How an agent might use this:**
1. Load prefs
2. Search for the topic
3. Read top 5 articles in full
4. Synthesize with quotes and citations

---

## Quick Updates User

```json
{
  "instructions": "Numbered list, no descriptions. Headlines only. Max 5 items. Only include if truly important — breaking or major news only."
}
```

---

## Sector-Specific User

```json
{
  "instructions": "Bullets grouped by company, include stock moves if mentioned. Focus on: regulatory changes, M&A activity, earnings reports, partnership announcements. Always note stock ticker symbols.",
  "topics": ["payments", "crypto regulation", "BNPL", "neobanks", "PYPL", "SQ", "COIN", "AFRM", "SOFI"]
}
```

---

## Creating a Profile

```bash
# Set preferences
wsj prefs set '{"instructions": "Brief daily summary of tech news", "topics": ["AI", "Apple", "Google"]}'

# Refine a single field
wsj prefs update instructions '"Brief bullets with URLs. 5 items total. Skip lifestyle."'

# Verify
wsj prefs get
```
