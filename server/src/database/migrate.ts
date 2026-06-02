import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

export const runMigrations = async () => {
  logger.info('Starting database migrations...');
  const client = await pool.connect();
  try {
    let schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(__dirname, '..', '..', 'src', 'database', 'schema.sql');
    }
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    logger.info('Database migrations applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error applying database migrations:', error);
    process.exit(1);
  } finally {
    client.release();
  }
};

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration execution failed:', err);
      process.exit(1);
    });
}
