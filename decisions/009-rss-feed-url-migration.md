# ADR-009: RSS Feed URL Migration

## Status

Accepted

## Context

WSJ migrated their RSS feed infrastructure from `feeds.a.dj.com` (S3-based) to `feeds.content.dowjones.io` (Express-based) between October 9 and November 6, 2024. This was confirmed via Wayback Machine snapshots of `wsj.com/news/rss-news-and-feeds`.

The old `feeds.a.dj.com` endpoints still return HTTP 200 but serve frozen content — most feeds were last updated January 27, 2025. The new `feeds.content.dowjones.io` endpoints are live and actively updated, and are listed on WSJ's official RSS page.

## Decision

Replace all RSS feed URLs from the old `feeds.a.dj.com/rss/<name>.xml` format to the new `feeds.content.dowjones.io/public/rss/<name>` format. The feed name stems remain the same; only the base URL changes and the `.xml` extension is dropped.

## Consequences

- All RSS data is now live and fresh instead of 9,000+ hours stale.
- The `<wsj:articletype>` element is not present in the new feeds, so the `category` field will be `null` for all articles. The parser already handles this gracefully.
- No changes needed to tests — they use the CLI dynamically with no hardcoded URLs.
