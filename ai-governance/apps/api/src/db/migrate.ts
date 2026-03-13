import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Client } from 'pg';
import 'dotenv/config';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Create migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Get all migration files
    const migrationsDir = join(new URL('.', import.meta.url).pathname, '../../db/migrations');
    const files = (await readdir(migrationsDir)).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      const version = file.replace('.sql', '');
      const result = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  Skipped ${version} (already executed)`);
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);

      console.log(`✅ Executed ${version}`);
    }

    console.log('\n✨ Migrations complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
