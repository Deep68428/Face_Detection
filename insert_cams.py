from clickhouse_connect import get_client

client = get_client(
    host="216.48.180.4",
    port=8123,
    username="ethics",
    password="Ethics@2026$",
    database="attendance_phase_1"
)

data = [
    [1, "Reception", "73 East", "Active", "rtsp://user1:Ethics123@192.168.13.251:554/cam/realmonitor?channel=2&subtype=0", 75, "High"],
    [2, "Pantry-Right", "73 East", "Active", "rtsp://user1:Ethics123@192.168.13.251:554/cam/realmonitor?channel=7&subtype=0", 75, "High"],
    [3, "Pantry-Left", "Neptune", "Active", "rtsp://user1:Ethics123@192.168.13.251:554/cam/realmonitor?channel=8&subtype=0", 75, "High"],
    [4, "Outside-Right", "73 East", "Active", "rtsp://user1:Ethics123@192.168.13.251:554/cam/realmonitor?channel=21&subtype=0", 75, "High"],
    [5, "Outside-Left", "Neptune", "Active", "rtsp://user1:Ethics123@192.168.13.251:554/cam/realmonitor?channel=22&subtype=0", 75, "High"]
]

try:
    client.insert("cameras", data, column_names=["id", "name", "location", "status", "ip", "confidence_override", "priority"])
    print("Inserted successfully!")
except Exception as e:
    print(f"Error: {e}")

