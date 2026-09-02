"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropAllTables = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const dropAllTables = async () => {
    logger_1.logger.info('Dropping all tables in the database...');
    const client = await database_1.pool.connect();
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
        logger_1.logger.info('All tables dropped successfully.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error dropping tables:', err);
        process.exit(1);
    }
    finally {
        client.release();
    }
};
exports.dropAllTables = dropAllTables;
if (require.main === module) {
    (0, exports.dropAllTables)()
        .then(() => {
        logger_1.logger.info('Drop process finished.');
        process.exit(0);
    })
        .catch((err) => {
        logger_1.logger.error('Drop execution failed:', err);
        process.exit(1);
    });
}
