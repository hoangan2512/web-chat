from fastapi import APIRouter, Depends, HTTPException
from ..core.security import get_current_user
from sqlalchemy.orm import Session
from ..db import crud, models
from ..db.session import get_db
from ..schemas import user as user_schema
from typing import List

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.post("/", response_model=user_schema.UserResponse)
def create_user(user: user_schema.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    return crud.create_user(db=db, user=user)

from ..schemas.user_update import UserUpdate

@router.get("/me", response_model=user_schema.UserResponse)
def get_my_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=user_schema.UserResponse)
def update_profile(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if user_in.username:
        if user_in.username != current_user.username:
            existing = db.query(models.User).filter(models.User.username == user_in.username).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username is already taken")
            current_user.username = user_in.username
    if user_in.avatar_url is not None:
        current_user.avatar_url = user_in.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/", response_model=List[user_schema.UserResponse])
def list_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    users = db.query(models.User).filter(models.User.id != current_user.id).all()
    return users

@router.get("/{user_id}", response_model=user_schema.UserResponse)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user