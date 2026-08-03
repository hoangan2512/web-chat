from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime
from .user import UserResponse
from ..core.config import to_gmt7

class ConversationBase(BaseModel):
    is_group: bool = False
    name: Optional[str] = None
    
class ConversationCreate(ConversationBase):
    participant_ids: List[int]

class ParticipantWithUser(BaseModel):
    id: int
    user_id: int
    joined_at: datetime
    user: UserResponse
    
    model_config = ConfigDict(from_attributes=True)

    @field_validator('joined_at', mode='before')
    @classmethod
    def format_joined_at(cls, v):
        return to_gmt7(v)

class MessageMin(BaseModel):
    id: int
    content: str
    timestamp: datetime
    sender_id: int
    is_read: bool
    
    model_config = ConfigDict(from_attributes=True)

    @field_validator('timestamp', mode='before')
    @classmethod
    def format_timestamp(cls, v):
        return to_gmt7(v)

class ConversationResponse(ConversationBase):
    id: int
    created_at: datetime
    participants: List[ParticipantWithUser] = []
    messages: List[MessageMin] = []
    
    model_config = ConfigDict(from_attributes=True)

    @field_validator('created_at', mode='before')
    @classmethod
    def format_created_at(cls, v):
        return to_gmt7(v)