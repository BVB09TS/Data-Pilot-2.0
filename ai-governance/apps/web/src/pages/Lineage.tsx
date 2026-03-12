import { useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// ── Types ─────────────────────────────────────────────────────────────────────

type Layer = 'raw' | 'source' | 'core' | 'analytics';
interface ModelNode { id: string; name: string; layer: Layer; }

// ── ShopMesh static data ───────────────────────────────────────────────────────

const NODES: ModelNode[] = [
  // RAW
  { id: 'raw_shopify_orders',           name: 'raw_shopify_orders',           layer: 'raw' },
  { id: 'raw_shopify_order_items',      name: 'raw_shopify_order_items',      layer: 'raw' },
  { id: 'raw_shopify_customers',        name: 'raw_shopify_customers',        layer: 'raw' },
  { id: 'raw_shopify_products',         name: 'raw_shopify_products',         layer: 'raw' },
  { id: 'raw_shopify_product_variants', name: 'raw_shopify_product_variants', layer: 'raw' },
  { id: 'raw_shopify_refunds',          name: 'raw_shopify_refunds',          layer: 'raw' },
  { id: 'raw_stripe_payments',          name: 'raw_stripe_payments',          layer: 'raw' },
  { id: 'raw_stripe_refunds',           name: 'raw_stripe_refunds',           layer: 'raw' },
  { id: 'raw_stripe_subscriptions',     name: 'raw_stripe_subscriptions',     layer: 'raw' },
  { id: 'raw_google_ads_campaigns',     name: 'raw_google_ads_campaigns',     layer: 'raw' },
  { id: 'raw_google_ads_performance',   name: 'raw_google_ads_performance',   layer: 'raw' },
  { id: 'raw_salesforce_accounts',      name: 'raw_salesforce_accounts',      layer: 'raw' },
  { id: 'raw_salesforce_contacts',      name: 'raw_salesforce_contacts',      layer: 'raw' },
  { id: 'raw_salesforce_opportunities', name: 'raw_salesforce_opportunities', layer: 'raw' },
  { id: 'raw_mobile_events',            name: 'raw_mobile_events',            layer: 'raw' },
  { id: 'raw_email_campaigns',          name: 'raw_email_campaigns',          layer: 'raw' },
  { id: 'raw_email_events',             name: 'raw_email_events',             layer: 'raw' },
  { id: 'raw_web_sessions',             name: 'raw_web_sessions',             layer: 'raw' },
  { id: 'raw_inventory_snapshots',      name: 'raw_inventory_snapshots',      layer: 'raw' },
  { id: 'raw_erp_products',             name: 'raw_erp_products',             layer: 'raw' },
  { id: 'raw_erp_warehouses',           name: 'raw_erp_warehouses',           layer: 'raw' },
  { id: 'raw_mobile_sessions',          name: 'raw_mobile_sessions',          layer: 'raw' },
  { id: 'raw_shopify_gift_cards',       name: 'raw_shopify_gift_cards',       layer: 'raw' },

  // SOURCE
  { id: 'src_shopify_orders',           name: 'src_shopify_orders',           layer: 'source' },
  { id: 'src_shopify_order_items',      name: 'src_shopify_order_items',      layer: 'source' },
  { id: 'src_shopify_customers',        name: 'src_shopify_customers',        layer: 'source' },
  { id: 'src_shopify_products',         name: 'src_shopify_products',         layer: 'source' },
  { id: 'src_shopify_product_variants', name: 'src_shopify_product_variants', layer: 'source' },
  { id: 'src_shopify_refunds',          name: 'src_shopify_refunds',          layer: 'source' },
  { id: 'src_stripe_payments',          name: 'src_stripe_payments',          layer: 'source' },
  { id: 'src_stripe_refunds',           name: 'src_stripe_refunds',           layer: 'source' },
  { id: 'src_stripe_subscriptions',     name: 'src_stripe_subscriptions',     layer: 'source' },
  { id: 'src_google_ads_campaigns',     name: 'src_google_ads_campaigns',     layer: 'source' },
  { id: 'src_google_ads_performance',   name: 'src_google_ads_performance',   layer: 'source' },
  { id: 'src_salesforce_accounts',      name: 'src_salesforce_accounts',      layer: 'source' },
  { id: 'src_salesforce_contacts',      name: 'src_salesforce_contacts',      layer: 'source' },
  { id: 'src_salesforce_opportunities', name: 'src_salesforce_opportunities', layer: 'source' },
  { id: 'src_mobile_events',            name: 'src_mobile_events',            layer: 'source' },
  { id: 'src_email_campaigns',          name: 'src_email_campaigns',          layer: 'source' },
  { id: 'src_email_events',             name: 'src_email_events',             layer: 'source' },
  { id: 'src_web_sessions',             name: 'src_web_sessions',             layer: 'source' },
  { id: 'src_inventory_snapshots',      name: 'src_inventory_snapshots',      layer: 'source' },
  { id: 'src_subscription_events',      name: 'src_subscription_events',      layer: 'source' },
  { id: 'src_erp_products',             name: 'src_erp_products',             layer: 'source' },
  { id: 'src_erp_warehouses',           name: 'src_erp_warehouses',           layer: 'source' },
  { id: 'src_orders_v2',                name: 'src_orders_v2',                layer: 'source' },
  { id: 'src_shopify_gift_cards_v2',    name: 'src_shopify_gift_cards_v2',    layer: 'source' },

  // CORE
  { id: 'core_orders',               name: 'core_orders',               layer: 'core' },
  { id: 'core_customers',            name: 'core_customers',            layer: 'core' },
  { id: 'core_products',             name: 'core_products',             layer: 'core' },
  { id: 'core_subscriptions',        name: 'core_subscriptions',        layer: 'core' },
  { id: 'core_revenue_daily',        name: 'core_revenue_daily',        layer: 'core' },
  { id: 'core_revenue_monthly',      name: 'core_revenue_monthly',      layer: 'core' },
  { id: 'core_revenue_combined',     name: 'core_revenue_combined',     layer: 'core' },
  { id: 'core_refunds',              name: 'core_refunds',              layer: 'core' },
  { id: 'core_new_vs_returning',     name: 'core_new_vs_returning',     layer: 'core' },
  { id: 'core_cohort_retention',     name: 'core_cohort_retention',     layer: 'core' },
  { id: 'core_ad_performance',       name: 'core_ad_performance',       layer: 'core' },
  { id: 'core_customer_segments',    name: 'core_customer_segments',    layer: 'core' },
  { id: 'core_inventory_status',     name: 'core_inventory_status',     layer: 'core' },
  { id: 'core_b2b_accounts',         name: 'core_b2b_accounts',         layer: 'core' },
  { id: 'core_email_performance',    name: 'core_email_performance',    layer: 'core' },
  { id: 'core_web_engagement',       name: 'core_web_engagement',       layer: 'core' },
  { id: 'core_mobile_engagement',    name: 'core_mobile_engagement',    layer: 'core' },
  { id: 'core_opportunities',        name: 'core_opportunities',        layer: 'core' },
  { id: 'core_revenue_summary',      name: 'core_revenue_summary',      layer: 'core' },
  { id: 'core_coupon_analysis',      name: 'core_coupon_analysis',      layer: 'core' },
  { id: 'core_experimental_ltv',     name: 'core_experimental_ltv',     layer: 'core' },
  { id: 'core_inventory_legacy',     name: 'core_inventory_legacy',     layer: 'core' },
  { id: 'core_seller_metrics',       name: 'core_seller_metrics',       layer: 'core' },
  { id: 'core_geographic_revenue',   name: 'core_geographic_revenue',   layer: 'core' },

  // ANALYTICS
  { id: 'analytics_revenue_v1',              name: 'analytics_revenue_v1',              layer: 'analytics' },
  { id: 'analytics_revenue_v2',              name: 'analytics_revenue_v2',              layer: 'analytics' },
  { id: 'analytics_customer_360',            name: 'analytics_customer_360',            layer: 'analytics' },
  { id: 'analytics_customer_health',         name: 'analytics_customer_health',         layer: 'analytics' },
  { id: 'analytics_churn_risk',              name: 'analytics_churn_risk',              layer: 'analytics' },
  { id: 'analytics_product_performance',     name: 'analytics_product_performance',     layer: 'analytics' },
  { id: 'analytics_subscription_health',     name: 'analytics_subscription_health',     layer: 'analytics' },
  { id: 'analytics_subscription_mrr_trend',  name: 'analytics_subscription_mrr_trend',  layer: 'analytics' },
  { id: 'analytics_marketing_weekly',        name: 'analytics_marketing_weekly',        layer: 'analytics' },
  { id: 'analytics_b2b_pipeline',            name: 'analytics_b2b_pipeline',            layer: 'analytics' },
  { id: 'analytics_inventory_current',       name: 'analytics_inventory_current',       layer: 'analytics' },
  { id: 'analytics_cohort_retention',        name: 'analytics_cohort_retention',        layer: 'analytics' },
  { id: 'analytics_email_performance',       name: 'analytics_email_performance',       layer: 'analytics' },
  { id: 'analytics_web_traffic',             name: 'analytics_web_traffic',             layer: 'analytics' },
  { id: 'analytics_mobile_engagement',       name: 'analytics_mobile_engagement',       layer: 'analytics' },
  { id: 'analytics_geographic_revenue',      name: 'analytics_geographic_revenue',      layer: 'analytics' },
  { id: 'analytics_inventory_legacy',        name: 'analytics_inventory_legacy',        layer: 'analytics' },
  { id: 'analytics_seller_dashboard_v1',     name: 'analytics_seller_dashboard_v1',     layer: 'analytics' },
  { id: 'analytics_seller_dashboard_v2',     name: 'analytics_seller_dashboard_v2',     layer: 'analytics' },
  { id: 'analytics_legacy_kpis',             name: 'analytics_legacy_kpis',             layer: 'analytics' },
  { id: 'analytics_executive_kpis',          name: 'analytics_executive_kpis',          layer: 'analytics' },
  { id: 'analytics_refund_analysis',         name: 'analytics_refund_analysis',         layer: 'analytics' },
  { id: 'analytics_new_vs_returning',        name: 'analytics_new_vs_returning',        layer: 'analytics' },
  { id: 'analytics_finance_monthly',         name: 'analytics_finance_monthly',         layer: 'analytics' },
  { id: 'analytics_cac_analysis',            name: 'analytics_cac_analysis',            layer: 'analytics' },
  { id: 'analytics_channel_roi',             name: 'analytics_channel_roi',             layer: 'analytics' },
  { id: 'analytics_new_customer_acquisition',name: 'analytics_new_customer_acquisition',layer: 'analytics' },
];

// source → target (target depends on source)
const EDGES_RAW: [string, string][] = [
  // raw → source
  ['raw_shopify_orders',           'src_shopify_orders'],
  ['raw_shopify_order_items',      'src_shopify_order_items'],
  ['raw_shopify_customers',        'src_shopify_customers'],
  ['raw_shopify_products',         'src_shopify_products'],
  ['raw_shopify_product_variants', 'src_shopify_product_variants'],
  ['raw_shopify_refunds',          'src_shopify_refunds'],
  ['raw_stripe_payments',          'src_stripe_payments'],
  ['raw_stripe_refunds',           'src_stripe_refunds'],
  ['raw_stripe_subscriptions',     'src_stripe_subscriptions'],
  ['raw_google_ads_campaigns',     'src_google_ads_campaigns'],
  ['raw_google_ads_performance',   'src_google_ads_performance'],
  ['raw_salesforce_accounts',      'src_salesforce_accounts'],
  ['raw_salesforce_contacts',      'src_salesforce_contacts'],
  ['raw_salesforce_opportunities', 'src_salesforce_opportunities'],
  ['raw_mobile_events',            'src_mobile_events'],
  ['raw_email_campaigns',          'src_email_campaigns'],
  ['raw_email_events',             'src_email_events'],
  ['raw_web_sessions',             'src_web_sessions'],
  ['raw_inventory_snapshots',      'src_inventory_snapshots'],
  ['raw_erp_products',             'src_erp_products'],
  ['raw_erp_warehouses',           'src_erp_warehouses'],
  ['raw_shopify_orders',           'src_orders_v2'],
  ['raw_shopify_gift_cards',       'src_shopify_gift_cards_v2'],
  ['src_stripe_subscriptions',     'src_subscription_events'],

  // source → core
  ['src_shopify_orders',           'core_orders'],
  ['src_stripe_payments',          'core_orders'],
  ['src_shopify_order_items',      'core_orders'],
  ['src_shopify_customers',        'core_customers'],
  ['core_orders',                  'core_customers'],
  ['src_stripe_subscriptions',     'core_customers'],
  ['src_shopify_products',         'core_products'],
  ['src_shopify_order_items',      'core_products'],
  ['src_shopify_product_variants', 'core_products'],
  ['src_stripe_subscriptions',     'core_subscriptions'],
  ['core_customers',               'core_subscriptions'],
  ['core_orders',                  'core_revenue_daily'],
  ['src_stripe_subscriptions',     'core_revenue_monthly'],
  ['core_revenue_daily',           'core_revenue_combined'],
  ['core_revenue_monthly',         'core_revenue_combined'],
  ['src_stripe_refunds',           'core_refunds'],
  ['src_stripe_payments',          'core_refunds'],
  ['core_orders',                  'core_refunds'],
  ['src_shopify_orders',           'core_new_vs_returning'],
  ['core_customers',               'core_cohort_retention'],
  ['core_orders',                  'core_cohort_retention'],
  ['src_google_ads_performance',   'core_ad_performance'],
  ['src_google_ads_campaigns',     'core_ad_performance'],
  ['core_customers',               'core_customer_segments'],
  ['src_inventory_snapshots',      'core_inventory_status'],
  ['src_shopify_product_variants', 'core_inventory_status'],
  ['src_shopify_products',         'core_inventory_status'],
  ['src_salesforce_accounts',      'core_b2b_accounts'],
  ['src_salesforce_contacts',      'core_b2b_accounts'],
  ['core_customers',               'core_b2b_accounts'],
  ['src_email_campaigns',          'core_email_performance'],
  ['src_email_events',             'core_email_performance'],
  ['src_web_sessions',             'core_web_engagement'],
  ['src_mobile_events',            'core_mobile_engagement'],
  ['src_salesforce_opportunities', 'core_opportunities'],
  ['src_salesforce_accounts',      'core_opportunities'],
  ['core_orders',                  'core_revenue_summary'],
  ['src_shopify_order_items',      'core_coupon_analysis'],
  ['core_customers',               'core_experimental_ltv'],
  ['src_erp_products',             'core_inventory_legacy'],
  ['core_orders',                  'core_seller_metrics'],
  ['core_customers',               'core_geographic_revenue'],
  ['core_orders',                  'core_geographic_revenue'],

  // core → analytics
  ['core_revenue_daily',        'analytics_revenue_v1'],
  ['core_revenue_combined',     'analytics_revenue_v2'],
  ['core_customers',            'analytics_customer_360'],
  ['core_customer_segments',    'analytics_customer_360'],
  ['core_mobile_engagement',    'analytics_customer_360'],
  ['core_customers',            'analytics_customer_health'],
  ['core_customer_segments',    'analytics_customer_health'],
  ['core_customers',            'analytics_churn_risk'],
  ['core_products',             'analytics_product_performance'],
  ['core_subscriptions',        'analytics_subscription_health'],
  ['core_revenue_monthly',      'analytics_subscription_mrr_trend'],
  ['core_ad_performance',       'analytics_marketing_weekly'],
  ['core_b2b_accounts',         'analytics_b2b_pipeline'],
  ['core_opportunities',        'analytics_b2b_pipeline'],
  ['core_inventory_status',     'analytics_inventory_current'],
  ['core_cohort_retention',     'analytics_cohort_retention'],
  ['core_email_performance',    'analytics_email_performance'],
  ['core_web_engagement',       'analytics_web_traffic'],
  ['core_mobile_engagement',    'analytics_mobile_engagement'],
  ['core_geographic_revenue',   'analytics_geographic_revenue'],
  ['core_inventory_legacy',     'analytics_inventory_legacy'],
  ['core_seller_metrics',       'analytics_seller_dashboard_v1'],
  ['core_seller_metrics',       'analytics_seller_dashboard_v2'],
  ['analytics_revenue_v1',      'analytics_legacy_kpis'],
  ['core_customers',            'analytics_legacy_kpis'],
  ['core_orders',               'analytics_executive_kpis'],
  ['core_subscriptions',        'analytics_executive_kpis'],
  ['core_refunds',              'analytics_refund_analysis'],
  ['core_new_vs_returning',     'analytics_new_vs_returning'],
  ['core_new_vs_returning',     'analytics_new_customer_acquisition'],
  ['core_web_engagement',       'analytics_new_customer_acquisition'],
  ['core_revenue_daily',        'analytics_finance_monthly'],
  ['core_refunds',              'analytics_finance_monthly'],
  ['core_ad_performance',       'analytics_cac_analysis'],
  ['core_customers',            'analytics_cac_analysis'],
  ['core_orders',               'analytics_channel_roi'],
  ['core_web_engagement',       'analytics_channel_roi'],
];

// ── Layer colours ──────────────────────────────────────────────────────────────

const LAYER_COLOR: Record<Layer, string> = {
  raw:       '#334155',
  source:    '#166534',
  core:      '#3730a3',
  analytics: '#92400e',
};

const LAYER_LABEL: Record<Layer, string> = {
  raw:       'Raw',
  source:    'Source',
  core:      'Core',
  analytics: 'Analytics',
};

// ── Dagre auto-layout ─────────────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 48;

function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 120 });
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

