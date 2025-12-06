import type { Request, Response, NextFunction } from 'express';

const logger = (req: Request, res: Response, next: NextFunction) => {
    const time = new Date();

    const formattedTime = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Karachi",
        timeZoneName: "short",
    }).format(time);

    const formattedDate = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Karachi",
    }).format(time);

    console.log(`[${formattedDate} ${formattedTime}] [${req.method}] '${req.originalUrl}'`);
    next();
};

module.exports = logger;