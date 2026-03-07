"""Lineage graph with full orphan/dead/broken detection.

Enhanced from v1 with structured logging and better typing.
"""

from __future__ import annotations

from typing import Any

import networkx as nx
import structlog

from datapilot.integrations.github_actions.parser import parse_github_actions

logger = structlog.get_logger()


def build_graph(project: dict) -> nx.DiGraph:
    """Build a directed lineage graph from parsed project data."""
    models = project["models"]
    query_history = project["query_history"]
    G = nx.DiGraph()

    for name, m in models.items():
        qh = query_history.get(name, {})
        G.add_node(
            name,
            layer=m["layer"],
            path=m["path"],
            refs=m["refs"],
            sources=m["sources"],
            columns=m["columns"],
            planted=m["planted"],
            query_count_30d=qh.get("query_count_30d"),
            query_count_90d=qh.get("query_count_90d"),
            last_queried_at=qh.get("last_queried_at"),
            qh_note=qh.get("note"),
        )

    for name, m in models.items():
        for ref in m["refs"]:
            if ref in models:
                G.add_edge(ref, name)
            else:
                if not G.has_node(ref):
                    G.add_node(
                        ref,
                        layer="MISSING",
                        path=None,
                        refs=[],
                        sources=[],
                        columns=[],
                        planted=None,
                        query_count_30d=None,
                        query_count_90d=None,
                        last_queried_at=None,
                        qh_note="MISSING MODEL",
                    )
                G.add_edge(ref, name)

    logger.info("graph_built", nodes=G.number_of_nodes(), edges=G.number_of_edges())
    return G


def find_dead_models(G: nx.DiGraph, models: dict) -> list[str]:
    """Find models with zero queries in 90 days."""
    return [
        n
        for n in G.nodes
        if n in models and G.nodes[n].get("query_count_90d") == 0
    ]


def _deprecated_set(models: dict) -> set[str]:
    """Find all models that are deprecated or in a legacy chain."""
    result: set[str] = set()
    for name, m in models.items():
        sql = m.get("sql", "").lower()
        p = (m.get("planted") or "").lower()
        yml_desc = ""
        for mod_def in m.get("yml", {}).get("models", []):
            if mod_def.get("name") == name:
                yml_desc = (mod_def.get("description") or "").lower()
                break
        if "legacy_erp" in sql or "deprecated" in p or "deprecated" in sql or "deprecated" in yml_desc:
            result.add(name)
    return result


def find_all_dead(G: nx.DiGraph, models: dict, query_history: dict) -> list[str]:
    """Dead = zero q90 OR (very low q90 + clearly deprecated)."""
    dep = _deprecated_set(models)
    dead = set(find_dead_models(G, models))
    for name in models:
        qh = query_history.get(name, {})
        q90 = qh.get("query_count_90d")
        if q90 is not None and q90 <= 6 and name in dep:
            dead.add(name)
    return list(dead)


def find_orphans(G: nx.DiGraph, models: dict) -> list[str]:
    """Models with no downstream consumers (excludes analytics layer)."""
    return [
        n
        for n in G.nodes
        if n in models and G.nodes[n].get("layer") != "analytics" and G.out_degree(n) == 0
    ]


def find_transitive_orphans(
    G: nx.DiGraph, models: dict, true_orphans: list[str], dead: list[str]
) -> list[str]:
    """Models whose only downstream consumers are themselves orphaned or dead."""
    bad = set(true_orphans) | set(dead)
    result = []
    for node in G.nodes:
        if node not in models:
            continue
        if G.nodes[node].get("layer") == "analytics":
            continue
        if node in true_orphans:
            continue
        consumers = list(G.successors(node))
        if not consumers:
            continue
        if all(c in bad for c in consumers):
            result.append(node)
    return result


def find_broken_refs(G: nx.DiGraph, models: dict) -> list[dict]:
    """Find models referencing non-existent models."""
    broken = []
    for node in G.nodes:
        if node not in models:
            continue
        for ref in models[node]["refs"]:
            if ref not in models:
                broken.append({"model": node, "missing_ref": ref})
    return broken


def export_graph_data(G: nx.DiGraph, models: dict, findings: list[dict]) -> dict:
    """Export graph as JSON-serializable data for the web UI."""
    problem_models = {f.get("model", "") for f in findings}

    nodes = []
    for node in G.nodes:
        if node not in models:
            continue
        data = G.nodes[node]
        nodes.append(
            {
                "id": node,
                "layer": data.get("layer", "unknown"),
                "has_problem": node in problem_models,
                "q30": data.get("query_count_30d"),
                "q90": data.get("query_count_90d"),
            }
        )

    edges = []
    for src, tgt in G.edges:
        if src in models and tgt in models:
            edges.append({"source": src, "target": tgt})

    return {"nodes": nodes, "edges": edges}


def graph_summary(G: nx.DiGraph, models: dict) -> str:
    """Return a human-readable graph summary."""
    phantom = G.number_of_nodes() - len(models)
    orphans = find_orphans(G, models)
    dead = find_dead_models(G, models)
    broken = find_broken_refs(G, models)
    return "\n".join(
        [
            f"  Nodes : {G.number_of_nodes()} ({len(models)} models + {phantom} phantom/missing)",
            f"  Edges : {G.number_of_edges()}",
            f"  Orphaned models   : {len(orphans)}",
            f"  Dead (0 q/90d)    : {len(dead)}",
            f"  Broken refs       : {len(broken)}",
        ]
    )
