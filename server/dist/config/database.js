"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.pool = void 0;
const pg_1 = require("pg");
const env_1 = require("./env");
const isProduction = env_1.env.NODE_ENV === 'production' || env_1.env.DATABASE_URL.includes('render.com');
// Use DATABASE_URL for connection, but fall back to individual variables
exports.pool = new pg_1.Pool({
    connectionString: env_1.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});
exports.pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
const query = async (text, params) => {
    return exports.pool.query(text, params);
};
exports.query = query;
