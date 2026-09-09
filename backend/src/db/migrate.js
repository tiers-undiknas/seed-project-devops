import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import database from '../infra/database.js';
import logger from '../infra/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const client = await database.getPool().connect();
  try {
    logger.info('Running database migrations...');

    // Create schema_migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Get applied migrations
    const appliedRes = await client.query('SELECT version FROM schema_migrations ORDER BY id ASC');
    const appliedVersions = new Set(appliedRes.rows.map((r) => r.version));

    // Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn(`Migrations directory not found: ${migrationsDir}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    for (const file of files) {
      if (appliedVersions.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      logger.info({ migration: file }, 'Applying migration');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedCount++;
        logger.info({ migration: file }, 'Migration applied successfully');
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ migration: file, err: err.message }, 'Migration failed, rolled back');
        throw err;
      }
    }

    logger.info({ totalApplied: appliedCount }, 'Database migrations completed');
  } finally {
    client.release();
  }
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await database.shutdown();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err: err.message }, 'Fatal error during migrations');
      await database.shutdown();
      process.exit(1);
    });
}

export default runMigrations;
