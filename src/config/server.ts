const express = require('express')
const cors = require('cors');
const dotenv = require('dotenv');

import type { Request, Response } from "express";
//import errorHandler from './middleware/errorHandler';
//import routes from './routes';

const logger = require('../middleware/logger');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// app.use('/', routes);

app.use(logger);

app.use('/health', (req: Request, res: Response) => {
    return res.send('Chat Backend is running');
});

// app.use(errorHandler);

module.exports = app;
