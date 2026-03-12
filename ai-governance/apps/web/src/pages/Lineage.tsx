import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// ── Types ──────────────────────────────────────────────────────────────────────

type Layer = 'raw' | 'source' | 'core' | 'analytics';
type TestBadge = 'P' | 'F' | 'N' | 'U';

interface ModelNode  { id: string; name: string; layer: Layer; }
interface ColumnDef  { name: string; type: string; tests: TestBadge[]; description?: string; }
interface ModelMeta  { description: string; columns: ColumnDef[]; sql: string; }
interface ChatMessage { role: 'assistant' | 'user'; content: string; ts: number; }

// ── Static model data ──────────────────────────────────────────────────────────

const NODES: ModelNode[] = [
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
  { id: 'analytics_revenue_v1',               name: 'analytics_revenue_v1',               layer: 'analytics' },
  { id: 'analytics_revenue_v2',               name: 'analytics_revenue_v2',               layer: 'analytics' },
  { id: 'analytics_customer_360',             name: 'analytics_customer_360',             layer: 'analytics' },
  { id: 'analytics_customer_health',          name: 'analytics_customer_health',          layer: 'analytics' },
  { id: 'analytics_churn_risk',               name: 'analytics_churn_risk',               layer: 'analytics' },
  { id: 'analytics_product_performance',      name: 'analytics_product_performance',      layer: 'analytics' },
  { id: 'analytics_subscription_health',      name: 'analytics_subscription_health',      layer: 'analytics' },
  { id: 'analytics_subscription_mrr_trend',   name: 'analytics_subscription_mrr_trend',   layer: 'analytics' },
  { id: 'analytics_marketing_weekly',         name: 'analytics_marketing_weekly',         layer: 'analytics' },
  { id: 'analytics_b2b_pipeline',             name: 'analytics_b2b_pipeline',             layer: 'analytics' },
  { id: 'analytics_inventory_current',        name: 'analytics_inventory_current',        layer: 'analytics' },
  { id: 'analytics_cohort_retention',         name: 'analytics_cohort_retention',         layer: 'analytics' },
  { id: 'analytics_email_performance',        name: 'analytics_email_performance',        layer: 'analytics' },
  { id: 'analytics_web_traffic',              name: 'analytics_web_traffic',              layer: 'analytics' },
  { id: 'analytics_mobile_engagement',        name: 'analytics_mobile_engagement',        layer: 'analytics' },
  { id: 'analytics_geographic_revenue',       name: 'analytics_geographic_revenue',       layer: 'analytics' },
  { id: 'analytics_inventory_legacy',         name: 'analytics_inventory_legacy',         layer: 'analytics' },
  { id: 'analytics_seller_dashboard_v1',      name: 'analytics_seller_dashboard_v1',      layer: 'analytics' },
  { id: 'analytics_seller_dashboard_v2',      name: 'analytics_seller_dashboard_v2',      layer: 'analytics' },
  { id: 'analytics_legacy_kpis',              name: 'analytics_legacy_kpis',              layer: 'analytics' },
  { id: 'analytics_executive_kpis',           name: 'analytics_executive_kpis',           layer: 'analytics' },
  { id: 'analytics_refund_analysis',          name: 'analytics_refund_analysis',          layer: 'analytics' },
  { id: 'analytics_new_vs_returning',         name: 'analytics_new_vs_returning',         layer: 'analytics' },
  { id: 'analytics_finance_monthly',          name: 'analytics_finance_monthly',          layer: 'analytics' },
  { id: 'analytics_cac_analysis',             name: 'analytics_cac_analysis',             layer: 'analytics' },
  { id: 'analytics_channel_roi',              name: 'analytics_channel_roi',              layer: 'analytics' },
  { id: 'analytics_new_customer_acquisition', name: 'analytics_new_customer_acquisition', layer: 'analytics' },
];

