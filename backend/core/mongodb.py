
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List
from __init__ import app
from gpt import *
import aiohttp
from utils import markdown_to_html

MONGO_URL = "mongodb://u:p@54.179.190.238.nip.io:27017"
MONGO_DB = "chat_db"  # Your database name
# MongoDB client and database connection setup

@app.on_event("startup")
async def startup_db():
    app.mongodb_client = AsyncIOMotorClient(MONGO_URL)
    app.db = app.mongodb_client[MONGO_DB]
    # Access collections
    app.conversations_collection = app.db["conversations"]
    app.users_collection = app.db["users"]
    app.counters_collection = app.db["counters"]

@app.on_event("shutdown")
async def shutdown_db():
    app.mongodb_client.close()

ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"


class User(BaseModel):
    email: str
    user_id: int = None

class Message(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class Conversation(BaseModel):
    user_id: str
    messages: List[Message]


# Function to get the next user_id (auto-increment logic)
async def get_next_user_id():
    counters_collection = app.counters_collection
    counter = await counters_collection.find_one_and_update(
        {"_id": "user_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return counter["seq"]


# Utility function to delete a conversation for a specific user
async def delete_conversation_from_db(user_id: str):
    # Get the conversations collection
    conversations_collection = app.conversations_collection

    # Attempt to delete the conversation by user_id
    result = await conversations_collection.delete_one({"user_id": user_id})

    # Check if the deletion was successful
    if result.deleted_count > 0:
        print(f"Conversation for user_id {user_id} has been deleted.")
        return {"status": "success", "message": "Conversation deleted."}
    else:
        print(f"No conversation found for user_id {user_id}.")
        return {"status": "failure", "message": "No conversation found for the given user_id."}



# Utility function to create or update a conversation for a specific user
async def upsert_messages(user_id: str, latest_messages: List[dict]):
    # Check if conversation exists for the user_id
    conversations_collection = app.conversations_collection
    conversation = await conversations_collection.find_one({"user_id": user_id})
    if conversation:
        # Update existing conversation with new message
        updated_messages = conversation["messages"] + latest_messages
        await conversations_collection.update_one(
            {"user_id": user_id},
            {"$set": {"messages": updated_messages}}
        )
        return updated_messages
    else:
        # Create new conversation for the user
        new_conversation = {
            "user_id": user_id,
            "messages": latest_messages
        }
        await conversations_collection.insert_one(new_conversation)

        return latest_messages



# Function to call OpenAI and get a response
async def get_openai_response(messages: List[dict]) -> str:
    # Create conversation history
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    data = {
        "model": "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.7,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(GPT_URL, headers=headers, json=data) as response:
            response_data = await response.json()
            html_data = markdown_to_html(response_data["choices"][0]["message"]["content"])
            return html_data
