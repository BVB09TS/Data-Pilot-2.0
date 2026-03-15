import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    const migrationsDir = join(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Postgres error codes for "object already exists" situations
    const ALREADY_EXISTS_CODES = new Set([
      '42P07', // duplicate_table
      '42710', // duplicate_object
      '42701', // duplicate_column
      '42P16', // invalid_table_definition (e.g. constraint already exists)
      '23505', // unique_violation (duplicate index)
    ]);

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1',
        [file]
      );
      if (rows.length > 0) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  apply ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        const pgErr = err as { code?: string; message: string };
        if (pgErr.code && ALREADY_EXISTS_CODES.has(pgErr.code)) {
          // Migration was already applied outside this tool — record it and move on
          await client.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
          console.log(`  baseline ${file} (objects already exist)`);
        } else {
          throw new Error(`Failed on ${file}: ${pgErr.message}`);
        }
      }
    }

    console.log('\nAll migrations applied.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error(err.message);
  process.exit(1);
});
