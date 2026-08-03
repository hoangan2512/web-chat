import sys
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, engine
from app.db import models
from app.core.security import get_password_hash

def populate():
    # Make sure tables are created
    models.Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # Check if database is already populated
        existing = db.query(models.User).filter(models.User.username == "demo").first()
        if existing:
            print("Database already populated. Skipping.")
            return

        print("Populating database...")
        
        # 1. Create Users
        demo = models.User(
            username="demo",
            hashed_password=get_password_hash("password123"),
            avatar_url="https://api.dicebear.com/7.x/adventurer/svg?seed=Demo",
            is_online=True,
            last_active_at=datetime.now(timezone.utc)
        )
        
        an = models.User(
            username="An Tran",
            hashed_password=get_password_hash("password123"),
            avatar_url="https://api.dicebear.com/7.x/adventurer/svg?seed=An",
            is_online=True,
            last_active_at=datetime.now(timezone.utc) - timedelta(minutes=5)
        )
        
        minh = models.User(
            username="Minh Nguyen",
            hashed_password=get_password_hash("password123"),
            avatar_url="https://api.dicebear.com/7.x/adventurer/svg?seed=Minh",
            is_online=False,
            last_active_at=datetime.now(timezone.utc) - timedelta(hours=2)
        )
        
        sara = models.User(
            username="Sara Chen",
            hashed_password=get_password_hash("password123"),
            avatar_url="https://api.dicebear.com/7.x/adventurer/svg?seed=Sara",
            is_online=False,
            last_active_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        
        alex = models.User(
            username="Alex",
            hashed_password=get_password_hash("password123"),
            avatar_url="https://api.dicebear.com/7.x/adventurer/svg?seed=Alex",
            is_online=True,
            last_active_at=datetime.now(timezone.utc)
        )

        db.add_all([demo, an, minh, sara, alex])
        db.commit()
        db.refresh(demo)
        db.refresh(an)
        db.refresh(minh)
        db.refresh(sara)
        db.refresh(alex)

        # 2. Conversations
        # 1-on-1: Demo <-> An Tran
        conv_an = models.Conversation(is_group=False)
        db.add(conv_an)
        db.commit()
        db.refresh(conv_an)
        
        part_an_1 = models.Participant(user_id=demo.id, conversation_id=conv_an.id)
        part_an_2 = models.Participant(user_id=an.id, conversation_id=conv_an.id)
        db.add_all([part_an_1, part_an_2])
        
        # 1-on-1: Demo <-> Minh Nguyen
        conv_minh = models.Conversation(is_group=False)
        db.add(conv_minh)
        db.commit()
        db.refresh(conv_minh)
        
        part_minh_1 = models.Participant(user_id=demo.id, conversation_id=conv_minh.id)
        part_minh_2 = models.Participant(user_id=minh.id, conversation_id=conv_minh.id)
        db.add_all([part_minh_1, part_minh_2])
        
        # 1-on-1: Demo <-> Sara Chen
        conv_sara = models.Conversation(is_group=False)
        db.add(conv_sara)
        db.commit()
        db.refresh(conv_sara)
        
        part_sara_1 = models.Participant(user_id=demo.id, conversation_id=conv_sara.id)
        part_sara_2 = models.Participant(user_id=sara.id, conversation_id=conv_sara.id)
        db.add_all([part_sara_1, part_sara_2])
        
        # Group Chat: Design Team Sync (Demo, An, Minh, Sara, Alex)
        conv_group = models.Conversation(is_group=True, name="Design Team Sync")
        db.add(conv_group)
        db.commit()
        db.refresh(conv_group)
        
        participants_group = [
            models.Participant(user_id=demo.id, conversation_id=conv_group.id),
            models.Participant(user_id=an.id, conversation_id=conv_group.id),
            models.Participant(user_id=minh.id, conversation_id=conv_group.id),
            models.Participant(user_id=sara.id, conversation_id=conv_group.id),
            models.Participant(user_id=alex.id, conversation_id=conv_group.id),
        ]
        db.add_all(participants_group)
        db.commit()

        # 3. Add Messages
        # Demo <-> An Tran Messages
        msg_an_1 = models.Message(
            content="Hey! Have you had a chance to look at the new design system components I sent over this morning?",
            sender_id=an.id,
            conversation_id=conv_an.id,
            timestamp=datetime.now(timezone.utc) - timedelta(minutes=26),
            is_read=True
        )
        msg_an_2 = models.Message(
            content="Just opening it now. The 'Airy Precision' theme looks incredibly clean. I love the use of tonal layers instead of heavy shadows.",
            sender_id=demo.id,
            conversation_id=conv_an.id,
            timestamp=datetime.now(timezone.utc) - timedelta(minutes=23),
            is_read=True
        )
        msg_an_3 = models.Message(
            content="The 8px base grid really makes the rhythm feel consistent.",
            sender_id=demo.id,
            conversation_id=conv_an.id,
            timestamp=datetime.now(timezone.utc) - timedelta(minutes=20),
            is_read=True
        )
        msg_an_4 = models.Message(
            content="Exactly! It's designed for high-efficiency communication.",
            sender_id=an.id,
            conversation_id=conv_an.id,
            timestamp=datetime.now(timezone.utc) - timedelta(minutes=17),
            is_read=True
        )
        msg_an_5 = models.Message(
            content="Sure, I'll review the Lumina specs now. Let me know if you want to hop on a call.",
            sender_id=an.id,
            conversation_id=conv_an.id,
            timestamp=datetime.now(timezone.utc) - timedelta(minutes=10),
            is_read=False # Make it unread so we get unread badges as in mockup!
        )
        msg_an_6 = models.Message(
            content="Can you review the mockup?",
            sender_id=an.id,
            conversation_id=conv_an.id,
            timestamp=datetime.now(timezone.utc) - timedelta(minutes=5),
            is_read=False
        )

        # Demo <-> Minh Nguyen Messages
        msg_minh_1 = models.Message(
            content="The deployment was successful.",
            sender_id=minh.id,
            conversation_id=conv_minh.id,
            timestamp=datetime.now(timezone.utc) - timedelta(hours=2),
            is_read=True
        )

        # Demo <-> Sara Chen Messages
        msg_sara_1 = models.Message(
            content="Sent a photo",
            sender_id=sara.id,
            conversation_id=conv_sara.id,
            timestamp=datetime.now(timezone.utc) - timedelta(days=1),
            is_read=True
        )

        # Group Chat messages
        msg_group_1 = models.Message(
            content="Let's focus on the bento grid.",
            sender_id=alex.id,
            conversation_id=conv_group.id,
            timestamp=datetime.now(timezone.utc) - timedelta(days=10),
            is_read=True
        )

        db.add_all([msg_an_1, msg_an_2, msg_an_3, msg_an_4, msg_an_5, msg_an_6, msg_minh_1, msg_sara_1, msg_group_1])
        db.commit()
        
        print("Database pre-populated successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error populating database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    populate()
