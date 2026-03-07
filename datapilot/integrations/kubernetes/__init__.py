"""Kubernetes integration — deploy DataPilot as a CronJob."""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


K8S_CRONJOB_MANIFEST = {
    "apiVersion": "batch/v1",
    "kind": "CronJob",
    "metadata": {
        "name": "datapilot-audit",
        "namespace": "data-platform",
        "labels": {"app": "datapilot", "component": "audit"},
    },
    "spec": {
        "schedule": "0 6 * * *",
        "concurrencyPolicy": "Forbid",
        "successfulJobsHistoryLimit": 5,
        "failedJobsHistoryLimit": 3,
        "jobTemplate": {
            "spec": {
                "template": {
                    "metadata": {"labels": {"app": "datapilot"}},
                    "spec": {
                        "restartPolicy": "OnFailure",
                        "containers": [
                            {
                                "name": "datapilot",
                                "image": "datapilot:2.0.0",
                                "command": ["datapilot", "audit", "--config", "/config/datapilot.yaml"],
                                "envFrom": [{"secretRef": {"name": "datapilot-secrets"}}],
                                "volumeMounts": [
                                    {"name": "config", "mountPath": "/config"},
                                    {"name": "output", "mountPath": "/output"},
                                ],
                                "resources": {
                                    "requests": {"cpu": "500m", "memory": "512Mi"},
                                    "limits": {"cpu": "2", "memory": "2Gi"},
                                },
                            }
                        ],
                        "volumes": [
                            {
                                "name": "config",
                                "configMap": {"name": "datapilot-config"},
                            },
                            {
                                "name": "output",
                                "persistentVolumeClaim": {"claimName": "datapilot-output"},
                            },
                        ],
                    },
                }
            }
        },
    },
}


class KubernetesIntegration(Integration):
    """Deploy and manage DataPilot on Kubernetes."""

    def __init__(self, namespace: str = "data-platform", kubeconfig: str = ""):
        self._namespace = namespace
        self._kubeconfig = kubeconfig

    @property
    def name(self) -> str:
        return "Kubernetes"

    @property
    def platform(self) -> str:
        return "kubernetes"

    def is_configured(self) -> bool:
        try:
            from kubernetes import config

            if self._kubeconfig:
                config.load_kube_config(config_file=self._kubeconfig)
            else:
                config.load_incluster_config()
            return True
        except Exception:
            return False

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured"}
        try:
            from kubernetes import client, config

            v1 = client.CoreV1Api()
            ns = v1.read_namespace(self._namespace)
            return {"status": "healthy", "namespace": self._namespace}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def generate_manifests(self, image: str = "datapilot:2.0.0", schedule: str = "0 6 * * *") -> dict:
        """Generate Kubernetes manifests for DataPilot deployment."""
        manifest = json.loads(json.dumps(K8S_CRONJOB_MANIFEST))
        manifest["spec"]["schedule"] = schedule
        container = manifest["spec"]["jobTemplate"]["spec"]["template"]["spec"]["containers"][0]
        container["image"] = image
        return manifest

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Store report as a ConfigMap in Kubernetes."""
        if not self.is_configured():
            return {"status": "skipped"}

        try:
            from kubernetes import client, config

            v1 = client.CoreV1Api()
            cm = client.V1ConfigMap(
                metadata=client.V1ObjectMeta(
                    name="datapilot-latest-report",
                    namespace=self._namespace,
                    labels={"app": "datapilot"},
                ),
                data={
                    "report.json": json.dumps(
                        {
                            "total_findings": report.get("total_findings", 0),
                            "by_severity": report.get("by_severity", {}),
                            "waste_usd": report.get("total_monthly_waste_usd", 0),
                        }
                    )
                },
            )

            try:
                v1.replace_namespaced_config_map(
                    "datapilot-latest-report", self._namespace, cm
                )
            except Exception:
                v1.create_namespaced_config_map(self._namespace, cm)

            return {"status": "published", "configmap": "datapilot-latest-report"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
