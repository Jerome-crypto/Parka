"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const runMigrations = async () => {
    logger_1.logger.info('Starting database migrations...');
    const client = await database_1.pool.connect();
    try {
        let schemaPath = path_1.default.join(__dirname, 'schema.sql');
        if (!fs_1.default.existsSync(schemaPath)) {
            schemaPath = path_1.default.join(__dirname, '..', '..', 'src', 'database', 'schema.sql');
        }
        const sql = fs_1.default.readFileSync(schemaPath, 'utf8');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        logger_1.logger.info('Database migrations applied successfully.');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error applying database migrations:', error);
        process.exit(1);
    }
    finally {
        client.release();
    }
};
exports.runMigrations = runMigrations;
// Run if called directly
if (require.main === module) {
    (0, exports.runMigrations)()
        .then(() => {
        logger_1.logger.info('Migration process finished.');
        process.exit(0);
    })
        .catch((err) => {
        logger_1.logger.error('Migration execution failed:', err);
        process.exit(1);
    });
}
