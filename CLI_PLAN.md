# bluesky-cli — plan

A standalone CLI wrapping the same Bluesky/AT Protocol layer this MCP server
already uses. Personal-tool sized: no test suite, no publish, a bin shim in
`~/bin`.

## What already exists (and transfers unchanged)

The MCP server is a hand-rolled XRPC client over `fetch` — there is **no
`@atproto/api` dependency**. That is the good news: the entire network layer is
plain and portable.

- `src/api/client.ts` — `BlueskyClient` class: session create/refresh, generic
  `makeRequest<T>(nsid, params, method)`, plus typed helpers (getTimeline,
  getProfile, searchPosts, createPost, likePost, followUser, etc.). Handles 401
  → refresh → retry internally.
- `src/api/types.ts` — AT Protocol response types (Session, PostView,
  ProfileView, FeedViewPost, ThreadViewPost, Notification, AtUri).
- `src/config/index.ts` — zod-validated env config: `BLUESKY_IDENTIFIER`,
  `BLUESKY_APP_PASSWORD`, `BLUESKY_PDS_URL` (default `https://bsky.social`).
- `src/tools/format.ts` — `formatPost`, `formatProfile`, `formatThread`. These
  are the human-readable renderers the CLI should reuse verbatim for its default
  output.

The only thing that is MCP-specific and does **not** transfer:
`src/server.ts` (Server/StdioServerTransport wiring) and the `McpError`/JSON-schema
`definition` objects + `handler` wrappers in each `src/tools/*.ts`. Each handler
is a thin zod-parse → client-call → format shell; the CLI reimplements that shell
as a command, but the client and formatters are shared.

## Auth / session — the one real gap

The MCP client holds `accessJwt`/`refreshJwt` in memory for the life of the
process. That is fine for a long-lived server; for a CLI that spawns fresh each
invocation it means **every command does a full `createSession` login**. Bluesky
tolerates this but it is slow and rate-limit-adjacent.

Plan: add opt-in session caching keyed by identifier.

- Cache file: `~/.config/bluesky-cli/session.json` (mode `0600`), storing
  `{ did, handle, accessJwt, refreshJwt, identifier }`.
- On start: if cache exists and matches `BLUESKY_IDENTIFIER`, hydrate the client
  with the cached tokens (add a `BlueskyClient.hydrate(session)` method) and skip
  `createSession`. The existing 401 → `refreshSessionToken` path then handles
  expiry transparently.
- After any successful `refreshSessionToken`/`createSession`, write the cache
  back (add a `onSession?: (s) => void` callback on the client, or expose the
  current tokens via a getter the CLI persists).
- `bluesky-cli logout` deletes the cache file.

Credentials stay exactly as today: `BLUESKY_IDENTIFIER` and
`BLUESKY_APP_PASSWORD` from the environment (MCP host config), with `dotenv`
loading a plain `.env` for CLI use. No change to how the secret is stored.

## Shape: one binary, `--mcp` folds the server in

Follow the `~/bin/listen` convention — a single entry point that runs as a CLI by
default and as an MCP stdio server when invoked with `--mcp`:

```
bluesky-cli --mcp          # existing MCP stdio server (current createServer())
bluesky-cli timeline       # CLI mode
```

`src/index.ts` becomes a dispatcher:

```ts
const main = async () => {
  const [first, ...rest] = process.argv.slice(2);
  if (first === '--mcp') return createServer();   // unchanged path
  return runCli(first, rest);                      // new
};
```

This keeps a single build, single install, single auth/session/config path, and
zero drift between the two front ends. The MCP registration in `server.ts` is
untouched.

## Command structure

Verb-first, one file per command group under `src/cli/`. A tiny dispatcher maps
command name → handler; each handler is an arrow function
`(args: string[], flags: Flags) => Promise<void>`.

```
bluesky-cli whoami
bluesky-cli timeline [--limit 20] [--json]
bluesky-cli feed <handle|did> [--limit 20]
bluesky-cli profile <handle|did>
bluesky-cli thread <at-uri> [--depth 6]
bluesky-cli search <query> [--limit 25] [--sort top|latest]
bluesky-cli search-users <query> [--limit 10]
bluesky-cli notifications [--limit 30]
bluesky-cli post <text> [--reply-to <uri>] [--url <link>] [--yes]
bluesky-cli delete <at-uri> [--yes]
bluesky-cli repost <at-uri> <cid> [--yes]
bluesky-cli like <at-uri> <cid> [--yes]
bluesky-cli unlike <rkey> [--yes]
bluesky-cli follow <did> [--yes]
bluesky-cli unfollow <rkey> [--yes]
bluesky-cli followers <handle|did> [--limit 50]
bluesky-cli follows <handle|did> [--limit 50]
bluesky-cli logout
```

