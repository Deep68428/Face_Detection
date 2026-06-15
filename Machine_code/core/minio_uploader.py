import boto3
from botocore.exceptions import ClientError
from botocore.client import Config
from pathlib import Path
import os
from config import settings

class MinioUploader:
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "http://216.48.180.4:9010")
        self.access_key = os.getenv("MINIO_ACCESS_KEY", "admin")
        self.secret_key = "Admin@123456"
        self.bucket_name = "totalfacedatabase"
        self.client = None
        # Connect lazily to avoid hanging on import

    def _connect(self):
        try:
            self.client = boto3.client(
                "s3",
                endpoint_url=self.endpoint,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=Config(signature_version="s3v4")
            )
            # Ensure bucket exists
            try:
                self.client.head_bucket(Bucket=self.bucket_name)
            except ClientError:
                self.client.create_bucket(Bucket=self.bucket_name)
                print(f"🪣 Created MinIO bucket: {self.bucket_name}")
            return True
        except Exception as e:
            self.client = None
            print(f"❌ MinIO connection failed: {e}")
            return False

    def upload_file(self, local_file_path: str, object_key: str) -> str:
        """
        Upload a file to MinIO and return the object URL path.
        """
        if not self.client:
            if not self._connect():
                return None
                
        try:
            # object_key should be relative, e.g., "01_05_2026/Reception/Unknown/img.jpg"
            object_key = object_key.replace("\\", "/")
            self.client.upload_file(
                local_file_path, 
                self.bucket_name, 
                object_key,
                ExtraArgs={'ContentType': 'image/jpeg'}
            )
            
            # The URL path for frontend to use (e.g. /totalfacedatabase/...)
            return f"/{self.bucket_name}/{object_key}"
            
        except Exception as e:
            print(f"❌ MinIO upload error for {object_key}: {e}")
            return None

    def download_file(self, object_key: str, local_file_path: str) -> bool:
        """
        Download a file from MinIO.
        """
        if not self.client:
            if not self._connect():
                return False
                
        try:
            object_key = object_key.replace("\\", "/")
            os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
            self.client.download_file(
                self.bucket_name,
                object_key,
                local_file_path
            )
            return True
        except Exception as e:
            print(f"❌ MinIO download error for {object_key}: {e}")
            return False

    def clean_old_objects(self, days=30):
        """
        Delete objects in the bucket that are older than the specified number of days.
        """
        if not self.client:
            if not self._connect():
                return
                
        try:
            from datetime import datetime, timezone
            # List all objects in bucket
            paginator = self.client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name)
            
            delete_keys = []
            now = datetime.now(timezone.utc)
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        last_modified = obj['LastModified']
                        age_days = (now - last_modified).days
                        if age_days > days:
                            # Do not delete Total_Database files (mapped employees images)
                            if obj['Key'].startswith("Total_Database/") or obj['Key'].startswith("dec25_jan26/"):
                                continue
                            delete_keys.append({'Key': obj['Key']})
                            
            # Delete in batches of 1000
            if delete_keys:
                print(f"🗑️ Found {len(delete_keys)} old objects in MinIO to delete.")
                for i in range(0, len(delete_keys), 1000):
                    batch = delete_keys[i:i+1000]
                    self.client.delete_objects(
                        Bucket=self.bucket_name,
                        Delete={'Objects': batch}
                    )
                print("✅ MinIO old objects deleted successfully.")
            else:
                print("ℹ️ No old objects found in MinIO.")
        except Exception as e:
            print(f"❌ Error cleaning old MinIO objects: {e}")

