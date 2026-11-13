import argparse
from furhat_realtime_api import FurhatClient
import logging
import random
import time
import colorsys

if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Furhat robot IP address")
    parser.add_argument("--auth_key", type=str, default=None, help="Authentication key for Realtime API")
    args = parser.parse_args()

    furhat = FurhatClient(args.host, auth_key=args.auth_key) # Also provide authentication key here if needed
    furhat.set_logging_level(logging.INFO) # Change to logging.DEBUG to see all events

    try:
        furhat.connect()
    except Exception as e:
        print(f"Failed to connect to Furhat on {args.host}.")
        exit(0)

    voice_status = furhat.request_voice_status() # Get the list of available voices
    voice_list = voice_status["voice_list"]

    furhat.request_voice_config(name="neural", gender="male", language="en-US") 

    face_status = furhat.request_face_status()

    print("Current voice: ", voice_status["voice_id"])

    face_list = face_status["face_list"]

    furhat.request_speak_text(f"Hello, I am Furhat. I have {len(voice_list)} different voices and {len(face_list)} different faces available. ")

    user_data = furhat.request_users_once()

    furhat.request_speak_text(f"I can currently see {len(user_data['users'])} users.")

    furhat.request_speak_text("Let me show off my LED lights.")

    for i in range(10):
        hue = random.random()
        r, g, b = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
        color = "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))
        furhat.request_led_set(color=color)
        time.sleep(0.5)

    furhat.request_led_set(color="#000000")  # Turn off the LED lights

    furhat.request_speak_text("That's it for now.")

    print("Done")
    furhat.disconnect()