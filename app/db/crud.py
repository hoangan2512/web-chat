from sqlalchemy.orm import Session, joinedload
from . import models
from typing import List, Optional
from ..schemas import user as user_schema
from ..schemas import message as message_schema
from ..schemas import conversation as conversation_schema
from ..core.security import get_password_hash

#1, USER CRUD

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: user_schema.UserCreate) -> models.User:
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username, 
        hashed_password=hashed_password,
        avatar_url=user.avatar_url
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_status(db: Session, user_id: int, is_online: bool) -> Optional[models.User]:
    db_user = get_user(db, user_id)
    if db_user:
        db_user.is_online = is_online
        db.commit()
        db.refresh(db_user)
    return db_user

#2, CONVERSATION AND PARTICIPANT CRUD

def create_conversation(
    db: Session,
    creator_id: int,
    participant_ids: List[int],
    is_group: bool = False,
    name: Optional[str] = None
) -> models.Conversation:
    
    db_conversation = models.Conversation(is_group=is_group, name=name)
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    
    all_member_ids = list(set([creator_id] + participant_ids))
    
    for u_id in all_member_ids:
        participant = models.Participant(
            user_id=u_id,
            conversation_id=db_conversation.id
        )
        db.add(participant)
    db.commit()
    return db_conversation

def get_user_conversations(db: Session, user_id: int) -> List[models.Conversation]:
    return (
        db.query(models.Conversation)
        .join(models.Participant)
        .filter(models.Participant.user_id == user_id)
        .options(
            joinedload(models.Conversation.participants).joinedload(models.Participant.user),
            joinedload(models.Conversation.messages)
        )
        .all()
    )
    
def check_user_in_conversation(db: Session, user_id: int, conversation_id: int) -> bool:
    participant = (
        db.query(models.Participant).filter(
            models.Participant.user_id == user_id,
            models.Participant.conversation_id == conversation_id
        )
        .first()
    )
    return participant is not None
    

#3, MESSAGE CRUD

def create_message(db: Session, content: str, sender_id: int, conversation_id: int) -> models.Message:
    db_message = models.Message(content=content, sender_id=sender_id, conversation_id=conversation_id)
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_conversation_messages(
    db: Session,
    conversation_id: int,
    skip: int = 0,
    limit: int = 50
) -> List[models.Message]:
    return (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation_id)
        .order_by(models.Message.timestamp.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def add_participant_to_conversation(db: Session, conversation_id: int, user_id: int) -> models.Participant:
    participant = models.Participant(user_id=user_id, conversation_id=conversation_id)
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant

def delete_conversation(db: Session, conversation_id: int):
    # 1. Delete all messages
    db.query(models.Message).filter(models.Message.conversation_id == conversation_id).delete()
    # 2. Delete all participants
    db.query(models.Participant).filter(models.Participant.conversation_id == conversation_id).delete()
    # 3. Delete conversation itself
    db.query(models.Conversation).filter(models.Conversation.id == conversation_id).delete()
    db.commit()