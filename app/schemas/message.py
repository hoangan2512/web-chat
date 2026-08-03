from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional
from ..core.config import to_gmt7

class UserMin(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class MessageBase(BaseModel):
    content: str
    conversation_id: int
    
class MessageCreate(MessageBase):
    sender_id: int
    
class MessageResponse(MessageBase):
    id: int
    sender_id: int
    timestamp: datetime
    is_read: bool
    sender: Optional[UserMin] = None
    
    model_config = ConfigDict(from_attributes=True)

    @field_validator('timestamp', mode='before')
    @classmethod
    def format_timestamp(cls, v):
        return to_gmt7(v)