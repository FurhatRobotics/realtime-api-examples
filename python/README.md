# Examples for the Python Furhat Realtime API Client

Install the Furhat Realtime API Client with pip:

```
pip install furhat_realtime_api
```

To run examples with OpenAI, you need to configure your api key. Create a file called `.env` with the following contents:

```
OPENAI_API_KEY=your_openai_api_key_here
```

There are a couple of examples in this repo:

- `hello_world.py` – A demo that showcases Furhat’s voices, faces, and LED lights, using the synchronous client.
- `openai_simple.py` – A simple synchronous chatbot loop using OpenAI and Furhat.
- `openai_async.py` – An asynchronous chatbot using OpenAI and Furhat, handling events with asyncio. This allows for somewhat better turn-taking with less interruptions. 
- `openai_realtime.py` – A bridge between OpenAI's realtime voice interaction and Furhat using the audio send/recieve endpoints. 
- `openai_realtime_vision.py` – Same as `openai_realtime.py`, but with vision capabilities. Images captured by the robot are sent to the realtime voice interaction model.

For all examples. you can provide the host (ip address) of the robot (default `127.0.0.1`, for SDK), as well as an optional authentication key (depending on the Realtime security settings) as command-line arguments. For example:

```
python hello_world --host=192.168.0.52 --auth_key==mykey123
```