Ergonomic upgrades over the raw MCP tools (optional, personal-tool niceties):

- `like`/`repost`/`follow` currently need a `cid` or `did` the user rarely has to
  hand. The CLI can accept a bare `at-uri` and resolve `cid` via `getPostThread`,
  and accept a `@handle` for `follow` and resolve the `did` via `getProfile`.
  Same trick the MCP `create_post` reply path already uses.

## Inventory: MCP tool → CLI command

```
┌────┬──────────────────────┬────────────────────────────┬──────────┬────────┐
│ #  │ MCP tool             │ CLI command                │ outbound │ --yes  │
├────┼──────────────────────┼────────────────────────────┼──────────┼────────┤
│ 1  │ whoami               │ whoami                     │ no       │ —      │
│ 2  │ get_timeline         │ timeline                   │ no       │ —      │
│ 3  │ get_user_feed        │ feed <actor>               │ no       │ —      │
│ 4  │ get_profile          │ profile <actor>            │ no       │ —      │
│ 5  │ get_post_thread      │ thread <uri>               │ no       │ —      │
│ 6  │ search_posts         │ search <query>             │ no       │ —      │
│ 7  │ search_users         │ search-users <query>       │ no       │ —      │
│ 8  │ get_notifications    │ notifications              │ no       │ —      │
│ 9  │ get_followers        │ followers <actor>          │ no       │ —      │
│ 10 │ get_follows          │ follows <actor>            │ no       │ —      │
│ 11 │ create_post          │ post <text>                │ YES      │ yes    │
│ 12 │ delete_post          │ delete <uri>               │ YES      │ yes    │
│ 13 │ repost               │ repost <uri> <cid>         │ YES      │ yes    │
│ 14 │ like_post            │ like <uri> <cid>           │ YES      │ yes    │
│ 15 │ unlike_post          │ unlike <rkey>              │ YES      │ yes    │
│ 16 │ follow_user          │ follow <did>               │ YES      │ yes    │
│ 17 │ unfollow_user        │ unfollow <rkey>            │ YES      │ yes    │
└────┴──────────────────────┴────────────────────────────┴──────────┴────────┘
```

New in the CLI (no MCP equivalent): `logout` (clears the session cache).

## Confirmation on outbound actions

Rows 11–17 are real, irreversible network writes. Convention:

