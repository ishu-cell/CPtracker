// migrations/migrate.js — Simple SQL migration runner
// Usage: node migrations/migrate.js
//
// Reads .sql files from this directory in numeric order and executes them.
// Tracks which migrations have been applied in a `_migrations` table.

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a dedicated connection with multipleStatements enabled
// (the main pool does NOT enable this for security)
async function createMigrationConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cp_tracker',
    multipleStatements: true,
  });
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(conn) {
  const [rows] = await conn.query('SELECT filename FROM _migrations ORDER BY id');
  return new Set(rows.map(r => r.filename));
}

async function runMigrations() {
  logger.info('Starting migration runner...');

  const conn = await createMigrationConnection();

  await ensureMigrationsTable(conn);
  const applied = await getAppliedMigrations(conn);

  // Find all .sql files, sorted by name
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of files) {
    if (applied.has(file)) {
      logger.info(`  ⏭  ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(__dirname, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      // Execute the entire SQL file as-is (multipleStatements handles semicolons)
      await conn.query(sql);

      // Record the migration
      await conn.query(
        'INSERT INTO _migrations (filename) VALUES (?)',
        [file]
      );

      logger.info(`  ✅ ${file} applied successfully`);
      count++;
    } catch (err) {
      logger.error(`  ❌ ${file} FAILED:`, { error: err.message });
      await conn.end();
      process.exit(1);
    }
  }

  if (count === 0) {
    logger.info('No new migrations to apply.');
  } else {
    logger.info(`Applied ${count} migration(s).`);
  }

  await conn.end();
  process.exit(0);
}

runMigrations().catch(err => {
  logger.error('Migration runner crashed:', { error: err.message });
  process.exit(1);
});
