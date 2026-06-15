# import os
# import boto3
# from botocore.client import Config

# MINIO_ENDPOINT = "http://localhost:9000"
# ACCESS_KEY = "NhaDYBlvXBmQvWXn9k5Q"
# SECRET_KEY = "BQAJUV0rvwonOXhx9qfsWx1N1TsJDwM8hYl2UmDB"
# BUCKET_NAME = "totalfacedatabase"

# s3 = boto3.client(
#     "s3",
#     endpoint_url=MINIO_ENDPOINT,
#     aws_access_key_id=ACCESS_KEY,
#     aws_secret_access_key=SECRET_KEY,
#     config=Config(signature_version="s3v4"),
# )

# # Create bucket if not exists
# try:
#     s3.head_bucket(Bucket=BUCKET_NAME)
# except:
#     s3.create_bucket(Bucket=BUCKET_NAME)

# LOCAL_FOLDER = "/home/ethics/ethics-facedetection-ai/Machine_code/Face_Database/01_05_2026/Outside-Left/Abhilasha Kashyap/"

# for root, dirs, files in os.walk(LOCAL_FOLDER):
#     for file in files:
#         local_path = os.path.join(root, file)

#         # keep folder structure
#         object_key = os.path.relpath(local_path, LOCAL_FOLDER)

#         print(f"Uploading {object_key}")

#         s3.upload_file(
#             local_path,
#             BUCKET_NAME,
#             object_key
#         )

# print("Upload completed!")





import os
import boto3
from botocore.exceptions import ClientError

# ==========================
# CONFIGURATION
# ==========================

MINIO_ENDPOINT = "http://216.48.180.4:9010"  # Change if needed
MINIO_ACCESS_KEY = "admin"
MINIO_SECRET_KEY = "Admin@123456"

BUCKET_NAME = "totalfacedatabase"

LOCAL_FOLDER = "/home/ethics/ethics-facedetection-ai/Machine_code/Face_Database/"

# ==========================
# CREATE S3 CLIENT
# ==========================

s3 = boto3.client(
    "s3",
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
)

# ==========================
# CREATE BUCKET IF NOT EXISTS
# ==========================

try:
    s3.head_bucket(Bucket=BUCKET_NAME)
    print(f"✓ Bucket exists: {BUCKET_NAME}")

except ClientError:
    print(f"Creating bucket: {BUCKET_NAME}")
    s3.create_bucket(Bucket=BUCKET_NAME)
    print(f"✓ Bucket created: {BUCKET_NAME}")

# ==========================
# COUNT FILES
# ==========================

total_files = 0

for root, dirs, files in os.walk(LOCAL_FOLDER):
    total_files += len(files)

print(f"\nFound {total_files} files\n")

# ==========================
# UPLOAD FILES
# ==========================

uploaded = 0
failed = 0

for root, dirs, files in os.walk(LOCAL_FOLDER):

    for filename in files:

        local_file = os.path.join(root, filename)

        # Example:
        # Face_Database/01_05_2026/Outside-Left/A/image.jpg
        #
        # becomes:
        # 01_05_2026/Outside-Left/A/image.jpg

        object_key = os.path.relpath(
            local_file,
            LOCAL_FOLDER
        ).replace("\\", "/")

        try:
            s3.upload_file(
                local_file,
                BUCKET_NAME,
                object_key,
                ExtraArgs={'ContentType': 'image/jpeg'}
            )

            uploaded += 1

            print(
                f"[{uploaded}/{total_files}] Uploaded -> {object_key}"
            )

        except Exception as e:
            failed += 1

            print(
                f"[ERROR] {object_key}\n{e}\n"
            )

# ==========================
# SUMMARY
# ==========================

print("\n====================")
print("UPLOAD COMPLETED")
print("====================")
print(f"Uploaded : {uploaded}")
print(f"Failed   : {failed}")
print("====================")