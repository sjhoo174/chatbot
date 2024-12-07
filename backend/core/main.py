import json

from fastapi import Request, Response, Body, HTTPException, Depends
from starlette.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from auth import oauth, config
from fastapi.templating import Jinja2Templates
import signal
import uuid
import sys
import os
import jwt
import uvicorn
import datetime
import redis.asyncio as redis
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from mongodb import *
from fastapi.staticfiles import StaticFiles
import secrets


class RedisSessionMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_url: str, secret_key: str):
        super().__init__(app)
        self.redis_url = redis_url
        self.secret_key = secret_key
        self.redis = None

    def generate_session_id(self):
        session_id = secrets.token_hex(32)  # Create a 64-character session ID (32 bytes)
        return session_id

    async def dispatch(self, request: Request, call_next):

        # Initialize Redis client if it isn't initialized yet
        if self.redis is None:
            self.redis = redis.from_url(self.redis_url)

        session_id = request.cookies.get("session_id")

        if session_id is None:
            # Generate a new session ID if not found in the request cookie
            session_id = self.generate_session_id()

            # Store the session ID in Redis with a session expiry time (e.g., 30 minutes)
            await self.redis.setex(session_id, 1800, json.dumps({}))  # 1800 seconds = 30 minutes

            request.state.session_data = {}

        else:
            # Session ID exists, so retrieve the session data from Redis
            session_data = await self.redis.get(session_id)
            if session_data:
                # If session data exists, we can parse it
                session_data = json.loads(session_data)
            else:
                # If session data doesn't exist, initialize it as an empty dictionary
                session_data = {}

            request.state.session_data = session_data

            # Continue processing the request
        response = await call_next(request)
        response.set_cookie("session_id", session_id, expires=1800)
        print('set cookie', session_id)
        session_data = request.state.session_data
        print("saving session data", session_data)
        # Store the updated session data back to Redis
        await self.redis.setex(session_id, 1800, json.dumps(session_data))

        return response


# Get the current directory (where main.py is located)
template_dir = os.path.dirname(os.path.realpath(__file__))
templates = Jinja2Templates(directory=template_dir)

app.mount("/assets", StaticFiles(directory="assets"), name="assets")

# Add CORS middleware to allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (not recommended for production)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)

# redis
REDIS_URL = "redis://54.179.190.238.nip.io:6379"
# Add Session Middleware

s_key = config["secret_key"]
app.add_middleware(SessionMiddleware, secret_key=s_key)
app.add_middleware(RedisSessionMiddleware, redis_url=REDIS_URL, secret_key=s_key)


SECRET_KEY = ""
ALGORITHM = ""
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_token(data):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# Middleware to decode JWT
class JWTMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        token = request.headers.get("Authorization")
        if token:
            try:
                # Extract token from 'Authorization' header (remove 'Bearer ' prefix)
                token = token.split(" ")[1]
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

                # Attach the decoded payload to the request state
                request.state.session = payload
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token has expired")
            except jwt.PyJWTError:
                raise HTTPException(status_code=401, detail="Invalid token")
        else:
            request.state.session = None  # No token, set user as None

        # Proceed with the request
        response = await call_next(request)
        return response

app.add_middleware(JWTMiddleware)


# Dependency to get current user (from the request state)
def get_current_user(request: Request):
    user = request.state.session
    if user is None:
        print("none")
        raise HTTPException(status_code=401, detail="Not authenticated")

    return user


@app.get("/prompt")
async def prompt(prompt_content: str):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    data = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt_content}],
        "temperature": 0.7,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(GPT_URL, headers=headers, json=data) as response:
            response_data = await response.json()
            print(response_data)
            html_data = markdown_to_html(response_data["choices"][0]["message"]["content"])
            print(html_data)
            return html_data


@app.get("/email")
async def get_email(current_user: dict = Depends(get_current_user)):
    return {"email": current_user["email"]}

# Endpoint to get all conversations for a specific user
@app.get("/conversations")
async def get_all_conversations(current_user: dict = Depends(get_current_user)):
    # Query the database for all messages associated with the user_id
    conversations_collection = app.conversations_collection
    conversation = await conversations_collection.find_one({"user_id": current_user["user_id"]})

    if conversation:
        # Return the messages from the conversation
        return {"user_id": current_user["user_id"], "messages": conversation["messages"]}
    else:
        await upsert_messages(current_user["user_id"], [])
        return {"user_id": current_user["user_id"], "messages": []}