1. Print exactly what will happen ("Will post as @handle:\n\n  <text>" or "Will
   delete at://…"), then require an interactive `y/N` on stdin before firing.
2. `--yes` (or `-y`) skips the prompt for scripted/piped use.
3. If stdin is not a TTY and `--yes` is absent, refuse and exit non-zero — never
   fire a write unattended by accident.

`post` should also echo the resulting URI/CID after success, as the MCP handler
already does.

## Arg parsing — no new dependency

`package.json` currently ships `@modelcontextprotocol/sdk`, `dotenv`, `zod`. Do
**not** add a parser library. Node 18's built-in `node:util` `parseArgs` covers
flags/positionals for a tool this size:

```ts
import { parseArgs } from 'node:util';
```

Keep a small `src/cli/args.ts` that declares the shared option shape
(`limit: number`, `json: boolean`, `yes: boolean`, `sort`, `cursor`, `depth`,
`reply-to`, `url`) and returns typed positionals + flags. zod can still validate
the parsed values, reusing the same constraints the tool schemas already encode
(limit 1–100, sort enum, etc.).

## Output

- Default: human-readable, via the existing `format.ts` renderers. `timeline` /
  `feed` / `search` number results `[n]` and append the pagination cursor line
  exactly as the MCP handlers do — that behaviour is already in the formatters
  and list handlers, so lift it into a shared `renderList` helper.
- `--json`: print the raw XRPC response (`JSON.stringify(res, null, 2)`) so the
  tool composes with `jq`. Every read command supports it; write commands emit
  `{ uri, cid }` (or `{ ok: true }`) under `--json`.
- Errors: print message to stderr, exit non-zero. Drop `McpError`; the CLI throws
  plain `Error` and the top-level catch formats it.

## File layout (all files < ~200 lines)

```
src/
  index.ts            # dispatcher: --mcp → createServer, else runCli   (edit)
  server.ts           # unchanged MCP wiring
  config/index.ts     # unchanged env/zod config
  api/client.ts       # + hydrate(session) + token getter/onSession     (edit)
  api/types.ts        # unchanged
  tools/*.ts          # unchanged (MCP handlers + shared format.ts)
  cli/
    run.ts            # command dispatcher, builds client, session cache
    args.ts           # parseArgs wrapper + shared flag types
    session.ts        # read/write/delete ~/.config/bluesky-cli/session.json
    confirm.ts        # TTY y/N prompt + --yes bypass
    render.ts         # renderList / --json helpers over format.ts
    commands/         # one file per group: read.ts, posts.ts, social.ts
```

Conventions: arrow functions, functional style, `type` over `interface`, minimal
comments — matching the existing codebase.

## Build / install

- Bump `.tool-versions` if desired; current `nodejs 18.20.0` is fine (`parseArgs`
  and global `fetch` both present).
- pnpm 11.x per house rules: replace the npm scripts, add
  `packageManager: pnpm@11.0.1` and a `pnpm-lock.yaml`. Keep `tsc` build
  (`pnpm build` → `tsc && chmod +x build/index.js`).
- Add a `bin` entry `bluesky-cli: ./build/index.js` alongside the existing
  `bluesky-mcp` (both point at the same dispatcher; the MCP name just implies
  `--mcp` usage in the client config).
- Shim in `~/bin/bluesky-cli`:

  ```sh
  #!/bin/sh
  exec node "$HOME/.local/mcp/bluesky-mcp/build/index.js" "$@"
  ```

  `chmod +x`. The MCP client config keeps calling
  `node …/build/index.js --mcp` with env injected by the MCP host, so it does not
  need the shim.

## Implementation checklist

1. `api/client.ts`: add `hydrate(session)` to set `accessJwt/refreshJwt/did/
   handle`, add a getter for the current session, and an `onSession` hook fired
   after every create/refresh. (Keep MCP behaviour identical when the hook is
   unset.)
2. `cli/session.ts`: read/write/delete `~/.config/bluesky-cli/session.json`
   (`0600`), matched by identifier.
3. `cli/args.ts`: `parseArgs` wrapper returning typed positionals + flags;
   validate with the zod constraints already used in `tools/*`.
4. `cli/confirm.ts`: TTY `y/N` prompt; `--yes`/`-y` bypass; non-TTY-without-yes
   refuses.
5. `cli/render.ts`: `renderList(items, formatter, cursor)` and a `--json`
   passthrough, wrapping `format.ts`.
6. `cli/commands/read.ts`: whoami, timeline, feed, profile, thread, search,
   search-users, notifications, followers, follows — each a zod-parse →
   `client.*` → render arrow fn.
7. `cli/commands/posts.ts`: post (with reply-to/url resolution + confirm),
   delete, repost — reuse `create_post`'s reply-root resolution logic.
8. `cli/commands/social.ts`: like, unlike, follow, unfollow — resolve `cid`/`did`
   from a bare uri/handle where possible; all gated by confirm.
9. `cli/run.ts`: build config + client, hydrate from cache, wire `onSession` to
   persist, dispatch on command name, top-level error → stderr + non-zero exit.
   Add `logout` (delete cache) and a `help` fallback listing commands.
10. `index.ts`: branch `--mcp` → `createServer()` else `runCli()`.
11. pnpm/bin/`.tool-versions`/shim per Build/install; `pnpm build`; smoke-test
    `bluesky-cli whoami`, then a read command, then a `--yes` write.
```

## Risks / notes

- **Session cache staleness / multi-account**: cache is keyed by identifier;
  switching accounts via env just misses the cache and re-logs-in. Acceptable.
- **`whoami` quirk**: the MCP `whoami` calls `com.atproto.server.getSession`
  first to populate `did`. With a hydrated cache the `did` is already known, so
  the CLI can skip that round-trip; harmless either way.
- **Rate limits**: caching sessions is the main mitigation. Bluesky's
  `createSession` is the rate-limited endpoint; reusing tokens across invocations
  avoids hammering it.
- **`unlike`/`unfollow` need rkeys**, not uris — the MCP surface returns the rkey
  on the originating `like`/`follow`. The CLI inherits this awkwardness; a future
  nicety is resolving the current user's like/follow record by scanning
  `viewer.like`/`viewer.following` from a `getProfile`/`getPostThread`, but that
  is out of scope for v1.
