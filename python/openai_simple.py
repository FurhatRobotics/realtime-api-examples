from openai import OpenAI
import logging
import os
from dotenv import load_dotenv
from furhat_ws_api import FurhatClient

load_dotenv(override=True)

openai = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

furhat = FurhatClient("127.0.0.1")
furhat.set_logging_level(logging.INFO)
furhat.connect()

model = "gpt-4o-mini"  
system_prompt = "You are a friendly robot looking for a nice little chat."
messages = [{"role": "developer", "content": system_prompt}] 
robot_utt = "Hello, I am Furhat. How are you today?"

furhat.request_attend_user()

while True:
    print("Robot: ", robot_utt)
    messages.append({"role": "assistant", "content": robot_utt})
    furhat.request_speak_text(robot_utt)
    user_utt = furhat.request_listen()
    print("User: ", user_utt)
    messages.append({"role": "user", "content": user_utt})
    response = openai.chat.completions.create(model=model, messages=messages)
    robot_utt = response.choices[0].message.content