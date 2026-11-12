import assert from 'node:assert/strict';
import { test, mock, afterEach } from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';
import { prisma } from '../src/config/prismaClient.js';
import { adminRouter } from '../src/routes/adminRouter.js';
import { errorHandler } from '../src/utils/errorHandler.js';
import { parseMessageRange } from '../src/controllers/adminController.js';
import { getAdminUser, getMessageActivity, getSignupActivity } from '../src/services/adminService.js';

const restorers: (() => void)[] = [];
function stub(target: object, key: string, implementation: (...args: unknown[]) => unknown) {
    const object = target as Record<string, unknown>;
    const original = object[key];
    const replacement = mock.fn(implementation);
    object[key] = replacement;
    restorers.push(() => { object[key] = original; });
    return replacement;
}
afterEach(() => { restorers.splice(0).reverse().forEach(restore => restore()); });

test('all admin endpoints require authentication and the current database role', async () => {
    let role = 'USER';
    stub(prisma.user, 'findUnique', async () => ({ role }));
    stub(prisma, '$transaction', async () => [2, 3, 4]);
    const app = express();
    app.use(cookieParser());
    app.use('/api/admin', adminRouter);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}/api/admin`;
    const token = jwt.sign({ id: 'test-user' }, process.env.JWT_ACCESS_TOKEN_SECRET!);
    const headers = { Cookie: `access_token=${token}` };
    try {
        for (const path of ['/overview', '/messages', '/signups', '/users', '/users/test-user', '/users/test-user/messages']) {
            assert.equal((await fetch(base + path)).status, 401);
            assert.equal((await fetch(base + path, { headers })).status, 403);
        }
        assert.equal((await fetch(base + '/overview', { headers: { Cookie: 'access_token=invalid' } })).status, 401);
        role = 'ADMIN';
        const response = await fetch(base + '/overview', { headers });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { success: true, data: { users: 2, chats: 3, messages: 4 } });
        assert.equal((await fetch(base + '/users?page=-1', { headers })).status, 400);
        assert.equal((await fetch(base + '/messages?group=invalid', { headers })).status, 400);
        assert.equal((await fetch(base + '/signups?from=2026-02-30', { headers })).status, 400);
        role = 'USER';
        assert.equal((await fetch(base + '/overview', { headers })).status, 403);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});

test('date filters validate calendar dates, ordering, range limits and grouping', () => {
    const range = parseMessageRange({ from: '2024-02-29', to: '2024-02-29', group: 'day' });
    assert.equal(range.start.toISOString(), '2024-02-29T00:00:00.000Z');
    assert.equal(range.end.toISOString(), '2024-03-01T00:00:00.000Z');
    for (const query of [
        { from: '2025-02-29' }, { from: 'bad' }, { group: 'year' },
        { from: '2026-02-02', to: '2026-02-01' },
        { from: '2024-01-01', to: '2026-01-01' }, { from: ['2026-01-01'] },
    ]) assert.throws(() => parseMessageRange(query), { statusCode: 400 });
});

test('chart fills gaps and scopes SQL to the sender with bound parameters', async () => {
    stub(prisma.user, 'findUnique', async () => ({ id: 'sender' }));
    const query = stub(prisma, '$queryRaw', async () => [{ bucket: new Date('2026-01-02T00:00:00Z'), count: 3n }]);
    const result = await getMessageActivity(parseMessageRange({ from: '2026-01-01', to: '2026-01-03' }), 'sender');
    assert.deepEqual(result.points, [
        { date: '2026-01-01', count: 0 }, { date: '2026-01-02', count: 3 }, { date: '2026-01-03', count: 0 },
    ]);
    const sql = query.mock.calls[0]!.arguments[0] as { values: unknown[]; strings: string[] };
    assert.ok(sql.values.includes('sender'));
    assert.ok(sql.strings.join('').includes('"senderId" ='));
});

test('weekly and monthly empty charts include partial boundary buckets', async () => {
    stub(prisma, '$queryRaw', async () => []);
    const weekly = await getMessageActivity(parseMessageRange({ from: '2026-01-01', to: '2026-01-07', group: 'week' }));
    assert.deepEqual(weekly.points, [{ date: '2025-12-29', count: 0 }, { date: '2026-01-05', count: 0 }]);
    const monthly = await getMessageActivity(parseMessageRange({ from: '2025-12-31', to: '2026-02-01', group: 'month' }));
    assert.deepEqual(monthly.points.map(point => point.date), ['2025-12-01', '2026-01-01', '2026-02-01']);
});

test('signup activity counts user creation dates with bound range filters and fills zero days', async () => {
    const query = stub(prisma, '$queryRaw', async () => [{ bucket: new Date('2026-01-02T00:00:00Z'), count: 2n }]);
    const range = parseMessageRange({ from: '2026-01-01', to: '2026-01-03' });
    const result = await getSignupActivity(range);
    assert.deepEqual(result, { timezone: 'UTC', points: [
        { date: '2026-01-01', count: 0 }, { date: '2026-01-02', count: 2 }, { date: '2026-01-03', count: 0 },
    ] });
    const sql = query.mock.calls[0]!.arguments[0] as { values: unknown[]; strings: string[] };
    assert.deepEqual(sql.values, ['day', range.start, range.end]);
    assert.match(sql.strings.join(''), /FROM "User"/);
    assert.match(sql.strings.join(''), /"createdAt" >= .* AND "createdAt" </);
});

test('signup activity supports empty weekly and monthly ranges across year boundaries', async () => {
    stub(prisma, '$queryRaw', async () => []);
    for (const [group, dates] of [
        ['week', ['2025-12-29', '2026-01-05']],
        ['month', ['2025-12-01', '2026-01-01']],
    ] as const) {
        const result = await getSignupActivity(parseMessageRange({ from: '2025-12-31', to: '2026-01-07', group }));
        assert.deepEqual(result.points, dates.map(date => ({ date, count: 0 })));
    }
});

test('missing users return 404 for both detail and activity', async () => {
    stub(prisma.user, 'findUnique', async () => null);
    await assert.rejects(getAdminUser('missing'), { statusCode: 404 });
    await assert.rejects(getMessageActivity(parseMessageRange({}), 'missing'), { statusCode: 404 });
});

test('user connections select the other friend on either side and only current chat memberships', async () => {
    const self = { id: 'self', username: 'Self', email: 'self@example.com' };
    const first = { id: 'first', username: 'First', email: 'first@example.com' };
    const second = { id: 'second', username: 'Second', email: 'second@example.com' };
    const date = new Date('2026-01-01T00:00:00Z');
    stub(prisma.user, 'findUnique', async () => self);
    stub(prisma.message, 'count', async () => 0);
    stub(prisma.message, 'findFirst', async () => null);
    stub(prisma.chatParticipant, 'count', async () => 1);
    const friendsQuery = stub(prisma.friendship, 'findMany', async () => [
        { friend1: 'self', friend1Relation: self, friend2Relation: first, createdAt: date },
        { friend1: 'second', friend1Relation: second, friend2Relation: self, createdAt: date },
    ]);
    const memberships = [{ joinedAt: date, chat: { id: 'group', name: 'Group', chatType: 'GROUP', participants: [{ isAdmin: true, user: self }] } }];
    const chatsQuery = stub(prisma.chatParticipant, 'findMany', async () => memberships);
    stub(prisma, '$transaction', operations => Promise.all(operations as Promise<unknown>[]));
    const result = await getAdminUser('self');
    assert.deepEqual(result.friends, [{ ...first, friendsSince: date }, { ...second, friendsSince: date }]);
    assert.deepEqual(result.chatMemberships, memberships);
    const friendArgs = friendsQuery.mock.calls[0]!.arguments[0] as { where: unknown };
    assert.deepEqual(friendArgs.where, { OR: [{ friend1: 'self' }, { friend2: 'self' }] });
    const chatArgs = chatsQuery.mock.calls[0]!.arguments[0] as {
        where: unknown; select: { chat: { select: { participants: { where: unknown }; messages?: unknown } } };
    };
    assert.deepEqual(chatArgs.where, { userId: 'self', leftAt: null });
    assert.deepEqual(chatArgs.select.chat.select.participants.where, { leftAt: null });
    assert.equal(chatArgs.select.chat.select.messages, undefined);
});

test('user detail returns empty connection lists for a user without friends or chats', async () => {
    stub(prisma.user, 'findUnique', async () => ({ id: 'self' }));
    stub(prisma, '$transaction', async () => [0, 0, null, [], []]);
    const result = await getAdminUser('self');
    assert.deepEqual(result.friends, []);
    assert.deepEqual(result.chatMemberships, []);
});

test('direct chat metadata batches totals, viewed-user sent counts and latest timestamps, including empty chats', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const latest = new Date('2026-02-03T12:34:56Z');
    const memberships = ['both', 'received-only', 'empty', 'group'].map(id => ({
        joinedAt: createdAt,
        chat: { id, name: null, createdAt, chatType: id === 'group' ? 'GROUP' : 'DIRECT', participants: [] },
    }));
    stub(prisma.user, 'findUnique', async () => ({ id: 'self' }));
    stub(prisma.message, 'count', async () => 3);
    stub(prisma.message, 'findFirst', async () => null);
    stub(prisma.chatParticipant, 'count', async () => memberships.length);
    stub(prisma.friendship, 'findMany', async () => []);
    stub(prisma.chatParticipant, 'findMany', async () => memberships);
    stub(prisma, '$transaction', operations => Promise.all(operations as Promise<unknown>[]));
    const grouped = stub(prisma.message, 'groupBy', async query => {
        const args = query as { where: { senderId?: string } };
        return args.where.senderId ? [{ chatId: 'both', _count: { _all: 3 } }] : [
            { chatId: 'both', _count: { _all: 8 }, _max: { createdAt: latest } },
            { chatId: 'received-only', _count: { _all: 2 }, _max: { createdAt } },
        ];
    });
    const result = await getAdminUser('self');
    const chats = result.chatMemberships.map(({ chat }) => chat) as { createdAt: Date; messageStats?: unknown }[];
    assert.deepEqual(chats[0]!.messageStats, { total: 8, sent: 3, lastMessageAt: latest });
    assert.deepEqual(chats[1]!.messageStats, { total: 2, sent: 0, lastMessageAt: createdAt });
    assert.deepEqual(chats[2]!.messageStats, { total: 0, sent: 0, lastMessageAt: null });
    assert.equal(chats[3]!.messageStats, undefined);
    assert.equal(chats[0]!.createdAt, createdAt);
    assert.equal(grouped.mock.callCount(), 2);
    const queries = grouped.mock.calls.map(call => call.arguments[0]) as { where: unknown; _max?: unknown }[];
    assert.deepEqual(queries[0]!.where, { chatId: { in: ['both', 'received-only', 'empty'] } });
    assert.deepEqual(queries[0]!._max, { createdAt: true });
    assert.deepEqual(queries[1]!.where, { chatId: { in: ['both', 'received-only', 'empty'] }, senderId: 'self' });
});

