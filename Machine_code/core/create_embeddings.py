import os
import sys
import cv2
import pickle
import numpy as np
import faiss
import shutil
from datetime import datetime
from insightface.app import FaceAnalysis
from pathlib import Path

# ─────────────────────────────────────────────
# CONFIG — dynamic paths based on project root
# ─────────────────────────────────────────────
CORE_DIR = Path(__file__).resolve().parent
BASE_DIR = CORE_DIR.parent.parent

# Add Machine_code parent directory to sys.path so we can import from core and config
sys.path.append(str(CORE_DIR.parent))

DATABASE_DIR  = str(BASE_DIR / "Machine_code/config/dec25_jan26/Total_Database")
OUTPUT_PKL    = str(BASE_DIR / "Machine_code/config/face_metadata_all_embeddings.pkl")
OUTPUT_FAISS  = str(BASE_DIR / "Machine_code/config/face_index_all_embeddings.faiss")
EMBEDDING_DIM = 512                          # Buffalo-L default
# ─────────────────────────────────────────────

def sync_db_images_locally(database_dir):
    """
    Sync all mapped face images from ClickHouse/MinIO to the local Total_Database folder.
    """
    print("🔄 Synchronizing mapped face images from ClickHouse and MinIO...")
    try:
        from core.clickhouse_manager import ClickHouseManager
        from core.minio_uploader import MinioUploader
        
        ch = ClickHouseManager()
        if not ch.ensure_connection():
            print("❌ Failed to connect to ClickHouse.")
            return
            
        minio = MinioUploader()
        
        # 1. Get all employees with 'Mapped' face status
        emp_query = "SELECT code, name FROM employees WHERE face_status = 'Mapped'"
        emp_res = ch.client.query(emp_query)
        mapped_employees = {row[0]: row[1] for row in emp_res.result_rows}
        
        if not mapped_employees:
            print("ℹ️ No mapped employees found in ClickHouse database.")
            return
            
        print(f"👥 Found {len(mapped_employees)} mapped employees in ClickHouse.")
        
        # 2. Get all assigned face mapping images
        fm_query = "SELECT emp_code, image_path FROM face_mappings WHERE status = 'Assigned'"
        fm_res = ch.client.query(fm_query)
        
        download_count = 0
        for row in fm_res.result_rows:
            emp_code, image_path = row
            if emp_code not in mapped_employees or not image_path:
                continue
                
            emp_name = mapped_employees[emp_code]
            
            # Extract key from path: e.g. /totalfacedatabase/73 East/... -> 73 East/...
            bucket_prefix = "/totalfacedatabase/"
            bucket_prefix_alt = "totalfacedatabase/"
            
            object_key = image_path
            if object_key.startswith(bucket_prefix):
                object_key = object_key[len(bucket_prefix):]
            elif object_key.startswith(bucket_prefix_alt):
                object_key = object_key[len(bucket_prefix_alt):]
            else:
                object_key = object_key.lstrip('/')
                
            # Local path in Total_Database/Employee_Name/
            filename = os.path.basename(object_key)
            local_folder = os.path.join(database_dir, emp_name)
            local_filepath = os.path.join(local_folder, filename)
            
            # Check if file exists locally, if not download
            if not os.path.exists(local_filepath):
                print(f"📥 Downloading new image for {emp_name}: {filename}")
                if minio.download_file(object_key, local_filepath):
                    download_count += 1
                else:
                    print(f"⚠️ Failed to download: {object_key}")
                    
        print(f"✅ Sync complete. Downloaded {download_count} new images.")
        
    except Exception as e:
        print(f"⚠️ Error during local database sync: {e}")

