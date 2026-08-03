from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional
from .message import MessageResponse
from datetime import datetime
from ..core.config import to_gmt7

class UserBase(BaseModel):
    username: str
    avatar_url: Optional[str] = None 
    
class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_online: bool
    last_active_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

    @field_validator('last_active_at', mode='before')
    @classmethod
    def format_last_active_at(cls, v):
        return to_gmt7(v)