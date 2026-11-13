import asyncio
from openai import AsyncOpenAI
import json
import os
import argparse
import signal
from dotenv import load_dotenv
from furhat_realtime_api import AsyncFurhatClient, Events

class Chatbot:
    def __init__(self, system_prompt: str):
        self.system_prompt = system_prompt
        self.dialog_history = []
        self.current_user_utt = None
        self.openai_task = None
        self.shutting_down = False

    def commit_user(self):
        if self.current_user_utt is None:
            return
        self.dialog_history.append({"role": "user", "content": self.current_user_utt})
        self.current_user_utt = None

    def commit_robot(self, message: str):
        self.dialog_history.append({"role": "assistant", "content": message})

    def initiate_request(self, text, callback):
        if self.shutting_down:
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
            messages = [{"role": "developer", "content": self.system_prompt}] + self.dialog_history + [{"role": "user", "content": self.current_user_utt}]
            print("[OpenAI] request:", messages)
            response = await self.client.chat.completions.create(model="gpt-4o-mini", messages=messages)
            robot_text = response.choices[0].message.content
            print("[OpenAI] response:", robot_text)
            if not self.shutting_down:
                await callback(robot_text)
        except asyncio.CancelledError:
            print("[OpenAI] request was aborted.")
            return None

    def set_client(self, client):
        self.client = client

    def set_shutting_down(self, value):
        self.shutting_down = value


class OpenAIAsyncFurhatBridge:
    def __init__(self, host: str = "127.0.0.1", auth_key=None):
        load_dotenv(override=True)
        
        self.client = AsyncOpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
        )
        
        self.system_prompt = "You are a friendly robot looking for a nice little chat."
        self.conversation_starter = "Hello, I am Furhat. How are you today?"
        self.stop_event = asyncio.Event()
        self.shutting_down = False
        self.host = host
        
        # Connect to the Furhat Realtime API
        self.furhat = AsyncFurhatClient(host, auth_key=auth_key)
        self.chatbot = Chatbot(self.system_prompt)
        self.chatbot.set_client(self.client)

    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            print(f"\nReceived signal {signum}, shutting down gracefully...")
            asyncio.create_task(self.shutdown())
        
        # Handle Ctrl+C (SIGINT) and SIGTERM
        signal.signal(signal.SIGINT, signal_handler)
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, signal_handler)

    async def shutdown(self):
        """Graceful shutdown"""
        if self.shutting_down:
            return
        
        self.shutting_down = True
        self.chatbot.set_shutting_down(True)
        print("Initiating shutdown...")
        
        try:
            # Cancel any ongoing OpenAI request
            self.chatbot.cancel_request()
            # Stop listening and speaking
            await self.furhat.request_listen_stop()
            await self.furhat.request_speak_stop()
        except Exception as e:
            print(f"Error during shutdown: {e}")
        
        self.stop_event.set()

    # The user has started speaking, so we should cancel any ongoing LLM request
    async def on_hear_start(self, event):
        if not self.shutting_down:
            self.chatbot.cancel_request()

    # The user has stopped speaking, initiate the LLM request
    async def on_hear_end(self, event):
        if not self.shutting_down:
            self.chatbot.initiate_request(event["text"], self.on_chatbot_response_ready)

    # The chatbot has a response, prepare to speak it out
    async def on_chatbot_response_ready(self, text: str):
        if not self.shutting_down:
            await self.furhat.request_speak_text(text)

    # The robot starts speaking, so we can commit the user's text to history
    async def on_speak_start(self, event):
        if not self.shutting_down:
            self.chatbot.commit_user()

    # The robot stopped speaking, so we can commit the robot's text to history
    async def on_speak_end(self, event):
        if not self.shutting_down:
            self.chatbot.commit_robot(event["text"])

    # Main dialog loop
    async def run(self):
        self.setup_signal_handlers()
        print("Starting dialog...")
        print("Press Ctrl+C to stop gracefully")
        
        try:
            await self.furhat.connect()
        except Exception as e:
            print(f"Failed to connect to Furhat on {self.host}.")
            exit(0)

        # Register event handlers
        self.furhat.add_handler(Events.response_hear_start, self.on_hear_start)
        self.furhat.add_handler(Events.response_hear_end, self.on_hear_end)
        self.furhat.add_handler(Events.response_speak_start, self.on_speak_start)
        self.furhat.add_handler(Events.response_speak_end, self.on_speak_end)

        await self.furhat.request_attend_user()

        await self.furhat.request_speak_text(self.conversation_starter)

        # Start listening 
        await self.furhat.request_listen_start(
            # Concatenate user speech into a single utterance
            concat=True,
            # Do not stop listening until the robot starts speaking
            stop_no_speech=False,
            stop_user_end=False,
            stop_robot_start=True,
            # Resume listening after the robot finishes speaking
            resume_robot_end=True,
            end_speech_timeout=0.5
        )

        # Wait for shutdown signal instead of input
        await self.stop_event.wait()

        print("Shutting down...")
        await self.furhat.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Furhat robot IP address")
    parser.add_argument("--auth_key", type=str, default=None, help="Authentication key for Realtime API")
    args = parser.parse_args()

    asyncio.run(OpenAIAsyncFurhatBridge(args.host, auth_key=args.auth_key).run())