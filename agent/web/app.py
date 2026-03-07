# web/app.py  --  Flask interactive dashboard for DataPilot
import os, json
from flask import Flask, render_template, jsonify, send_from_directory


def create_app(report_path: str = None, graph_path: str = None):
    root = os.path.dirname(os.path.abspath(__file__))
    app = Flask(__name__,
                template_folder=os.path.join(root, "templates"),
                static_folder=os.path.join(root, "static"))

    # Defaults
    base = os.path.join(root, "..", "..")
    report_path = report_path or os.path.join(base, "datapilot_report.json")
    graph_path  = graph_path  or os.path.join(base, "datapilot_graph.json")

    def _load_json(path):
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        return {}

    @app.route("/")
    def index():
        return render_template("dashboard.html")

    @app.route("/api/report")
    def api_report():
        data = _load_json(report_path)
        return jsonify(data)

    @app.route("/api/graph")
    def api_graph():
        data = _load_json(graph_path)
        return jsonify(data)

    return app


def main():
    """Standalone entry point: python -m web.app"""
    import argparse
    p = argparse.ArgumentParser(description="DataPilot Web Dashboard")
    p.add_argument("--port", type=int, default=5000)
    p.add_argument("--report", default=None, help="Path to datapilot_report.json")
    p.add_argument("--graph",  default=None, help="Path to datapilot_graph.json")
    args = p.parse_args()
    app = create_app(args.report, args.graph)
    print(f"\n  DataPilot Dashboard running at http://localhost:{args.port}\n")
    app.run(host="0.0.0.0", port=args.port, debug=True)


if __name__ == "__main__":
    main()
