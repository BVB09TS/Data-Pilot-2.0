import { Client } from 'pg';
import 'dotenv/config';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Clear existing data
    await client.query('DELETE FROM users CASCADE;');

    // Seed a test user
    const userResult = await client.query(`
      INSERT INTO users (email, name, provider, provider_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['test@example.com', 'Test User', 'github', '123']);

    const userId = userResult.rows[0].id;

    // Seed a workspace
    await client.query(`
      INSERT INTO workspaces (name, slug, owner_id)
      VALUES ($1, $2, $3)
    `, ['Default Workspace', 'default', userId]);

    console.log('✅ Seed data inserted!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
