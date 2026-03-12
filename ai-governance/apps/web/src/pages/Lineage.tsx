import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { lineageApi } from '../lib/api';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiNode { id: string; name: string; type: string; }
interface ApiEdge { id: string; source_node_id: string; target_node_id: string; label?: string; }
interface Graph {
  nodes: ApiNode[];
  edges: ApiEdge[];
  cycles: string[][];
  is_dag: boolean;
}

// ── Dagre auto-layout ─────────────────────────────────────────────────────────

const NODE_W = 180;
const NODE_H = 56;

function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100 });
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return {
    nodes: nodes.map(n => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
    }),
    edges,
  };
}

// ── Node type colours ─────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  model:    '#6366f1',
  source:   '#10b981',
  seed:     '#f59e0b',
  snapshot: '#8b5cf6',
  analysis: '#ec4899',
};
const nodeColor = (type: string) => TYPE_COLOR[type] ?? '#64748b';

// ── Build React Flow elements ─────────────────────────────────────────────────

function buildElements(graph: Graph): { nodes: Node[]; edges: Edge[] } {
  const rfNodes: Node[] = graph.nodes.map(n => ({
    id: n.id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: { label: n.name },
    style: {
      background: nodeColor(n.type),
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
      width: NODE_W,
      height: NODE_H,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    },
  }));

  const rfEdges: Edge[] = graph.edges.map(e => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label,
    labelStyle: { fontSize: 10, fill: '#94a3b8' },
    style: { stroke: '#475569', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
  }));

  return layoutGraph(rfNodes, rfEdges);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Lineage() {
  const { workspaceId } = useAuth();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApiNode | null>(null);
  const [relatives, setRelatives] = useState<{ ancestors: ApiNode[]; descendants: ApiNode[] } | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  useEffect(() => {
    if (!workspaceId) return;
    lineageApi.graph(workspaceId)
      .then(r => {
        const g: Graph = r.data.data;
        setGraph(g);
        const { nodes: n, edges: e } = buildElements(g);
        setNodes(n);
        setEdges(e);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  async function onNodeClick(_: React.MouseEvent, node: Node) {
    if (!workspaceId || !graph) return;
    const apiNode = graph.nodes.find(n => n.id === node.id);
    if (!apiNode) return;
    if (selected?.id === node.id) { setSelected(null); setRelatives(null); return; }
    setSelected(apiNode);
    const [a, d] = await Promise.all([
      lineageApi.ancestors(workspaceId, node.id),
      lineageApi.descendants(workspaceId, node.id),
    ]);
    setRelatives({ ancestors: a.data.data.ancestors, descendants: d.data.data.descendants });
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>;
  if (!graph)  return <div className="p-8 text-gray-500 text-sm">Failed to load lineage.</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Lineage DAG</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {graph.nodes.length} nodes · {graph.edges.length} edges ·{' '}
            <span className={graph.is_dag ? 'text-green-400' : 'text-red-400'}>
              {graph.is_dag ? 'Valid DAG' : `${graph.cycles.length} cycle(s) detected`}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
            {Object.entries(TYPE_COLOR).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                {type}
              </span>
            ))}
          </div>
          <button
            className="btn-ghost text-xs"
            onClick={() => workspaceId && window.open(`/api/workspaces/${workspaceId}/lineage/manifest?format=download`, '_blank')}
          >
            ↓ Export
          </button>
        </div>
      </div>

      {!graph.is_dag && (
        <div className="mx-8 mt-3 rounded-lg bg-red-900/30 border border-red-700 px-4 py-2 text-sm text-red-300 flex-shrink-0">
          Cycles detected — not a valid DAG
        </div>
      )}

      {/* Canvas + side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-gray-950">
          {graph.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              No nodes yet — add nodes and connect them to visualise the DAG.
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={20} />
              <Controls />
              <MiniMap
                nodeColor={n => nodeColor(graph.nodes.find(a => a.id === n.id)?.type ?? '')}
                style={{ background: '#0f172a', border: '1px solid #1e293b' }}
              />
            </ReactFlow>
          )}
        </div>

        {selected && relatives && (
          <div className="w-64 border-l border-gray-800 overflow-y-auto flex-shrink-0 p-5 space-y-5 bg-gray-900">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Node</p>
              <p className="text-white font-semibold text-sm">{selected.name}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ background: nodeColor(selected.type) }}>
                {selected.type}
              </span>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Ancestors ({relatives.ancestors.length})
              </p>
              {relatives.ancestors.length === 0
                ? <p className="text-xs text-gray-600">None</p>
                : relatives.ancestors.map(n => (
                  <div key={n.id} className="flex items-center gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: nodeColor(n.type) }} />
                    <span className="text-xs text-gray-300">{n.name}</span>
                  </div>
                ))
              }
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Descendants ({relatives.descendants.length})
              </p>
              {relatives.descendants.length === 0
                ? <p className="text-xs text-gray-600">None</p>
                : relatives.descendants.map(n => (
                  <div key={n.id} className="flex items-center gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: nodeColor(n.type) }} />
                    <span className="text-xs text-gray-300">{n.name}</span>
                  </div>
                ))
              }
            </div>

            <button className="text-xs text-gray-600 hover:text-gray-400"
              onClick={() => { setSelected(null); setRelatives(null); }}>
              ✕ Deselect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
