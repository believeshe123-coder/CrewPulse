# CrewPulse

CrewPulse now uses a lightweight TypeScript monorepo layout so backend and frontend can evolve independently while sharing common contracts.

## Repository Layout

- `apps/api` — Fastify API service.
- `apps/web` — React + Vite frontend.
- `packages/contracts` — shared status labels, account tiers, and rating enums.

## Getting Started for Developers

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL (for API migrations)

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create local env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Required API environment variables (`apps/api/.env`):

- `NODE_ENV`
- `API_PORT`
- `API_HOST`
- `DATABASE_URL`
- `WEB_ORIGIN`

Required web environment variables (`apps/web/.env`):

- `VITE_API_BASE_URL`

### 3) Run API and web locally

In separate terminals:

```bash
npm run dev:api
npm run dev:web
```

Or run every workspace development script together:

```bash
npm run dev
```

- API health endpoint: `http://localhost:4000/health`
- Web landing route: `http://localhost:5173/`

### 4) Migration commands

Run database migrations from the repository root:

```bash
npm run db:migrate
```

Generate Prisma client:

```bash
npm run --workspace @crewpulse/api db:generate
```
