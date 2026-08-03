from fastapi import WebSocket, APIRouter, WebSocketException, Depends, WebSocketDisconnect
from ..core.security import get_current_user_ws
from ..db import models
from typing import List, Dict

router = APIRouter(tags=["WebSockets"])
async def websocket_endpoint(
    websocket: WebSocket,
    current_user: models.User = Depends(get_current_user_ws)
):
    
    await manager.connect(websocket, current_user.id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            await manager.send_personal_message(f"[{current_user.username}]: {data}", current_user.id)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user.id)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                
            if len(self.active_connections[user_id]) == 0:
                del self.active_connections[user_id]
            
    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_text(message)
    
    async def broadcast_to_conservation(self, message: str, participant_ids: List[int]):
        for user_id in participant_ids:
            if user_id in self.active_connections:
                for connection in self.active_connections[user_id]:
                    await connection.send_text(message)
            
manager = ConnectionManager()