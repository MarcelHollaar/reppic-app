# Dashboard Backend

Express API for Reppic strategic and operational sales dashboards. Runs separately from the Reppic Next.js app on port **5001**.

Reppic frontend pages under `/dashboards/*` call this service via `NEXT_PUBLIC_DASHBOARD_API_URL`. Reppic server-side transcript sync uses `DASHBOARD_API_URL`.

## Prerequisites

- Node.js 20+
- PostgreSQL with a dedicated database `sales_dashboard` (separate from Reppic Prisma DB)
- Same `JWT_SECRET` as Reppic
- OpenAI API key (set as `Reppic_dashboard`)

## Setup

```bash
cp .env.example .env
# Edit .env — especially JWT_SECRET, Reppic_dashboard, DATABASE_URL

# Create DB once (example):
# psql -U postgres -c "CREATE DATABASE sales_dashboard;"
# Or: npm run db:ensure

npm install
npm run db:ensure
npm run db:push
```

## Development

```bash
npm run dev
```

Server listens on `http://localhost:5001`.

Run Reppic in parallel:

```bash
cd ../app && npm run dev
```

## Docker

Built and started via root `docker-compose.yml` as service `dashboard-backend`.

## API

See `API-ENDPOINTS.md` for the full list. Endpoints used by Reppic integration:

- `POST /api/transcripts`
- `GET /api/analytics/summary`
- `GET /api/analytics/operational`
- `GET/POST /api/plans/*`
- `POST /api/ai/suggested-questions`
- `POST /api/ai/conclusion-chat`
