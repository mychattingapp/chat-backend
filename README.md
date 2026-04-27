# chat-backend

Backend for **mychattingapp** — a real-time chat application.

## Tech Stack

- **Node.js + Express** (TypeScript)
- **PostgreSQL** + **Prisma ORM**
- **Passport.js** (Google OAuth 2.0)
- **JWT access/refresh tokens** stored in **HttpOnly cookies**

## Auth Overview

- OAuth login starts with `GET /auth/google` and completes at `GET /auth/google/callback`.
- On successful callback, the backend issues:
	- `access_token` (short-lived)
	- `refresh_token` (longer-lived)
- Tokens are set as **HttpOnly cookies**.
- Token refresh happens via `GET /auth/refresh`.
- Logout clears cookies and invalidates the refresh token server-side.

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- PostgreSQL database

### 1) Install

```bash
npm install
```

### 2) Environment Variables

Create a `.env` file in this folder:

```env
# Server
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT secrets
JWT_ACCESS_TOKEN_SECRET=change_me
JWT_REFRESH_TOKEN_SECRET=change_me

# Cookie/JWT TTLs (milliseconds)
ACCESS_TOKEN_TTL=3600000
REFRESH_TOKEN_TTL=604800000
```

Notes:
- `ACCESS_TOKEN_TTL` and `REFRESH_TOKEN_TTL` are used for cookie expiration and refresh-session expiry.
- JWT access/refresh token lifetimes should be aligned with the TTLs above.

### 3) Database Setup

Run Prisma migrations and generate the client:

```bash
npx prisma migrate dev
npx prisma generate
```

### 4) Run the Backend

```bash
npm run dev
```

Health check:
- `GET /health`

## API Routes (Auth)

- `GET /auth/google` — start Google OAuth flow
- `GET /auth/google/callback` — OAuth callback (sets cookies, redirects to `CLIENT_URL`)
- `GET /auth/failure` — OAuth failure handler (redirects to frontend `/login?error=oauth_failed`)
- `GET /auth/me` — get current user (requires valid access token)
- `GET /auth/refresh` — refresh tokens using refresh cookie
- `POST /auth/logout` — clear cookies + revoke refresh token

## Project Structure

- `src/config` — server, passport, prisma, cookies, env utilities
- `src/controllers` — request handlers (auth, etc.)
- `src/routes` — Express routers (e.g. `authRouter`) that wire endpoints → controllers
- `src/services` — business logic and DB calls (Prisma)
- `src/middleware` — auth, logging, helpers
- `prisma/` — schema + migrations

## Roadmap / Future Work

- Real-time messaging via **WebSockets** (or Socket.IO) for live chat updates
- Presence/typing indicators, read receipts, message delivery status
- Dockerized local dev (`docker compose`) and production containerization
- CI/CD pipeline (lint, typecheck, tests, build, deploy)
- More providers (GitHub OAuth) and account linking
- Rate limiting, CSRF hardening for cookie-based auth, audit logging
- Redis for session-related caching / pub-sub (horizontal scaling)

## License

ISC