const EDGES_RAW: [string, string][] = [
  ['raw_shopify_orders','src_shopify_orders'],['raw_shopify_order_items','src_shopify_order_items'],
  ['raw_shopify_customers','src_shopify_customers'],['raw_shopify_products','src_shopify_products'],
  ['raw_shopify_product_variants','src_shopify_product_variants'],['raw_shopify_refunds','src_shopify_refunds'],
  ['raw_stripe_payments','src_stripe_payments'],['raw_stripe_refunds','src_stripe_refunds'],
  ['raw_stripe_subscriptions','src_stripe_subscriptions'],['raw_google_ads_campaigns','src_google_ads_campaigns'],
  ['raw_google_ads_performance','src_google_ads_performance'],['raw_salesforce_accounts','src_salesforce_accounts'],
  ['raw_salesforce_contacts','src_salesforce_contacts'],['raw_salesforce_opportunities','src_salesforce_opportunities'],
  ['raw_mobile_events','src_mobile_events'],['raw_email_campaigns','src_email_campaigns'],
  ['raw_email_events','src_email_events'],['raw_web_sessions','src_web_sessions'],
  ['raw_inventory_snapshots','src_inventory_snapshots'],['raw_erp_products','src_erp_products'],
  ['raw_erp_warehouses','src_erp_warehouses'],['raw_shopify_orders','src_orders_v2'],
  ['raw_shopify_gift_cards','src_shopify_gift_cards_v2'],['src_stripe_subscriptions','src_subscription_events'],
  ['src_shopify_orders','core_orders'],['src_stripe_payments','core_orders'],['src_shopify_order_items','core_orders'],
  ['src_shopify_customers','core_customers'],['core_orders','core_customers'],['src_stripe_subscriptions','core_customers'],
  ['src_shopify_products','core_products'],['src_shopify_order_items','core_products'],['src_shopify_product_variants','core_products'],
  ['src_stripe_subscriptions','core_subscriptions'],['core_customers','core_subscriptions'],
  ['core_orders','core_revenue_daily'],['src_stripe_subscriptions','core_revenue_monthly'],
  ['core_revenue_daily','core_revenue_combined'],['core_revenue_monthly','core_revenue_combined'],
  ['src_stripe_refunds','core_refunds'],['src_stripe_payments','core_refunds'],['core_orders','core_refunds'],
  ['src_shopify_orders','core_new_vs_returning'],['core_customers','core_cohort_retention'],['core_orders','core_cohort_retention'],
  ['src_google_ads_performance','core_ad_performance'],['src_google_ads_campaigns','core_ad_performance'],
  ['core_customers','core_customer_segments'],['src_inventory_snapshots','core_inventory_status'],
  ['src_shopify_product_variants','core_inventory_status'],['src_shopify_products','core_inventory_status'],
  ['src_salesforce_accounts','core_b2b_accounts'],['src_salesforce_contacts','core_b2b_accounts'],['core_customers','core_b2b_accounts'],
  ['src_email_campaigns','core_email_performance'],['src_email_events','core_email_performance'],
  ['src_web_sessions','core_web_engagement'],['src_mobile_events','core_mobile_engagement'],
  ['src_salesforce_opportunities','core_opportunities'],['src_salesforce_accounts','core_opportunities'],
  ['core_orders','core_revenue_summary'],['src_shopify_order_items','core_coupon_analysis'],
  ['core_customers','core_experimental_ltv'],['src_erp_products','core_inventory_legacy'],
  ['core_orders','core_seller_metrics'],['core_customers','core_geographic_revenue'],['core_orders','core_geographic_revenue'],
  ['core_revenue_daily','analytics_revenue_v1'],['core_revenue_combined','analytics_revenue_v2'],
  ['core_customers','analytics_customer_360'],['core_customer_segments','analytics_customer_360'],['core_mobile_engagement','analytics_customer_360'],
  ['core_customers','analytics_customer_health'],['core_customer_segments','analytics_customer_health'],
  ['core_customers','analytics_churn_risk'],['core_products','analytics_product_performance'],
  ['core_subscriptions','analytics_subscription_health'],['core_revenue_monthly','analytics_subscription_mrr_trend'],
  ['core_ad_performance','analytics_marketing_weekly'],['core_b2b_accounts','analytics_b2b_pipeline'],['core_opportunities','analytics_b2b_pipeline'],
  ['core_inventory_status','analytics_inventory_current'],['core_cohort_retention','analytics_cohort_retention'],
  ['core_email_performance','analytics_email_performance'],['core_web_engagement','analytics_web_traffic'],
  ['core_mobile_engagement','analytics_mobile_engagement'],['core_geographic_revenue','analytics_geographic_revenue'],
  ['core_inventory_legacy','analytics_inventory_legacy'],['core_seller_metrics','analytics_seller_dashboard_v1'],
  ['core_seller_metrics','analytics_seller_dashboard_v2'],['analytics_revenue_v1','analytics_legacy_kpis'],
  ['core_customers','analytics_legacy_kpis'],['core_orders','analytics_executive_kpis'],['core_subscriptions','analytics_executive_kpis'],
  ['core_refunds','analytics_refund_analysis'],['core_new_vs_returning','analytics_new_vs_returning'],
  ['core_new_vs_returning','analytics_new_customer_acquisition'],['core_web_engagement','analytics_new_customer_acquisition'],
  ['core_revenue_daily','analytics_finance_monthly'],['core_refunds','analytics_finance_monthly'],
  ['core_ad_performance','analytics_cac_analysis'],['core_customers','analytics_cac_analysis'],
  ['core_orders','analytics_channel_roi'],['core_web_engagement','analytics_channel_roi'],
];

