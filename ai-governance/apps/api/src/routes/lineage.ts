import { Router, IRouter, Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { buildLineageGraph, topologicalSort } from '../services/lineage.js';
import { pool } from '../db/pool.js';

const router: IRouter = Router({ mergeParams: true });
router.use(requireAuth);

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return r.rows.length > 0;
}

// ── GET /api/workspaces/:workspaceId/lineage ───────────────────────────────────
// Returns nodes + edges + cycle info for the workspace DAG.

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const graph = await buildLineageGraph(workspaceId);
  res.json({ data: graph });
});

// ── GET /api/workspaces/:workspaceId/lineage/manifest ──────────────────────────
// Exports the full graph as a portable JSON manifest (useful for dbt / DataPilot).

router.get('/manifest', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const graph = await buildLineageGraph(workspaceId);

  let execution_order: string[] | null = null;
  if (graph.is_dag) {
    try {
      execution_order = topologicalSort(
        graph.nodes.map(n => n.id),
        graph.edges
      );
    } catch {
      // shouldn't happen since is_dag is true, but guard anyway
    }
  }

  const manifest = {
    schema_version: '1.0',
    exported_at: new Date().toISOString(),
    workspace_id: workspaceId,
    is_dag: graph.is_dag,
    cycles: graph.cycles,
    execution_order,
    nodes: graph.nodes,
    edges: graph.edges.map(e => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      label: e.label,
      metadata: e.metadata,
    })),
  };

  // Support ?format=download to trigger a file download
  if (req.query['format'] === 'download') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lineage-manifest-${workspaceId}.json"`);
  }

  res.json(manifest);
});

// ── GET /api/workspaces/:workspaceId/lineage/ancestors/:nodeId ────────────────
// Returns all upstream nodes for a given node.

router.get('/ancestors/:nodeId', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, nodeId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const graph = await buildLineageGraph(workspaceId);
  const ancestors = new Set<string>();
  const queue = [nodeId];

  const parentMap = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!parentMap.has(e.target_node_id)) parentMap.set(e.target_node_id, []);
    parentMap.get(e.target_node_id)!.push(e.source_node_id);
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const parent of parentMap.get(cur) ?? []) {
      if (!ancestors.has(parent)) {
        ancestors.add(parent);
        queue.push(parent);
      }
    }
  }

  const nodes = graph.nodes.filter(n => ancestors.has(n.id));
  res.json({ data: { node_id: nodeId, ancestors: nodes } });
});

// ── GET /api/workspaces/:workspaceId/lineage/descendants/:nodeId ──────────────
// Returns all downstream nodes for a given node.

router.get('/descendants/:nodeId', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, nodeId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const graph = await buildLineageGraph(workspaceId);
  const descendants = new Set<string>();
  const queue = [nodeId];

  const childMap = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!childMap.has(e.source_node_id)) childMap.set(e.source_node_id, []);
    childMap.get(e.source_node_id)!.push(e.target_node_id);
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const child of childMap.get(cur) ?? []) {
      if (!descendants.has(child)) {
        descendants.add(child);
        queue.push(child);
      }
    }
  }

  const nodes = graph.nodes.filter(n => descendants.has(n.id));
  res.json({ data: { node_id: nodeId, descendants: nodes } });
});

// ── GET /api/workspaces/:workspaceId/lineage/columns/:nodeId ──────────────────
// Returns column-level lineage for a node (stored in node metadata during audit).

router.get('/columns/:nodeId', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, nodeId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const r = await pool.query<{ name: string; metadata: Record<string, unknown> }>(
    `SELECT name, metadata FROM nodes WHERE id = $1 AND workspace_id = $2`,
    [nodeId, workspaceId],
  );

  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }

  const { name, metadata } = r.rows[0];
  const columnLineage = (metadata?.columnLineage as unknown[]) ?? [];

  res.json({
    node_id: nodeId,
    model_name: name,
    column_lineage: columnLineage,
    has_lineage: columnLineage.length > 0,
  });
});

export default router;
