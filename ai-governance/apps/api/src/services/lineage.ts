import { pool } from '../db/pool.js';

export interface LineageNode {
  id: string;
  name: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  config: Record<string, unknown>;
}

export interface LineageEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  metadata: Record<string, unknown>;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  cycles: string[][];       // each cycle is an ordered list of node IDs
  is_dag: boolean;          // true when no cycles exist
}

/**
 * Load the full lineage graph for a workspace and run cycle detection.
 * Cycle detection uses DFS (Tarjan-style back-edge tracking).
 */
export async function buildLineageGraph(workspaceId: string): Promise<LineageGraph> {
  const [nodesResult, edgesResult] = await Promise.all([
    pool.query<LineageNode>(
      `SELECT id, name, type, description, metadata, config
       FROM nodes WHERE workspace_id = $1 ORDER BY created_at`,
      [workspaceId]
    ),
    pool.query<LineageEdge>(
      `SELECT id, source_node_id, target_node_id, label, metadata
       FROM edges WHERE workspace_id = $1`,
      [workspaceId]
    ),
  ]);

  const nodes = nodesResult.rows;
  const edges = edgesResult.rows;

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    adj.get(edge.source_node_id)?.push(edge.target_node_id);
  }

  const cycles = detectCycles(adj);

  return { nodes, edges, cycles, is_dag: cycles.length === 0 };
}

/**
 * Detect cycles in a directed graph using iterative DFS.
 * Returns a list of cycles, each as an ordered array of node IDs.
 */
function detectCycles(adj: Map<string, string[]>): string[][] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: string[][] = [];

  for (const node of adj.keys()) color.set(node, WHITE);

  function dfs(u: string): void {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        // Back edge → reconstruct cycle
        const cycle: string[] = [v];
        let cur: string | null | undefined = u;
        while (cur && cur !== v) {
          cycle.push(cur);
          cur = parent.get(cur);
        }
        cycle.push(v);
        cycle.reverse();
        cycles.push(cycle);
      } else if (color.get(v) === WHITE) {
        parent.set(v, u);
        dfs(v);
      }
    }
    color.set(u, BLACK);
  }

  for (const node of adj.keys()) {
    if (color.get(node) === WHITE) {
      parent.set(node, null);
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Topological sort (Kahn's algorithm). Returns sorted node IDs or throws if cyclic.
 */
export function topologicalSort(
  nodeIds: string[],
  edges: LineageEdge[]
): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodeIds) { inDegree.set(id, 0); adj.set(id, []); }
  for (const e of edges) {
    adj.get(e.source_node_id)?.push(e.target_node_id);
    inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) ?? 0) + 1);
  }

  const queue = nodeIds.filter(id => inDegree.get(id) === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    sorted.push(u);
    for (const v of adj.get(u) ?? []) {
      const deg = (inDegree.get(v) ?? 1) - 1;
      inDegree.set(v, deg);
      if (deg === 0) queue.push(v);
    }
  }

  if (sorted.length !== nodeIds.length) {
    throw new Error('Graph contains cycles — topological sort not possible');
  }
  return sorted;
}