// ── Model metadata (descriptions, columns, SQL) ───────────────────────────────

const META: Record<string, ModelMeta> = {
  core_orders: {
    description: 'Unified orders fact table combining Shopify order data with Stripe payment records. Each row represents one order with resolved payment status, item count, and revenue attribution.',
    columns: [
      { name: 'order_id',        type: 'varchar',   tests: ['P', 'N'],     description: 'Unique Shopify order ID' },
      { name: 'customer_id',     type: 'varchar',   tests: ['F', 'N'],     description: 'Foreign key to core_customers' },
      { name: 'order_date',      type: 'date',      tests: ['N'],          description: 'Date the order was placed' },
      { name: 'total_amount',    type: 'numeric',   tests: ['N'],          description: 'Gross order value in USD' },
      { name: 'payment_status',  type: 'varchar',   tests: [],             description: 'paid | pending | refunded' },
      { name: 'item_count',      type: 'integer',   tests: ['N'],          description: 'Number of line items' },
      { name: 'stripe_charge_id',type: 'varchar',   tests: ['U'],          description: 'Matching Stripe charge' },
    ],
    sql: `with orders as (\n  select * from {{ ref('src_shopify_orders') }}\n),\npayments as (\n  select * from {{ ref('src_stripe_payments') }}\n),\nline_items as (\n  select order_id, count(*) as item_count\n  from {{ ref('src_shopify_order_items') }}\n  group by 1\n)\nselect\n  o.order_id,\n  o.customer_id,\n  o.created_at::date          as order_date,\n  o.total_price               as total_amount,\n  coalesce(p.status, 'pending') as payment_status,\n  coalesce(li.item_count, 0)  as item_count,\n  p.charge_id                 as stripe_charge_id\nfrom orders o\nleft join payments p on o.order_id = p.order_id\nleft join line_items li on o.order_id = li.order_id`,
  },
  core_customers: {
    description: 'Customer dimension table combining Shopify customer profiles with Stripe subscription status and order history. Used as the primary customer entity across all analytics models.',
    columns: [
      { name: 'customer_id',       type: 'varchar', tests: ['P', 'N', 'U'], description: 'Unique customer identifier' },
      { name: 'email',             type: 'varchar', tests: ['N', 'U'],       description: 'Customer email address' },
      { name: 'first_name',        type: 'varchar', tests: [],               description: 'First name' },
      { name: 'last_name',         type: 'varchar', tests: [],               description: 'Last name' },
      { name: 'created_at',        type: 'timestamp',tests: ['N'],           description: 'Account creation timestamp' },
      { name: 'total_orders',      type: 'integer', tests: ['N'],            description: 'Lifetime order count' },
      { name: 'lifetime_value',    type: 'numeric', tests: [],               description: 'Total revenue attributed' },
      { name: 'is_subscriber',     type: 'boolean', tests: ['N'],            description: 'Has active Stripe subscription' },
    ],
    sql: `with customers as (\n  select * from {{ ref('src_shopify_customers') }}\n),\norder_stats as (\n  select\n    customer_id,\n    count(*)       as total_orders,\n    sum(total_amount) as lifetime_value\n  from {{ ref('core_orders') }}\n  group by 1\n),\nsubs as (\n  select distinct customer_id, true as is_subscriber\n  from {{ ref('src_stripe_subscriptions') }}\n  where status = 'active'\n)\nselect\n  c.customer_id,\n  c.email,\n  c.first_name,\n  c.last_name,\n  c.created_at,\n  coalesce(os.total_orders, 0)    as total_orders,\n  coalesce(os.lifetime_value, 0)  as lifetime_value,\n  coalesce(s.is_subscriber, false) as is_subscriber\nfrom customers c\nleft join order_stats os using (customer_id)\nleft join subs s using (customer_id)`,
  },
  core_revenue_daily: {
    description: 'Daily revenue aggregation from core_orders. Provides date-grain revenue metrics used by downstream analytics and finance reporting.',
    columns: [
      { name: 'date_day',      type: 'date',    tests: ['P', 'N', 'U'], description: 'Calendar date' },
      { name: 'order_count',   type: 'integer', tests: ['N'],            description: 'Number of paid orders' },
      { name: 'gross_revenue', type: 'numeric', tests: ['N'],            description: 'Sum of total_amount' },
      { name: 'net_revenue',   type: 'numeric', tests: ['N'],            description: 'Gross minus refunds' },
      { name: 'avg_order_value',type:'numeric', tests: [],               description: 'gross_revenue / order_count' },
    ],
    sql: `select\n  order_date                       as date_day,\n  count(*)                         as order_count,\n  sum(total_amount)                as gross_revenue,\n  sum(total_amount)\n    - coalesce(sum(refund_amount),0) as net_revenue,\n  avg(total_amount)                as avg_order_value\nfrom {{ ref('core_orders') }}\nwhere payment_status = 'paid'\ngroup by 1`,
  },
  analytics_revenue_v1: {
    description: 'Daily revenue report (v1) — legacy format used by finance dashboards. Sourced from core_revenue_daily with additional rolling window calculations.',
    columns: [
      { name: 'date_day',        type: 'date',    tests: ['P', 'N'], description: 'Report date' },
      { name: 'gross_revenue',   type: 'numeric', tests: ['N'],      description: 'Daily gross revenue' },
      { name: 'net_revenue',     type: 'numeric', tests: ['N'],      description: 'Daily net revenue' },
      { name: 'revenue_7d',      type: 'numeric', tests: [],         description: '7-day rolling sum' },
      { name: 'revenue_30d',     type: 'numeric', tests: [],         description: '30-day rolling sum' },
    ],
    sql: `select\n  date_day,\n  gross_revenue,\n  net_revenue,\n  sum(gross_revenue) over (\n    order by date_day\n    rows between 6 preceding and current row\n  ) as revenue_7d,\n  sum(gross_revenue) over (\n    order by date_day\n    rows between 29 preceding and current row\n  ) as revenue_30d\nfrom {{ ref('core_revenue_daily') }}\norder by date_day`,
  },
  raw_salesforce_accounts: {
    description: 'Raw Salesforce Account records loaded via Fivetran. Contains all CRM account data including B2B company profiles, ARR estimates, and sales owner assignments.',
    columns: [
      { name: 'id',              type: 'varchar',   tests: ['P', 'N', 'U'], description: 'Salesforce Account ID (18-char)' },
      { name: 'name',            type: 'varchar',   tests: ['N'],            description: 'Account / company name' },
      { name: 'industry',        type: 'varchar',   tests: [],               description: 'Industry vertical' },
      { name: 'annual_revenue',  type: 'numeric',   tests: [],               description: 'Self-reported ARR' },
      { name: 'owner_id',        type: 'varchar',   tests: ['F'],            description: 'Salesforce User ID of AE' },
      { name: '_fivetran_synced',type: 'timestamp', tests: ['N'],            description: 'Last Fivetran sync time' },
    ],
    sql: `-- Raw table loaded by Fivetran connector\n-- Do not transform here — use src_salesforce_accounts\nselect * from salesforce.account`,
  },
  analytics_b2b_pipeline: {
    description: 'B2B sales pipeline analytics combining CRM accounts with open opportunities. Provides deal stage distribution, weighted pipeline value, and win-rate metrics for sales leadership.',
    columns: [
      { name: 'account_id',       type: 'varchar', tests: ['P', 'N'],  description: 'Salesforce account ID' },
      { name: 'account_name',     type: 'varchar', tests: ['N'],       description: 'Company name' },
      { name: 'open_opps',        type: 'integer', tests: ['N'],       description: 'Count of open opportunities' },
      { name: 'pipeline_value',   type: 'numeric', tests: [],          description: 'Sum of opportunity amounts' },
      { name: 'weighted_pipeline',type: 'numeric', tests: [],          description: 'Amount × close probability' },
      { name: 'stage',            type: 'varchar', tests: [],          description: 'Dominant opportunity stage' },
      { name: 'days_in_pipeline', type: 'integer', tests: [],          description: 'Days since first open opp' },
    ],
    sql: `with accounts as (\n  select * from {{ ref('core_b2b_accounts') }}\n),\nopps as (\n  select\n    account_id,\n    count(*)                              as open_opps,\n    sum(amount)                           as pipeline_value,\n    sum(amount * close_probability / 100) as weighted_pipeline,\n    mode() within group (order by stage)  as stage,\n    datediff('day', min(created_date), current_date) as days_in_pipeline\n  from {{ ref('core_opportunities') }}\n  where is_closed = false\n  group by 1\n)\nselect a.*, o.*\nfrom accounts a\nleft join opps o using (account_id)`,
  },
};

