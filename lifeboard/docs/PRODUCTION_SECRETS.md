# Production secrets & environment variables

Treat all credentials as **production secrets**: store them only in your host’s **secrets manager** or **encrypted env** (e.g. Vercel Environment Variables, AWS Secrets Manager, Doppler), not in git, tickets, or screenshots.

## Required variables (see root `.env.example`)

| Variable | Notes |
|----------|--------|
| `NEXTAUTH_SECRET` | **Strong random** value (e.g. `openssl rand -base64 32`). Rotate if leaked or on a serious incident. |
| `NEXTAUTH_URL` | **Exact** public HTTPS URL of the app (no trailing slash issues with your host). Wrong value breaks OAuth callbacks and cookies. With `https://`, the app sets **`useSecureCookies`** so session cookies are **Secure** + appropriate for production. |
| `DATABASE_URL` / `DIRECT_URL` | DB credentials in the connection string — **rotate DB password** periodically; use a DB user with **least privilege** (see ops runbook). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console. **Rotate** client secret if exposed. Restrict OAuth redirect URIs to your production domain. |
| `GOOGLE_REDIRECT_URI` | Must match what Google allows and what your app uses for the Google OAuth flow (see `app/api/google/` routes). |
| `OPENAI_API_KEY` | **Rotate** in OpenAI dashboard if leaked. Prefer org-level keys + usage limits. |
| `OPENWEATHER_API_KEY` | OpenWeather — used only by **`/api/weather`** (never `NEXT_PUBLIC_*`). |
| `API_NINJAS_KEY` | API Ninjas — used only by **`/api/quote`** (never `NEXT_PUBLIC_*`). |

If you previously used `NEXT_PUBLIC_OPENWEATHER_KEY` or `NEXT_PUBLIC_API_NINJAS_KEY`, remove them and set the server-only names above so keys are not bundled to the browser.

## Practices

1. **Never commit** `.env`, `.env.local`, or real keys — `.env.example` is the template only.
2. **Separate** dev/staging/prod secrets; don’t reuse production keys in local `.env`.
3. **Rotate** after employee offboarding, suspected leak, or periodically for high-risk keys (DB, OAuth client secret, OpenAI).
4. **Audit** who can read production env in your hosting provider.

## Verification before deploy

- [ ] `NEXTAUTH_URL` matches production URL (HTTPS).
- [ ] `NEXTAUTH_SECRET` is set and not a placeholder.
- [ ] Google OAuth **Authorized redirect URIs** include `https://<your-domain>/api/auth/callback/google` (and any custom Google routes you use).
- [ ] `DATABASE_URL` points at production DB; credentials are not default/postgres-only if exposed to internet.

This complements code-level protections (auth on API routes, rate limits, payload caps); it does not replace them.

For database role hardening, follow **[DB_LEAST_PRIVILEGE.md](./DB_LEAST_PRIVILEGE.md)**.

## Logging

- **`[time-debug]`** logs are **off in production** unless you set **`TIME_DEBUG=1`**. When on, user fields (`text`, `title`, etc.) are **length-only**, not raw content.
- **`devLog`** (schedule success lines, etc.) only runs when **`NODE_ENV !== "production"`**.
- **API route errors** use **`logErrorSafe`**: in production only the **error message** is logged, not full stack traces in the default path.

## NextAuth session cookies (code)

- **`useSecureCookies`**: enabled when `NEXTAUTH_URL` starts with `https://` (HTTP localhost for dev remains OK).
- **Session lifetime**: database sessions use **30 days** `maxAge`, with **`updateAge` 24 hours** (session record refreshed at most once per day of activity — see NextAuth `session` options).

## Rate limits (application)

In-memory limits apply before expensive work:

| Route | Rule |
|-------|------|
| `POST /api/agent`, `POST /api/tasks/schedule` | Per authenticated user + per IP (see `lib/rateLimit.ts`). |
| `GET /api/weather`, `GET /api/quote` | Per IP only (public proxies; **60 req / minute / IP** by default). |
| `GET/POST /api/auth/*` (except `/api/auth/session`) | **Edge middleware**: per IP **45 req / minute** — throttles OAuth/CSRF/sign-in abuse without slowing session polling. |

On multi-instance deployments, limits are **per instance** unless you later use Redis (or similar) for shared counters. Ensure your host forwards **`x-forwarded-for`** (and Cloudflare **`cf-connecting-ip`** when applicable) so per-IP limits map to real clients.