class MessageList(BaseModel):
    messages: List[Message]


@app.post("/prompt")
async def create_or_get_conversation(payload: MessageList = Body(), current_user: dict = Depends(get_current_user)):
    messages = [msg.model_dump() for msg in payload.messages]
    updated_messages = await upsert_messages(current_user["user_id"], messages)
    response = await get_openai_response(updated_messages)
    formatted_response = Message(role=ROLE_ASSISTANT, content=response)
    conversation_result = await upsert_messages(current_user["user_id"], [formatted_response.model_dump()])
    return conversation_result


# FastAPI endpoint to delete conversation
@app.delete("/conversations")
async def delete_conversation(current_user: dict = Depends(get_current_user)):
    result = await delete_conversation_from_db(current_user["user_id"])
    return result


# Redirect to Google for authentication
@app.get("/login")
async def login(request: Request, response: Response) -> RedirectResponse:
    state = str(uuid.uuid4())
    request.state.session_data["oauth"] = state
    print("stored", request.state.session_data["oauth"])
    redirect_uri = config['google_oauth']['redirect_uri']
    oauth_url = await oauth.google.authorize_redirect(request, redirect_uri, state=state)
    return oauth_url.headers.get("location")
    # return "http://127.0.0.1:5173/auth/callback"


# Callback route for Google OAuth
@app.get("/auth/callback")
async def auth(request: Request, response: Response):
    frontend_url = "https://54.179.190.238.nip.io/"

    cookie_state = request.state.session_data["oauth"]
    print(cookie_state, request.query_params.get("state"))
    if cookie_state != request.query_params.get("state"):
        raise HTTPException(status_code=401, detail="Oauth state doesn't match")

    try:
        # Prepare to exchange the authorization code for an access token
        token_url = "https://oauth2.googleapis.com/token"
        payload = {
            'code': request.query_params.get("code"),
            'client_id': config['google_oauth']['client_id'],
            'client_secret': config['google_oauth']['client_secret'],
            'redirect_uri': config['google_oauth']['redirect_uri'],
            'grant_type': 'authorization_code',
        }

        # Use aiohttp to send a POST request to exchange the authorization code for a token
        async with aiohttp.ClientSession() as session:
            async with session.post(token_url, data=payload) as response:
                token_data = await response.json()

        if 'access_token' not in token_data:
            raise HTTPException(status_code=400, detail="Failed to obtain access token")

        # Now you have the access token and can use it to call the API
        token = token_data['access_token']

        async with aiohttp.ClientSession() as session:
            async with session.get('https://www.googleapis.com/oauth2/v3/userinfo',
                                   headers={'Authorization': f'Bearer {token}'}) as response:
                userinfo = await response.json()
                print("User Info:", userinfo)

                # Extract the user's email
                user_email = userinfo.get('email')
                print("User Email:", user_email)

                # Query the users collection to find the user by email
                users_collection = app.users_collection

                user = await users_collection.find_one({"email": user_email})

                if user:
                    user_id = user["user_id"]
                    request.state.session = user_id

                else:
                    # Get the next user_id atomically
                    user_id = await get_next_user_id()

                    # Create the new user document
                    user_dict = {
                        "email": user_email,
                        "user_id": user_id
                    }

                    # Insert the user into the database
                    await users_collection.insert_one(user_dict)

                    request.state.session = user_id

                token = create_token(data={"email": user["email"], "user_id": user_id})
                return RedirectResponse(url=f'{frontend_url}?token={token}')
    except Exception as e:
        print("caught", e)
        return RedirectResponse(url=frontend_url)

    # token = create_token(data={"email": "hooshijan123@gmail.com", "user_id": 1})
    # return RedirectResponse(url=f'{frontend_url}?token={token}')

# Logout route to clear the session
@app.get("/auth/logout")
async def logout(request: Request):
    # Clear the session
    request.session.clear()
    return RedirectResponse(url="/")

# Home route to display login button
@app.get("/")
async def home(request:Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/{path}")
async def home(request:Request):
    return templates.TemplateResponse("index.html", {"request": request})


# Run the app with `uvicorn main:app --reload`


def handle_exit_signal(signal, frame):
    print("Exiting gracefully...")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit_signal)
signal.signal(signal.SIGTERM, handle_exit_signal)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, proxy_headers=True)