function getMeta(id: string): ModelMeta {
  if (META[id]) return META[id];
  const n = NODES.find(x => x.id === id);
  const layer = n?.layer ?? 'raw';
  const label = id.replace(/^(raw_|src_|core_|analytics_)/, '').replace(/_/g, ' ');
  return {
    description: `${layer.charAt(0).toUpperCase() + layer.slice(1)}-layer model: ${label}. Part of the ShopMesh dbt project.`,
    columns: [
      { name: `${id.replace(/^(raw_|src_|core_|analytics_)/, '')}_id`, type: 'varchar', tests: ['P', 'N', 'U'], description: 'Primary key' },
      { name: 'created_at', type: 'timestamp', tests: ['N'], description: 'Record creation timestamp' },
      { name: 'updated_at', type: 'timestamp', tests: [],    description: 'Last update timestamp' },
    ],
    sql: layer === 'raw'
      ? `select * from ${id.replace('raw_', '')}`
      : `select *\nfrom {{ ref('${EDGES_RAW.find(([,t]) => t === id)?.[0] ?? 'upstream_model'}') }}`,
  };
}

// ── Lookups ────────────────────────────────────────────────────────────────────

const NODE_MAP  = new Map(NODES.map(n => [n.id, n]));
const LAYERS: Layer[] = ['raw', 'source', 'core', 'analytics'];

