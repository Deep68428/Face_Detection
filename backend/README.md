# Attendance System — Backend

A FastAPI + ClickHouse backend for the employee attendance tracking system.

## Requirements

- Python 3.11+
- ClickHouse running locally on port 8123

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your ClickHouse connection details
```

### 3. Create ClickHouse database & tables
```bash
# Run using clickhouse-client or the HTTP interface
clickhouse-client < schema.sql
```

### 4. Seed with sample data
```bash
python3 seed.py
```

### 5. Start the server
```bash
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

## API Endpoints

| Resource | Prefix |
|----------|--------|
| Dashboard | `/api/dashboard` |
| Cameras | `/api/cameras` |
| Employees | `/api/employees` |
| Movement Logs | `/api/movement-logs` |
| Face Mapping | `/api/face-mapping` |
| Users | `/api/users` |
| Reports | `/api/reports` |

## Directory Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI app
│   ├── config.py        # Settings
│   ├── database.py      # ClickHouse client
│   ├── models/          # Pydantic models
│   └── routers/         # Route handlers
├── schema.sql           # ClickHouse DDL
├── seed.py              # Sample data seeder
├── requirements.txt
└── .env.example
```
