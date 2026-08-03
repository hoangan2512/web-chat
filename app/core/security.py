from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import hashlib
from jose import jwt
import os
from dotenv import load_dotenv
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status, WebSocketException, Query
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from ..db.session import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
EXPIRE_MINUTES_STR = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
ACCESS_TOKEN_EXPIRE_MINUTES = int(EXPIRE_MINUTES_STR)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    pre_hashed = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return pwd_context.hash(pre_hashed)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pre_hashed = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    
    return pwd_context.verify(pre_hashed, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from ..db import crud

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token is invalid or expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = crud.get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    
    return user

def get_current_user_ws(
    token: str = Query(...),
    
    db: Session = Depends(get_db)
):
    from ..db import crud

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
        username: str = payload.get("sub")
        if username is None:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    except JWTError:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    
    user = crud.get_user_by_username(db, username=username)
    if user is None:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    
    return user