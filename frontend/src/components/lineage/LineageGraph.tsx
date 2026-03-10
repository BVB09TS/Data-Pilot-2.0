import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'

import { ModelNode, type ModelNodeData, type ModelNodeType } from './ModelNode'
import { LAYER_COLORS } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

/* ─── Types ─── */

export interface RawNode {
  id:          string
  layer:       string
  has_problem: boolean
  q30:         number | null
  q90:         number | null
}

export interface RawEdge {
  source: string
  target: string
}

/* ─── Dagre layout ─── */

const NODE_W = 180
const NODE_H = 56

function applyLayout(
  nodes: ModelNodeType[],
  edges: Edge[],
  direction: 'LR' | 'TB',
): ModelNodeType[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 100, align: 'UL' })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }
  })
}

/* ─── Custom node registry ─── */

const NODE_TYPES: NodeTypes = { modelNode: ModelNode }

/* ─── Component ─── */

interface LineageGraphProps {
  rawNodes:       RawNode[]
  rawEdges:       RawEdge[]
  searchText:     string
  layerFilter:    string | null
  direction:      'LR' | 'TB'
  selectedNodeId: string | null
  onSelectNode:   (id: string | null) => void
}

export function LineageGraph({
  rawNodes,
  rawEdges,
  searchText,
  layerFilter,
  direction,
  selectedNodeId,
  onSelectNode,
}: LineageGraphProps) {
  const { theme } = useTheme()

  const [nodes, setNodes, onNodesChange] = useNodesState<ModelNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Track last search so we can apply it after layout
  const searchRef = useRef(searchText)
  searchRef.current = searchText

  // ── Effect 1: Full re-layout when graph structure changes ──
  // searchText intentionally excluded — it only drives highlighting, not positions
  useEffect(() => {
    const lc = searchRef.current.toLowerCase().trim()

    const rfNodes: ModelNodeType[] = rawNodes
      .filter(n => !layerFilter || n.layer === layerFilter)
      .map(n => ({
        id:       n.id,
        type:     'modelNode' as const,
        position: { x: 0, y: 0 },
        draggable: true,
        data: {
          name:        n.id,
          layer:       n.layer,
          has_problem: n.has_problem,
          q90:         n.q90,
          matched:     lc.length > 0 && n.id.toLowerCase().includes(lc),
        } satisfies ModelNodeData,
      }))

    const visible = new Set(rfNodes.map(n => n.id))

    const rfEdges: Edge[] = rawEdges
      .filter(e => visible.has(e.source) && visible.has(e.target))
      .map(e => ({
        id:              `${e.source}→${e.target}`,
        source:          e.source,
        target:          e.target,
        type:            'smoothstep',
        animated:        false,
        style:           { stroke: '#475569', strokeWidth: 1.5 },
        selectedStyle:   { stroke: '#3b82f6', strokeWidth: 2.5 },
      }))

    const laid = applyLayout(rfNodes, rfEdges, direction)
    setNodes(laid)
    setEdges(rfEdges)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes, rawEdges, direction, layerFilter, setNodes, setEdges])

  // ── Effect 2: Update search highlighting WITHOUT resetting positions ──
  // This preserves user-dragged node positions while typing
  useEffect(() => {
    const lc = searchText.toLowerCase().trim()
    setNodes(nds =>
      nds.map(n => ({
        ...n,
        data: {
          ...n.data,
          matched: lc.length > 0 && n.id.toLowerCase().includes(lc),
        },
      })),
    )
  }, [searchText, setNodes])

  const handleNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    onSelectNode(node.id === selectedNodeId ? null : node.id)
  }, [onSelectNode, selectedNodeId])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onPaneClick={() => onSelectNode(null)}
      nodeTypes={NODE_TYPES}
      colorMode={theme === 'dark' ? 'dark' : 'light'}
      nodesDraggable={true}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.05}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

      {/* showInteractive=true shows the lock/unlock toggle */}
      <Controls showInteractive={true} />

      <MiniMap
        nodeColor={n => LAYER_COLORS[(n.data as ModelNodeData).layer] ?? '#94a3b8'}
        maskColor={theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}
        style={{ bottom: 56, right: 12 }}
        zoomable
        pannable
      />
    </ReactFlow>
  )
}
