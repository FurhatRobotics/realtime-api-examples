import asyncio
from openai import AsyncOpenAI
import json
import os
import logging
import signal
from dotenv import load_dotenv
from furhat_ws_api import AsyncFurhatClient, Events

load_dotenv(override=True)

client = AsyncOpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

system_prompt = "You are a friendly robot looking for a nice little chat."
conversation_starter = "Hello, I am Furhat. How are you today?"

openai_task = None
stop_event = asyncio.Event()
shutting_down = False

# Connect to the Furhat WebSocket API
furhat = AsyncFurhatClient("127.0.0.1")

def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown"""
    def signal_handler(signum, frame):
        print(f"\nReceived signal {signum}, shutting down gracefully...")
        asyncio.create_task(shutdown())
    
    # Handle Ctrl+C (SIGINT) and SIGTERM
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)

async def shutdown():
    """Graceful shutdown"""
    global shutting_down
    if shutting_down:
        return
    
    shutting_down = True
    print("Initiating shutdown...")
    
    try:
        # Cancel any ongoing OpenAI request
        chatbot.cancel_request()
        # Stop listening and speaking
        await furhat.request_listen_stop()
        await furhat.request_speak_stop()
    except Exception as e:
        print(f"Error during shutdown: {e}")
    
    stop_event.set()

class Chatbot:
    def __init__(self, system_prompt: str):
        self.system_prompt = system_prompt
        self.dialog_history = []
        self.current_user_utt = None
        self.openai_task = None

    def commit_user(self):
        if self.current_user_utt is None:
            return
        self.dialog_history.append({"role": "user", "content": self.current_user_utt})
        self.current_user_utt = None

    def commit_robot(self, message: str):
        self.dialog_history.append({"role": "assistant", "content": message})

    def initiate_request(self, text, callback):
        if shutting_down:
            return
        self.current_user_utt = text
        self.openai_task = asyncio.create_task(self.make_request(callback))

    def cancel_request(self):
        self.current_user_utt = None
        if self.openai_task and not self.openai_task.done():
            print("[OpenAI] Cancelling request...")
            self.openai_task.cancel()

    async def make_request(self, callback):
        try:
            messages = [{"role": "developer", "content": system_prompt}] + self.dialog_history + [{"role": "user", "content": self.current_user_utt}]
            print("[OpenAI] request:", messages)
            response = await client.chat.completions.create(model="gpt-4o-mini", messages=messages)
            robot_text = response.choices[0].message.content
            print("[OpenAI] response:", robot_text)
            if not shutting_down:
                await callback(robot_text)
        except asyncio.CancelledError:
            print("[OpenAI] request was aborted.")
            return None  # Return None to indicate cancellation


chatbot = Chatbot(system_prompt)


# The user has started speaking, so we should cancel any ongoing LLM request
async def on_hear_start(event):
    if not shutting_down:
        chatbot.cancel_request()

# The user has stopped speaking, initiate the LLM request
async def on_hear_end(event):
    if not shutting_down:
        chatbot.initiate_request(event["text"], on_chatbot_response_ready)

# The chatbot has a response, prepare to speak it out
async def on_chatbot_response_ready(text: str):
    if not shutting_down:
        await furhat.request_speak_text(text)

# The robot starts speaking, so we can commit the user's text to history
async def on_speak_start(event):
    if not shutting_down:
        chatbot.commit_user()

# The robot stopped speaking, so we can commit the robot's text to history
async def on_speak_end(event):
    if not shutting_down:
        chatbot.commit_robot(event["text"])

# Main dialog loop
async def run_dialog():
    setup_signal_handlers()
    print("Starting dialog...")
    print("Press Ctrl+C to stop gracefully")
    
    # Connect to Furhat
    await furhat.connect()

    # Register event handlers
    furhat.add_handler(Events.response_hear_start, on_hear_start)
    furhat.add_handler(Events.response_hear_end, on_hear_end)
    furhat.add_handler(Events.response_speak_start, on_speak_start)
    furhat.add_handler(Events.response_speak_end, on_speak_end)

    await furhat.request_attend_user()

    await furhat.request_speak_text(conversation_starter)

    # Start listening 
    await furhat.request_listen_start(
        # Concatenate user speech into a single utterance
        concat=True,
        # Do not stop listening until the robot starts speaking
        stop_silence_timeout=False,
        stop_user_end=False,
        stop_robot_start=True,
        # Resume listening after the robot finishes speaking
        resume_robot_end=True
    )

    # Wait for shutdown signal instead of input
    await stop_event.wait()

    print("Shutting down...")
    await furhat.disconnect()


if __name__ == "__main__":
    asyncio.run(run_dialog())