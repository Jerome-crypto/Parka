import { pool } from '../config/database';
import { logger } from '../utils/logger';

export const dropAllTables = async () => {
  logger.info('Dropping all tables in the database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Dynamic PL/pgSQL block to drop all user tables in public schema
    const dropQuery = `
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    await client.query(dropQuery);
    await client.query('COMMIT');
    logger.info('All tables dropped successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error dropping tables:', err);
    process.exit(1);
  } finally {
    client.release();
  }
};

if (require.main === module) {
  dropAllTables()
    .then(() => {
      logger.info('Drop process finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Drop execution failed:', err);
      process.exit(1);
    });
}
