import express, { type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { requireEnv } from './env.js';
import passport from 'passport';

dotenv.config();

import { registerPassportStrategies } from './passport.js';
import { authRouter } from '../routes/authRouter.js';
//import errorHandler from './middleware/errorHandler';
//import routes from './routes';

import { logger } from '../middleware/logger.js';

export const app = express();
app.use(cors({ origin: requireEnv('CLIENT_URL'), credentials: true }));
app.use(express.json());
app.use(cookieParser());

registerPassportStrategies();
app.use(passport.initialize());

app.use('/auth', authRouter);

app.use(logger);

app.use('/health', (req: Request, res: Response) => {
    return res.send('Chat Backend is running');
});

// app.use(errorHandler);


