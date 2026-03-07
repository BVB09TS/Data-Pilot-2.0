"""Core remediator for auto-fixing issues found by DataPilot."""

import os
from pathlib import Path
import structlog
import shutil

logger = structlog.get_logger()

def apply_fixes(report: dict, dbt_root: str) -> dict:
    """Auto-remediate issues like dead models by directly applying changes."""
    fixes_applied = 0
    errors = 0
    actions_taken = []
    
    findings = report.get("findings", [])
    
    # We only auto-fix dead models and orphaned models for now
    for finding in findings:
        issue = finding.get("type", finding.get("issue"))
        model = finding.get("model")
        
        if not model:
            continue
            
        if issue == "dead_model":
            # Attempt to delete the .sql file and the .yml file for this model
            try:
                # Find the actual path by walking the models dir
                models_dir = Path(dbt_root) / "models"
                if not models_dir.exists():
                    logger.warning("fix_failed_no_models_dir", dir=str(models_dir))
                    continue
                    
                sql_path = None
                yml_path = None
                
                # We do a naive search for the exact model name .sql and .yml
                for root, _, files in os.walk(models_dir):
                    root_path = Path(root)
                    if f"{model}.sql" in files:
                        sql_path = root_path / f"{model}.sql"
                    if f"{model}.yml" in files:
                        yml_path = root_path / f"{model}.yml"
                
                # Only delete if we found the SQL file safely
                if sql_path and sql_path.exists():
                    # Move to a "trash/deprecations" folder instead of hard delete for safety
                    trash_dir = Path(dbt_root) / ".datapilot_trash"
                    trash_dir.mkdir(exist_ok=True)
                    
                    shutil.move(str(sql_path), str(trash_dir / f"{model}.sql"))
                    if yml_path and yml_path.exists():
                        shutil.move(str(yml_path), str(trash_dir / f"{model}.yml"))
                        
                    fixes_applied += 1
                    actions_taken.append({
                        "model": model, 
                        "action": "deprecated_dead_model",
                        "status": "success",
                        "moved_to": str(trash_dir)
                    })
                    logger.info("auto_remediated_dead_model", model=model)
            except Exception as e:
                errors += 1
                actions_taken.append({
                    "model": model, 
                    "action": "deprecated_dead_model",
                    "status": "error",
                    "error": str(e)
                })
                logger.error("fix_failed", model=model, error=str(e))
                
    return {
        "fixes_applied": fixes_applied,
        "errors": errors,
        "actions_taken": actions_taken
    }
