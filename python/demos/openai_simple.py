from openai import OpenAI
import logging
import os
from dotenv import load_dotenv
from furhat_realtime_api import FurhatClient
import argparse

if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Furhat robot IP address")
    parser.add_argument("--auth_key", type=str, default=None, help="Authentication key for Realtime API")
    args = parser.parse_args()

    load_dotenv(override=True)

    openai = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
    )

    furhat = FurhatClient(host=args.host, auth_key=args.auth_key)
    furhat.set_logging_level(logging.INFO)
    
    try:
        furhat.connect()
    except Exception as e:
        print(f"Failed to connect to Furhat on {args.host}.")
        exit(0)

    model = "gpt-4o-mini"  
    system_prompt = "You are a friendly robot looking for a nice little chat."
    messages = [{"role": "developer", "content": system_prompt}] 
    robot_utt = "Hello, I am Furhat. How are you today?"

    furhat.request_attend_user() # This will default to attending the closest user

    while True:
        print("Robot: ", robot_utt)
        messages.append({"role": "assistant", "content": robot_utt})
        furhat.request_speak_text(robot_utt)
        user_utt = furhat.request_listen_start()
        print("User: ", user_utt)
        messages.append({"role": "user", "content": user_utt})
        response = openai.chat.completions.create(model=model, messages=messages)
        robot_utt = response.choices[0].message.content