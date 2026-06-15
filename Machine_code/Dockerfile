
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libxcb1 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
# Copy uv directly from the official image (faster and lighter than pip install uv)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency definition files
COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev --no-install-project

# Copy application source code
COPY . .

# Install project dependencies in a cached layer (excluding dev tools)
RUN uv sync --frozen --no-dev --no-editable


# Ensure the database directory exists
RUN mkdir -p /app/Face_Database

EXPOSE 8000

# Fix: Use app.main:app if your main.py is inside an 'app' directory
CMD ["uv", "run", "main.py"]