def build_face_index(database_dir, output_pkl, output_faiss):
    # First, sync remote database images locally
    sync_db_images_locally(database_dir)

    # Initialize InsightFace Buffalo-L
    print("\n[INIT] Loading InsightFace Buffalo-L model...")
    # Use ctx_id=-1 for CPU if no GPU is available/detected
    app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("[INIT] Model loaded successfully.\n")

    all_embeddings = []   # List of np arrays (512,)
    metadata = []         # List of dicts: {name, image_path, embedding_index}

    supported_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    person_dirs = sorted([
        d for d in Path(database_dir).iterdir() if d.is_dir()
    ])

    if not person_dirs:
        print("[ERROR] No subfolders found in the database directory.")
        return

    print(f"[INFO] Found {len(person_dirs)} person(s) in database.\n")
    print("=" * 55)

    total_images     = 0
    total_embeddings = 0
    skipped_images   = 0

    for i, person_dir in enumerate(person_dirs):
        person_name = person_dir.name
        image_files = [
            f for f in person_dir.iterdir()
            if f.suffix.lower() in supported_exts
        ]

        print(f"[{i+1}/{len(person_dirs)}] [PERSON] {person_name}")
        print(f"         Images found : {len(image_files)}")

        person_embeddings = 0
        person_skipped    = 0

        for img_path in sorted(image_files):
            npy_path = img_path.with_suffix(img_path.suffix + ".npy")
            
            embedding = None
            if npy_path.exists():
                try:
                    embedding = np.load(str(npy_path))
                except Exception:
                    embedding = None

            if embedding is None:
                img = cv2.imread(str(img_path))
                if img is None:
                    print(f"         [SKIP] Could not read: {img_path.name}")
                    person_skipped += 1
                    continue

                faces = app.get(img)

                if len(faces) == 0:
                    print(f"         [SKIP] No face detected: {img_path.name}")
                    person_skipped += 1
                    continue

                # Pick the largest face by bbox area
                face = max(faces, key=lambda f: (
                    (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
                ))

                embedding = face.normed_embedding.astype(np.float32)  # shape (512,)
                # Cache the embedding to disk for next time
                np.save(str(npy_path), embedding)

            metadata.append({
                "name":            person_name,
                "image_path":      str(img_path),
                "embedding_index": len(all_embeddings)
            })
            all_embeddings.append(embedding)
            person_embeddings += 1

        print(f"         Embeddings added : {person_embeddings}")
        if person_skipped:
            print(f"         Skipped          : {person_skipped}")
        
        total_images     += len(image_files)
        total_embeddings += person_embeddings
        skipped_images   += person_skipped

    print("=" * 55)
    print(f"[SUMMARY] Total persons     : {len(person_dirs)}")
    print(f"[SUMMARY] Total images      : {total_images}")
    print(f"[SUMMARY] Total embeddings  : {total_embeddings}")
    print(f"[SUMMARY] Skipped images    : {skipped_images}")
    print("=" * 55)

    if total_embeddings == 0:
        print("[ERROR] No embeddings generated. Check your images/model.")
        return

    # 1. Prepare temporary paths
    temp_pkl = output_pkl + ".tmp"
    temp_faiss = output_faiss + ".tmp"

    # 2. Build FAISS index
    print("\n[FAISS] Building index...")
    embedding_matrix = np.stack(all_embeddings, axis=0)
    faiss.normalize_L2(embedding_matrix)

    index = faiss.IndexFlatIP(EMBEDDING_DIM)
    index.add(embedding_matrix)
    print(f"[FAISS] Index built with {index.ntotal} vectors.")

    # 3. Save to temporary files first
    faiss.write_index(index, temp_faiss)
    with open(temp_pkl, "wb") as f:
        pickle.dump(metadata, f)

    # 4. Backup old files if they exist
    today_str = datetime.today().strftime('%d_%m_%y')
    if os.path.exists(output_pkl):
        backup_pkl = os.path.splitext(output_pkl)[0] + f"_old_{today_str}.pkl"
        shutil.copy2(output_pkl, backup_pkl)
        print(f"[BACKUP] Saved {backup_pkl}")

    if os.path.exists(output_faiss):
        backup_faiss = os.path.splitext(output_faiss)[0] + f"_old_{today_str}.faiss"
        shutil.copy2(output_faiss, backup_faiss)
        print(f"[BACKUP] Saved {backup_faiss}")

    # 5. Atomic swap: Move temp files to final destination
    os.replace(temp_pkl, output_pkl)
    os.replace(temp_faiss, output_faiss)

    print(f"\n[DONE] Files generated and swapped successfully.")
    print(f"       → {output_pkl}")
    print(f"       → {output_faiss}")


if __name__ == "__main__":
    # Ensure output directory exists
    Path(OUTPUT_PKL).parent.mkdir(parents=True, exist_ok=True)
    build_face_index(DATABASE_DIR, OUTPUT_PKL, OUTPUT_FAISS)
