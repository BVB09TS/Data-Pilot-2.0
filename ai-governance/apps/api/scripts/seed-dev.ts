/**
 * Dev seed: creates a test user + workspace + live session token.
 * Usage: pnpm seed-dev
 * Prints a ready-to-use curl snippet at the end.
 */
import pg from 'pg';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SECRET = process.env.SERVER_SECRET ?? 'dev-secret';

async function seed() {
  const client = await pool.connect();
  try {
    // ── User ──────────────────────────────────────────────────────────────────
    const userRes = await client.query<{ id: string }>(`
      INSERT INTO users (name, email, provider, provider_id)
      VALUES ('Dev User', 'dev@local.test', 'local', 'dev-seed')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const userId = userRes.rows[0].id;
    console.log(`user      ${userId}`);

    // ── Workspace ─────────────────────────────────────────────────────────────
    const wsRes = await client.query<{ id: string }>(`
      INSERT INTO workspaces (name, slug)
      VALUES ('Dev Workspace', 'dev-workspace')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const workspaceId = wsRes.rows[0].id;
    console.log(`workspace ${workspaceId}`);

    // ── Membership ────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, 'admin')
      ON CONFLICT (workspace_id, user_id) DO NOTHING
    `, [workspaceId, userId]);

    // ── Session token ─────────────────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = jwt.sign({ userId }, SECRET, { expiresIn: '7d' });

    await client.query(`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [userId, token, expiresAt]);

    console.log(`\ntoken     ${token}\n`);
    console.log('── Ready-to-use curl commands ──────────────────────────────────────────\n');
    console.log(`# Health`);
    console.log(`curl http://localhost:3000/api/health\n`);
    console.log(`# List policies`);
    console.log(`curl --cookie "token=${token}" \\`);
    console.log(`  http://localhost:3000/api/workspaces/${workspaceId}/policies\n`);
    console.log(`# Create a policy`);
    console.log(`curl -X POST --cookie "token=${token}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"name":"No deprecated nodes","rules":[{"id":"r1","type":"deny_value","field":"status","value":"deprecated","message":"Status must not be deprecated","severity":"error"}]}' \\`);
    console.log(`  http://localhost:3000/api/workspaces/${workspaceId}/policies\n`);
    console.log(`# Audit log`);
    console.log(`curl --cookie "token=${token}" \\`);
    console.log(`  "http://localhost:3000/api/workspaces/${workspaceId}/audit"\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err.message);
  process.exit(1);
});
