"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const errorHandler = (err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) => {
    const statusCode = err.statusCode || 500;
    const status = err.status || 'error';
    logger_1.logger.error(`${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    if (env_1.env.NODE_ENV === 'development') {
        logger_1.logger.error(err.stack || '');
    }
    // If in development, return rich logs, otherwise return sanitized responses
    if (env_1.env.NODE_ENV === 'development') {
        return res.status(statusCode).json({
            status,
            error: err,
            message: err.message,
            stack: err.stack,
        });
    }
    // Production response
    if (err.isOperational) {
        return res.status(statusCode).json({
            status,
            message: err.message,
        });
    }
    // Programming or unknown errors: don't leak detail
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong on the server.',
    });
};
exports.errorHandler = errorHandler;
