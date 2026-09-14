# Bhai Ka Theka — backend

Django + DRF API for the game. The game itself stays 100% client-side; this exists for
**auth, a database, and anything you want to persist later** (leaderboard, saved sessions, profiles).

## Quickstart

```bash
cd backend
cp .env.example .env
make install          # venv + dependencies
make migrate
make superuser        # admin login
make run              # http://localhost:8000
```

Generate a real secret key for `.env`:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Other commands: `make test`, `make lint`, `make format`, `make check` (Django's deployment checklist).

With Docker + Postgres instead: `docker compose up --build`.

## Layout

```
backend/
├── config/                 project config, no business logic
│   ├── settings/           base.py + dev.py / prod.py / test.py
│   ├── urls.py             everything versioned under /api/v1/
│   └── wsgi.py asgi.py
├── apps/
│   ├── common/             shared building blocks (base models, pagination,
│   │                       error shape, IsOwner permission, health check)
│   ├── accounts/           custom User (email login) + JWT auth
│   └── game/               example domain app — copy this pattern
├── requirements/           base / dev / prod
├── conftest.py             pytest fixtures (api_client, user, auth_client)
└── Dockerfile docker-compose.yml Makefile
```

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/health/` | — | Liveness + DB check |
| POST | `/api/v1/auth/register/` | — | Create account → returns user + tokens |
| POST | `/api/v1/auth/login/` | — | Email + password → access + refresh |
| POST | `/api/v1/auth/refresh/` | — | New access token |
| POST | `/api/v1/auth/logout/` | ✔ | Blacklist a refresh token |
| GET/PATCH | `/api/v1/auth/me/` | ✔ | Read / update your profile |
| GET/POST | `/api/v1/game/sessions/` | ✔ | Your rounds (list / record one) |
| GET | `/api/v1/game/leaderboard/` | — | Public top 20 by jars |

Try it:

```bash
curl -X POST localhost:8000/api/v1/auth/register/ \
  -H 'Content-Type: application/json' \
  -d '{"email":"bunty@theka.test","password":"thandi-beer-123"}'

curl localhost:8000/api/v1/auth/me/ -H "Authorization: Bearer <access>"
```

## Calling it from the game

```js
const API = import.meta.env.VITE_API_URL; // e.g. https://api.yourdomain.com/api/v1

async function saveSession(stats, accessToken) {
  await fetch(`${API}/game/sessions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      jars: stats.jars,
      litres_drunk: stats.drunkL.toFixed(2),
      litres_spilled: stats.spilledL.toFixed(2),
      bottles_opened: stats.opened,
    }),
  });
}
```

Add the game's origin to `CORS_ALLOWED_ORIGINS` in `.env`, or the browser will block the call.

## Conventions worth keeping

- **Custom user model from day one** — switching later means a painful migration.
- **UUID primary keys** (`apps/common/models.BaseModel`) — safe to expose, no row-count leak.
- **Deny by default**: DRF requires authentication unless a view opts out with `AllowAny`.
- **Never trust the client for ownership** — `perform_create` sets `user=request.user`, and
  querysets are filtered to the caller so one user can't read another's rows.
- **One error shape** everywhere: `{"error": {"code", "message", "details"}}`.
- **Settings by environment**, secrets from env vars only. `prod.py` refuses to boot without a real key.
- **`ATOMIC_REQUESTS`** is on: a failed request can't leave half-written rows.
- **Thin views, fat serializers/models.** Business rules belong in the model or a `services.py`, not the view.

### Adding a new app

```bash
mkdir -p apps/yourapp/migrations && touch apps/yourapp/__init__.py apps/yourapp/migrations/__init__.py
```

Create `apps.py` with `name = "apps.yourapp"` and a short `label`, add it to `LOCAL_APPS` in
`config/settings/base.py`, inherit models from `apps.common.models.BaseModel`, then wire its
`urls.py` into the `api_v1` list in `config/urls.py`.

## Deploying

Any host that runs a Python web service works — Railway, Render, Fly.io, a VPS.

1. Set env vars: `DJANGO_SETTINGS_MODULE=config.settings.prod`, `DJANGO_SECRET_KEY`,
   `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL` (Postgres), `CORS_ALLOWED_ORIGINS`.
2. Release command: `python manage.py migrate`
3. Start command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3`
4. Health check path: `/api/v1/health/`

Vercel is a poor fit for Django (serverless, no persistent connections) — keep the game on Vercel
and put this on Railway/Render instead.
