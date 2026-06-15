import boto3
import json

s3 = boto3.client(
    "s3",
    endpoint_url="http://216.48.180.4:9010",
    aws_access_key_id="admin",
    aws_secret_access_key="Admin@123456"
)

bucket_name = "totalfacedatabase"

policy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
        }
    ]
}

try:
    s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(policy))
    print("Bucket policy successfully set to PUBLIC READ!")
except Exception as e:
    print(f"Failed to set bucket policy: {e}")
