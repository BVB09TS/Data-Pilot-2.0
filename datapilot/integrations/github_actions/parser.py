"""Parser for GitHub Actions workflows to extract dbt execution steps."""

import os
import yaml
from pathlib import Path
import re
import structlog

logger = structlog.get_logger()


def parse_github_actions(dbt_project_root: str) -> list[dict]:
    """Parse .github/workflows/*.yml files to find dbt run commands."""
    
    # GitHub workflows are usually at the repo root, up one from the dbt project
    # Assumes the typical structure: repo/.github/workflows/ and repo/dbt_project/
    repo_root = Path(dbt_project_root).parent
    workflows_dir = repo_root / ".github" / "workflows"
    
    if not workflows_dir.exists():
        logger.debug("no_github_actions_found", path=str(workflows_dir))
        return []

    actions = []
    
    for filename in os.listdir(workflows_dir):
        if not filename.endswith((".yml", ".yaml")):
            continue
            
        filepath = workflows_dir / filename
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = yaml.safe_load(f)
                
                if not content or not isinstance(content, dict):
                    continue
                    
                workflow_name = content.get("name", filename)
                jobs = content.get("jobs", {})
                
                for job_name, job_def in jobs.items():
                    steps = job_def.get("steps", [])
                    dbt_models_run = []
                    
                    for step in steps:
                        run_cmd = step.get("run", "")
                        if "dbt run" in run_cmd or "dbt build" in run_cmd:
                            # Extract model names from --select or -s
                            # e.g. dbt run --select core_orders +analytics_revenue
                            match = re.search(r"(?:--select|-s)\s+([a-zA-Z0-9_+ ]+)", run_cmd)
                            if match:
                                models_str = match.group(1).strip()
                                # split by space and remove + modifiers
                                targets = [m.replace("+", "") for m in models_str.split()]
                                dbt_models_run.extend(targets)
                            elif "dbt run" in run_cmd and "--select" not in run_cmd:
                                # Runs everything
                                dbt_models_run.append("ALL_MODELS")
                                
                    if dbt_models_run:
                        actions.append({
                            "workflow_file": filename,
                            "workflow_name": workflow_name,
                            "job_name": job_name,
                            "runs_models": list(set(dbt_models_run)),
                            "type": "github_action"
                        })
                        
        except Exception as e:
            logger.warning("github_action_parse_failed", file=filename, error=str(e))

    return actions
