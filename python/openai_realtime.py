import os
import json
import asyncio
import websockets
import signal
from dotenv import load_dotenv
from furhat_realtime_api import AsyncFurhatClient, Events
import argparse
import logging

class OpenAIRealtimeFurhatBridge:
    def __init__(self, host: str = "127.0.0.1", auth_key = None):
        load_dotenv(override=True)
        self.url = "wss://api.openai.com/v1/realtime?model=gpt-realtime"
        self.headers = {
            "Authorization": "Bearer " + os.environ.get("OPENAI_API_KEY"),
            "OpenAI-Beta": "realtime=v1"
        }
        self.user_turn = False
        self.output_started = False
        self.ws = None
        self.host = host
        self.instruction = "You are a friendly robot speaking English, looking for a nice little chat."
        self.stop_event = asyncio.Event()
        self.shutting_down = False
        self.furhat = AsyncFurhatClient(self.host, auth_key=auth_key)
        #self.furhat.set_logging_level(logging.DEBUG)
        self.furhat.add_handler(Events.response_speak_end, self.furhat_speak_end)
        self.furhat.add_handler(Events.response_audio_data, self.furhat_microphone_data)

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
        print("Initiating shutdown...")
        
        try:
            await self.furhat.request_audio_stop()
            await self.furhat.request_speak_stop()
        except Exception as e:
            print(f"Error during Furhat shutdown: {e}")
        
        self.stop_event.set()

    async def furhat_speak_end(self, data):
        # This is called when Furhat finishes speaking
        self.user_turn = True
        await self.furhat.request_audio_start(sample_rate=24000, microphone=True, speaker=False)

    async def furhat_microphone_data(self, data):
        # This is called when Furhat received user audio
        # We only send audio data to OpenAI if it's the user's turn and not shutting down
        if self.user_turn and self.ws and not self.shutting_down:
            await self.ws.send(json.dumps({
                "type": "input_audio_buffer.append",
                "audio": data.get("microphone")
            }))

    async def session_created(self):
        # This is called when the OpenAI session is created
        # We ask OpenAI to create the initial response
        await self.ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "instructions": self.instruction,
                #"turn_detection": {
                #    "type": "semantic_vad"
                #}
            }
        }))
        await self.furhat.request_attend_user()
        await self.ws.send(json.dumps({
            "type": "response.create"
        }))

    async def response_created(self, data):
        # This is called when OpenAI has created a response and is ready to speak
        await self.furhat.request_audio_stop()
        self.user_turn = False

    async def response_audio_delta(self, data):
        # This is called when OpenAI sends a delta of audio data
        if not self.output_started:
            await self.furhat.request_speak_audio_start(sample_rate=24000, lipsync=True)
            self.output_started = True
        delta = data.get("delta")
        await self.furhat.request_speak_audio_data(delta)

    async def response_audio_done(self, data):
        # This is called when OpenAI has finished sending audio data
        await self.furhat.request_speak_audio_end()
        self.output_started = False

    async def monitor_input(self):
        """Monitor for Enter key press to stop the program"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, input, "Press Enter to stop the program...\n")
        self.shutting_down = True
        await self.furhat.request_audio_stop()
        await self.furhat.request_speak_stop()
        self.stop_event.set()

    async def websocket_handler(self):
        """Handle Realtime connection"""
        async with websockets.connect(
            self.url,
            additional_headers=self.headers
        ) as ws:
            self.ws = ws
            while not self.stop_event.is_set():
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=0.1)
                    data = json.loads(message)
                    #print("Received event:", data.get("type"))
                    if data.get("type") == "session.created":
                        await self.session_created()
                    elif data.get("type") == "response.created":
                        await self.response_created(data)
                    elif data.get("type") == "response.audio.delta":
                        await self.response_audio_delta(data)
                    elif data.get("type") == "response.audio.done":
                        await self.response_audio_done(data)
                    elif data.get("type") == "error":
                        print("Error from OpenAI:", data)
                except asyncio.TimeoutError:
                    continue
                except websockets.exceptions.ConnectionClosed:
                    break

    async def run(self):
        self.setup_signal_handlers()
        print("Starting OpenAI Realtime Furhat Bridge...")
        print("Press Ctrl+C to stop gracefully")
        
        try:
            await self.furhat.connect()
        except Exception as e:
            print(f"Failed to connect to Furhat on {self.host}.")
            exit(0)
        
        try:
            await self.websocket_handler()
        except Exception as e:
            print(f"Error in main loop: {e}")
        finally:
            print("Shutting down...")
            await self.furhat.disconnect()
       
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Furhat robot IP address")
    parser.add_argument("--auth_key", type=str, default=None, help="Authentication key for Realtime API")
    args = parser.parse_args()
    asyncio.run(OpenAIRealtimeFurhatBridge(args.host, auth_key=args.auth_key).run())