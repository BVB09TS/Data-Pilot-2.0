import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('🗄️  DB connected — running migrations...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    const migrationsDir = join(__dirname, '../../db/migrations');
    const files = (await readdir(migrationsDir)).sort();
    let ran = 0;

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;
      const version = file.replace('.sql', '');
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );
      if (rows.length > 0) continue;

      const sql = await readFile(join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      console.log(`  ✅ ${version}`);
      ran++;
    }

    console.log(`✨ Migrations complete (${ran} new)\n`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Allow running directly: node --import tsx/esm src/db/migrate.ts
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations().catch(() => process.exit(1));
}
