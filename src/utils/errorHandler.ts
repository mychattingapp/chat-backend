import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
    if (error instanceof AppError) {
        if (error.statusCode < 500) {
            console.warn(`[${error.statusCode}] ${error.code} ${req.method} ${req.originalUrl}: ${error.message}`);
        }
        else {
            console.error(error);
        }

        return res.status(error.statusCode).json({
            "success": false,
            error: {
                code: error.code,
                message: error.message
            }
        })
    }

    console.error(error);

    return res.status(500).json({
        "success": false,
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong..."
        }
    })
}
