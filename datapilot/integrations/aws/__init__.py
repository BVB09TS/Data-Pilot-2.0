"""AWS integration — S3 storage and SNS notifications."""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


class AWSIntegration(Integration):
    """Publish reports to S3 and send SNS notifications."""

    def __init__(
        self,
        region: str = "us-east-1",
        s3_bucket: str = "",
        s3_prefix: str = "datapilot/",
        sns_topic_arn: str = "",
    ):
        self._region = region
        self._s3_bucket = s3_bucket
        self._s3_prefix = s3_prefix
        self._sns_topic_arn = sns_topic_arn

    @property
    def name(self) -> str:
        return "AWS S3 + SNS"

    @property
    def platform(self) -> str:
        return "aws"

    def is_configured(self) -> bool:
        return bool(self._s3_bucket)

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured"}
        try:
            import boto3

            s3 = boto3.client("s3", region_name=self._region)
            s3.head_bucket(Bucket=self._s3_bucket)
            return {"status": "healthy", "bucket": self._s3_bucket}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Upload report to S3 and optionally notify via SNS."""
        if not self.is_configured():
            return {"status": "skipped"}

        try:
            import boto3
            from datetime import datetime

            s3 = boto3.client("s3", region_name=self._region)
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            key = f"{self._s3_prefix}datapilot_report_{ts}.json"

            s3.put_object(
                Bucket=self._s3_bucket,
                Key=key,
                Body=json.dumps(report, indent=2, default=str),
                ContentType="application/json",
            )

            result: dict[str, Any] = {"status": "published", "s3_key": key}

            if self._sns_topic_arn:
                sns = boto3.client("sns", region_name=self._region)
                critical = report.get("by_severity", {}).get("critical", 0)
                subject = f"DataPilot Audit: {report.get('total_findings', 0)} findings"
                if critical:
                    subject = f"[CRITICAL] {subject} ({critical} critical)"

                sns.publish(
                    TopicArn=self._sns_topic_arn,
                    Subject=subject[:100],
                    Message=json.dumps(
                        {
                            "total_findings": report.get("total_findings", 0),
                            "by_severity": report.get("by_severity", {}),
                            "waste_usd": report.get("total_monthly_waste_usd", 0),
                            "s3_key": key,
                        },
                        indent=2,
                    ),
                )
                result["sns_published"] = True

            return result
        except Exception as e:
            return {"status": "error", "error": str(e)}
