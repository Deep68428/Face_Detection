import boto3
from botocore.client import Config

s3 = boto3.client(
    "s3",
    endpoint_url="http://216.48.180.4:9010",
    aws_access_key_id="admin",
    aws_secret_access_key="Admin@123456",
    config=Config(signature_version="s3v4")
)

try:
    print(s3.list_buckets())
    print("Success on port 9000")
except Exception as e:
    print(f"Error on port 9000: {e}")

s3_9011 = boto3.client(
    "s3",
    endpoint_url="http://216.48.180.4:9011",
    aws_access_key_id="admin",
    aws_secret_access_key="Admin@123456",
    config=Config(signature_version="s3v4")
)

try:
    print(s3_9011.list_buckets())
    print("Success on port 9011")
except Exception as e:
    print(f"Error on port 9011: {e}")

