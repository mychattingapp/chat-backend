import express, { type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { requireEnv } from './env.js';
import passport from 'passport';

dotenv.config();

import { registerPassportStrategies } from './passport.js';
import { authRouter } from '../routes/authRouter.js';
import { friendRouter } from '../routes/friendRouter.js';
import { logger } from '../middleware/logger.js';
import { errorHandler } from '../utils/errorHandler.js';
import { chatRouter } from '../routes/chatRouter.js';

export const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: requireEnv('CLIENT_URL'), credentials: true }));
app.use(express.json());
app.use(cookieParser());

registerPassportStrategies();
app.use(passport.initialize());

app.use('/api/auth', authRouter);
app.use('/api/friends', friendRouter);
app.use('/api/chats', chatRouter);

app.use(logger);

app.use('/health', (_req: Request, res: Response) => {
    return res.send('Chat Backend is running');
});

app.use(errorHandler);


