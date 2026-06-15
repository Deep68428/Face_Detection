"""
Display thread for rendering multiple camera feeds
One window per camera
"""
import cv2
import time
from datetime import datetime

from config import settings


def draw_camera_ui(frame, camera_name, faces, recognized_faces):
    """
    Draw UI overlay on camera frame
    
    Args:
        frame: Video frame
        camera_name: Camera identifier
        faces: List of detected faces
        recognized_faces: Dict of recognized faces
    
    Returns:
        frame: Frame with UI overlay
    """
    if frame is None:
        return None
    
    display_frame = frame.copy()
    h, w = frame.shape[:2]
    
    # Header bar with camera name + 24-hr clock
    cv2.rectangle(display_frame, (0, 0), (w, 60), (40, 40, 40), -1)
    cv2.putText(display_frame, f"Camera: {camera_name}", (10, 40),
               cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 2)
    # 24-hour time (HH:MM:SS) in top-right corner
    time_str = datetime.now().strftime("%H:%M:%S")
    time_size, _ = cv2.getTextSize(time_str, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
    cv2.putText(display_frame, time_str, (w - time_size[0] - 15, 40),
               cv2.FONT_HERSHEY_SIMPLEX, 0.9, (200, 200, 200), 2)
    
    # Draw face boxes and labels
    for i, face in enumerate(faces):
        bbox = face.bbox.astype(int)
        x1, y1, x2, y2 = bbox
        face_id = f"Face_{i+1}"
        
        if face_id in recognized_faces:
            name, confidence = recognized_faces[face_id]
            color = (0, 255, 0)  # Green for recognized
            label = f"{name} ({confidence:.2f})"
        else:
            color = (0, 0, 255)  # Red for unknown
            det_score = getattr(face, 'det_score', 0.0)
            label = f"Unknown ({det_score:.2f})"
        
        # Draw bounding box
        # cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
        
        # Draw label background
        label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        y_label = max(y1 - 10, 65)
        cv2.rectangle(display_frame, (x1, y_label - 30),
                     (x1 + label_size[0] + 10, y_label), color, -1)
        
        # Draw label text
        cv2.putText(display_frame, label, (x1 + 5, y_label - 8),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    # Recent detections sidebar
    current_time = time.time()
    
    with settings.detections_lock:
        if camera_name in settings.recent_detections:
            recent = [d for d in settings.recent_detections[camera_name]
                     if current_time - d['timestamp'] < settings.DISPLAY_DURATION]
            
            settings.recent_detections[camera_name] = recent
            
            if recent:
                sidebar_x = w - 320
                sidebar_y = 80
                
                # Title
                # cv2.rectangle(display_frame, (sidebar_x, sidebar_y - 30),
                #              (w - 10, sidebar_y), (50, 50, 50), -1)
                # cv2.putText(display_frame, "Recent Detections", (sidebar_x + 10, sidebar_y - 8),
                #            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                # Recent entries
                # for idx, detection in enumerate(recent[-5:]):  # Show last 5
                #     y_pos = sidebar_y + (idx * 55)
                    
                #     cv2.rectangle(display_frame, (sidebar_x, y_pos),
                #                  (w - 10, y_pos + 50), (50, 50, 50), -1)
                #     cv2.rectangle(display_frame, (sidebar_x, y_pos),
                #                  (w - 10, y_pos + 50), (0, 255, 0), 2)
                    
                #     cv2.putText(display_frame, detection['name'], (sidebar_x + 10, y_pos + 25),
                #                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                #     cv2.putText(display_frame, detection['time'], (sidebar_x + 10, y_pos + 43),
                #                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
    
    # Footer with instructions
    cv2.rectangle(display_frame, (0, h - 35), (w, h), (40, 40, 40), -1)
    cv2.putText(display_frame, "Press 'Q' to quit | 'S' to save snapshot",
               (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    
    return display_frame


def display_thread(stop_event):
    """
    Display thread - handles all camera windows
    Creates one window per camera
    """
    if not settings.SHOW_WINDOWS:
        print("[Display] Running in headless mode (no windows)")
        while not stop_event.is_set():
            time.sleep(1)
        return
    
    print("[Display] Starting display thread...")
    
    # Create windows for each camera
    windows_created = set()
    
    while not stop_event.is_set():
        try:
            with settings.frame_data_lock:
                cameras = list(settings.frame_data.keys())
            
            # Create windows for new cameras
            for camera_name in cameras:
                if camera_name not in windows_created:
                    window_name = f"Camera: {camera_name}"
                    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
                    cv2.resizeWindow(window_name, 1280, 720)
                    windows_created.add(camera_name)
                    print(f"[Display] Created window for {camera_name}")
            
            # Update each camera window
            for camera_name in cameras:
                with settings.frame_data_lock:
                    data = settings.frame_data.get(camera_name, {}).copy()
                
                if data.get('frame') is not None:
                    # Draw UI on frame
                    display_frame = draw_camera_ui(
                        data['frame'],
                        camera_name,
                        data.get('faces', []),
                        data.get('recognized_faces', {})
                    )
                    
                    if display_frame is not None:
                        window_name = f"Camera: {camera_name}"
                        cv2.imshow(window_name, display_frame)
            
            # Handle keyboard input
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('q') or key == ord('Q') or key == 27:  # Q or ESC
                print("\n[Display] Quit requested")
                stop_event.set()
                break
            
            elif key == ord('s') or key == ord('S'):
                # Save snapshots of all cameras
                from pathlib import Path
                snapshot_dir = Path("snapshots")
                snapshot_dir.mkdir(exist_ok=True)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                
                with settings.frame_data_lock:
                    for camera_name in cameras:
                        data = settings.frame_data.get(camera_name, {})
                        frame = data.get('frame')
                        
                        if frame is not None:
                            snapshot_path = snapshot_dir / f"{camera_name}_{timestamp}.jpg"
                            cv2.imwrite(str(snapshot_path), frame)
                            print(f"[Display] Saved snapshot: {snapshot_path}")
        
        except Exception as e:
            print(f"[Display] Error: {e}")
            time.sleep(0.1)
    
    # Cleanup
    cv2.destroyAllWindows()
    print("[Display] Display thread stopped")
