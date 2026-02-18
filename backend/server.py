from fastapi import FastAPI, HTTPException, Depends, Body, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import os
import json
import logging
from pathlib import Path
import httpx
import asyncio

# /backend 
ROOT_DIR = Path(__file__).parent
from dotenv import load_dotenv
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# OpenAI API Key
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class Message(BaseModel):
    role: str
    content: str

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    messages: List[Dict[str, str]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
class CreateConversationRequest(BaseModel):
    title: str
    
class AddMessageRequest(BaseModel):
    message: str

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    completed: bool = False
    due_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None

# Helper Functions
async def get_simple_response(user_message: str) -> str:
    """Generate a simple response when API is unavailable"""
    message = user_message.lower()
    
    # Common ADHD help responses
    if "task" in message or "todo" in message or "to-do" in message or "organize" in message:
        return "To help organize your tasks, try breaking them down into smaller steps. I recommend starting with just 1-3 tasks that are most important today."
    
    elif "focus" in message or "concentrate" in message or "distract" in message:
        return "For better focus, try the Pomodoro technique: 25 minutes of focused work followed by a 5-minute break. Also, minimize distractions by silencing notifications."
    
    elif "deadline" in message or "late" in message or "procrastinate" in message:
        return "To manage deadlines, try setting earlier personal deadlines with small rewards. Breaking the project into smaller milestones can also help prevent procrastination."
    
    elif "overwhelm" in message or "stress" in message or "anxious" in message:
        return "When feeling overwhelmed, pause and take a few deep breaths. Try writing everything down that's on your mind, then prioritize only what needs attention today."
    
    elif "forgot" in message or "remember" in message or "memory" in message:
        return "To help with memory, try using external systems like calendar alerts, sticky notes, or apps with reminders. Writing things down immediately is also helpful."
    
    elif "hello" in message or "hi" in message or "hey" in message:
        return "Hello! I'm your AI assistant. I can help you with organization, focus, task management, and more. What would you like assistance with today?"
    
    else:
        return "I understand you need help. Could you share more specific details about what you're looking for assistance with? I can help with organization, focus, breaking down tasks, and managing ADHD challenges."

async def get_ai_response(messages: List[Dict[str, str]]):
    """Get response from OpenAI API with fallback to simple responses"""
    # Check if we have an API key
    if not OPENAI_API_KEY:
        logger.warning("No OpenAI API key provided. Using fallback responses.")
        user_message = messages[-1]["content"] if messages and messages[-1]["role"] == "user" else ""
        return {"role": "assistant", "content": await get_simple_response(user_message)}
    
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-3.5-turbo",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1000
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                OPENAI_API_URL,
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"OpenAI API error: {error_text}")
                
                # Check for quota errors
                if "quota" in error_text or "insufficient_quota" in error_text:
                    user_message = messages[-1]["content"] if messages and messages[-1]["role"] == "user" else ""
                    return {"role": "assistant", "content": f"I'm sorry, but there's an API quota limitation. Using simplified responses instead.\n\n{await get_simple_response(user_message)}"}
                
                return {"role": "assistant", "content": "I'm having trouble connecting to my brain. Please try again later."}
                
            result = response.json()
            return result["choices"][0]["message"]
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}")
        user_message = messages[-1]["content"] if messages and messages[-1]["role"] == "user" else ""
        return {"role": "assistant", "content": f"I encountered an error while processing your request. Using simplified responses instead.\n\n{await get_simple_response(user_message)}"}

# API Routes
@app.get("/api")
async def root():
    return {"message": "AI Assistant API is running"}

@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(request: CreateConversationRequest):
    """Create a new conversation"""
    conversation = Conversation(title=request.title)
    result = await db.conversations.insert_one(conversation.dict())
    return conversation

@app.get("/api/conversations", response_model=List[Conversation])
async def get_conversations():
    """Get all conversations"""
    conversations = await db.conversations.find().sort("updated_at", -1).to_list(100)
    return conversations

@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """Get a specific conversation"""
    conversation = await db.conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

@app.post("/api/conversations/{conversation_id}/messages")
async def add_message(conversation_id: str, request: AddMessageRequest):
    """Add a message to a conversation and get AI response"""
    # Find the conversation
    conversation = await db.conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Add user message
    user_message = {"role": "user", "content": request.message}
    
    # Get current messages
    messages = conversation.get("messages", [])
    messages.append(user_message)
    
    # Get AI response
    ai_message = await get_ai_response(messages)
    messages.append(ai_message)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "messages": messages,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "user_message": user_message,
        "ai_message": ai_message
    }

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation"""
    result = await db.conversations.delete_one({"id": conversation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation deleted"}

# Task management endpoints
@app.post("/api/tasks", response_model=Task)
async def create_task(request: CreateTaskRequest):
    """Create a new task"""
    task = Task(
        title=request.title,
        description=request.description,
        due_date=request.due_date
    )
    await db.tasks.insert_one(task.dict())
    return task

@app.get("/api/tasks", response_model=List[Task])
async def get_tasks():
    """Get all tasks"""
    tasks = await db.tasks.find().to_list(100)
    return tasks

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, task_data: dict = Body(...)):
    """Update a task"""
    result = await db.tasks.update_one(
        {"id": task_id},
        {"$set": task_data}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task updated"}

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
