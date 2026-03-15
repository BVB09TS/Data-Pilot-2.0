/**
 * GitHub PR Review Service
 *
 * Triggered when a pull_request webhook fires. Downloads the PR diff,
 * identifies changed dbt files, runs analysis agents, then posts a
 * structured review comment on the PR.
 *
 * Agents run (mirrors the Zscaler PRISM architecture):
 *  1. Linter         — naming conventions, folder structure
 *  2. Governor       — missing docs, missing tests, missing freshness
 *  3. Impact Analyzer — downstream lineage impact
 *  4. Optimizer      — duplicate refs, long chains
 */

import { Octokit } from '@octokit/rest';
import { pool } from '../db/pool.js';
import { decrypt } from '../utils/crypto.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface PRFinding {
  agent: 'linter' | 'governor' | 'impact' | 'optimizer';
  severity: FindingSeverity;
  file: string;
  line?: number;
  title: string;
  body: string;
  suggestion?: string;        // inline code fix suggestion
  fix_available: boolean;
}

export interface PRReviewResult {
  summary: string;
  findings: PRFinding[];
  stats: {
    files_changed: number;
    dbt_files: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    auto_approved: boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Files that belong to a dbt project */
function isDbtFile(filename: string): boolean {
  return (
    (filename.endsWith('.sql') && /models\//.test(filename)) ||
    (filename.endsWith('.yml') && /models\//.test(filename)) ||
    (filename.endsWith('.yaml') && /models\//.test(filename))
  );
}

/** Extract model name from a file path like models/core/orders.sql → orders */
function modelName(filename: string): string {
  return filename.split('/').pop()?.replace(/\.(sql|yml|yaml)$/, '') ?? filename;
}

/** Parse ref() calls from SQL content */
function extractRefs(sql: string): string[] {
  const matches = sql.matchAll(/\{\{\s*ref\(['"](\w+)['"]\)\s*\}\}/g);
  return [...matches].map(m => m[1]);
}

/** Check if a YAML file has tests for a given model */
function hasTestsInYaml(yamlContent: string, model: string): boolean {
  // Look for the model name followed by columns with tests
  return (
    yamlContent.includes(`name: ${model}`) &&
    (yamlContent.includes('not_null') ||
      yamlContent.includes('unique') ||
      yamlContent.includes('accepted_values') ||
      yamlContent.includes('relationships'))
  );
}

/** Check if a YAML file has a description for a given model */
function hasDescriptionInYaml(yamlContent: string, model: string): boolean {
  const modelIdx = yamlContent.indexOf(`name: ${model}`);
  if (modelIdx === -1) return false;
  const snippet = yamlContent.slice(modelIdx, modelIdx + 500);
  return snippet.includes('description:') && !snippet.match(/description:\s*['"]{0,1}\s*['"]{0,1}\n/);
}

// ── Agent: Linter ─────────────────────────────────────────────────────────────

function runLinterAgent(files: { filename: string; patch?: string }[]): PRFinding[] {
  const findings: PRFinding[] = [];

  for (const f of files) {
    if (!isDbtFile(f.filename)) continue;
    const name = modelName(f.filename);

    // Naming: must be snake_case
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      findings.push({
        agent: 'linter',
        severity: 'medium',
        file: f.filename,
        title: 'Model name is not snake_case',
        body: `Model \`${name}\` should use lowercase snake_case (e.g. \`${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}\`).`,
        fix_available: false,
      });
    }

    // SQL files: check for SELECT *
    if (f.filename.endsWith('.sql') && f.patch?.includes('SELECT *')) {
      findings.push({
        agent: 'linter',
        severity: 'low',
        file: f.filename,
        title: 'Avoid SELECT *',
        body: 'Explicitly list columns instead of using `SELECT *` to prevent schema drift issues.',
        fix_available: false,
      });
    }

    // SQL files: check for hardcoded dates
    if (f.filename.endsWith('.sql') && /'\d{4}-\d{2}-\d{2}'/.test(f.patch ?? '')) {
      findings.push({
        agent: 'linter',
        severity: 'low',
        file: f.filename,
        title: 'Hardcoded date literal detected',
        body: 'Hardcoded dates become stale. Use `current_date` or a dbt variable instead.',
        fix_available: false,
      });
    }
  }

  return findings;
}

// ── Agent: Governor ───────────────────────────────────────────────────────────

function runGovernorAgent(
  sqlFiles: { filename: string; content?: string }[],
  yamlContent: Map<string, string>
): PRFinding[] {
  const findings: PRFinding[] = [];

  for (const f of sqlFiles) {
    if (!isDbtFile(f.filename) || !f.filename.endsWith('.sql')) continue;
    const name = modelName(f.filename);

    // Find any .yml in the same directory
    const dir = f.filename.split('/').slice(0, -1).join('/');
    let foundYaml: string | undefined;
    for (const [path, content] of yamlContent.entries()) {
      if (path.startsWith(dir)) {
        foundYaml = content;
        break;
      }
    }

    if (!foundYaml) {
      findings.push({
        agent: 'governor',
        severity: 'medium',
        file: f.filename,
        title: 'No YAML schema file found',
        body: `Model \`${name}\` has no accompanying \`.yml\` file. Add documentation and tests in \`${dir}/schema.yml\`.`,
        suggestion: `version: 2\n\nmodels:\n  - name: ${name}\n    description: "TODO: describe this model"\n    columns:\n      - name: id\n        description: "Primary key"\n        tests:\n          - unique\n          - not_null`,
        fix_available: true,
      });
      continue;
    }

    if (!hasTestsInYaml(foundYaml, name)) {
      findings.push({
        agent: 'governor',
        severity: 'medium',
        file: f.filename,
        title: 'Model has no dbt tests',
        body: `Model \`${name}\` is missing tests (unique, not_null, etc.). Add at minimum \`unique\` and \`not_null\` on the primary key column.`,
        fix_available: false,
      });
    }

    if (!hasDescriptionInYaml(foundYaml, name)) {
      findings.push({
        agent: 'governor',
        severity: 'low',
        file: f.filename,
        title: 'Model has no description',
        body: `Model \`${name}\` is missing a \`description\` in its YAML schema file. Good descriptions help downstream consumers understand the model.`,
        fix_available: false,
      });
    }
  }

  return findings;
}

// ── Agent: Impact Analyzer ────────────────────────────────────────────────────

async function runImpactAgent(
  workspaceId: string,
  changedModels: string[]
): Promise<PRFinding[]> {
  if (changedModels.length === 0) return [];
  const findings: PRFinding[] = [];

  // Query existing nodes in the workspace that match the changed model names
  const result = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM nodes WHERE workspace_id = $1 AND name = ANY($2)`,
    [workspaceId, changedModels]
  );

  for (const node of result.rows) {
    // Find downstream dependents via edges
    const downstream = await pool.query<{ name: string; type: string }>(
      `SELECT DISTINCT n.name, n.type
       FROM edges e
       JOIN nodes n ON n.id = e.target_node_id
       WHERE e.workspace_id = $1 AND e.source_node_id = $2`,
      [workspaceId, node.id]
    );

    if (downstream.rows.length > 0) {
      const names = downstream.rows.map(r => `\`${r.name}\``).join(', ');
      const hasDashboard = downstream.rows.some(r => r.type === 'output');

      findings.push({
        agent: 'impact',
        severity: hasDashboard ? 'high' : 'medium',
        file: `models/**/${node.name}.sql`,
        title: `${downstream.rows.length} downstream model${downstream.rows.length > 1 ? 's' : ''} affected`,
        body: `Changes to \`${node.name}\` will affect: ${names}. ${hasDashboard ? '⚠️ At least one downstream **dashboard/output** depends on this model.' : 'Review these models before merging.'}`,
        fix_available: false,
      });
    }
  }

  return findings;
}

// ── Agent: Optimizer ──────────────────────────────────────────────────────────

function runOptimizerAgent(files: { filename: string; content?: string }[]): PRFinding[] {
  const findings: PRFinding[] = [];

  // Track which refs appear in each file — warn on duplicate ref() to same model
  for (const f of files) {
    if (!isDbtFile(f.filename) || !f.filename.endsWith('.sql') || !f.content) continue;
    const refs = extractRefs(f.content);
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const r of refs) {
      if (seen.has(r)) dupes.add(r);
      seen.add(r);
    }
    if (dupes.size > 0) {
      findings.push({
        agent: 'optimizer',
        severity: 'low',
        file: f.filename,
        title: 'Duplicate ref() calls',
        body: `Model references ${[...dupes].map(d => `\`${d}\``).join(', ')} more than once. Consider using a CTE to reference it a single time.`,
        fix_available: false,
      });
    }

    // Warn on very large SQL files (likely missing modularization)
    const lines = f.content.split('\n').length;
    if (lines > 200) {
      findings.push({
        agent: 'optimizer',
        severity: 'low',
        file: f.filename,
        title: 'Large model — consider splitting',
        body: `This model is ${lines} lines. Models over 200 lines are often doing too much. Consider extracting intermediate CTEs into separate staging models.`,
        fix_available: false,
      });
    }
  }

  return findings;
}

// ── Comment formatter ─────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<FindingSeverity, string> = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🔵',
  info:     '⚪',
};

const AGENT_LABEL: Record<string, string> = {
  linter:    '🔍 Linter',
  governor:  '📋 Governor',
  impact:    '🌊 Impact',
  optimizer: '⚡ Optimizer',
};

export function formatPRComment(result: PRReviewResult): string {
  const { findings, stats, summary } = result;

  const header = stats.auto_approved
    ? `## VORO Review — Auto-Approved\n\n${summary}`
    : `## VORO PR Review\n\n${summary}`;

  if (findings.length === 0) {
    return `${header}\n\n_No issues found. This PR follows all governance policies._\n\n---\n*Powered by [VORO](https://voro.dev)*`;
  }

  const statsLine = [
    stats.critical > 0 ? `${SEVERITY_EMOJI.critical} ${stats.critical} critical` : null,
    stats.high > 0     ? `${SEVERITY_EMOJI.high} ${stats.high} high` : null,
    stats.medium > 0   ? `${SEVERITY_EMOJI.medium} ${stats.medium} medium` : null,
    stats.low > 0      ? `${SEVERITY_EMOJI.low} ${stats.low} low` : null,
  ].filter(Boolean).join('  ·  ');

  const findingBlocks = findings.map(f => {
    const lines = [
      `### ${SEVERITY_EMOJI[f.severity]} ${f.title}`,
      `**${AGENT_LABEL[f.agent]}** · \`${f.file}\``,
      '',
      f.body,
    ];
    if (f.suggestion) {
      lines.push('', '<details><summary>💡 Suggested fix</summary>', '', '```yaml', f.suggestion, '```', '</details>');
    }
    return lines.join('\n');
  });

  return [
    header,
    '',
    `**${stats.dbt_files} dbt file${stats.dbt_files !== 1 ? 's' : ''} reviewed** · ${statsLine}`,
    '',
    '---',
    '',
    findingBlocks.join('\n\n---\n\n'),
    '',
    '---',
    '*Powered by [VORO](https://voro.dev) · Comment `Accept` on any suggestion to auto-apply it*',
  ].join('\n');
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runPRReview(
  workspaceId: string,
  encryptedToken: string,
  repo: string,           // "owner/repo"
  prNumber: number,
  commitSha: string
): Promise<PRReviewResult> {
  const token = decrypt(encryptedToken);
  const octokit = new Octokit({ auth: token });
  const [owner, repoName] = repo.split('/');

  // 1. Fetch list of changed files from GitHub
  const { data: prFiles } = await octokit.pulls.listFiles({
    owner, repo: repoName, pull_number: prNumber, per_page: 100,
  });

  const allFiles = prFiles.filter(f => f.status !== 'removed');
  const dbtFiles = allFiles.filter(f => isDbtFile(f.filename));

  if (dbtFiles.length === 0) {
    return {
      summary: `No dbt model files changed in this PR (${allFiles.length} file${allFiles.length !== 1 ? 's' : ''} total). Skipping VORO review.`,
      findings: [],
      stats: { files_changed: allFiles.length, dbt_files: 0, critical: 0, high: 0, medium: 0, low: 0, auto_approved: true },
    };
  }

  // 2. Fetch file contents for SQL files (for deeper analysis)
  const fileContents = new Map<string, string>();
  const yamlContents = new Map<string, string>();

  await Promise.all(
    dbtFiles.map(async f => {
      try {
        const { data } = await octokit.repos.getContent({
          owner, repo: repoName, path: f.filename, ref: commitSha,
        });
        if ('content' in data && data.encoding === 'base64') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          fileContents.set(f.filename, content);
          if (f.filename.endsWith('.yml') || f.filename.endsWith('.yaml')) {
            yamlContents.set(f.filename, content);
          }
        }
      } catch {
        // File might have been deleted; skip gracefully
      }
    })
  );

  const richFiles = dbtFiles.map(f => ({
    filename: f.filename,
    patch: f.patch,
    content: fileContents.get(f.filename),
  }));

  const sqlFiles = richFiles.filter(f => f.filename.endsWith('.sql'));
  const changedModels = sqlFiles.map(f => modelName(f.filename));

  // 3. Run all agents in parallel
  const [linterFindings, governorFindings, impactFindings, optimizerFindings] =
    await Promise.all([
      Promise.resolve(runLinterAgent(richFiles)),
      Promise.resolve(runGovernorAgent(sqlFiles, yamlContents)),
      runImpactAgent(workspaceId, changedModels),
      Promise.resolve(runOptimizerAgent(richFiles)),
    ]);

  const findings = [
    ...linterFindings,
    ...governorFindings,
    ...impactFindings,
    ...optimizerFindings,
  ].sort((a, b) => {
    const order: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  // 4. Compute stats
  const stats = {
    files_changed: allFiles.length,
    dbt_files: dbtFiles.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high:     findings.filter(f => f.severity === 'high').length,
    medium:   findings.filter(f => f.severity === 'medium').length,
    low:      findings.filter(f => f.severity === 'low').length,
    auto_approved: false as boolean,
  };

  const blockingCount = stats.critical + stats.high;
  stats.auto_approved = blockingCount === 0;

  const summary = stats.auto_approved
    ? `Reviewed **${dbtFiles.length} dbt file${dbtFiles.length !== 1 ? 's' : ''}** — no blocking issues found. ${stats.medium + stats.low > 0 ? `${stats.medium + stats.low} suggestion${stats.medium + stats.low !== 1 ? 's' : ''} for improvement below.` : 'Ready to merge! 🎉'}`
    : `Found **${blockingCount} blocking issue${blockingCount !== 1 ? 's' : ''}** in ${dbtFiles.length} dbt file${dbtFiles.length !== 1 ? 's' : ''}. Please address before merging.`;

  return { summary, findings, stats };
}

// ── Post review comment ───────────────────────────────────────────────────────

export async function postPRComment(
  encryptedToken: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<number> {
  const token = decrypt(encryptedToken);
  const octokit = new Octokit({ auth: token });
  const [owner, repoName] = repo.split('/');

  const { data } = await octokit.issues.createComment({
    owner, repo: repoName, issue_number: prNumber, body,
  });

  return data.id;
}

// ── Register webhook on a repo ────────────────────────────────────────────────

export async function registerWebhook(
  encryptedToken: string,
  repo: string,
  webhookUrl: string,
  secret: string
): Promise<number> {
  const token = decrypt(encryptedToken);
  const octokit = new Octokit({ auth: token });
  const [owner, repoName] = repo.split('/');

  const { data } = await octokit.repos.createWebhook({
    owner,
    repo: repoName,
    config: {
      url: webhookUrl,
      content_type: 'json',
      secret,
      insecure_ssl: '0',
    },
    events: ['pull_request', 'issue_comment'],
    active: true,
  });

  return data.id;
}

export async function deleteWebhook(
  encryptedToken: string,
  repo: string,
  webhookId: number
): Promise<void> {
  const token = decrypt(encryptedToken);
  const octokit = new Octokit({ auth: token });
  const [owner, repoName] = repo.split('/');
  await octokit.repos.deleteWebhook({ owner, repo: repoName, hook_id: webhookId }).catch(() => {});
}
