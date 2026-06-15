import pandas as pd
import time
import uuid
from datetime import datetime
from pathlib import Path
import threading

from config import settings
from .clickhouse_manager import ClickHouseManager

class DetectionLogger:
    def __init__(self):
        """Initialize detection logger"""
        self.ch = ClickHouseManager()
        self.mappings = {}
        self.employee_mappings = {}
        self.last_mapping_refresh = 0
        print("Creating ClickHouse tables...")
        self.ch.create_tables()
        self.refresh_mappings()
    
    def refresh_mappings(self):
        """Refresh face_id -> emp_code mappings and dynamic settings from ClickHouse."""
        now = time.time()
        if now - self.last_mapping_refresh > 60:
            self.mappings = self.ch.get_active_mappings()
            self.employee_mappings = self.ch.get_employee_mappings()
            # Also refresh AI thresholds from database
            settings.refresh_dynamic_settings(self.ch)
            self.last_mapping_refresh = now
    
    def init_daily_database(self):
        """Initialize daily logging structure."""
        Path(settings.LOGS_ROOT).mkdir(parents=True, exist_ok=True)
        today = datetime.now()
        date_str = today.strftime("%d_%m_%Y")
        settings.CURRENT_DATE_STR = date_str
        settings.DAILY_EXCEL_FILE = Path(settings.LOGS_ROOT) / f"detections_{date_str}.xlsx"
        settings.CURRENT_DATE_FOLDER = Path(settings.DATABASE_ROOT) / date_str
        settings.CURRENT_DATE_FOLDER.mkdir(parents=True, exist_ok=True)
        
        if not settings.DAILY_EXCEL_FILE.exists():
            self._create_new_excel()
        self.ch.load_today_seen()
    
    def _create_new_excel(self):
        df = pd.DataFrame(columns=['Name', 'Camera', 'Timestamp', 'Face_centerpoint', 'Image-Path'])
        with pd.ExcelWriter(settings.DAILY_EXCEL_FILE, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Detections', index=False)

    def _load_detections(self):
        if settings.DAILY_EXCEL_FILE.exists():
            try: return pd.read_excel(settings.DAILY_EXCEL_FILE, sheet_name='Detections')
            except Exception: pass
        return pd.DataFrame(columns=['Name', 'Camera', 'Timestamp', 'Face_centerpoint', 'Image-Path'])

    @staticmethod
    def _get_direction(camera: str) -> str:
        cam_lower = camera.lower()
        return "OUT" if ("outside-left" in cam_lower or "outside-right" in cam_lower) else "IN"

    def can_log_detection(self, name: str, camera: str, is_unknown: bool = False) -> bool:
        now = datetime.now()
        direction = self._get_direction(camera)
        state = settings.last_detection_time.get(name)

        if state is None:
            settings.last_detection_time[name] = {"direction": direction, "last_logged": now}
            return True

        if direction != state["direction"]:
            settings.last_detection_time[name] = {"direction": direction, "last_logged": now}
            return True

        elapsed = (now - state["last_logged"]).total_seconds()
        
        # 5-minute cooldown for known Employees
        required_wait = settings.COOLDOWN_SECONDS
        
        # 60s cooldown for Unknowns - Grouped by Camera to prevent spam from changing Tracker IDs
        if is_unknown:
            required_wait = 60
            name = f"Unknown_Group_{camera}" # Override name to throttle ALL unknowns on this camera
            state = settings.last_detection_time.get(name)
            if state:
                elapsed = (now - state["last_logged"]).total_seconds()
                if direction != state["direction"]: # Still allow rapid IN/OUT transitions
                    elapsed = required_wait + 1
            else:
                elapsed = required_wait + 1

        if elapsed >= required_wait:
            settings.last_detection_time[name] = {"direction": direction, "last_logged": now}
            return True
        return False

    def log_detection(self, name, camera, Face_centerpoint, confidence=0, image_path=None, frame=None, face=None, image_saver=None):
        """
        Log a detection to Excel + ClickHouse (thread-safe).
        """
        try:
            # 1. Resolve Mapping (e.g. Unknown_001 -> Dhruv Modi)
            self.refresh_mappings()
            mapping = self.mappings.get(name)
            
            if mapping:
                emp_code = mapping["code"]
                emp_name = mapping["name"]
                is_unknown = False
            else:
                name_key = name.strip().lower()
                if name_key in self.employee_mappings:
                    emp_code = self.employee_mappings[name_key]
                    emp_name = name
                    is_unknown = False
                else:
                    emp_code = name
                    emp_name = name
                    # Truly unknown if it starts with Unknown/Face and has no mapping
                    is_unknown = name.startswith("Unknown") or name.startswith("Face_")

            # 2. Cooldown Gate (Direction-Aware)
            # Use the RESOLVED name for cooldown so mappings are respected
            if not self.can_log_detection(emp_name, camera, is_unknown):
                return False

            # 3. Time setup
            now = datetime.now()
            timestamp = now.strftime('%H:%M:%S')

            # 4. Save Image ONLY after cooldown cleared
            if image_path is None and image_saver and frame is not None and face is not None:
                image_path = image_saver.save_detection_image(
                    frame=frame,
                    face=face,
                    name=emp_name,
                    camera=camera,
                    confidence=confidence
                )

            with settings.excel_write_lock:
                df = self._load_detections()
                new_row = pd.DataFrame({
                    'Name': [emp_name],
                    'Camera': [camera],
                    'Timestamp': timestamp,
                    'Face_centerpoint': [Face_centerpoint],
                    'Image-Path': [image_path if image_path else ""]
                })
                df = pd.concat([df, new_row], ignore_index=True)
                with pd.ExcelWriter(settings.DAILY_EXCEL_FILE, engine='openpyxl') as writer:
                    df.to_excel(writer, sheet_name='Detections', index=False)
            
            # 5. DB Insertion
            if self.ch and self.ch.client:
                # If it's a known employee, log to audit and movement logs
                if not is_unknown:
                    log_direction = self._get_direction(camera)
                    
                    # ENFORCE: Only store detections AFTER or AT the first "IN" of the day
                    has_checked_in = emp_name in self.ch.seen_today
                    if not has_checked_in and log_direction != "IN":
                        # We don't print anything to avoid console spam, just skip.
                        return False

                    self.ch.insert_detection(
                        emp_code=emp_code, 
                        emp_name=emp_name,
                        camera=camera,
                        timestamp=now,
                        face_centerpoint=Face_centerpoint,
                        image_path=image_path if image_path else "",
                        confidence=confidence,
                        direction=log_direction
                    )
                    
                    # Mark as checked in for subsequent detections
                    if log_direction == "IN":
                        self.ch.seen_today.add(emp_name)
                
                # Register in face_mappings (Unknowns only, for UI assignment)
                # But only if confidence is decent enough to be useful
                if is_unknown and confidence >= settings.MIN_CONFIDENCE_TO_SAVE:
                    self.ch.register_new_face(emp_code, confidence, image_path)

            if not is_unknown:
                print(f"💾 [{camera}] {emp_name} → Logged")
            return True
        except Exception as e:
            print(f"❌ Log Error: {e}")
            return False

    def get_daily_stats(self):
        """Returns basic stats for terminal display."""
        try:
            df = self._load_detections()
            return {
                'total_detections': len(df),
                'unique_people': df['Name'].nunique() if len(df) > 0 else 0,
                'cameras_active': df['Camera'].nunique() if len(df) > 0 else 0
            }
        except Exception:
            return {'total_detections': 0, 'unique_people': 0, 'cameras_active': 0}
