"""
Multi-Camera Face Recognition System
Main application entry point

VERSION 2.0 - Simplified Multi-Camera Detection Logger
"""
import warnings
# Silence warnings immediately before other imports
warnings.filterwarnings("ignore", category=FutureWarning)

import threading
import time
import os
import sys
from datetime import datetime

# 🚀 FIX: Force RTSP to use TCP instead of UDP
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_VIDEOIO_LOG_LEVEL"] = "0"
os.environ["OPENCV_LOG_LEVEL"] = "0"
os.environ["OPENCV_VIDEOIO_DEBUG"] = "0"
os.environ["OPENCV_FFMPEG_LOGLEVEL"] = "-8"

from config import settings
from core import FaceRecognitionSystem, DetectionLogger, ImageSaver
from core.create_embeddings import build_face_index, DATABASE_DIR, OUTPUT_PKL, OUTPUT_FAISS
from threads import process_camera_stream, display_thread
from queue import Queue

log_queue = Queue(maxsize=2000)

def clean_old_local_xlsx(days=30):
    """Clean local Excel files older than 30 days in Detection_Logs"""
    try:
        from pathlib import Path
        from datetime import datetime, timedelta
        
        logs_dir = settings.BASE_DIR / "Detection_Logs"
        if not logs_dir.exists():
            return
            
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted_count = 0
        
        for filepath in logs_dir.glob("detections_*.xlsx"):
            try:
                # Filename: detections_DD_MM_YYYY.xlsx
                filename = filepath.name
                date_part = filename.replace("detections_", "").replace(".xlsx", "")
                file_date = datetime.strptime(date_part, "%d_%m_%Y")
                if file_date < cutoff_date:
                    if filepath.exists():
                        filepath.unlink()
                        deleted_count += 1
            except Exception as fe:
                print(f"⚠️ [Retention] Error parsing/deleting Excel file {filepath.name}: {fe}")
        if deleted_count > 0:
            print(f"🗑️ [Retention] Deleted {deleted_count} local Excel log files older than {days} days.")
    except Exception as e:
        print(f"❌ [Retention] Error cleaning old local Excel files: {e}")

def run_retention_cleanup(days=30):
    """Run ClickHouse, MinIO, and local XLSX cleanup for data older than 30 days"""
    print(f"\n🧹 [Retention] Starting data retention cleanup ({days} days policy)...")
    try:
        # 1. Clean local Excel logs
        clean_old_local_xlsx(days)
        
        # 2. Clean ClickHouse logs
        from core.clickhouse_manager import ClickHouseManager
        ch = ClickHouseManager()
        if ch.ensure_connection():
            ch.client.command(f"ALTER TABLE detections DELETE WHERE toDate(timestamp) < today() - {days}")
            ch.client.command(f"ALTER TABLE movement_logs DELETE WHERE toDate(timestamp) < today() - {days}")
            ch.client.command(f"ALTER TABLE face_mappings DELETE WHERE status != 'Assigned' AND toDate(created_at) < today() - {days}")
            print("✅ [Retention] ClickHouse tables cleaned.")
            
        # 3. Clean MinIO old images
        from core.minio_uploader import MinioUploader
        minio = MinioUploader()
        minio.clean_old_objects(days)
        
    except Exception as e:
        print(f"❌ [Retention] Error during data retention cleanup: {e}")

def scheduler_worker(stop_event):
    """Background thread to trigger nightly embedding rebuild at 23:00"""
    print("[Scheduler] Started")
    last_run_date = ""
    
    while not stop_event.is_set():
        now = datetime.now()
        current_date = now.strftime("%Y-%m-%d")
        
        # Check if it's 11:00 PM (23:00) and we haven't run today
        if now.hour == 23 and now.minute == 0 and last_run_date != current_date:
            print(f"\n⏰ [Scheduler] Time is {now.strftime('%H:%M')}. Starting nightly embedding rebuild & retention cleanup...")
            try:
                # Run the embedding generation logic
                build_face_index(DATABASE_DIR, OUTPUT_PKL, OUTPUT_FAISS)
                print("✅ [Scheduler] Nightly rebuild completed successfully.")
                
                # Run the data retention cleanup
                run_retention_cleanup(30)
                
                last_run_date = current_date
            except Exception as e:
                print(f"❌ [Scheduler] Error during rebuild / retention: {e}")
        
        # Check every 30 seconds
        time.sleep(30)
    print("[Scheduler] Stopped")

def log_worker(log_queue, logger, image_saver, stop_event):
    print("[LoggerWorker] Started")
    while not stop_event.is_set() or not log_queue.empty():
        try:
            if log_queue.empty():
                time.sleep(0.1)
                continue
            data = log_queue.get(timeout=1)
            logger.log_detection(
                name=data["name"],
                camera=data["camera"],
                Face_centerpoint=data["face_centerpoint"],
                confidence=data["confidence"],
                frame=data["frame"],
                face=data["face"],
                image_saver=image_saver
            )
            log_queue.task_done()
        except Exception:
            continue
    print("[LoggerWorker] Stopped")

