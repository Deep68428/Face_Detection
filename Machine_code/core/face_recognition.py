"""
Face Recognition System using InsightFace and FAISS
Simplified for multi-camera presence detection
"""

import cv2
import numpy as np
import pickle
import os
import faiss
from pathlib import Path
from collections import Counter
from insightface.app import FaceAnalysis

from config import settings


class FaceRecognitionSystem:
    def __init__(self):
        print("🚀 Loading InsightFace...")

        self.face_app = FaceAnalysis(
            providers=['CPUExecutionProvider'],
            provider_options=[{}]
        )

        self.face_app.prepare(ctx_id=-1, det_size=(640, 640))

        self.index_file = os.path.join(settings.FACE_DB_PATH, "face_index_all_embeddings.faiss")
        self.meta_file = os.path.join(settings.FACE_DB_PATH, "face_metadata_all_embeddings.pkl")
        self.last_load_time = 0

        print("📁 Loading database embeddings with FAISS...")
        self._load_database()

        unique_people = len(set(self.id_to_name))
        print(f"✅ Loaded {unique_people} people with {self.index.ntotal} total embeddings")

        self.print_database_stats()
        print("✅ Face recognition system ready!")

    # ---------------------------------------------------
    # DATABASE LOADING
    # ---------------------------------------------------

    def _load_database(self):
        """Build FAISS index with ALL quality embeddings per person"""

        self.embedding_dim = 512
        self.index = faiss.IndexFlatIP(self.embedding_dim)
        self.id_to_name = []

        # ---------------------------
        # LOAD CACHE
        # ---------------------------
        if os.path.exists(self.index_file) and os.path.exists(self.meta_file):
            try:
                print(f"✅ Loading FAISS index from {self.index_file}")

                self.index = faiss.read_index(self.index_file)

                with open(self.meta_file, "rb") as f:
                    self.id_to_name = pickle.load(f)
                
                self.last_load_time = os.path.getmtime(self.index_file)

                print(f"✅ Loaded {len(self.id_to_name)} embeddings from cache")

                # 🔥 FIX: normalize structure (dict -> string)
                self.id_to_name = [
                    item['name'] if isinstance(item, dict) else item
                    for item in self.id_to_name
                ]

                return

            except Exception as e:
                print(f"⚠️ Cache corrupt, rebuilding: {e}")

        # ---------------------------
        # BUILD DATABASE
        # ---------------------------
        print("🛠️ Building FAISS index with ALL quality embeddings per person...")

        # FIX: Point to the actual master database directory (dynamic path)
        core_dir = Path(__file__).resolve().parent
        base_dir = core_dir.parent.parent
        db_path = base_dir / "Machine_code/config/dec25_jan26/Total_Database"
        all_embeddings = []

        if not db_path.exists():
            print(f"⚠️ Master database directory not found at {db_path}!")
            return

        for person_dir in db_path.iterdir():
            if not person_dir.is_dir() or person_dir.name in ["NoFace_detected", "Unknown"]:
                continue

            person_name = person_dir.name
            person_embeddings = []

            print(f"   Processing {person_name}...")

            for img_path in person_dir.glob("*.jpg"):
                try:
                    img = cv2.imread(str(img_path))
                    if img is None:
                        continue

                    faces = self.face_app.get(img)
                    if not faces:
                        continue

                    face = faces[0]
                    det_score = getattr(face, "det_score", 0.5)

                    if det_score < 0.65:
                        continue

                    emb = face.embedding.astype("float32")
                    emb /= np.linalg.norm(emb)

                    person_embeddings.append(emb)

                except Exception:
                    continue

            if person_embeddings:
                print(f"      → Collected {len(person_embeddings)} embeddings")

                if len(person_embeddings) > 8:
                    person_embeddings = self._remove_outliers(person_embeddings)

                for emb in person_embeddings:
                    all_embeddings.append(emb)
                    self.id_to_name.append(person_name)

                print(f"      ✅ Added {len(person_embeddings)} embeddings")
            else:
                print(f"      ⚠️ No valid embeddings")

        # ---------------------------
        # BUILD FAISS INDEX
        # ---------------------------
        if all_embeddings:
            embeddings_matrix = np.vstack(all_embeddings)
            self.index.add(embeddings_matrix)

            faiss.write_index(self.index, self.index_file)

            with open(self.meta_file, "wb") as f:
                pickle.dump(self.id_to_name, f)
            
            self.last_load_time = os.path.getmtime(self.index_file)

            print(f"✅ FAISS index ready with {self.index.ntotal} embeddings")
        else:
            print("⚠️ No embeddings found!")

    # ---------------------------------------------------
    # OUTLIER REMOVAL
    # ---------------------------------------------------

    def _remove_outliers(self, embeddings):
        if len(embeddings) < 3:
            return embeddings

        try:
            embeddings_array = np.array(embeddings)
            similarities = np.dot(embeddings_array, embeddings_array.T)

            avg_similarities = np.mean(similarities, axis=1)

            threshold = np.median(avg_similarities) - 0.15
            good_indices = avg_similarities > threshold

            filtered = [
                emb for i, emb in enumerate(embeddings)
                if good_indices[i]
            ]

            return filtered if filtered else embeddings

        except Exception:
            return embeddings

    # ---------------------------------------------------
    # STATS
    # ---------------------------------------------------

    def print_database_stats(self):
        print("\n📊 Database Statistics:")

        total_embeddings = self.index.ntotal

        names = self.id_to_name  # already normalized

        unique_people = len(set(names))

        print(f"   Total people: {unique_people}")
        print(f"   Total embeddings: {total_embeddings}")

        if unique_people > 0:
            counts = Counter(names)

            avg_embeddings = total_embeddings / unique_people
            print(f"   Average per person: {avg_embeddings:.1f}")

            low_count = [(name, cnt) for name, cnt in counts.items() if cnt < 5]

            if low_count:
                print("\n   ⚠️ People with <5 embeddings:")
                for name, cnt in sorted(low_count, key=lambda x: x[1])[:10]:
                    print(f"      {name}: {cnt}")

    # ---------------------------------------------------
    # RECOGNITION
    # ---------------------------------------------------

    def recognize_faces(self, faces):
        # Check if database has been updated on disk
        try:
            if os.path.exists(self.index_file):
                current_mtime = os.path.getmtime(self.index_file)
                if current_mtime > self.last_load_time + 5: # 5s grace period
                    print("🔄 Database update detected! Reloading embeddings...")
                    self._load_database()
                    print(f"✅ Reloaded: {len(set(self.id_to_name))} people")
        except Exception as e:
            print(f"⚠️ Error checking for DB update: {e}")

        recognized = {}

        if self.index.ntotal == 0:
            return recognized

        for i, face in enumerate(faces):
            if face.embedding is None:
                continue

            face_id = f"Face_{i+1}"

            emb = face.embedding.astype("float32")
            emb /= np.linalg.norm(emb)
            emb = emb.reshape(1, -1)

            k = min(5, self.index.ntotal)
            scores, indices = self.index.search(emb, k=k)

            best_match = None
            best_score = 0

            for idx, score in zip(indices[0], scores[0]):
                score = float(score)

                if idx >= 0 and score >= settings.SIMILARITY_THRESHOLD:
                    if score > best_score:
                        best_score = score
                        best_match = (self.id_to_name[idx], score)

                    if score > 0.80:
                        break

            if best_match:
                recognized[face_id] = best_match

        return recognized