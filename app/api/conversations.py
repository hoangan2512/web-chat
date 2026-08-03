from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..db.session import get_db
from ..db import crud, models
from ..schemas import conversation as conversation_schema
from ..schemas import message as message_schema
from ..core.security import get_current_user

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"]
)

@router.post("/", response_model=conversation_schema.ConversationResponse)
def create_new_conversation(
    conv_in: conversation_schema.ConversationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_conv = crud.create_conversation(
        db=db,
        creator_id=current_user.id,
        participant_ids=conv_in.participant_ids,
        is_group=conv_in.is_group,
        name=conv_in.name
    )
    return new_conv

@router.get("/", response_model=List[conversation_schema.ConversationResponse])
def get_my_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_user_conversations(db=db, user_id=current_user.id)

@router.get("/user/{user_id}", response_model=List[conversation_schema.ConversationResponse])
def get_conversations_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify they are checking their own conversations or are authorized
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view other user's conversations"
        )
    db_user = crud.get_user(db, user_id=user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not exist"
        )
    conversations = crud.get_user_conversations(db=db, user_id=user_id)
    return conversations

@router.get("/{conversation_id}/messages", response_model=List[message_schema.MessageResponse])
def get_messages_in_conversation(
    conversation_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    is_member = crud.check_user_in_conversation(db, user_id=current_user.id, conversation_id=conversation_id)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not in this conversation"
        )
    
    # Automatically mark all messages from other senders as read
    db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id,
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False
    ).update({models.Message.is_read: True}, synchronize_session=False)
    db.commit()
    
    messages = crud.get_conversation_messages(
        db=db,
        conversation_id=conversation_id,
        skip=skip,
        limit=limit
    )
    
    return messages

@router.post("/{conversation_id}/add-member")
def add_member_to_group(
    conversation_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify the conversation exists and is a group chat
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if not conv.is_group:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add members to 1-on-1 conversations")
        
    # Verify current user is a member of the conversation
    is_member = crud.check_user_in_conversation(db, user_id=current_user.id, conversation_id=conversation_id)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this group")
        
    # Verify the user to add exists
    user_to_add = crud.get_user(db, user_id=user_id)
    if not user_to_add:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User to add not found")
        
    # Verify user is not already in conversation
    already_in = crud.check_user_in_conversation(db, user_id=user_id, conversation_id=conversation_id)
    if already_in:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already in this conversation")
        
    crud.add_participant_to_conversation(db, conversation_id=conversation_id, user_id=user_id)
    
    # Create system message
    crud.create_message(
        db=db,
        content=f"[System]: {user_to_add.username} has been added to the group by {current_user.username}.",
        sender_id=current_user.id,
        conversation_id=conversation_id
    )
    
    return {"detail": "User added successfully"}

@router.delete("/{conversation_id}")
def delete_chat_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify the conversation exists
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        
    # Verify current user is a member of the conversation
    is_member = crud.check_user_in_conversation(db, user_id=current_user.id, conversation_id=conversation_id)
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this conversation")
        
    crud.delete_conversation(db, conversation_id=conversation_id)
    return {"detail": "Conversation deleted successfully"}