PLANTED_PROBLEMS = [
    # DEAD MODELS (7)
    {"id":"DEAD-001","type":"dead_model","model":"analytics_seller_dashboard_v1","cost_usd":22},
    {"id":"DEAD-002","type":"dead_model","model":"analytics_seller_dashboard_v2","cost_usd":22},
    {"id":"DEAD-003","type":"dead_model","model":"analytics_legacy_kpis","cost_usd":15},
    {"id":"DEAD-004","type":"dead_model","model":"analytics_cac_analysis","cost_usd":18},
    {"id":"DEAD-005","type":"dead_model","model":"analytics_inventory_legacy","cost_usd":31},
    {"id":"DEAD-006","type":"dead_model","model":"analytics_churn_risk","cost_usd":28},
    {"id":"DEAD-007","type":"dead_model","model":"core_inventory_legacy","cost_usd":12},
    # BROKEN LINEAGE (2)
    {"id":"BROKEN-001","type":"broken_lineage","model":"core_seller_metrics","reason":"ref src_shopify_sellers does not exist"},
    {"id":"BROKEN-002","type":"broken_lineage","model":"src_shopify_gift_cards_v2","reason":"shopify.gift_cards source never configured"},
    # LOGIC DRIFT (1)
    {"id":"DRIFT-001","type":"logic_drift","model":"src_orders_v2","reason":"duplicate of src_shopify_orders with different column names"},
    # DEPRECATED SOURCES (3)
    {"id":"DEPRECATED-001","type":"deprecated_source","model":"src_erp_products","source":"legacy_erp"},
    {"id":"DEPRECATED-002","type":"deprecated_source","model":"src_erp_warehouses","source":"legacy_erp"},
    {"id":"DEPRECATED-003","type":"deprecated_chain","model":"analytics_inventory_legacy","chain":"analytics_inventory_legacy->core_inventory_legacy->src_erp_products->legacy_erp"},
    # DUPLICATE METRICS (2)
    {"id":"DUPLICATE-001","type":"duplicate_metric","metric":"total_revenue",
     "models":["core_revenue_summary","analytics_revenue_v1","analytics_revenue_v2","analytics_executive_kpis"],
     "definitions":{"core_revenue_summary":"net only","analytics_revenue_v1":"gross only","analytics_revenue_v2":"gross+subs (inflated)","analytics_executive_kpis":"net+subs"}},
    {"id":"DUPLICATE-002","type":"redundant_model","model":"src_orders_v2","superseded_by":"src_shopify_orders"},
    # ORPHANED (6)
    {"id":"ORPHAN-001","type":"orphaned_model","model":"core_coupon_analysis"},
    {"id":"ORPHAN-002","type":"orphaned_model","model":"core_experimental_ltv"},
    {"id":"ORPHAN-003","type":"orphaned_model","model":"raw_mobile_sessions"},
    {"id":"ORPHAN-004","type":"orphaned_model","model":"raw_shopify_gift_cards"},
    {"id":"ORPHAN-005","type":"orphaned_model","model":"src_erp_products"},
    {"id":"ORPHAN-006","type":"orphaned_model","model":"src_erp_warehouses"},
    # WRONG GRAIN JOIN (1)
    {"id":"GRAIN-001","type":"wrong_grain_join","model":"core_revenue_combined",
     "description":"DAILY joined to MONTHLY causes subscription_revenue ~30x inflation. Cascades to analytics_revenue_v2."},
    # MISSING TESTS (4)
    {"id":"TEST-001","type":"missing_tests","model":"core_orders","severity":"critical","missing":["unique+not_null on order_id"]},
    {"id":"TEST-002","type":"missing_tests","model":"core_customers","severity":"critical","missing":["uniqueness tests"]},
    {"id":"TEST-003","type":"missing_tests","model":"core_revenue_summary","severity":"high","missing":["uniqueness on revenue_month"]},
    {"id":"TEST-004","type":"missing_tests","model":"core_revenue_combined","severity":"high","missing":["row count assertion to catch grain fan-out"]},
]

TOTAL = len(PLANTED_PROBLEMS)
PASS_THRESHOLD = 0.70

if __name__ == "__main__":
    from collections import Counter
    print(f"Total planted problems: {TOTAL}")
    print(f"Pass = 70% = {int(TOTAL * 0.7)} problems")
    print()
    for t, c in Counter(p["type"] for p in PLANTED_PROBLEMS).most_common():
        print(f"  {t}: {c}")
    waste = sum(p.get("cost_usd",0) for p in PLANTED_PROBLEMS if p["type"]=="dead_model")
    print(f"\nWasted spend (dead models): ${waste}/month")
