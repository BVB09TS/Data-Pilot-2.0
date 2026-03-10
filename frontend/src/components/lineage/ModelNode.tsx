import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { LAYER_COLORS } from '../../types'

/* ─── Types ─── */

export interface ModelNodeData extends Record<string, unknown> {
  name:        string
  layer:       string
  has_problem: boolean
  q90:         number | null
  matched:     boolean
}

export type ModelNodeType = Node<ModelNodeData>

/* ─── Component ─── */

export const ModelNode = memo(function ModelNode({
  data,
  selected,
}: NodeProps<ModelNodeType>) {
  const color = LAYER_COLORS[data.layer] ?? '#64748b'

  return (
    <div
      style={{ width: 180, cursor: 'grab' }}
      className={`
        relative rounded-xl bg-white dark:bg-slate-800
        border-2 transition-all duration-150 select-none
        hover:shadow-lg hover:-translate-y-px
        ${selected
          ? 'border-blue-500 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50'
          : data.matched
          ? 'border-amber-400 shadow-md shadow-amber-200/40 dark:shadow-amber-900/30'
          : 'border-slate-200 dark:border-slate-600 shadow-sm'}
      `}
    >
      {/* Layer color bar — left edge */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: color }}
      />

      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 8, height: 8, background: color, border: '2px solid white', left: -5 }}
      />

      <div className="px-3 py-2.5 pl-4">
        {/* Model name */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
            {data.name}
          </span>
          {data.has_problem && (
            <span
              className="shrink-0 w-2 h-2 rounded-full bg-red-500"
              title="Has audit findings"
            />
          )}
        </div>

        {/* Layer + query count */}
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color }}
          >
            {data.layer}
          </span>
          {data.q90 != null && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              · {data.q90 >= 1000 ? `${(data.q90 / 1000).toFixed(1)}k` : data.q90} queries
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 8, height: 8, background: color, border: '2px solid white', right: -5 }}
      />
    </div>
  )
})
