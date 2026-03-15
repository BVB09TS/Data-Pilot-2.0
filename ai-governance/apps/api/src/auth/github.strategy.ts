import { Strategy as GitHubStrategy } from 'passport-github2';
import { pool } from '../db/pool.js';

export function buildGitHubStrategy() {
  return new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      callbackURL: `${process.env.API_URL ?? 'http://localhost:3000'}/auth/github/callback`,
    },
    async (_accessToken: string, _refreshToken: string, profile: { id: string; emails?: { value: string }[]; displayName?: string; photos?: { value: string }[] }, done: (err: Error | null, user?: Express.User | false) => void) => {
      try {
        const email = profile.emails?.[0]?.value ?? `${profile.id}@github.noreply`;
        const name = profile.displayName ?? null;
        const avatarUrl = profile.photos?.[0]?.value ?? null;

        const result = await pool.query<{ id: string }>(
          `INSERT INTO users (email, name, avatar_url, provider, provider_id)
           VALUES ($1, $2, $3, 'github', $4)
           ON CONFLICT (email) DO UPDATE
             SET name = EXCLUDED.name,
                 avatar_url = EXCLUDED.avatar_url,
                 provider = EXCLUDED.provider,
                 provider_id = EXCLUDED.provider_id
           RETURNING id`,
          [email, name, avatarUrl, profile.id]
        );

        const userId = result.rows[0].id;
        await ensureDefaultWorkspace(userId, name ?? email);

        done(null, { id: userId });
      } catch (err) {
        done(err as Error);
      }
    }
  );
}

async function ensureDefaultWorkspace(userId: string, label: string): Promise<void> {
  const existing = await pool.query(
    `SELECT w.id FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = $1 LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) return;

  const slug = `ws-${userId.slice(0, 8)}`;
  const ws = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (name, slug, owner_id) VALUES ($1, $2, $3) RETURNING id`,
    [`${label}'s Workspace`, slug, userId]
  );
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [ws.rows[0].id, userId]
  );
}