const LAYER_COLOR: Record<Layer, string>  = { raw: '#1e3a5f', source: '#14532d', core: '#312e81', analytics: '#78350f' };
const LAYER_BORDER: Record<Layer, string> = { raw: '#3b82f6', source: '#22c55e', core: '#818cf8', analytics: '#f59e0b' };
const LAYER_LABEL: Record<Layer, string>  = { raw: 'Raw', source: 'Source', core: 'Core', analytics: 'Analytics' };

const BADGE_STYLE: Record<TestBadge, string> = {
  P: 'bg-blue-900 text-blue-300 border border-blue-700',
  F: 'bg-purple-900 text-purple-300 border border-purple-700',
  N: 'bg-green-900 text-green-300 border border-green-700',
  U: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
};
const BADGE_TITLE: Record<TestBadge, string> = { P: 'Primary Key', F: 'Foreign Key', N: 'Not Null', U: 'Unique' };

// ── Graph helpers ──────────────────────────────────────────────────────────────

function getFocusedGraph(id: string, depth: number) {
  const inc = new Set<string>([id]);
  let f = [id];
  for (let d = 0; d < depth; d++) {
    const nx: string[] = [];
    EDGES_RAW.forEach(([s, t]) => { if (f.includes(t) && !inc.has(s)) { inc.add(s); nx.push(s); } });
    f = nx;
  }
  f = [id];
  for (let d = 0; d < depth; d++) {
    const nx: string[] = [];
    EDGES_RAW.forEach(([s, t]) => { if (f.includes(s) && !inc.has(t)) { inc.add(t); nx.push(t); } });
    f = nx;
  }
  return {
    nodes: NODES.filter(n => inc.has(n.id)),
    edges: EDGES_RAW.filter(([s, t]) => inc.has(s) && inc.has(t)),
  };
}

function getFullLineage(id: string) {
  const anc: string[] = []; const desc: string[] = [];
  const vis = new Set([id]);
  const up = (n: string) => EDGES_RAW.forEach(([s, t]) => { if (t === n && !vis.has(s)) { vis.add(s); anc.push(s); up(s); } });
  up(id); vis.clear(); vis.add(id);
  const dn = (n: string) => EDGES_RAW.forEach(([s, t]) => { if (s === n && !vis.has(t)) { vis.add(t); desc.push(t); dn(t); } });
  dn(id);
  return { ancestors: anc, descendants: desc };
}

// ── Dagre + ReactFlow builders ─────────────────────────────────────────────────

const NODE_W = 200; const NODE_H = 44;

function layoutNodes(rfNodes: Node[], rfEdges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 110 });
  rfNodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rfEdges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return rfNodes.map(n => { const p = g.node(n.id); return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }; });
}

function buildFlow(modelNodes: ModelNode[], edgePairs: [string, string][], selectedId: string) {
  const rfNodes: Node[] = modelNodes.map(n => ({
    id: n.id, type: 'default', position: { x: 0, y: 0 },
    data: { label: n.name.replace(/^(raw_|src_|core_|analytics_)/, '') },
    style: {
      background: n.id === selectedId ? LAYER_BORDER[n.layer] : LAYER_COLOR[n.layer],
      color: '#f1f5f9',
      border: `2px solid ${LAYER_BORDER[n.layer]}`,
      borderRadius: 7, fontSize: 11,
      fontWeight: n.id === selectedId ? 700 : 400,
      width: NODE_W, height: NODE_H,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 8px', cursor: 'pointer',
      boxShadow: n.id === selectedId ? `0 0 14px ${LAYER_BORDER[n.layer]}55` : '0 1px 4px rgba(0,0,0,0.5)',
    },
  }));
  const rfEdges: Edge[] = edgePairs.map(([s, t], i) => ({
    id: `e${i}`, source: s, target: t,
    style: { stroke: '#475569', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 11, height: 11 },
  }));
  return { nodes: layoutNodes(rfNodes, rfEdges), edges: rfEdges };
}

