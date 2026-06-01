import { Pool } from 'pg';
import { env } from './env';

const isProduction = env.NODE_ENV === 'production';

// Use DATABASE_URL for connection, but fall back to individual variables
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const query = async (text: string, params?: unknown[]) => {
  return pool.query(text, params);
};
