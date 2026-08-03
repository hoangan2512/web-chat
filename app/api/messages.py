from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..db import crud, models
from ..db.session import get_db
from ..schemas import message as message_schema
from ..core.security import get_current_user

router = APIRouter(
    prefix="/messages",
    tags = ["Messages"]
)

@router.post("/", response_model=message_schema.MessageResponse)
def create_message(
    message: message_schema.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Ensure user can only send messages as themselves
    if current_user.id != message.sender_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot send messages as another user"
        )
    
    # Check if conversation exists and user is part of it
    is_member = crud.check_user_in_conversation(db, user_id=current_user.id, conversation_id=message.conversation_id)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation"
        )
        
    return crud.create_message(
        db=db,
        content=message.content,
        sender_id=message.sender_id,
        conversation_id=message.conversation_id
    )

@router.get("/", response_model=List[message_schema.MessageResponse])
def read_messages(
    conversation_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    is_member = crud.check_user_in_conversation(db, user_id=current_user.id, conversation_id=conversation_id)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation"
        )
        
    messages = crud.get_conversation_messages(db, conversation_id=conversation_id, skip=skip, limit=limit)
    return messages