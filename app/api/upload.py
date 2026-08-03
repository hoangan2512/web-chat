from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import shutil
import os
import uuid
import urllib.parse
from ..core.security import get_current_user
from ..db import models

router = APIRouter(tags=["Upload"])

UPLOAD_DIR = "app/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    # Split filename and extension
    _, ext = os.path.splitext(file.filename)
    
    # Store file using an alphanumeric UUID for safety on Windows filesystems
    safe_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
        
    # URL encode the original filename as a query parameter for rendering
    encoded_name = urllib.parse.quote(file.filename)
    return {
        "filename": file.filename,
        "url": f"/uploads/{safe_filename}?name={encoded_name}"
    }
