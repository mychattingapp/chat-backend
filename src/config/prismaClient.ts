import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { requireEnv } from './env.js';

// Load .env in case this module is imported before other config.
dotenv.config();

const connectionString = requireEnv('DATABASE_URL');
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Prisma 7 requires a driver adapter; PrismaPg wraps the pg Pool.
const adapter = new PrismaPg(new Pool({ connectionString }));
const prisma = new PrismaClient({ adapter });

export { prisma };
