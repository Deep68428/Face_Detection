"""
Image saving utilities for detected faces
"""
import cv2
from datetime import datetime
from pathlib import Path

from config import settings
from .minio_uploader import MinioUploader

minio = MinioUploader()


class ImageSaver:
    @staticmethod
    def save_detection_image(frame, face, name, camera, confidence):
        """
        Save detected face image with organized folder structure
        
        Args:
            frame: Original frame
            face: InsightFace face object
            name: Person name
            camera: Camera identifier
            confidence: Recognition confidence
        
        Returns:
            str: Path to saved image, or None if failed
        """
        if not settings.SAVE_DETECTED_FACES:
            return None
        
        # Don't save low confidence unknowns (check for tracker names too)
        is_generic_unknown = name == "Unknown" or name.startswith("Unknown") or name.startswith("Face_")
        if is_generic_unknown and confidence < settings.MIN_CONFIDENCE_TO_SAVE:
            return None
        
        try:
            # Get bounding box
            bbox = face.bbox.astype(int)
            x1, y1, x2, y2 = bbox
            
            # Calculate scaled crop region
            w, h = x2 - x1, y2 - y1
            scale_w, scale_h = w * settings.CROP_SCALE, h * settings.CROP_SCALE
            x1 = max(0, int(x1 - scale_w/2))
            y1 = max(0, int(y1 - scale_h/2))
            x2 = min(frame.shape[1], int(x2 + scale_w/2))
            y2 = min(frame.shape[0], int(y2 + scale_h/2))
            
            # Crop face
            cropped = frame[y1:y2, x1:x2]
            if cropped.size == 0:
                return None
            
            # If it's an Unknown tracker, put it in a generic "Unknown" folder 
            effective_name = "Unknown" if name.startswith("Unknown") or name.startswith("Face_") else name
            
            # Get camera info from settings
            cam_info = settings.CAMERAS.get(camera)
            location = cam_info["location"] if cam_info else "Unknown_Location"
            camera_id = str(cam_info["id"]) if cam_info else "0"
            date_str = settings.CURRENT_DATE_STR
            
            # Create folder structure: BASE_DIR / Location / CameraID / Date / PersonName /
            # Example: /home/ethics/.../Machine_code/73 East/2/04_06_2026/Bhumika Jadeja/
            camera_folder = settings.BASE_DIR / location / camera_id / date_str / effective_name
            camera_folder.mkdir(parents=True, exist_ok=True)
            
            # Use original tracker name in filename so we can identify them
            timestamp = datetime.now().strftime('%H%M%S_%f')[:-3]
            filename = f"{name}_{camera}_{timestamp}_conf{confidence:.2f}.jpg"
            filepath = camera_folder / filename
            
            # Save image locally
            cv2.imwrite(str(filepath), cropped)
            
            # Return relative path for MinIO object key (Location/CameraID/Date/Name/filename)
            relative_path = f"{location}/{camera_id}/{date_str}/{effective_name}/{filename}"
            
            # Push to MinIO
            minio_url = minio.upload_file(str(filepath), relative_path)
            
            if minio_url:
                # Delete local file if successfully uploaded to MinIO to avoid local storage build-up
                try:
                    import os
                    if os.path.exists(str(filepath)):
                        os.remove(str(filepath))
                except Exception as e:
                    print(f"⚠️ Error deleting local file: {e}")
                return minio_url
            
            return str(relative_path)
            
        except Exception as e:
            print(f"⚠️  Image save error: {e}")
            return None
    
    @staticmethod
    def save_unknown_face(frame, face, camera):
        """
        Save unknown face to Unknown folder
        
        Args:
            frame: Original frame
            face: InsightFace face object
            camera: Camera identifier
        
        Returns:
            str: Path to saved image, or None if failed
        """
        try:
            det_score = getattr(face, 'det_score', 0.0)
            
            # Only save high-quality unknown faces
            if det_score < settings.MIN_CONFIDENCE_TO_SAVE:
                return None
            
            return ImageSaver.save_detection_image(frame, face, "Unknown", camera, det_score)
            
        except Exception as e:
            print(f"⚠️  Unknown face save error: {e}")
            return None
