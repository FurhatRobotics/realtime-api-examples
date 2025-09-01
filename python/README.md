# Examples for the Python Furhat WebSocket API Client

Install the Furhat WebSocket API Client with pip:

```
pip install furhat_ws_api
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

