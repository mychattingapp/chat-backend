# Admin dashboard

Apply the checked-in migration before starting the updated backend (the new user
role is also returned by existing account endpoints). From `chat-backend`:

```sh
npx prisma migrate deploy
npm run prisma:generate
```

Promote an existing account in the intended database:

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'you@example.com';
```

Reload the app to refresh the role in the UI, then open `/admin` or use the Admin
dashboard link in Profile settings. Set the role back to `USER` to revoke access.
Every admin API request checks the current database role; JWTs and cookies are
unchanged. Group-chat admin privileges are independent.

The dashboard is read-only. Totals count retained records, current user chats
exclude memberships with `leftAt`, and user message counts include only messages
sent by that user. Charts use UTC and inclusive date inputs (an exclusive next-day
boundary internally), Monday-based weeks, and a maximum range of 366 days.
Partial weeks/months count only the selected dates. No active-user tracking or
message contents are exposed.

Run focused tests with `node --import tsx --test tests/admin.test.ts`. These tests
stub database operations; they do not apply migrations or verify against a live
PostgreSQL database.
