"""
Image proxy — fetches images from MinIO server-side and serves them to the browser.
This completely avoids Chrome's Private Network Access (PNA) CORS block where
the browser refuses to load images from a different port (9010) than the UI (8080).
"""
import urllib.parse
import urllib.request
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from app.config import get_settings

router = APIRouter(prefix="/api/images/proxy", tags=["image-proxy"])
settings = get_settings()


@router.get("/{path:path}")
def proxy_minio_image(path: str):
    """
    Proxies image from MinIO through the backend.
    FastAPI automatically URL-decodes path params (spaces etc.), so we re-encode.
    URL pattern: /api/images/proxy/totalfacedatabase/73 East/...
    """
    # Re-encode the path so spaces become %20 again for the HTTP request to MinIO
    encoded_path = urllib.parse.quote(path, safe="/")
    minio_url = f"{settings.minio_endpoint}/{encoded_path}"

    try:
        req = urllib.request.Request(minio_url, headers={"User-Agent": "AttendanceProxy/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read()
            content_type = response.headers.get("Content-Type", "image/jpeg")
            return Response(
                content=content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*",
                },
            )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Image not found: {e}")
