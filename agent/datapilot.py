# datapilot.py  --  DataPilot agent entry point
# Usage:  python agent/datapilot.py [--project PATH] [--output DIR] [--no-score]
import os, sys, json, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parser   import parse_project, summary as project_summary
from graph    import (build_graph, find_all_dead, find_orphans,
                      find_transitive_orphans, find_broken_refs,
                      graph_summary, export_graph_data)
from analyzer import (get_client,
                      analyze_dead_models, analyze_orphans, analyze_broken_refs,
                      analyze_duplicate_metrics, analyze_grain_joins,
                      analyze_deprecated_sources, analyze_missing_tests,
                      analyze_logic_drift)
from reporter import build_report, score_against_answer_key, print_report


def parse_args():
    p = argparse.ArgumentParser(
        description="DataPilot — AI-powered dbt project auditor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  python agent/datapilot.py\n"
               "  python agent/datapilot.py --project ./my_dbt_project\n"
               "  python agent/datapilot.py --project ./shopmesh_dbt --output ./reports\n"
    )
    p.add_argument("--project", "-p", default=None,
                   help="Path to dbt project root (default: shopmesh_dbt)")
    p.add_argument("--output", "-o", default=None,
                   help="Output directory for reports (default: project parent)")
    p.add_argument("--no-score", action="store_true",
                   help="Skip scoring against answer key")
    p.add_argument("--serve", action="store_true",
                   help="Start the interactive web UI after generating reports")
    p.add_argument("--port", type=int, default=5000,
                   help="Port for the web UI (default: 5000)")
    return p.parse_args()


def main():
    import warnings
    warnings.warn(
        "agent/datapilot.py is DEPRECATED. Use 'datapilot audit' instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    print("\n  [DEPRECATED] Use 'datapilot audit' instead of 'python agent/datapilot.py'\n")

    args = parse_args()

    ROOT        = os.path.dirname(os.path.abspath(__file__))
    DBT_ROOT    = args.project or os.path.join(ROOT, "..", "shopmesh_dbt")
    DBT_ROOT    = os.path.abspath(DBT_ROOT)
    SCRIPTS_DIR = os.path.join(ROOT, "..", "scripts")
    ANSWER_KEY  = os.path.join(SCRIPTS_DIR, "answer_key.py")
    OUT_DIR     = args.output or os.path.join(ROOT, "..")
    OUT_DIR     = os.path.abspath(OUT_DIR)

    os.makedirs(OUT_DIR, exist_ok=True)

    print()
    print("=" * 58)
    print("  DataPilot  --  dbt Audit Agent  v1.0")
    print("=" * 58)
    print(f"  Project : {DBT_ROOT}")
    print(f"  Output  : {OUT_DIR}")

    # ── 1. Parse ──────────────────────────────────────────────
    print("\n[1/5] Parsing dbt project...")
    project = parse_project(DBT_ROOT)
    print(project_summary(project))
    models        = project["models"]
    query_history = project["query_history"]
    cost_waste    = project["cost_waste"]

    # ── 2. Build graph ────────────────────────────────────────
    print("\n[2/5] Building lineage graph...")
    G = build_graph(project)
    print(graph_summary(G, models))

    # ── 3. Static analysis ────────────────────────────────────
    print("\n[3/5] Static analysis...")
    dead_list        = find_all_dead(G, models, query_history)
    orphan_list      = find_orphans(G, models)
    broken_list      = find_broken_refs(G, models)
    transitive_orph  = find_transitive_orphans(G, models, orphan_list, dead_list)

    print(f"  dead={len(dead_list)}, orphans={len(orphan_list)}, "
          f"transitive_orphans={len(transitive_orph)}, broken_refs={len(broken_list)}")

    # ── 4. LLM analysis ───────────────────────────────────────
    print("\n[4/5] LLM analysis...")
    client = get_client()

    print("  -> dead models...")
    dead_f    = analyze_dead_models(client, dead_list, cost_waste, query_history, models)

    print("  -> orphaned models...")
    orphan_f  = analyze_orphans(client, orphan_list, transitive_orph, models)

    print("  -> broken lineage...")
    broken_f  = analyze_broken_refs(client, broken_list, models)

    print("  -> duplicate metrics...")
    dup_f     = analyze_duplicate_metrics(client, models)

    print("  -> grain joins...")
    grain_f   = analyze_grain_joins(client, models)

    print("  -> deprecated sources...")
    dep_f     = analyze_deprecated_sources(client, models)

    print("  -> missing tests (deterministic)...")
    test_f    = analyze_missing_tests(models)

    print("  -> logic drift...")
    drift_f   = analyze_logic_drift(client, models)

    findings = {
        "dead_models":       dead_f,
        "orphans":           orphan_f,
        "broken_refs":       broken_f,
        "duplicate_metrics": dup_f,
        "grain_joins":       grain_f,
        "deprecated":        dep_f,
        "missing_tests":     test_f,
        "logic_drift":       drift_f,
    }

    # ── 5. Report ─────────────────────────────────────────────
    print("\n[5/5] Building reports...")
    report = build_report(findings, cost_waste, models)

    score = None
    if not args.no_score and os.path.exists(ANSWER_KEY):
        score = score_against_answer_key(report, ANSWER_KEY)

    print_report(report, score)

    # Export graph data for web UI
    graph_data = export_graph_data(G, models, report["findings"])

    # Save JSON
    json_path = os.path.join(OUT_DIR, "datapilot_report.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"report": report, "score": score, "graph": graph_data},
                  f, indent=2, default=str)
    print(f"  JSON  -> {json_path}")

    # Save graph data separately for web UI
    graph_path = os.path.join(OUT_DIR, "datapilot_graph.json")
    with open(graph_path, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, indent=2, default=str)
    print(f"  Graph -> {graph_path}")

    print()

    # Optionally start web UI
    if args.serve:
        print("  Starting web UI...")
        from web.app import create_app
        app = create_app(json_path, graph_path)
        app.run(host="0.0.0.0", port=args.port, debug=False)


if __name__ == "__main__":
    main()
