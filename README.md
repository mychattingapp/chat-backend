# chat-backend

Backend for **mychattingapp** - a real-time chat application.

## Related Repos

- Frontend: https://github.com/mychattingapp/chat-frontend

## Project Overview

This backend powers **mychattingapp**, a real-time messaging application with secure sign-in, friend requests, direct chats, text and image messages, message history, read state, presence, typing indicators, and profile avatar support.

## Tech Stack

- **Node.js + Express** (TypeScript)
- **PostgreSQL** + **Prisma ORM**
- **Passport.js** (Google OAuth 2.0)
- **JWT access/refresh tokens** stored in **HttpOnly cookies**
- **Socket.IO** for authenticated real-time chat events
- **Cloudflare R2** for profile image storage, private message image storage, and signed image uploads/downloads

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
- Friend request responses hide profile image URLs unless the friendship is accepted.
- Direct chat creation and chat listing are implemented.
- Message pagination and text/image message sending are implemented.
- Private message images use signed Cloudflare R2 upload/read URLs and are only exposed to users in the chat.
- User profile updates and avatar upload URLs backed by Cloudflare R2 are implemented.
- Socket.IO chat rooms support joining chats, read receipts, presence, typing indicators, new-chat notifications, and real-time new-message events.
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

# Cloudflare R2
CLOUDFLARE_R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=your_r2_access_key
CLOUDFLARE_R2_SECRET_KEY=your_r2_secret_key
CLOUDFLARE_R2_BUCKET=your_r2_bucket
CLOUDFLARE_R2_PUBLIC_URL=https://your_public_r2_domain
```

Notes:
- `ACCESS_TOKEN_TTL` and `REFRESH_TOKEN_TTL` are used for cookie expiration and refresh-session expiry.
- JWT access/refresh token lifetimes should be aligned with the TTLs above.
- `CLIENT_URL` must match the frontend origin because CORS and Socket.IO credentials are restricted to this value.
- Cloudflare R2 variables are required for avatar uploads, message image uploads, signed message image reads, and storing OAuth provider profile images.

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

## Deployment

- On pushes to `main`, GitHub Actions verifies the build and runs `npx prisma migrate deploy`.
- Docker image builds are published to **GitHub Container Registry (GHCR)**.
- Continuous deployment deploys the backend to **Railway**.
- Runtime environment variables are managed in Railway.

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
- `POST /api/chats/:chatId/messages` - send a text and/or image message over REST
- `GET /api/chats/:chatId/messages/:messageId/image-url` - create a signed read URL for a private message image

### Users

- `GET /api/users/me` - get the current user's profile
- `PATCH /api/users/me` - update the current user's profile

### Images

- `POST /api/images/upload-url` - create a signed upload URL for an avatar or message image
- `PATCH /api/images/avatar` - confirm the uploaded avatar and update the current user's profile image URL

## Socket Events

Socket.IO uses the same backend URL and requires the `access_token` cookie during the handshake.

Client-to-server:
- `chat:join` with `{ chatId }` - joins a chat room after participant validation
- `chat:read` with `{ chatId, lastReadMessageId }` - updates the current user's last-read message for a chat
- `message:send` with `{ chatId, text?, imageKey? }` - sends a text and/or image message and emits it to other room participants
- `typing:start` with `{ chatId }` - notifies other room participants that the current user is typing
- `typing:stop` with `{ chatId }` - notifies other room participants that the current user stopped typing

Server-to-client:
- `chat:new` with `{ chatId }` - notifies participants about a new chat
- `message:new` with `{ chatId, message }` - emits a new message to chat participants
- `presence:snapshot` with `{ onlineUserIds }` - sends the connected user's currently online chat participants
- `presence:update` with `{ userId, isOnline }` - notifies room participants when a user goes online or offline
- `typing:update` with `{ chatId, userId, isTyping }` - notifies room participants about typing state changes
- `chat:error` / `message:error` - emitted when an acknowledgement callback is missing

## Project Structure

- `src/config` - server, passport, prisma, cookies, env, and R2 utilities
- `src/controllers` - request handlers for auth, friends, chats, users, and images
- `src/routes` - Express routers that wire endpoints to controllers
- `src/services` - business logic, DB calls, and image upload helpers
- `src/middleware` - auth, logging, helpers
- `src/socket` - Socket.IO setup, auth middleware, connection handlers, chat/message/presence/typing events
- `src/dtos` - API response shaping helpers
- `src/types` - shared backend TypeScript types
- `prisma/` - schema + migrations

## Roadmap / Future Work

- Message delivery status
- More providers (GitHub OAuth) and account linking
- Rate limiting, CSRF hardening for cookie-based auth, audit logging
- Redis for session-related caching / pub-sub (horizontal scaling)

## License

ISC