def offline_sync_worker(stop_event):
    """Background thread to sync offline local images to MinIO and ClickHouse once network is restored"""
    print("[OfflineSync] Started")
    
    # Wait 30 seconds after startup before the first run
    time.sleep(30)
    
    while not stop_event.is_set():
        try:
            from core.clickhouse_manager import ClickHouseManager
            from core.minio_uploader import MinioUploader
            import re
            
            ch = ClickHouseManager()
            # If DB is not available, don't try to sync
            if not ch.ensure_connection():
                time.sleep(60)
                continue
                
            minio = MinioUploader()
            # If MinIO is not available, don't try to sync
            if not minio._connect():
                time.sleep(60)
                continue
                
            # Get camera locations from settings
            locations = set()
            for cam in settings.CAMERAS.values():
                if "location" in cam:
                    locations.add(cam["location"])
                    
            if not locations:
                time.sleep(60)
                continue
                
            # Regex to parse filename: Name_Camera_HHMMSS_mmm_conf0.85.jpg
            filename_regex = re.compile(r"^(.+?)_(.+?)_(\d{6})_(\d{3})_conf(\d+\.\d+)\.jpg$")
            
            sync_count = 0
            for location in locations:
                location_dir = settings.BASE_DIR / location
                if not location_dir.exists():
                    continue
                    
                # Find all local jpg files
                for filepath in list(location_dir.rglob("*.jpg")):
                    if stop_event.is_set():
                        break
                        
                    try:
                        # Double check existence before doing any operations
                        if not filepath.exists():
                            continue
                            
                        # Delete files older than 24 hours to avoid spamming server and clean disk
                        import time as pytime
                        file_mtime = filepath.stat().st_mtime
                        if pytime.time() - file_mtime > 86400:
                            if filepath.exists():
                                filepath.unlink()
                            npy_path = filepath.with_suffix(filepath.suffix + ".npy")
                            if npy_path.exists():
                                npy_path.unlink()
                            continue
                            
                        filename = filepath.name
                        # Path structure: Location / CameraID / Date / Name / filename
                        parts = filepath.parts
                        if len(parts) < 5:
                            continue
                            
                        person_name = filepath.parent.name
                        date_str = filepath.parent.parent.name
                        camera_id = filepath.parent.parent.parent.name
                        
                        match = filename_regex.match(filename)
                        if not match:
                            continue
                            
                        parsed_name = match.group(1)
                        camera_name = match.group(2)
                        time_str = match.group(3)   # HHMMSS
                        conf_str = match.group(5)   # confidence
                        
                        confidence = float(conf_str)
                        
                        # Calculate exact datetime
                        dt = datetime.strptime(f"{date_str} {time_str}", "%d_%m_%Y %H%M%S")
                        
                        # Double check file exists to prevent race conditions
                        if not filepath.exists():
                            continue
                            
                        # Upload to MinIO
                        relative_path = f"{location}/{camera_id}/{date_str}/{person_name}/{filename}"
                        minio_url = minio.upload_file(str(filepath), relative_path)
                        
                        if minio_url:
                            # Log to ClickHouse
                            is_unknown = parsed_name.startswith("Unknown") or parsed_name.startswith("Face_")
                            
                            # Resolve emp_code
                            emp_code = parsed_name
                            emp_name = parsed_name
                            
                            # Check active mappings
                            mappings = ch.get_active_mappings()
                            if parsed_name in mappings:
                                emp_code = mappings[parsed_name]["code"]
                                emp_name = mappings[parsed_name]["name"]
                                is_unknown = False
                            else:
                                emp_mappings = ch.get_employee_mappings()
                                name_key = parsed_name.strip().lower()
                                if name_key in emp_mappings:
                                    emp_code = emp_mappings[name_key]
                                    is_unknown = False
                                
                            if not is_unknown:
                                # Check if already logged in ClickHouse to avoid duplicate
                                formatted_ts = dt.strftime('%Y-%m-%d %H:%M:%S')
                                check_query = f"SELECT count() FROM movement_logs WHERE emp_name = '{emp_name}' AND camera_name = '{camera_name}' AND timestamp = '{formatted_ts}'"
                                check_res = ch.client.query(check_query)
                                
                                if check_res.result_rows[0][0] == 0:
                                    # Insert log
                                    log_direction = "OUT" if ("outside-left" in camera_name.lower() or "outside-right" in camera_name.lower()) else "IN"
                                    ch.insert_detection(
                                        emp_code=emp_code,
                                        emp_name=emp_name,
                                        camera=camera_name,
                                        timestamp=dt,
                                        face_centerpoint=(0, 0), # Default centerpoint for sync
                                        image_path=minio_url,
                                        confidence=confidence,
                                        direction=log_direction
                                    )
                                    print(f"🔄 [OfflineSync] Synced & Logged: {emp_name} ({camera_name})")
                            else:
                                # For unknowns, check if already in face_mappings
                                check_query = f"SELECT count() FROM face_mappings WHERE face_id = '{parsed_name}'"
                                check_res = ch.client.query(check_query)
                                
                                if check_res.result_rows[0][0] == 0:
                                    ch.register_new_face(parsed_name, confidence, minio_url)
                                    print(f"🔄 [OfflineSync] Synced & Registered Unknown: {parsed_name}")
                                    
                            # Delete local jpg and any cached embedding npy
                            if filepath.exists():
                                filepath.unlink()
                            npy_path = filepath.with_suffix(filepath.suffix + ".npy")
                            if npy_path.exists():
                                npy_path.unlink()
                                
                            sync_count += 1
                            
                    except Exception as fe:
                        print(f"⚠️ [OfflineSync] Error syncing file {filepath}: {fe}")
                        
            if sync_count > 0:
                print(f"✅ [OfflineSync] Successfully synced {sync_count} offline images/logs.")
                
        except Exception as e:
            print(f"⚠️ [OfflineSync] Loop error: {e}")
            
        # Run every 5 minutes
        time.sleep(300)
        
    print("[OfflineSync] Stopped")

