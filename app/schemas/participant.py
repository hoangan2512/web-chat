from pydantic import BaseModel, ConfigDict
from datetime import datetime

class ParticipantBase(BaseModel):
    user_id: int
    conversation_id: int

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantResponse(ParticipantBase):
    id: int
    joined_at: datetime
    
    model_config = ConfigDict(from_attributes=True)