// ── Mini Lineage graph (floating panel in docs) ────────────────────────────────

function MiniLineage({ selectedId, onExpand, onNodeClick }: {
  selectedId: string;
  onExpand: () => void;
  onNodeClick: (id: string) => void;
}) {
  const { nodes: mn, edges: me } = getFocusedGraph(selectedId, 1);
  const { nodes: fn, edges: fe } = buildFlow(mn, me, selectedId);
  const [nodes, , onNC] = useNodesState<Node>(fn);
  const [edges, , onEC] = useEdgesState<Edge>(fe);

  useEffect(() => {
    const { nodes: mn2, edges: me2 } = getFocusedGraph(selectedId, 1);
    const { nodes: fn2, edges: fe2 } = buildFlow(mn2, me2, selectedId);
    onNC(fn2.map(n => ({ type: 'reset', item: n })));
    onEC(fe2.map(e => ({ type: 'reset', item: e })));
  }, [selectedId]);

  return (
    <div className="absolute bottom-4 right-4 w-72 h-52 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-10">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-xs font-semibold text-gray-300">Lineage Graph</span>
        <button onClick={onExpand} className="text-gray-400 hover:text-white transition-colors" title="Expand">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
      </div>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNC} onEdgesChange={onEC}
        onNodeClick={(_, n) => onNodeClick(n.id)}
        fitView fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false} zoomOnScroll={false} panOnDrag={false}
      >
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={16} />
      </ReactFlow>
    </div>
  );
}

// ── Full Lineage modal ─────────────────────────────────────────────────────────

function LineageModal({ selectedId, onClose, onNodeClick }: {
  selectedId: string;
  onClose: () => void;
  onNodeClick: (id: string) => void;
}) {
  const [depth, setDepth] = useState(2);
  const { nodes: mn, edges: me } = getFocusedGraph(selectedId, depth);
  const { nodes: fn, edges: fe } = buildFlow(mn, me, selectedId);
  const [nodes, setNodes, onNC] = useNodesState<Node>(fn);
  const [edges, setEdges, onEC] = useEdgesState<Edge>(fe);
  const node = NODE_MAP.get(selectedId);

  useEffect(() => {
    const { nodes: mn2, edges: me2 } = getFocusedGraph(selectedId, depth);
    const { nodes: fn2, edges: fe2 } = buildFlow(mn2, me2, selectedId);
    setNodes(fn2); setEdges(fe2);
  }, [selectedId, depth]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[90vw] h-[85vh] bg-gray-900 border border-gray-700 rounded-xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 bg-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Lineage — {selectedId}</span>
            {node && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: LAYER_COLOR[node.layer], color: LAYER_BORDER[node.layer], border: `1px solid ${LAYER_BORDER[node.layer]}` }}>
                {LAYER_LABEL[node.layer]}
              </span>
            )}
            <span className="text-xs text-gray-500">{nodes.length} nodes · {edges.length} edges</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Depth</span>
            {[1, 2, 3].map(d => (
              <button key={d} onClick={() => setDepth(d)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors ${depth === d ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                {d}
              </button>
            ))}
            <button onClick={onClose} className="ml-2 text-gray-400 hover:text-white transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        {/* Layer legend */}
        <div className="flex items-center gap-4 px-5 py-1.5 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          {LAYERS.map(l => (
            <span key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-sm" style={{ background: LAYER_BORDER[l] }} />{LAYER_LABEL[l]}
            </span>
          ))}
          <span className="ml-auto text-xs text-gray-600">Click any node to navigate to its documentation</span>
        </div>
        {/* Canvas */}
        <div className="flex-1 bg-gray-950">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNC} onEdgesChange={onEC}
            onNodeClick={(_, n) => { onNodeClick(n.id); onClose(); }}
            fitView fitViewOptions={{ padding: 0.15 }} proOptions={{ hideAttribution: true }}>
            <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={20} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

// ── Model Documentation panel ──────────────────────────────────────────────────

type DocTab = 'description' | 'columns' | 'sql';

