export class AppError extends Error {
    statusCode: number;
    code: string;

    constructor(message: string, code: string, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        
        Error.captureStackTrace(this, this.constructor)
    }
}