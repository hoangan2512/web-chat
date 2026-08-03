from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .db import models
from .db.session import engine

from .api import users
from .api import messages
from .api import chat
from .api import conversations
from .api import auth
from .api import upload

# Initialize DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Web Chat")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router)
app.include_router(messages.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(auth.router)
app.include_router(upload.router)

# Mount static files at root
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")