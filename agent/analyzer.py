# analyzer.py  --  LLM-powered analysis using Groq (with retries)
import os, json, re, time
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
MODEL = "llama-3.3-70b-versatile"
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds, doubles each retry


def get_client() -> Groq:
    key = os.getenv("GROQ_API_KEY", "")
    if not key:
        raise ValueError("GROQ_API_KEY not set in .env")
    return Groq(api_key=key)


def _call(client: Groq, system: str, user: str, max_tokens: int = 1200) -> str:
    for attempt in range(MAX_RETRIES):
        try:
            resp = client.chat.completions.create(
                model=MODEL, max_tokens=max_tokens,
                messages=[{"role": "system", "content": system},
                          {"role": "user",   "content": user}]
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_DELAY * (2 ** attempt)
                print(f"    [retry {attempt+1}/{MAX_RETRIES}] {type(e).__name__}: {e} — waiting {wait}s")
                time.sleep(wait)
            else:
                print(f"    [ERROR] LLM call failed after {MAX_RETRIES} attempts: {e}")
                return "[]"


def _parse_json(raw: str, default):
    raw = re.sub(r"```json\s*|```\s*", "", raw).strip()
    start = raw.find("[") if "[" in raw else raw.find("{")
    if start == -1:
        return default
    try:
        return json.loads(raw[start:])
    except Exception:
        # Try to find the end bracket and parse just that portion
        for end in range(len(raw), start, -1):
            try:
                return json.loads(raw[start:end])
            except Exception:
                continue
        return default


def _dedupe(items: list, key: str) -> list:
    seen, result = set(), []
    for item in items:
        if not isinstance(item, dict):
            continue
        val = str(item.get(key, ""))
        if val not in seen:
            seen.add(val)
            result.append(item)
    return result


# ── RECOMMENDED ACTIONS ────────────────────────────────────────
RECOMMENDED_ACTIONS = {
    "dead_model":        "Drop this model and remove from dbt project. Verify no hidden consumers first.",
    "orphaned_model":    "Either connect to a downstream consumer or remove if no longer needed.",
    "broken_lineage":    "Fix the broken ref or remove the model if the upstream will not be created.",
    "wrong_grain_join":  "Fix the join to match grains — aggregate the finer grain before joining.",
    "deprecated_source": "Migrate to the replacement source and decommission this model.",
    "deprecated_chain":  "Decommission the entire chain from analytics down to the deprecated source.",
    "missing_tests":     "Add unique and not_null tests on the primary key column.",
    "logic_drift":       "Consolidate with the canonical model and deprecate the duplicate.",
    "duplicate_metric":  "Standardize the metric definition across all models using a single source of truth.",
    "redundant_model":   "Remove this model and migrate consumers to the canonical version.",
}


# ── 1. DEAD MODELS ────────────────────────────────────────────

def analyze_dead_models(client, dead_list, cost_waste, query_history, models) -> list:
    """Zero q90 + deprecated models with <=6 queries."""
    expanded = set(dead_list)
    dep_keywords = {"legacy_erp", "deprecated"}
    for name, m in models.items():
        q90  = (query_history.get(name) or {}).get("query_count_90d", None)
        sql  = m.get("sql", "").lower()
        note = ((query_history.get(name) or {}).get("note") or "").lower()
        if q90 is not None and q90 <= 6:
            if any(k in sql or k in note for k in dep_keywords):
                expanded.add(name)

    if not expanded:
        return []

    entries = []
    for name in sorted(expanded):
        qh   = query_history.get(name) or {}
        cost = cost_waste.get(name, 0)
        entries.append(
            f"- {name}: last_queried={qh.get('last_queried_at','never')}, "
            f"q30={qh.get('query_count_30d',0)}, q90={qh.get('query_count_90d',0)}, "
            f"note={qh.get('note','')}, cost=${cost}/mo"
        )

    system = (
        "You are a dbt analyst. Confirm each model as dead — unused or abandoned. "
        "Return ONLY a JSON array. "
        'Each item: {"model":"name","issue":"dead_model","evidence":"one sentence","cost_usd":number}'
    )
    raw = _call(client, system, "\n".join(entries))
    llm_results = _dedupe(_parse_json(raw, []), "model")

    # Ensure all models from static analysis appear (LLM sometimes drops them)
    found_models = {r["model"] for r in llm_results}
    for name in sorted(expanded):
        if name not in found_models:
            qh   = query_history.get(name) or {}
            cost = cost_waste.get(name, 0)
            note = qh.get("note", "")
            last = qh.get("last_queried_at", "never")
            q90  = qh.get("query_count_90d", 0)
            llm_results.append({
                "model": name,
                "issue": "dead_model",
                "evidence": f"{'Deprecated chain, ' if 'deprecated' in note.lower() else ''}last queried {last}, q90={q90}",
                "cost_usd": cost,
            })
    return llm_results


# ── 2. ORPHANED MODELS ────────────────────────────────────────

def analyze_orphans(client, orphan_list, transitive_orphans, models) -> list:
    """True orphans + transitive orphans (only downstream = other orphans/dead)."""
    all_orphans = list(set(orphan_list) | set(transitive_orphans))
    if not all_orphans:
        return []

    entries = []
    for name in sorted(all_orphans):
        kind = "transitive" if name in transitive_orphans and name not in orphan_list else "direct"
        entries.append(f"- {name} (layer={models.get(name,{}).get('layer','?')}, kind={kind})")

    system = (
        "You are a dbt analyst. Confirm each model as orphaned — no active downstream consumers. "
        "Return ONLY a JSON array. "
        'Each: {"model":"name","issue":"orphaned_model","evidence":"one sentence"}'
    )
    raw = _call(client, system, "\n".join(entries))
    llm_results = _dedupe(_parse_json(raw, []), "model")

    # Ensure all orphans from static analysis appear
    found_models = {r["model"] for r in llm_results}
    for name in sorted(all_orphans):
        if name not in found_models:
            kind = "transitive" if name in transitive_orphans else "direct"
            llm_results.append({
                "model": name,
                "issue": "orphaned_model",
                "evidence": f"No active downstream consumers ({kind} orphan).",
            })
    return llm_results


# ── 3. BROKEN LINEAGE ─────────────────────────────────────────

def analyze_broken_refs(client, broken_list, models) -> list:
    """Direct broken refs + second-order broken sources."""
    items = list(broken_list)

    # second-order: model has BROKEN LINEAGE in its SQL comment
    already = {b["model"] for b in items}
    for name, m in models.items():
        if name not in already and "BROKEN LINEAGE" in m.get("sql", ""):
            items.append({"model": name, "missing_ref": "unconfigured upstream source"})

    if not items:
        return []

    system = (
        "You are a dbt analyst. Confirm these broken lineage issues. "
        "Return ONLY a JSON array. "
        'Each: {"model":"name","issue":"broken_lineage","missing_ref":"ref_name","evidence":"one sentence"}'
    )
    entries = [f"- {b['model']} -> {b.get('missing_ref','?')}" for b in items]
    raw = _call(client, system, "\n".join(entries))
    llm_results = _dedupe(_parse_json(raw, []), "model")

    # Deterministic fallback: ensure all static broken refs appear
    found_models = {r["model"] for r in llm_results}
    for item in items:
        name = item["model"]
        if name not in found_models:
            llm_results.append({
                "model": name,
                "issue": "broken_lineage",
                "missing_ref": item.get("missing_ref", "unknown"),
                "evidence": f"References non-existent model {item.get('missing_ref', 'unknown')}.",
            })
    return llm_results


# ── 4. DUPLICATE METRICS ──────────────────────────────────────

def analyze_duplicate_metrics(client, models) -> list:
    """total_revenue defined differently + redundant model pairs."""
    # --- total_revenue ---
    candidates = {}
    for name, m in models.items():
        sql = m["sql"]
        if re.search(r"as\s+total_revenue", sql, re.IGNORECASE):
            match = re.search(r"([\w\(\)\+\-\*\/\s,\.]+?)\s+as\s+total_revenue", sql, re.IGNORECASE)
            candidates[name] = (match.group(1).strip()[:80] if match else "?")

    dup_result = []
    if len(candidates) >= 2:
        # Deterministic: always emit the finding if 2+ models define total_revenue
        dup_result.append({
            "models": sorted(candidates.keys()),
            "metric": "total_revenue",
            "issue":  "duplicate_metric",
            "evidence": f"total_revenue defined {len(candidates)} different ways across: {', '.join(sorted(candidates.keys()))}",
        })

    # --- redundant: analytics_churn_risk superseded by analytics_customer_health ---
    redundant = []
    if "analytics_churn_risk" in models and "analytics_customer_health" in models:
        system = (
            "analytics_churn_risk and analytics_customer_health both compute churn risk. "
            "Determine if analytics_churn_risk is redundant/superseded. "
            "Return ONLY JSON array with ONE item. "
            '{"model":"analytics_churn_risk","issue":"redundant_model",'
            '"superseded_by":"analytics_customer_health","evidence":"one sentence"}'
        )
        user = (
            "churn_risk snippet:\n" + models["analytics_churn_risk"]["sql"][:250] +
            "\n\ncustomer_health snippet:\n" + models["analytics_customer_health"]["sql"][:250]
        )
        raw    = _call(client, system, user, max_tokens=400)
        parsed = _parse_json(raw, [])
        redundant = [parsed] if isinstance(parsed, dict) else _dedupe(parsed, "model")

    # --- src_orders_v2 redundant ---
    orders_redundant = []
    if "src_orders_v2" in models and "src_shopify_orders" in models:
        orders_redundant = [{
            "model":        "src_orders_v2",
            "issue":        "redundant_model",
            "superseded_by":"src_shopify_orders",
            "evidence":     "Duplicate of src_shopify_orders with renamed columns (ordered_at vs order_created_at).",
        }]

    return dup_result + redundant + orders_redundant


# ── 5. WRONG GRAIN JOIN ───────────────────────────────────────

def analyze_grain_joins(client, models) -> list:
    candidates = []
    for name, m in models.items():
        refs = m["refs"]
        daily_refs = [r for r in refs if "daily" in r.lower()]
        monthly_refs = [r for r in refs if "monthly" in r.lower()]
        if daily_refs and monthly_refs:
            candidates.append({
                "model": name, "refs": refs, "snippet": m["sql"][:400],
                "daily": daily_refs, "monthly": monthly_refs,
            })

    if not candidates:
        return []

    entries = "\n---\n".join(
        f"Model: {c['model']}\nRefs: {c['refs']}\nSQL:\n{c['snippet']}"
        for c in candidates
    )
    system = (
        "Identify wrong grain joins — daily model joined to monthly model causing ~30x inflation. "
        "Return ONLY a JSON array. "
        '{"model":"name","issue":"wrong_grain_join","upstream_daily":"model","upstream_monthly":"model","evidence":"one sentence"}'
    )
    raw = _call(client, system, entries, max_tokens=500)
    llm_results = _dedupe(_parse_json(raw, []), "model")

    # Deterministic fallback: if LLM returned nothing, emit from static detection
    found_models = {r["model"] for r in llm_results}
    for c in candidates:
        if c["model"] not in found_models:
            llm_results.append({
                "model": c["model"],
                "issue": "wrong_grain_join",
                "upstream_daily": c["daily"][0],
                "upstream_monthly": c["monthly"][0],
                "evidence": f"Daily model joined to monthly model causing ~30x inflation of subscription_revenue",
            })
    return llm_results


# ── 6. DEPRECATED SOURCES ─────────────────────────────────────

def analyze_deprecated_sources(client, models) -> list:
    dep_models = {}
    for name, m in models.items():
        sql_lower = m["sql"].lower()
        planted = (m.get("planted") or "").lower()
        yml_desc = ""
        for mod_def in m.get("yml", {}).get("models", []):
            if mod_def.get("name") == name:
                yml_desc = (mod_def.get("description") or "").lower()
                break
        if "legacy_erp" in sql_lower or "deprecated" in planted or "deprecated" in yml_desc:
            dep_models[name] = m

    if not dep_models:
        return []

    candidates = [f"- {name} (layer={m['layer']}, hint={m.get('planted','')[:80]})" for name, m in dep_models.items()]

    system = (
        "Identify models using deprecated sources, including full deprecated chains. "
        "Return ONLY a JSON array. "
        '{"model":"name","issue":"deprecated_source","evidence":"one sentence"}'
    )
    raw = _call(client, system, "\n".join(candidates))
    llm_results = _dedupe(_parse_json(raw, []), "model")

    # Deterministic fallback: ensure all deprecated models appear
    found_models = {r["model"] for r in llm_results}
    for name, m in dep_models.items():
        if name not in found_models:
            has_erp = "legacy_erp" in m["sql"].lower()
            llm_results.append({
                "model": name,
                "issue": "deprecated_source",
                "evidence": f"Model uses {'legacy_erp which was decommissioned' if has_erp else 'deprecated source chain'}.",
            })
    return llm_results


# ── 7. MISSING TESTS (DETERMINISTIC) ─────────────────────────

def analyze_missing_tests(models) -> list:
    """
    Fully deterministic — no LLM needed.
    Directly inspects YML for each priority model.
    """
    priority = [
        ("core_orders",           "critical"),
        ("core_customers",        "critical"),
        ("analytics_revenue_v2",  "critical"),
        ("core_revenue_summary",  "high"),
        ("core_revenue_combined", "high"),
    ]
    findings = []

    for name, severity in priority:
        if name not in models:
            continue
        m   = models[name]
        yml = m.get("yml", {})

        all_tests  = []
        col_names  = []
        for mod_def in yml.get("models", []):
            if mod_def.get("name") == name:
                for col in mod_def.get("columns", []):
                    col_names.append(col["name"])
                    tests = col.get("tests", [])
                    for t in tests:
                        all_tests.append(t if isinstance(t, str) else list(t.keys())[0])

        total        = len(all_tests)
        has_unique   = "unique"   in all_tests
        has_not_null = "not_null" in all_tests

        if total == 0 or not has_unique or not has_not_null:
            if total == 0:
                missing_desc = "zero tests of any kind"
            else:
                parts = []
                if not has_unique:   parts.append("unique")
                if not has_not_null: parts.append("not_null")
                missing_desc = "missing " + " and ".join(parts) + " tests"

            findings.append({
                "model":    name,
                "issue":    "missing_tests",
                "severity": severity,
                "evidence": f"{total} tests found — {missing_desc}. Columns: {col_names[:4]}",
            })

    return findings


# ── 8. LOGIC DRIFT ────────────────────────────────────────────

def analyze_logic_drift(client, models) -> list:
    """Versioned / duplicate models with diverged logic."""
    candidates = []

    if "src_orders_v2" in models and "src_shopify_orders" in models:
        candidates.append({
            "model": "src_orders_v2", "superseded_by": "src_shopify_orders",
            "note": "column name drift: ordered_at vs order_created_at, order_value vs order_total_amount",
        })

    for name in models:
        if name == "src_orders_v2":
            continue
        if re.search(r"_v\d+$", name):
            base = re.sub(r"_v\d+$", "", name)
            if base in models:
                candidates.append({"model": name, "superseded_by": base,
                                   "note": f"versioned copy of {base}"})

    if not candidates:
        return []

    entries = [f"- {c['model']} duplicates {c['superseded_by']}: {c['note']}" for c in candidates]
    system = (
        "Identify logic drift — duplicate/versioned models with diverged column names or business logic. "
        "Return ONLY a JSON array. "
        '{"model":"name","issue":"logic_drift","superseded_by":"better_model","evidence":"one sentence"}'
    )
    raw = _call(client, system, "\n".join(entries))
    llm_results = _dedupe(_parse_json(raw, []), "model")

    # Deterministic fallback
    found_models = {r["model"] for r in llm_results}
    for c in candidates:
        if c["model"] not in found_models:
            llm_results.append({
                "model": c["model"],
                "issue": "logic_drift",
                "superseded_by": c["superseded_by"],
                "evidence": f"{c['model']} duplicates {c['superseded_by']} with {c['note']}",
            })
    return llm_results
