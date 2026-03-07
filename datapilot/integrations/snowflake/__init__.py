"""Snowflake integration — query metadata and publish findings."""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


class SnowflakeIntegration(Integration):
    """Connect to Snowflake for metadata enrichment and result publishing."""

    def __init__(
        self,
        account: str = "",
        warehouse: str = "",
        database: str = "",
        schema: str = "DATAPILOT",
        role: str = "",
    ):
        self._account = account
        self._warehouse = warehouse
        self._database = database
        self._schema = schema
        self._role = role

    @property
    def name(self) -> str:
        return "Snowflake"

    @property
    def platform(self) -> str:
        return "snowflake"

    def is_configured(self) -> bool:
        return bool(self._account and self._warehouse and self._database)

    def _get_connection(self) -> Any:
        """Create a Snowflake connection."""
        import snowflake.connector

        return snowflake.connector.connect(
            account=self._account,
            user=os.getenv("SNOWFLAKE_USER", ""),
            password=os.getenv("SNOWFLAKE_PASSWORD", ""),
            warehouse=self._warehouse,
            database=self._database,
            schema=self._schema,
            role=self._role,
        )

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured"}
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT CURRENT_VERSION()")
            version = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            return {"status": "healthy", "version": version}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def fetch_query_history(self, model_names: list[str], days: int = 90) -> dict[str, dict]:
        """Fetch real query history from Snowflake's QUERY_HISTORY."""
        conn = self._get_connection()
        cursor = conn.cursor()

        placeholders = ", ".join(f"'{name.upper()}'" for name in model_names)
        query = f"""
            SELECT
                SPLIT_PART(query_text, '.', -1) as model_name,
                COUNT(*) as query_count,
                MAX(start_time) as last_queried
            FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
            WHERE start_time >= DATEADD(day, -{days}, CURRENT_TIMESTAMP())
                AND query_type = 'SELECT'
                AND UPPER(query_text) REGEXP '.*({"|".join(name.upper() for name in model_names)}).*'
            GROUP BY 1
        """

        try:
            cursor.execute(query)
            results = {}
            for row in cursor.fetchall():
                results[row[0].lower()] = {
                    "query_count": row[1],
                    "last_queried_at": str(row[2]),
                }
            return results
        finally:
            cursor.close()
            conn.close()

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Write audit results to a Snowflake table."""
        if not self.is_configured():
            return {"status": "skipped", "reason": "Not configured"}

        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {self._schema}.DATAPILOT_AUDITS (
                    audit_id VARCHAR,
                    generated_at TIMESTAMP_NTZ,
                    total_findings INTEGER,
                    total_waste_usd FLOAT,
                    by_type VARIANT,
                    by_severity VARIANT,
                    findings VARIANT,
                    agent_stats VARIANT
                )
            """)

            cursor.execute(
                f"""
                INSERT INTO {self._schema}.DATAPILOT_AUDITS
                SELECT
                    UUID_STRING(),
                    CURRENT_TIMESTAMP(),
                    %s, %s,
                    PARSE_JSON(%s),
                    PARSE_JSON(%s),
                    PARSE_JSON(%s),
                    PARSE_JSON(%s)
                """,
                (
                    report.get("total_findings", 0),
                    report.get("total_monthly_waste_usd", 0),
                    json.dumps(report.get("by_type", {})),
                    json.dumps(report.get("by_severity", {})),
                    json.dumps(report.get("findings", [])),
                    json.dumps(report.get("agent_stats", {})),
                ),
            )

            conn.commit()
            cursor.close()
            conn.close()
            return {"status": "published", "table": f"{self._schema}.DATAPILOT_AUDITS"}

        except Exception as e:
            return {"status": "error", "error": str(e)}
