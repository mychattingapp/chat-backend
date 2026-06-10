# chat-backend

Backend for **mychattingapp** - a real-time chat application.

## Related Repos

- Frontend: https://github.com/mychattingapp/chat-frontend

## Tech Stack

- **Node.js + Express** (TypeScript)
- **PostgreSQL** + **Prisma ORM**
- **Passport.js** (Google OAuth 2.0)
- **JWT access/refresh tokens** stored in **HttpOnly cookies**
- **Socket.IO** for authenticated real-time chat events

## Auth Overview

- OAuth login starts with `GET /api/auth/google` and completes at `GET /api/auth/google/callback`.
- On successful callback, the backend issues:
  - `access_token` (short-lived)
  - `refresh_token` (longer-lived)
- Tokens are set as **HttpOnly cookies**.
- Token refresh happens via `GET /api/auth/refresh`.
- Logout clears cookies and invalidates the refresh token server-side.
- REST and socket requests are authenticated from the same HttpOnly access-token cookie.

## Features

- Google OAuth login flow is implemented.
- JWT access/refresh token auth with HttpOnly cookies is implemented.
- PostgreSQL + Prisma integration is in place.
- Friend request send/accept/reject/list flows are implemented.
- Direct chat creation and chat listing are implemented.
- Message pagination and message sending are implemented.
- Socket.IO chat rooms support joining chats, new-chat notifications, and real-time new-message events.
- Dockerized backend and local Compose-based database setup are in place.
- CI build validation is configured.

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
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

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
- `CLIENT_URL` must match the frontend origin because CORS and Socket.IO credentials are restricted to this value.

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

## Scripts

```bash
npm run dev
```

Runs the TypeScript server in watch mode.

```bash
npm run typecheck
npm run build
```

Type-checks and compiles the backend to `dist/`.

```bash
npm run prisma:generate
npm run prisma:erd
```

Generates the Prisma client and optional ERD output.

## API Routes

All routes except OAuth entry/failure, refresh, logout, and health require a valid access token cookie.

### Auth

- `GET /api/auth/google` - start Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback (sets cookies, redirects to `CLIENT_URL`)
- `GET /api/auth/failure` - OAuth failure handler (redirects to frontend `/login?error=oauth_failed`)
- `GET /api/auth/me` - get current user (requires valid access token)
- `GET /api/auth/refresh` - refresh tokens using refresh cookie
- `POST /api/auth/logout` - clear cookies + revoke refresh token

### Friends

- `GET /api/friends` - list accepted friends
- `POST /api/friends/requests` - send a friend request
- `GET /api/friends/requests/sent` - list sent friend requests
- `GET /api/friends/requests/received` - list received friend requests
- `PATCH /api/friends/requests/:friendRequestId/accept` - accept a friend request
- `PATCH /api/friends/requests/:friendRequestId/reject` - reject a friend request

### Chats

- `POST /api/chats` - create or open a direct chat
- `GET /api/chats` - list chats, supports chat type filtering
- `GET /api/chats/:chatId` - get one chat
- `GET /api/chats/:chatId/messages` - get paginated messages
- `POST /api/chats/:chatId/messages` - send a message over REST

## Socket Events

Socket.IO uses the same backend URL and requires the `access_token` cookie during the handshake.

Client-to-server:
- `chat:join` with `{ chatId }` - joins a chat room after participant validation
- `message:send` with `{ chatId, text }` - sends a message and emits it to other room participants

Server-to-client:
- `chat:new` with `{ chatId }` - notifies participants about a new chat
- `message:new` with `{ chatId, message }` - emits a new message to chat participants
- `chat:error` / `message:error` - emitted when an acknowledgement callback is missing

## Project Structure

- `src/config` - server, passport, prisma, cookies, env utilities
- `src/controllers` - request handlers for auth, friends, and chats
- `src/routes` - Express routers that wire endpoints to controllers
- `src/services` - business logic and DB calls (Prisma)
- `src/middleware` - auth, logging, helpers
- `src/socket` - Socket.IO setup, auth middleware, connection handlers, chat/message events
- `src/dtos` - API response shaping helpers
- `src/types` - shared backend TypeScript types
- `prisma/` - schema + migrations

## Roadmap / Future Work

- Presence/typing indicators, read receipts, message delivery status
- More providers (GitHub OAuth) and account linking
- Rate limiting, CSRF hardening for cookie-based auth, audit logging
- Redis for session-related caching / pub-sub (horizontal scaling)

## License

ISC
