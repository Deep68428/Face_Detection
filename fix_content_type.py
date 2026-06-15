import boto3

s3 = boto3.client(
    "s3",
    endpoint_url="http://216.48.180.4:9010",
    aws_access_key_id="admin",
    aws_secret_access_key="Admin@123456"
)

bucket_name = "totalfacedatabase"

def fix_content_types():
    try:
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket_name):
            if 'Contents' not in page:
                continue
            
            for obj in page['Contents']:
                key = obj['Key']
                # Copy object over itself to update metadata
                s3.copy_object(
                    Bucket=bucket_name,
                    Key=key,
                    CopySource={'Bucket': bucket_name, 'Key': key},
                    MetadataDirective='REPLACE',
                    ContentType='image/jpeg'
                )
                print(f"✅ Fixed ContentType for: {key}")
        print("🎉 All existing MinIO images updated successfully!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_content_types()