def run_app():
    """Main application loop with auto-day-change logic"""
    print("="*60)
    print("MULTI-CAMERA FACE RECOGNITION SYSTEM")
    print("="*60)
    
    recognition_system = FaceRecognitionSystem()
    logger = DetectionLogger()
    image_saver = ImageSaver()
    logger.init_daily_database()
    
    # Resolve location dynamically from database based on MACHINE_ID
    if settings.MACHINE_ID != "default-machine":
        db_location = logger.ch.get_machine_location(settings.MACHINE_ID)
        if db_location:
            settings.LOCATION_FILTER = db_location
            print(f"📡 Resolved location for machine '{settings.MACHINE_ID}' -> '{settings.LOCATION_FILTER}'")
        else:
            print(f"❌ Error: Machine ID '{settings.MACHINE_ID}' not registered in database. Cannot run without a location filter.")
            return False
    else:
        print(f"⚠️ Warning: Running in single-machine mode (no location filter).")
    
    logger.ch.load_cameras()
    
    if not settings.CAMERAS:
        print("❌ No active cameras found in database. Exiting.")
        return False
    
    for camera_name in settings.CAMERAS.keys():
        settings.frame_data[camera_name] = {'frame': None, 'faces': [], 'recognized_faces': {}, 'timestamp': 0}
        settings.recent_detections[camera_name] = []
    
    stats = logger.get_daily_stats()
    print(f"\n📊 Current Stats: Detections={stats['total_detections']}, People={stats['unique_people']}")
    
    stop_event = threading.Event()
    camera_threads = []
    
    # Start Scheduler
    scheduler = threading.Thread(target=scheduler_worker, args=(stop_event,), daemon=True, name="Scheduler")
    scheduler.start()

    # Start Offline Sync Worker
    sync_worker = threading.Thread(target=offline_sync_worker, args=(stop_event,), daemon=True, name="OfflineSync")
    sync_worker.start()

    # Start Logger Workers
    for i in range(2):
        t = threading.Thread(target=log_worker, args=(log_queue, logger, image_saver, stop_event), daemon=True)
        t.start()

    # Start Camera Threads
    for camera_name, cam_info in settings.CAMERAS.items():
        rtsp_url = cam_info["rtsp_url"]
        thread = threading.Thread(
            target=process_camera_stream,
            args=(recognition_system, logger, image_saver, camera_name, rtsp_url, stop_event, log_queue),
            daemon=True
        )
        thread.start()
        camera_threads.append(thread)
        time.sleep(0.5)
        print(f"   ✅ Started {camera_name}")
    
    print("\n" + "="*60 + "\nSYSTEM RUNNING\n" + "="*60 + "\n")
    
    should_restart_signal = False
    last_day_check = time.time()
    try:
        while not stop_event.is_set():
            time.sleep(10)
            current_time = time.time()
            
            # Check for day change
            if current_time - last_day_check > 3600:
                today_date = datetime.now().strftime("%d_%m_%Y")
                if settings.CURRENT_DATE_STR != today_date:
                    print(f"\n🌅 DAY CHANGE DETECTED: {today_date}. Restarting...")
                    stop_event.set()
                    should_restart_signal = True
                    break 
                last_day_check = current_time
    except KeyboardInterrupt:
        print("\n🛑 Shutdown requested...")
        stop_event.set()
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        stop_event.set()
    finally:
        stop_event.set()
        # Ensure threads stop
        for t in camera_threads: t.join(timeout=2)
        print("✅ Cleanly stopped")
    
    return should_restart_signal

if __name__ == "__main__":
    while True:
        should_restart = run_app()
        if not should_restart:
            break
        print("🔄 Restarting system loop...")
        time.sleep(5)