// ── Build React Flow elements ─────────────────────────────────────────────────

function buildElements() {
  const nodeMap = new Map(NODES.map(n => [n.id, n]));

  const rfNodes: Node[] = NODES.map(n => ({
    id: n.id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: { label: n.name.replace(/^(raw_|src_|core_|analytics_)/, '') },
    style: {
      background: LAYER_COLOR[n.layer],
      color: '#f1f5f9',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 500,
      width: NODE_W,
      height: NODE_H,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 10px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      cursor: 'pointer',
    },
  }));

  const rfEdges: Edge[] = EDGES_RAW.map(([src, tgt], i) => ({
    id: `e${i}`,
    source: src,
    target: tgt,
    style: { stroke: '#475569', strokeWidth: 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 12, height: 12 },
  }));

  const { nodes, edges } = layoutGraph(rfNodes, rfEdges);

  return { nodes, edges, nodeMap };
}

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES, nodeMap: NODE_MAP } = buildElements();

// ── Ancestor / descendant traversal ──────────────────────────────────────────

function getRelatives(id: string) {
  const ancestors: string[] = [];
  const descendants: string[] = [];
  const visited = new Set<string>();

  const walkUp = (nodeId: string) => {
    EDGES_RAW.forEach(([src, tgt]) => {
      if (tgt === nodeId && !visited.has(src)) {
        visited.add(src); ancestors.push(src); walkUp(src);
      }
    });
  };
  visited.add(id);
  walkUp(id);
  visited.clear(); visited.add(id);

  const walkDown = (nodeId: string) => {
    EDGES_RAW.forEach(([src, tgt]) => {
      if (src === nodeId && !visited.has(tgt)) {
        visited.add(tgt); descendants.push(tgt); walkDown(tgt);
      }
    });
  };
  walkDown(id);

  return { ancestors, descendants };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Lineage() {
  const [nodes, , onNodesChange] = useNodesState<Node>(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(INITIAL_EDGES);
  const [selected, setSelected] = useState<string | null>(null);
  const [relatives, setRelatives] = useState<{ ancestors: string[]; descendants: string[] } | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (selected === node.id) { setSelected(null); setRelatives(null); return; }
    setSelected(node.id);
    setRelatives(getRelatives(node.id));
  }, [selected]);

  const selectedNode = selected ? NODE_MAP.get(selected) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">ShopMesh Lineage DAG</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {NODES.length} models · {EDGES_RAW.length} edges · <span className="text-green-400">Valid DAG</span>
          </p>
        </div>
        <div className="hidden md:flex items-center gap-4">
          {(Object.entries(LAYER_COLOR) as [Layer, string][]).map(([layer, color]) => (
            <span key={layer} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              {LAYER_LABEL[layer]}
            </span>
          ))}
        </div>
      </div>

      {/* Canvas + side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-gray-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={n => LAYER_COLOR[(NODE_MAP.get(n.id)?.layer ?? 'raw') as Layer]}
              style={{ background: '#0f172a', border: '1px solid #1e293b' }}
            />
          </ReactFlow>
        </div>

        {selectedNode && relatives && (
          <div className="w-64 border-l border-gray-800 overflow-y-auto flex-shrink-0 p-5 space-y-5 bg-gray-900">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Selected</p>
              <p className="text-white font-semibold text-sm break-all">{selectedNode.name}</p>
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ background: LAYER_COLOR[selectedNode.layer] }}
              >
                {LAYER_LABEL[selectedNode.layer]}
              </span>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Ancestors ({relatives.ancestors.length})
              </p>
              {relatives.ancestors.length === 0
                ? <p className="text-xs text-gray-600">None — root node</p>
                : relatives.ancestors.map(id => {
                    const n = NODE_MAP.get(id);
                    return (
                      <div key={id} className="flex items-center gap-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: LAYER_COLOR[(n?.layer ?? 'raw') as Layer] }} />
                        <span className="text-xs text-gray-300 break-all">{id}</span>
                      </div>
                    );
                  })
              }
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Descendants ({relatives.descendants.length})
              </p>
              {relatives.descendants.length === 0
                ? <p className="text-xs text-gray-600">None — leaf node</p>
                : relatives.descendants.map(id => {
                    const n = NODE_MAP.get(id);
                    return (
                      <div key={id} className="flex items-center gap-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: LAYER_COLOR[(n?.layer ?? 'raw') as Layer] }} />
                        <span className="text-xs text-gray-300 break-all">{id}</span>
                      </div>
                    );
                  })
              }
            </div>

            <button
              className="text-xs text-gray-600 hover:text-gray-400"
              onClick={() => { setSelected(null); setRelatives(null); }}
            >
              ✕ Deselect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
