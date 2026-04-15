# Lineo (QueueLess)

Lineo is a multi-tenant queue and appointment platform for clinics, hospitals, and service centers.

This repository contains:
- a Go backend API (`cmd`, `internal`, `pkg`)
- a Next.js frontend (`lineo-fe`)

## Highlights
- JWT authentication with role-based access (`user`, `agent`, `admin`)
- Queue lifecycle management with staff controls
- Appointment booking and check-in flow
- Redis-backed real-time state and pub/sub fan-out
- RabbitMQ event bus and background consumers
- Razorpay payment order, verify, and webhook handling
- Prometheus metrics and structured JSON logging

## Tech Stack

Backend:
- Go (module target: 1.25)
- Gin
- GORM + PostgreSQL
- Redis
- RabbitMQ
- Prometheus client

Frontend:
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Axios

## Repository Layout

```text
cmd/api/                # API bootstrap
internal/               # handlers, services, repositories, domain models, workers
pkg/                    # infra packages (db, redis, broker, middleware, utils)
docs/openapi.yaml       # OpenAPI starter spec
lineo-fe/               # Next.js frontend app
example.env             # Backend environment template
docker-compose.yml      # API + Redis + RabbitMQ services
```

## Prerequisites

- Go 1.25+
- Node.js 20+
- npm
- Docker + Docker Compose (recommended for local infra)

If running backend without Docker, you also need:
- PostgreSQL
- Redis
- RabbitMQ

## Environment Setup

### 1) Backend env (`.env`)

Create `.env` from the template:

```bash
cp example.env .env
```

Minimum required values to run backend successfully:
- `DATABASE_URL` (recommended)
- `JWT_SECRET`
- `REDIS_HOST`
- `REDIS_PORT`
- `RABBITMQ_URL`

Important notes:
- `DATABASE_URL` is preferred. If omitted, the app falls back to `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`.
- In production, set `ENV=production` and configure `ALLOWED_ORIGINS`.
- Secret keys support file-based variants like `JWT_SECRET_FILE`, `RAZORPAY_KEY_SECRET_FILE`, etc.

Optional integrations:
- Twilio (`TWILIO_*`)
- Google Maps (`GOOGLE_API_KEY`)
- Cloudflare Turnstile (`TURNSTILE_SECRET_KEY`)
- Razorpay (`RAZORPAY_*`)

### 2) Frontend env (`lineo-fe/.env.local`)

Create `lineo-fe/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_key
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
```

## Run with Docker (Backend)

`docker-compose.yml` starts:
- API on `http://localhost:8080`
- Redis on `localhost:6379`
- RabbitMQ on `localhost:5672`
- RabbitMQ management UI on `http://localhost:15672`

Before starting, ensure your `.env` has a valid `DATABASE_URL` (PostgreSQL is not included in this compose file).

```bash
docker-compose up --build
```

Health check:

```bash
curl http://localhost:8080/health
```

## Run Locally (Backend)

Start PostgreSQL, Redis, and RabbitMQ first, then:

```bash
go mod tidy
go run ./cmd/api
```

## Run Locally (Frontend)

```bash
cd lineo-fe
npm install
npm run dev
```

Frontend default URL: `http://localhost:3000`

## Tests and Quality

Backend tests:

```bash
go test ./...
go test -race ./...
```

If `go test ./...` traverses nested Go files inside frontend dependencies, run backend-only packages:

```bash
go test ./cmd/... ./internal/... ./pkg/...
```

Frontend checks:

```bash
cd lineo-fe
npm run lint
npm run build
```

## API Reference

Main API group: `/api/v1`

Common routes:
- Auth: `/api/v1/auth/register`, `/api/v1/auth/login`
- Queue: `/api/v1/queue/join`, `/api/v1/queue/:key/state`
- Appointments: `/api/v1/appointments/book`
- Staff queue ops: `/api/v1/staff/queue/:key/next`
- Admin config: `/api/v1/admin/config`

Also see:
- OpenAPI starter: `docs/openapi.yaml`
- Runtime metrics: `/metrics`

## Security Notes

- Do not commit real secrets to `.env` or frontend env files.
- In production:
  - set strict `ALLOWED_ORIGINS`
  - use secure secret delivery via `*_FILE` env vars where possible
  - use strong values for `JWT_SECRET` and payment keys

## Troubleshooting

- Backend exits on startup with DB error:
  - confirm `DATABASE_URL` is set and reachable.
- Captcha validation fails:
  - set both backend `TURNSTILE_SECRET_KEY` and frontend `NEXT_PUBLIC_TURNSTILE_SITE_KEY` correctly.
- CORS issues in production:
  - ensure `ENV=production` and `ALLOWED_ORIGINS` includes your frontend origin.
