# Environment configuration

Use Node.js 22.12 or newer for the frontend and backend. The optional env-file
flag requires Node.js 22.9 or newer; the shared minimum also satisfies Vite.

## Development

- Frontend: `npm --prefix frontend run dev`. Without `VITE_API_BASE_URL`, requests
  use `http://localhost:3000`.
- Backend: `npm --prefix backend start`. `backend/.env` is loaded if present,
  but is not required. Variables supplied by the process environment take priority.
- `PORT` defaults to `3000`.
- `FRONTEND_ORIGIN` defaults to `http://localhost:5173` outside production.
- PostgreSQL configuration remains unchanged: supply `PGHOST`, `PGPORT`,
  `PGDATABASE`, `PGUSER` and `PGPASSWORD` as needed by the existing `pg` pool.

## Production

1. Build with `npm --prefix frontend run build`. With `VITE_API_BASE_URL` unset,
   API URLs are relative (`/auth/me`, `/transactions`, `/budgets`, etc.).
2. Configure the web server/reverse proxy to serve the frontend and forward
   `/auth`, `/transactions`, `/budgets` (including nested paths) and `/health`
   to Express. These paths must reach the API before any SPA fallback.
   Express does not currently serve `frontend/dist` or configure this routing.
3. Start the backend with `NODE_ENV=production`, the database variables and the
   deployment's `PORT`. HTTPS is required for the existing production cookies.

Production enables no cross-origin CORS access by default; same-origin requests
do not need CORS headers. If cross-origin browser access is required, set
`FRONTEND_ORIGIN` to one exact HTTP(S) origin, such as `https://finantec.example`.
Wildcards, URL paths and trailing slashes are not accepted. CORS does not replace
authentication or authorization, and enabling it does not change cookie policy.

`VITE_API_BASE_URL` can override the frontend API base (for example `/api` or an
explicit API URL). It is public build-time configuration, not a runtime variable
or a place for secrets. A path prefix requires corresponding proxy routing and
prefix rewriting because Express routes currently have no `/api` prefix.

This configuration does not provision PostgreSQL, apply migrations, configure
HTTPS or create deployment routing. Those remain deployment prerequisites.

## Public authentication rate limits

- `POST /auth/login`: 15 requests per client IP in 15 minutes.
- `POST /auth/register`: 5 requests per client IP in 60 minutes.
- Each endpoint has its own limiter and in-memory store, created inside
  `createApp`. Applications and endpoints do not share counters.
- All attempts count, including successful requests and invalid JSON or
  credentials. Limiting runs before JSON parsing, validation, database access
  and password hashing/verification. Other routes are not rate limited.
- Blocked requests return HTTP 429 and
  `{ "error": "Muitas tentativas. Aguarde antes de tentar novamente." }`.
  `Retry-After` reports the remaining wait in seconds; standard rate-limit
  headers are also enabled.

Express `trust proxy` remains disabled. The limiter uses Express's client IP
and the library's default IPv6 subnet handling, not a client-supplied
`X-Forwarded-For`. Before deploying behind a reverse proxy/load balancer, define
and test a trust policy for the actual hosting topology and trusted proxies.
Do not enable `trust proxy: true` or trust arbitrary forwarded headers.
Without this configuration, users behind a proxy may share its IP quota.

Memory counters reset when the process restarts and are not shared between
backend processes, workers or instances. This first layer is not distributed
brute-force protection or DDoS protection. Shared-store/edge protections and a
safe proxy configuration must be evaluated for the chosen production setup;
no Redis, database tables or hosting-specific settings are added here.
