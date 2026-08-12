from pydantic import BaseModel, ConfigDict
from typing import Optional

class UserUpdate(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
