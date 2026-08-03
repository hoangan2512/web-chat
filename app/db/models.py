from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .session import Base
from sqlalchemy.sql import func
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    avatar_url = Column(String, nullable=False)
    is_online = Column(Boolean, default=False)
    last_active_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    messages = relationship("Message", back_populates="sender")
    participations = relationship("Participant", back_populates="user")
    

    
class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    is_group = Column(Boolean, default=False)
    name = Column(String, nullable=True) #Dùng cho nhóm chat
    created_at = Column("joined_at", DateTime(timezone=True), default=func.now())
    
    messages = relationship("Message", back_populates="conversation", order_by="Message.timestamp.asc()")
    participants = relationship("Participant", back_populates="conversation")
    
class Participant(Base):
    __tablename__ = "participants"
    
    id =Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    joined_at = Column(DateTime(timezone=True), default=func.now())
    
    user = relationship("User", back_populates="participations")
    conversation = relationship("Conversation", back_populates="participants")

class Message(Base):
    
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=func.now())
    sender_id = Column(Integer, ForeignKey("users.id"))
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    is_read = Column(Boolean, default=False)
    
    sender = relationship("User", back_populates="messages")
    conversation = relationship("Conversation", back_populates="messages")