function ModelDocs({ id, onNavigate }: { id: string; onNavigate: (id: string) => void }) {
  const [tab, setTab] = useState<DocTab>('description');
  const [lineageExpanded, setLineageExpanded] = useState(false);
  const node = NODE_MAP.get(id);
  const meta = getMeta(id);
  const directParents  = EDGES_RAW.filter(([, t]) => t === id).map(([s]) => s);
  const directChildren = EDGES_RAW.filter(([s]) => s === id).map(([, t]) => t);

  if (!node) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Model header */}
      <div className="px-8 pt-6 pb-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white font-mono">{node.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: LAYER_COLOR[node.layer], color: LAYER_BORDER[node.layer], border: `1px solid ${LAYER_BORDER[node.layer]}` }}>
                {LAYER_LABEL[node.layer]}
              </span>
              <span className="text-xs text-gray-600">table</span>
            </div>
            {/* Upstream / downstream quick ref */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {directParents.length > 0 && (
                <span>↑ {directParents.length} upstream: {directParents.slice(0, 2).map(p => (
                  <button key={p} onClick={() => onNavigate(p)}
                    className="text-indigo-400 hover:text-indigo-300 ml-1 font-mono">{p}</button>
                ))}{directParents.length > 2 && ` +${directParents.length - 2} more`}</span>
              )}
              {directChildren.length > 0 && (
                <span>↓ {directChildren.length} downstream: {directChildren.slice(0, 2).map(c => (
                  <button key={c} onClick={() => onNavigate(c)}
                    className="text-indigo-400 hover:text-indigo-300 ml-1 font-mono">{c}</button>
                ))}{directChildren.length > 2 && ` +${directChildren.length - 2} more`}</span>
              )}
              {directParents.length === 0 && <span className="text-green-600">● root model</span>}
              {directChildren.length === 0 && <span className="text-orange-600">● leaf model</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['description', 'columns', 'sql'] as DocTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-t transition-colors capitalize ${
                tab === t ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {tab === 'description' && (
          <div className="max-w-2xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{meta.description}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Details</h3>
              <table className="text-xs text-gray-400 w-full">
                <tbody>
                  <tr className="border-b border-gray-800"><td className="py-2 pr-8 text-gray-600 w-32">Layer</td><td className="py-2">{LAYER_LABEL[node.layer]}</td></tr>
                  <tr className="border-b border-gray-800"><td className="py-2 pr-8 text-gray-600">Columns</td><td className="py-2">{meta.columns.length}</td></tr>
                  <tr className="border-b border-gray-800"><td className="py-2 pr-8 text-gray-600">Upstream</td><td className="py-2">{directParents.length} direct · {getFullLineage(id).ancestors.length} total</td></tr>
                  <tr><td className="py-2 pr-8 text-gray-600">Downstream</td><td className="py-2">{directChildren.length} direct · {getFullLineage(id).descendants.length} total</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'columns' && (
          <div className="max-w-3xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-left">
                  <th className="pb-2 pr-4 font-medium uppercase tracking-wide w-16">Tests</th>
                  <th className="pb-2 pr-8 font-medium uppercase tracking-wide">Column</th>
                  <th className="pb-2 pr-8 font-medium uppercase tracking-wide w-32">Type</th>
                  <th className="pb-2 font-medium uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody>
                {meta.columns.map(col => (
                  <tr key={col.name} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex gap-1">
                        {col.tests.map(t => (
                          <span key={t} title={BADGE_TITLE[t]}
                            className={`px-1 py-0.5 rounded text-[10px] font-bold leading-none ${BADGE_STYLE[t]}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-8">
                      <span className="font-mono text-gray-200">{col.name}</span>
                    </td>
                    <td className="py-2.5 pr-8 text-gray-500 font-mono">{col.type}</td>
                    <td className="py-2.5 text-gray-500">{col.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-4 mt-4 text-xs text-gray-600">
              {(['P','F','N','U'] as TestBadge[]).map(t => (
                <span key={t} className="flex items-center gap-1">
                  <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${BADGE_STYLE[t]}`}>{t}</span>
                  {BADGE_TITLE[t]}
                </span>
              ))}
            </div>
          </div>
        )}

        {tab === 'sql' && (
          <div className="max-w-3xl">
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
                <span className="text-xs text-gray-500 font-mono">{node.name}.sql</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(meta.sql)}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  Copy
                </button>
              </div>
              <pre className="p-4 text-xs text-green-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">
                {meta.sql}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Floating mini lineage */}
      <MiniLineage
        selectedId={id}
        onExpand={() => setLineageExpanded(true)}
        onNodeClick={onNavigate}
      />

      {/* Full-screen lineage modal */}
      {lineageExpanded && (
        <LineageModal
          selectedId={id}
          onClose={() => setLineageExpanded(false)}
          onNodeClick={id2 => { onNavigate(id2); setLineageExpanded(false); }}
        />
      )}
    </div>
  );
}

// ── Model Tree ─────────────────────────────────────────────────────────────────

function ModelTree({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<Layer>>(new Set());
  const toggle = (l: Layer) => setCollapsed(p => { const s = new Set(p); s.has(l) ? s.delete(l) : s.add(l); return s; });
  const filtered = NODES.filter(n => n.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-60 flex-shrink-0">
      <div className="px-3 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Models</p>
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500" />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {LAYERS.map(layer => {
          const models = filtered.filter(n => n.layer === layer);
          if (!models.length) return null;
          const isCol = collapsed.has(layer);
          return (
            <div key={layer}>
              <button onClick={() => toggle(layer)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 text-left">
                <span className="text-gray-600 text-xs w-2">{isCol ? '▶' : '▼'}</span>
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: LAYER_BORDER[layer] }} />
                <span className="text-xs font-semibold text-gray-300">{LAYER_LABEL[layer]}</span>
                <span className="ml-auto text-xs text-gray-600">{models.length}</span>
              </button>
              {!isCol && models.map(n => (
                <button key={n.id} onClick={() => onSelect(n.id)}
                  className={`w-full flex items-center gap-2 px-4 py-1 text-left hover:bg-gray-800 transition-colors ${selected === n.id ? 'bg-gray-800' : ''}`}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: selected === n.id ? LAYER_BORDER[layer] : '#374151', border: `1px solid ${LAYER_BORDER[layer]}` }} />
                  <span className={`text-xs truncate ${selected === n.id ? 'text-white font-medium' : 'text-gray-400'}`}>
                    {n.name.replace(/^(raw_|src_|core_|analytics_)/, '')}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t border-gray-800">
        <p className="text-xs text-gray-600">{NODES.length} models</p>
      </div>
    </div>
  );
}

// ── AI Chat ────────────────────────────────────────────────────────────────────

function buildContext(id: string) {
  const n = NODE_MAP.get(id);
  if (!n) return '';
  const { ancestors, descendants } = getFullLineage(id);
  const parents  = EDGES_RAW.filter(([, t]) => t === id).map(([s]) => s);
  const children = EDGES_RAW.filter(([s]) => s === id).map(([, t]) => t);
  return [
    `**Model: \`${id}\`** (${LAYER_LABEL[n.layer]} layer)`,
    '',
    parents.length ? `**Direct upstream (${parents.length}):** ${parents.join(', ')}` : '**Upstream:** none — root model',
    children.length ? `**Direct downstream (${children.length}):** ${children.join(', ')}` : '**Downstream:** none — leaf model',
    '',
    `**Full ancestry:** ${ancestors.length ? ancestors.join(', ') : 'none'}`,
    `**Full impact:** ${descendants.length ? descendants.join(', ') : 'none'}`,
    '',
    'How can I help you with this model?',
  ].join('\n');
}

function AiChat({ selectedModelId }: { selectedModelId: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedModelId) return;
    setMessages([{ role: 'assistant', content: buildContext(selectedModelId), ts: Date.now() }]);
  }, [selectedModelId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), ts: Date.now() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_context: selectedModelId ? buildContext(selectedModelId) : null,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(p => [...p, { role: 'assistant', content: data.reply, ts: Date.now() }]);
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: '⚙️ AI provider not configured yet. Connect your AI in Settings to enable chat.', ts: Date.now() }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col w-72 flex-shrink-0 border-l border-gray-800 bg-gray-900">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-400" />
        <p className="text-xs font-semibold text-gray-300">AI Assistant</p>
        {selectedModelId && (
          <span className="ml-auto text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded truncate max-w-[130px]">{selectedModelId}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {!selectedModelId && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-2xl mb-3 opacity-30">⬅</div>
            <p className="text-xs text-gray-600">Select a model from the tree to load its context into the AI conversation.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-300'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-500 animate-pulse">Thinking…</div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 py-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={selectedModelId ? `Ask about ${selectedModelId}…` : 'Select a model first…'}
            disabled={!selectedModelId || loading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-40" />
          <button onClick={send} disabled={!selectedModelId || !input.trim() || loading}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded transition-colors">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Lineage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  return (
    <div className="flex h-full overflow-hidden">
      <ModelTree selected={selectedId} onSelect={handleSelect} />

      <div className="flex-1 flex overflow-hidden">
        {selectedId ? (
          <ModelDocs id={selectedId} onNavigate={handleSelect} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gray-950">
            <div className="text-5xl mb-5 opacity-10">⬡</div>
            <p className="text-gray-600 text-sm font-medium mb-2">No model selected</p>
            <p className="text-gray-700 text-xs max-w-xs">
              Pick a model from the tree on the left to view its documentation, columns, SQL, and lineage.
            </p>
          </div>
        )}
      </div>

      <AiChat selectedModelId={selectedId} />
    </div>
  );
}
