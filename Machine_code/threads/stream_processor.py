"""
Stream processing thread for continuous video capture
Simplified for multi-camera detection logging
"""
import cv2
import time
import gc
from datetime import datetime

from config import settings


def process_camera_stream(recognition_system, logger, image_saver, camera_name, rtsp_url, stop_event, log_queue):
    """
    Process single camera stream - detect faces and log presence
    
    Args:
        recognition_system: FaceRecognitionSystem instance
        logger: DetectionLogger instance  
        image_saver: ImageSaver instance
        camera_name: Camera identifier (e.g., "cam1", "lobby")
        rtsp_url: RTSP stream URL
        stop_event: Threading event to signal stop
    """
    print(f"[{camera_name}] Starting stream: {rtsp_url}")
    
    retries = 0
    current_db_status = None
    
    while not stop_event.is_set():
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_FPS, 10)
        
        if not cap.isOpened():
            print(f"❌ [{camera_name}] Failed to connect (Network/Camera offline)")
            if current_db_status != "Error":
                if getattr(logger, 'ch', None): logger.ch.update_camera_status(camera_name, "Error")
                current_db_status = "Error"
            time.sleep(settings.RETRY_DELAY)
            continue
        
        # Test frame
        ret, test_frame = cap.read()
        if not ret or test_frame is None:
            cap.release()
            if current_db_status != "Error":
                if getattr(logger, 'ch', None): logger.ch.update_camera_status(camera_name, "Error")
                current_db_status = "Error"
            time.sleep(settings.RETRY_DELAY)
            continue
        
        print(f"✅ [{camera_name}] Connected and active")
        if current_db_status != "Active":
            if getattr(logger, 'ch', None): logger.ch.update_camera_status(camera_name, "Active")
            current_db_status = "Active"
        
        frame_count = 0
        last_process_time = 0
        
        while cap.isOpened() and not stop_event.is_set():
            # Grab frame (fast operation)
            if not cap.grab():
                break
            
            frame_count += 1
            current_time = time.time()
            
            # Process every Nth frame
            if frame_count % settings.PROCESS_EVERY_N_FRAMES == 0 and (current_time - last_process_time) > 0.3:
                ret, frame = cap.retrieve()
                if not ret or frame is None:
                    continue
                
                try:
                    # Detect faces using InsightFace
                    faces = recognition_system.face_app.get(frame)
                    
                    # Recognize faces
                    recognized_faces = recognition_system.recognize_faces(faces)

                    # Debug: show detection vs recognition counts
                    # print(f"[{camera_name}] Debug: detected={len(faces)} recognized={len(recognized_faces)}")
                    
                    # Process each recognized face
                    for face_id, (name, confidence) in recognized_faces.items():
                        face_index = int(face_id.split("_")[1]) - 1
                        face = faces[face_index]
                        bbox = face.bbox.astype(int)
                        Face_cxcy = [int((bbox[0]+bbox[2])/2), int((bbox[1]+bbox[3])/2)]
                        
                        try:
                            log_queue.put_nowait({
                                "frame": frame.copy(),
                                "face": face,
                                "name": name,
                                "camera": camera_name,
                                "confidence": confidence,
                                "face_centerpoint": tuple(Face_cxcy)
                            })
                        except:
                            print(f"⚠️ [{camera_name}] Log queue full, skipping...")
                    
                    # 🚀 Process and Save UNKNOWN faces
                    for i, face in enumerate(faces):
                        face_id = f"Face_{i+1}"
                        if face_id not in recognized_faces:
                            # 1. Check cooldown for "Unknown" to prevent spamming
                            if logger.can_log_detection("Unknown", camera_name):
                                # 2. Save crop locally
                                image_path = image_saver.save_unknown_face(frame, face, camera_name)
                                
                                # 3. Generate unique temp name for registration
                                time_str = datetime.now().strftime("%H%M%S")
                                unknown_name = f"Unknown_{camera_name}"
                                
                                bbox = face.bbox.astype(int)
                                Face_cxcy = [int((bbox[0]+bbox[2])/2), int((bbox[1]+bbox[3])/2)]
                                
                                try:
                                    log_queue.put_nowait({
                                        "frame": frame.copy(),
                                        "face": face,
                                        "name": unknown_name,
                                        "camera": camera_name,
                                        "confidence": getattr(face, 'det_score', 0),
                                        "face_centerpoint": tuple(Face_cxcy),
                                        "image_path": image_path  # Pass pre-saved path
                                    })
                                    print(f"👤 [{camera_name}] Logged Unknown face: {unknown_name}")
                                except:
                                    pass
                    
                    # Update frame data for display thread
                    with settings.frame_data_lock:
                        settings.frame_data[camera_name] = {
                            'frame': frame.copy(),
                            'faces': faces,
                            'recognized_faces': recognized_faces,
                            'timestamp': current_time
                        }
                    
                    last_process_time = current_time
                    
                except Exception as e:
                    print(f"⚠️ [{camera_name}] Processing error: {e}")
                    import traceback
                    traceback.print_exc()
                
                finally:
                    gc.collect()
            
            else:
                # Just retrieve frame for display (no processing)
                ret, frame = cap.retrieve()
                if ret and frame is not None:
                    with settings.frame_data_lock:
                        if camera_name in settings.frame_data:
                            settings.frame_data[camera_name]['frame'] = frame.copy()
                            settings.frame_data[camera_name]['timestamp'] = current_time
                        else:
                            settings.frame_data[camera_name] = {
                                'frame': frame.copy(),
                                'faces': [],
                                'recognized_faces': {},
                                'timestamp': current_time
                            }
            
            time.sleep(0.008)  # Small delay to prevent CPU overload
        
        cap.release()
        print(f"[{camera_name}] Stream lost, reconnecting in {settings.RETRY_DELAY}s...")
        time.sleep(settings.RETRY_DELAY)
    
    # if getattr(logger, 'ch', None): logger.ch.update_camera_status(camera_name, "Inactive")
    # print(f"[{camera_name}] Thread stopped cleanly")
