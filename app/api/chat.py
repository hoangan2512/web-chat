from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
import json
from ..core.socket_manager import manager
from ..db import crud, models
from ..db.session import get_db
from ..core.security import get_current_user_ws
from ..core.config import to_gmt7

router = APIRouter()

@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: int,
    current_user: models.User = Depends(get_current_user_ws),
    db: Session = Depends(get_db)
):
    user_id = current_user.id
    is_member = crud.check_user_in_conversation(db, user_id=user_id, conversation_id=conversation_id)
    if not is_member:
        await websocket.close(code=1008, reason="You are not a member of this conversation")
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            new_message = crud.create_message(
                db=db,
                content=data,
                sender_id=user_id,
                conversation_id=conversation_id
            )
            
            participants = (
                db.query(models.Participant)
                .filter(models.Participant.conversation_id == conversation_id)
                .all()
            )
            participant_ids = [p.user_id for p in participants]
            
            response_payload = json.dumps({
                "id": new_message.id,
                "sender_id": user_id,
                "sender_name": current_user.username,
                "avatar_url": current_user.avatar_url,
                "conversation_id": conversation_id,
                "content": new_message.content,
                "timestamp": to_gmt7(new_message.timestamp).isoformat()
            })
            
            await manager.broadcast_to_conservation(
                message=response_payload,
                participant_ids=participant_ids
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)