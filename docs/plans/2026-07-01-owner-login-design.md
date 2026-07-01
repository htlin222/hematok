# Hematok — owner login + server-side interaction recording

**Date:** 2026-07-01
**Status:** shipped to production (`https://hematok.pages.dev`)

## Goal

Keep the site public and anonymous by default. Add an **owner login** in the
header; once logged in, the owner's **like / dislike / read** interactions are
recorded **server-side** (not just localStorage) so they persist across devices
and steer the recommendation algorithm. Currently the only allowed user is
`hsieh.ting.lin@gmail.com`.

## Architecture (as built)

Everything runs on `hematok.pages.dev` — no custom domain needed.

```
Anonymous (unchanged):
  browser → Pages static site
          → hematok-rec-api.hsieh-ting-lin.workers.dev /recommend  (public, stateless)
  like/dislike → localStorage; seen → in-memory + localStorage "readImages"

Logged-in owner (new):
  browser → hematok.pages.dev/api/*   (Pages Functions, same-origin)
           ├ GET  /api/me      → { email }
           ├ GET  /api/state   → { liked[], disliked[], read[] }   (from KV)
           ├ POST /api/events  → record like|unlike|dislike|undislike|read|unread
           ├ POST /api/merge   → union localStorage history into KV on login
           └ GET  /api/login   → Access login trampoline (for the email path)
  state → Cloudflare KV, key `u:<email>`  (binding STATE = b34a1057c7134c70b40b1e053f1d69f5)
```

- **KV, not D1:** the algorithm only consumes `liked/disliked/seen` arrays, so
  KV holding `{liked, disliked, read}` per user is enough (YAGNI).
- **Recommendation logic unchanged:** the logged-in client still calls the
  public `/recommend` worker; its arrays are just hydrated from the server
  (cross-device) instead of only localStorage. `read` seeds the `seen` exclusion.
- **"Read" = auto on view:** a card marked read once ≥60 % visible
  (IntersectionObserver in `App.tsx`), deduped, persisted, and (when logged in)
  POSTed to `/api/events`.

## Auth — two paths, both supported by the backend (`pages-lib/gate.ts`)

1. **Cloudflare Access email login (the chosen design, "方向 A").** When
   `hematok.pages.dev/api` is gated by an Access app, Cloudflare injects a
   `Cf-Access-Jwt-Assertion` header; the functions read the `email` claim and
   check the allow-list. **This gate is not yet created** — the available
   Cloudflare tokens (wrangler OAuth + MCP) have Access **read** but not
   **write** scope, so it could not be created headlessly.

2. **Owner bearer token (shipped so it works today).** The header **Login**
   opens a prompt; the token is verified against `/api/me`, stored in
   localStorage, and sent as `Authorization: Bearer <token>`. The function
   compares it (constant-time) against the `OWNER_TOKEN` Pages secret. Only the
   holder of the token can record — satisfies "single allowed user".

The client attaches **both** the Access cookie (`credentials:"include"`) and the
bearer token, so the moment the Access gate exists, the email login works with
no code change.

## To switch on the email login you originally chose (方向 A)

Create one Access self-hosted app gating **only** the API path (never the whole
site), allow just the owner, with the existing `onetimepin` IdP. The site is
served on **both** `hematok.hsiehting.com` (primary, what the user visits) and
`hematok.pages.dev` from the same Pages deployment, so gate the primary domain
(or both). Either:

- **cf-gate** (needs an API token with *Access: Apps and Policies: Edit* in the
  skill's `.env`): `cf-gate gate hematok.hsiehting.com/api hsieh.ting.lin@gmail.com`
- **API** (`POST /accounts/{id}/access/apps`):
  `self_hosted_domains: ["hematok.hsiehting.com/api", "hematok.pages.dev/api"]`,
  one `allow` policy including `hsieh.ting.lin@gmail.com`.

After that, the header "Login" can be pointed at `/api/login?rd=…` (the
trampoline is already deployed) for a pure email/PIN flow, and the bearer token
becomes optional. Team domain: `htlin.cloudflareaccess.com`.

## Verification

- Local (`wrangler pages dev`, `DEV_EMAIL` bypass): full CRUD + merge + 400/302.
- Production (real `OWNER_TOKEN`): 401 without/with wrong token; email with the
  right token; like/dislike/read persist to KV; state reflects; cleanup leaves
  the owner's state empty; public site + `/feed.json` still 200; login 302.
