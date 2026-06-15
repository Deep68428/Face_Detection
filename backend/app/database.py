import clickhouse_connect
from clickhouse_connect.driver.client import Client
from app.config import get_settings
import threading

_client: Client | None = None
_lock = threading.Lock()


def get_client() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        _client = clickhouse_connect.get_client(
            host=s.clickhouse_host,
            port=s.clickhouse_port,
            username=s.clickhouse_user,
            password=s.clickhouse_password,
            database=s.clickhouse_database,
        )
    return _client


def query(sql: str, parameters: dict | None = None) -> list[dict]:
    """Execute a SELECT and return rows as list of dicts."""
    with _lock:
        client = get_client()
        result = client.query(sql, parameters=parameters or {})
        columns = result.column_names
        return [dict(zip(columns, row)) for row in result.result_rows]

def execute(sql: str, parameters: dict | None = None) -> None:
    """Execute a non-SELECT statement (INSERT, ALTER, etc.)."""
    with _lock:
        client = get_client()
        client.command(sql, parameters=parameters or {})

def insert_rows(table: str, column_names: list[str], rows: list[list]) -> None:
    """Bulk insert rows into a ClickHouse table."""
    with _lock:
        client = get_client()
        client.insert(table, rows, column_names=column_names)
