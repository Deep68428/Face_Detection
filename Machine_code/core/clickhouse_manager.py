from clickhouse_connect import get_client
from datetime import datetime
import uuid
import threading
import time
import os

from config import settings

class ClickHouseManager:
    def __init__(self):
        """Initialize ClickHouse connection with robustness."""
        self.seen_today = set()
        self._lock = threading.RLock()
        self.client = None
        self._connect()

    def _connect(self):
        """Internal helper to establish/refresh connection."""
        try:
            self.client = get_client(
                host=settings.CLICKHOUSE_HOST,
                port=settings.CLICKHOUSE_PORT,
                username=settings.CLICKHOUSE_USER,
                password=settings.CLICKHOUSE_PASSWORD,
                database=settings.CLICKHOUSE_DATABASE,
                connect_timeout=20, 
                send_receive_timeout=30 
            )
            return True
        except Exception as e:
            self.client = None
            print(f"❌ ClickHouse connection failed: {e}")
            return False

    def ensure_connection(self):
        """Ensure client is active, reconnect if necessary (Thread-safe)."""
        with self._lock:
            if self.client is None:
                return self._connect()
            try:
                self.client.query("SELECT 1")
                return True
            except Exception:
                return self._connect()

    def create_tables(self):
        if not self.ensure_connection(): return
        with self._lock:
            try:
                # Audit detections table
                self.client.command("""
                    CREATE TABLE IF NOT EXISTS detections (
                        id             String,
                        name           String,
                        camera         String,
                        camera_id      UInt32,
                        timestamp      DateTime('Asia/Kolkata'),
                        face_centerpoint String,
                        image_path     String,
                        confidence     UInt8 DEFAULT 0
                    ) ENGINE = MergeTree() ORDER BY (timestamp, name)
                """)
                
                # Main movement logs
                self.client.command("""
                    CREATE TABLE IF NOT EXISTS movement_logs (
                        id          UInt64,
                        emp_code    String,
                        emp_name    String,
                        camera_name String,
                        camera_id   UInt32,
                        timestamp   DateTime('Asia/Kolkata'),
                        direction   Enum8('IN' = 1, 'OUT' = 2),
                        confidence  UInt8,
                        image_path  String
                    ) ENGINE = MergeTree() ORDER BY (emp_code, timestamp)
                """)

                # Face mapping registry
                self.client.command("""
                    CREATE TABLE IF NOT EXISTS face_mappings (
                        face_id      String,
                        emp_code     Nullable(String),
                        detected_at  String,
                        detected_time String,
                        confidence   UInt8,
                        status       Enum8('New' = 1, 'Reviewed' = 2, 'Assigned' = 3) DEFAULT 'New',
                        created_at   DateTime('Asia/Kolkata') DEFAULT now(),
                        emp_name     Nullable(String),
                        image_path   String DEFAULT ''
                    ) ENGINE = MergeTree() ORDER BY (face_id, created_at)
                """)
                
                # Machines registry
                self.client.command("""
                    CREATE TABLE IF NOT EXISTS machines (
                        machine_id   UInt32,
                        location     String
                    ) ENGINE = MergeTree() ORDER BY machine_id
                """)
                
                print("✅ Tables initialized")
            except Exception as e:
                print(f"❌ Table creation error: {e}")

    def get_machine_location(self, machine_id):
        """Query the machines table to find the mapped location for a machine ID."""
        if not self.ensure_connection(): return ""
        try:
            mid_val = int(machine_id)
        except (ValueError, TypeError):
            mid_val = 0
            
        with self._lock:
            try:
                result = self.client.query(
                    "SELECT location FROM machines WHERE machine_id = %(mid)s LIMIT 1",
                    parameters={"mid": mid_val}
                )
                if result and result.result_rows:
                    return result.result_rows[0][0]
            except Exception as e:
                print(f"❌ Failed to fetch location for machine {machine_id}: {e}")
        return ""

    def load_today_seen(self):
        if not self.ensure_connection(): return
        with self._lock:
            try:
                result = self.client.query("SELECT DISTINCT emp_name FROM movement_logs WHERE toDate(timestamp) = today() AND direction = 'IN'")
                self.seen_today = {row[0] for row in result.result_rows}
            except Exception: pass

    def register_new_face(self, face_id, confidence=0, image_path=""):
        """Register a seen unknown face into face_mappings."""
        if not self.ensure_connection(): return
        
        int_conf = int(confidence * 100) if confidence < 1.1 else int(confidence)
        now_dt = datetime.now()
        date_str = now_dt.strftime("%Y-%m-%d")
        time_str = now_dt.strftime("%H:%M:%S")
        
        with self._lock:
            try:
                # Check if already exists
                exists = self.client.query(f"SELECT count() FROM face_mappings WHERE face_id = '{face_id}'")
                if exists.result_rows[0][0] == 0:
                    self.client.insert("face_mappings",
                        [[face_id, None, date_str, time_str, int_conf, 1, now_dt, image_path]],
                        column_names=["face_id", "emp_code", "detected_at", "detected_time", "confidence", "status", "created_at", "image_path"]
                    )
            except Exception as e:
                print(f"❌ face_mappings registration error: {e}")

    def load_cameras(self):
        """Fetch all active cameras and populate settings.CAMERAS."""
        if not self.ensure_connection(): return
        with self._lock:
            try:
                location_filter = settings.LOCATION_FILTER
                if location_filter:
                    # Filter by location to prevent cross-connecting to cameras in other locations
                    result = self.client.query(
                        "SELECT id, name, location, ip FROM cameras WHERE location = %(loc)s",
                        parameters={"loc": location_filter}
                    )
                else:
                    result = self.client.query("SELECT id, name, location, ip FROM cameras")
                
                settings.CAMERAS.clear()
                for row in result.result_rows:
                    cam_id, name, location, ip = row
                    settings.CAMERAS[name] = {
                        "id": cam_id,
                        "location": location,
                        "rtsp_url": ip
                    }
                filter_msg = f" (filtered by location: '{location_filter}')" if location_filter else ""
                print(f"📷 Loaded {len(settings.CAMERAS)} active cameras from database{filter_msg}.")
            except Exception as e:
                print(f"❌ Failed to load cameras from DB: {e}")

    def insert_detection(self, emp_code, emp_name, camera, timestamp, face_centerpoint, image_path="", confidence=0, direction="IN"):
        if not self.ensure_connection(): return
        
        detection_id = str(uuid.uuid4())[:16]
        numeric_id = int(timestamp.timestamp() * 1000) % (2**63)
        int_confidence = int(confidence * 100) if confidence < 1.1 else int(confidence)
        dir_val = 1 if direction.upper() == "IN" else 2
        
        # Resolve camera_id from settings
        cam_info = settings.CAMERAS.get(camera)
        camera_id = cam_info["id"] if cam_info else 0
        
        with self._lock:
            try:
                # 1. Insert into raw audit table
                self.client.insert("detections", 
                    [[detection_id, emp_name, camera, camera_id, timestamp, str(face_centerpoint), image_path, int_confidence]], 
                    column_names=["id", "name", "camera", "camera_id", "timestamp", "face_centerpoint", "image_path", "confidence"]
                )
                
                # 2. Insert into movement_logs
                self.client.insert("movement_logs",
                    [[numeric_id, emp_code, emp_name, camera, camera_id, timestamp, dir_val, int_confidence, image_path]],
                    column_names=["id", "emp_code", "emp_name", "camera_name", "camera_id", "timestamp", "direction", "confidence", "image_path"]
                )
            except Exception as e: 
                print(f"❌ insert error: {e}")

    def get_active_mappings(self):
        if not self.ensure_connection(): return {}
        with self._lock:
          try:
              result = self.client.query("SELECT face_id, emp_code, emp_name FROM face_mappings WHERE status = 'Assigned'")
              return {row[0]: {"code": row[1], "name": row[2]} for row in result.result_rows}
          except Exception: return {}

    def get_employee_mappings(self):
        if not self.ensure_connection(): return {}
        with self._lock:
          try:
              result = self.client.query("SELECT name, code FROM employees")
              return {row[0].strip().lower(): row[1] for row in result.result_rows if row[0]}
          except Exception: return {}

    def update_camera_status(self, camera_name, status):
        """Update camera status and last_active timestamp in database."""
        if not self.ensure_connection(): return
        with self._lock:
            try:
                # Get the specific location for this camera to prevent cross-updating
                cam_info = settings.CAMERAS.get(camera_name)
                cam_location = cam_info["location"] if cam_info and "location" in cam_info else settings.LOCATION_FILTER
                
                # ClickHouse uses ALTER TABLE UPDATE for mutations
                query = f"""
                    ALTER TABLE cameras UPDATE 
                        status = '{status}',
                        last_active = now()
                    WHERE name = '{camera_name}'
                """
                if cam_location:
                    query += f" AND location = '{cam_location}'"
                self.client.command(query)
            except Exception as e:
                # Silent failure to avoid recursion or spam if DB is down
                pass
