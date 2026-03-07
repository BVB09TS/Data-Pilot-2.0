# DataPilot v2.0 — Multi-stage production Docker image
# Optimized for enterprise deployment on Kubernetes, ECS, Cloud Run

# ── Stage 1: Builder ──────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for better caching
COPY pyproject.toml ./
COPY datapilot/ datapilot/

# Install package
RUN pip install --no-cache-dir --prefix=/install .

# ── Stage 2: Runtime ──────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

LABEL maintainer="DataPilot Team"
LABEL version="2.0.0"
LABEL description="AI-powered dbt project auditor with multi-agent intelligence"

# Security: run as non-root user
RUN groupadd -r datapilot && useradd -r -g datapilot -m datapilot

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code (agent/ deprecated — use datapilot CLI)
COPY datapilot/ datapilot/
COPY scripts/ scripts/

# Create directories
RUN mkdir -p /app/output /app/config && chown -R datapilot:datapilot /app

# Switch to non-root user
USER datapilot

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import datapilot; print('healthy')" || exit 1

# Expose web dashboard port
EXPOSE 5000

# Default entrypoint
ENTRYPOINT ["datapilot"]
CMD ["audit", "--serve", "--port", "5000"]
