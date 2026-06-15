FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

ENV UV_SYSTEM_PYTHON=1

WORKDIR /app

# ── Dependency layer (cached until pyproject.toml changes) ───────────────────
COPY backend/pyproject.toml ./backend/pyproject.toml
# Stub so hatchling can resolve the 'app' package without the full source
RUN mkdir -p /app/backend/app && touch /app/backend/app/__init__.py
RUN cd /app/backend && uv pip install .

# ── Source layer ─────────────────────────────────────────────────────────────
COPY backend/ ./backend/
RUN mkdir -p /app/Machine_code/Face_Database

WORKDIR /app/backend
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
