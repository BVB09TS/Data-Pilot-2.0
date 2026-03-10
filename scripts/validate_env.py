import sys, os

def check(label, fn):
    try:
        fn()
        print(f"  OK  {label}")
        return True
    except Exception as e:
        print(f"  FAIL  {label} - {e}")
        return False

print("\n" + "="*45)
print("  DataPilot -- Environment Check")
print("="*45 + "\n")

results = []
results.append(check("Python 3.10+",
    lambda: None if sys.version_info>=(3,10) else (_ for _ in ()).throw(Exception("Need 3.10+"))))
results.append(check("dbt-duckdb",    lambda: __import__("dbt.version")))
results.append(check("DuckDB",        lambda: __import__("duckdb").connect().execute("SELECT 42").fetchone()))
results.append(check("Anthropic SDK", lambda: __import__("anthropic")))
results.append(check("KuzuDB",        lambda: __import__("kuzu")))
results.append(check("NetworkX",      lambda: __import__("networkx")))

def check_key():
    from dotenv import load_dotenv; load_dotenv()
    k = os.getenv("ANTHROPIC_API_KEY","")
    assert k and k != "your_api_key_here", "Not set - open .env and add key"
results.append(check("API key in .env", check_key))

def check_structure():
    for p in ["shopmesh_dbt/dbt_project.yml","shopmesh_dbt/models/raw",
              "shopmesh_dbt/models/source","shopmesh_dbt/models/core",
              "shopmesh_dbt/models/analytics","shopmesh_dbt/macros",
              "shopmesh_dbt/query_history.json","scripts/answer_key.py"]:
        assert os.path.exists(p), f"Missing: {p}"
results.append(check("Project structure", check_structure))

def count_models():
    import glob
    sql = glob.glob("shopmesh_dbt/models/**/*.sql", recursive=True)
    assert len(sql) >= 100, f"Only {len(sql)} SQL files"
    print(f"         {len(sql)} SQL models found")
results.append(check("100+ models", count_models))

print()
passed = sum(results)
total  = len(results)
print(f"  {passed}/{total} passed {'-- ready for Phase 2!' if passed==total else '-- fix FAIL items above'}")
print()
