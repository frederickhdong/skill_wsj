# ADR-004: Profile Access Control

**Status:** Accepted

## Context

The original `prefs` commands took a profile name as an argument:

```bash
wsj prefs get <name>       # view any user's profile
wsj prefs set <name> ...   # modify any user's profile
wsj prefs list             # enumerate all profiles
```

This was a cross-user information disclosure vulnerability. Any agent (or user) could:
1. Enumerate all profile names on the system via `prefs list`
2. Read any user's instructions, tracked topics, and personal preferences via `prefs get <name>`
3. Modify another user's profile via `prefs set <name> ...`

Profile instructions may contain sensitive preferences, tracked topics, or personal information that shouldn't be visible to other users.

## Decision

- **Remove `prefs list`** — with profile isolation, listing only your own profile is redundant with `prefs get`
- **Remove the name argument** from all `prefs` commands — the current user is always determined by `$WSJ_USER`
- `prefs get` returns the current user's preferences (no argument)
- `prefs set '<json>'` overwrites the current user's preferences
- `prefs update <key> '<value>'` updates a single key in the current user's preferences

## Alternatives Considered

**Keep name argument but restrict to own profile** — adds complexity for no benefit. If you can only access your own profile, the name argument is redundant since `$WSJ_USER` already identifies you.

**Add ACLs / admin role** — too complex for the current use case. If cross-user access is needed in the future, it should be a separate, explicit admin tool.

## Consequences

- Breaking change: `prefs list` removed (returns an error with guidance)
- Breaking change: name argument removed from `prefs get/set/update`
- Simpler API surface — three commands, no arguments to get wrong
- Users can only access their own data
