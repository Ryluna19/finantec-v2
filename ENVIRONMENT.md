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
