import type { Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { getAdminUser, getMessageActivity, getSignupActivity, getOverview, getUsers, type MessageRange } from '../services/adminService.js';

function invalid(message: string): never { throw new AppError(message, 'INVALID_ADMIN_QUERY', 400); }

function dateOnly(value: unknown): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid('Use dates in YYYY-MM-DD format.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return invalid('Invalid date.');
    return date;
}

export function parseMessageRange(query: Request['query']): MessageRange {
    const group = query.group ?? 'day';
    if (group !== 'day' && group !== 'week' && group !== 'month') return invalid('Invalid grouping.');
    const today = new Date().toISOString().slice(0, 10);
    const end = dateOnly(query.to ?? today);
    end.setUTCDate(end.getUTCDate() + 1);
    const defaultStart = new Date(end.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const start = dateOnly(query.from ?? defaultStart);
    if (start >= end || end.getTime() - start.getTime() > 366 * 86400000) return invalid('Choose a range of 1–366 days.');
    return { start, end, group };
}

function userId(req: Request): string {
    const id = req.params.userId;
    if (typeof id !== 'string' || !id || id.length > 100) return invalid('Invalid user ID.');
    return id;
}

export async function handleOverview(_req: Request, res: Response) {
    res.json({ success: true, data: await getOverview() });
}

export async function handleUsers(req: Request, res: Response) {
    const rawPage = req.query.page ?? '1';
    if (typeof rawPage !== 'string' || !/^[1-9]\d*$/.test(rawPage)) return invalid('Invalid page.');
    const page = Number(rawPage);
    if (!Number.isSafeInteger(page) || page > 1000000) return invalid('Invalid page.');
    const search = req.query.search ?? '';
    if (typeof search !== 'string' || search.length > 200) return invalid('Search must be at most 200 characters.');
    res.json({ success: true, data: await getUsers(page, search.trim()) });
}

export async function handleUser(req: Request, res: Response) {
    res.json({ success: true, data: await getAdminUser(userId(req)) });
}

export async function handleActivity(req: Request, res: Response) {
    res.json({ success: true, data: await getMessageActivity(parseMessageRange(req.query), req.params.userId === undefined ? undefined : userId(req)) });
}

export async function handleSignups(req: Request, res: Response) {
    res.json({ success: true, data: await getSignupActivity(parseMessageRange(req.query)) });
}
