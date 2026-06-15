from clickhouse_connect import get_client
client = get_client(host='localhost', port=8123, username='admin', password='admin123', database='attendance_phase_1')
for r in client.query("SELECT emp_code, emp_name FROM movement_logs ORDER BY timestamp DESC LIMIT 5").result_rows:
    print(r)
