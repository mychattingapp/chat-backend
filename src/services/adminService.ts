import { Prisma } from '@prisma/client';
import { prisma } from '../config/prismaClient.js';
import { AppError } from '../errors/AppError.js';

const userSelect = { id: true, username: true, email: true, role: true, createdAt: true } as const;
const personSelect = { id: true, username: true, email: true } as const;

export async function getOverview() {
    const [users, chats, messages] = await prisma.$transaction([
        prisma.user.count(), prisma.chat.count(), prisma.message.count(),
    ]);
    return { users, chats, messages };
}

export async function getUsers(page: number, search: string) {
    const where: Prisma.UserWhereInput = search ? { OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
    ] } : {};
    const [users, total] = await prisma.$transaction([
        prisma.user.findMany({ where, select: userSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 25, take: 25 }),
        prisma.user.count({ where }),
    ]);
    return { users, total, page, pageSize: 25 };
}

export async function getAdminUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new AppError('User not found', 'USER_NOT_FOUND', 404);
    const [messages, chats, lastMessage, friendships, chatMemberships] = await prisma.$transaction([
        prisma.message.count({ where: { senderId: id } }),
        prisma.chatParticipant.count({ where: { userId: id, leftAt: null } }),
        prisma.message.findFirst({ where: { senderId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        prisma.friendship.findMany({
            where: { OR: [{ friend1: id }, { friend2: id }] },
            select: {
                friend1: true, createdAt: true,
                friend1Relation: { select: personSelect },
                friend2Relation: { select: personSelect },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
        prisma.chatParticipant.findMany({
            where: { userId: id, leftAt: null },
            select: {
                joinedAt: true,
                chat: { select: {
                    id: true, name: true, chatType: true, createdAt: true,
                    participants: {
                        where: { leftAt: null },
                        select: { isAdmin: true, user: { select: personSelect } },
                        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
                    },
                } },
            },
            orderBy: [{ joinedAt: 'desc' }, { id: 'asc' }],
        }),
    ]);
    const friends = friendships.map(friendship => ({
        ...(friendship.friend1 === id ? friendship.friend2Relation : friendship.friend1Relation),
        friendsSince: friendship.createdAt,
    }));
    const directChatIds = chatMemberships.filter(({ chat }) => chat.chatType === 'DIRECT').map(({ chat }) => chat.id);
    const totalsQuery = prisma.message.groupBy({
        by: ['chatId'], where: { chatId: { in: directChatIds } },
        orderBy: { chatId: 'asc' },
        _count: { _all: true }, _max: { createdAt: true },
    });
    const sentQuery = prisma.message.groupBy({
        by: ['chatId'], where: { chatId: { in: directChatIds }, senderId: id },
        orderBy: { chatId: 'asc' },
        _count: { _all: true },
    });
    const [totals, sent] = directChatIds.length ? await prisma.$transaction([totalsQuery, sentQuery]) : [[], []];
    const totalsByChat = new Map(totals.map(row => [row.chatId, row]));
    const sentByChat = new Map(sent.map(row => [row.chatId, row._count._all]));
    const membershipsWithStats = chatMemberships.map(membership => {
        if (membership.chat.chatType !== 'DIRECT') return membership;
        const total = totalsByChat.get(membership.chat.id);
        return { ...membership, chat: { ...membership.chat, messageStats: {
            total: total?._count._all ?? 0,
            sent: sentByChat.get(membership.chat.id) ?? 0,
            lastMessageAt: total?._max.createdAt ?? null,
        } } };
    });
    return { ...user, messages, chats, lastMessageAt: lastMessage?.createdAt ?? null, friends, chatMemberships: membershipsWithStats };
}

export type MessageRange = { start: Date; end: Date; group: 'day' | 'week' | 'month' };

export async function getMessageActivity(range: MessageRange, userId?: string) {
    if (userId && !await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
    }
    // Values are bound parameters, including the validated date_trunc unit.
    const rows = await prisma.$queryRaw<{ bucket: Date; count: bigint }[]>(Prisma.sql`
        SELECT date_trunc(${range.group}, "createdAt") AS bucket, count(*) AS count
        FROM "Message"
        WHERE "createdAt" >= ${range.start} AND "createdAt" < ${range.end}
        ${userId ? Prisma.sql`AND "senderId" = ${userId}` : Prisma.empty}
        GROUP BY 1 ORDER BY 1
    `);
    return fillActivityBuckets(range, rows);
}

export async function getSignupActivity(range: MessageRange) {
    const rows = await prisma.$queryRaw<{ bucket: Date; count: bigint }[]>(Prisma.sql`
        SELECT date_trunc(${range.group}, "createdAt") AS bucket, count(*) AS count
        FROM "User"
        WHERE "createdAt" >= ${range.start} AND "createdAt" < ${range.end}
        GROUP BY 1 ORDER BY 1
    `);
    return fillActivityBuckets(range, rows);
}

function fillActivityBuckets(range: MessageRange, rows: { bucket: Date; count: bigint }[]) {
    const counts = new Map(rows.map(row => [row.bucket.toISOString().slice(0, 10), Number(row.count)]));
    const cursor = new Date(range.start);
    if (range.group === 'week') cursor.setUTCDate(cursor.getUTCDate() - (cursor.getUTCDay() + 6) % 7);
    if (range.group === 'month') cursor.setUTCDate(1);
    const points: { date: string; count: number }[] = [];
    while (cursor < range.end) {
        const date = cursor.toISOString().slice(0, 10);
        points.push({ date, count: counts.get(date) ?? 0 });
        if (range.group === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        else cursor.setUTCDate(cursor.getUTCDate() + (range.group === 'week' ? 7 : 1));
    }
    return { points, timezone: 'UTC' };
}
