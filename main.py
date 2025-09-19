import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import httpx
import asyncio
from byteplussdkarkruntime import Ark

load_dotenv()

API_KEY = os.getenv("ARK_API_KEY")
if not API_KEY:
    print("ARK_API_KEY not set in environment")
    sys.exit(1)

ark_client = Ark(api_key=API_KEY, timeout=1800)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        test_response = ark_client.chat.completions.create(
            model="seed-1-6-250615",
            messages=[{"role": "user", "content": "Hello"}],
        )
        print("ARK API key verified successfully.")
        yield
    except Exception as e:
        print(f"ARK API key verification failed: {e}")
        raise RuntimeError("ARK API key verification failed") from e

app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    user_message: str
    model: str = "chat"

@app.get("/")
async def health_check():
    return {"status": "ok"}

@app.post("/chat")
async def chat(request: ChatRequest):
    if request.model == "chat":
        try:
            response = ark_client.chat.completions.create(
                model="seed-1-6-250615",
                messages=[{"role": "user", "content": request.user_message}],
            )
            content = response.choices[0].message.content
            return {"bot_response": content}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    elif request.model == "image":
        try:
            response = ark_client.images.generate(
                model="seedream-4-0-250828",
                prompt=request.user_message,
                size="2K",
                response_format="url",
                watermark=True
            )
            image_url = response.data[0].url
            return {"media_url": image_url}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    elif request.model == "video":
        video_api_url = "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        }
        payload = {
            "model": "seedance-1-0-lite-i2v-250428",
            "content": [
                {
                    "type": "text",
                    "text": request.user_message + " --resolution 720p --duration 5 --camerafixed false"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://ark-doc.tos-ap-southeast-1.bytepluses.com/see_i2v.jpeg"
                    }
                }
            ]
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(video_api_url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                task_id = data.get("id")
                if not task_id:
                    raise HTTPException(status_code=500, detail="No task ID returned from video generation API")

                status_url = f"{video_api_url}/{task_id}"
                timeout_seconds = 60
                poll_interval = 3
                elapsed = 0

                while elapsed < timeout_seconds:
                    status_resp = await client.get(status_url, headers=headers)
                    status_resp.raise_for_status()
                    status_data = status_resp.json()
                    status = status_data.get("status")

                    if status == "succeeded":
                        video_url = None
                        if "content" in status_data and "video_url" in status_data["content"]:
                            video_url = status_data["content"]["video_url"]
                        if video_url:
                            return {"media_url": video_url}
                        else:
                            return {"detail": "Video generation succeeded but no media URL found", "raw_response": status_data}

                    elif status == "failed":
                        raise HTTPException(status_code=500, detail="Video generation failed")

                    await asyncio.sleep(poll_interval)
                    elapsed += poll_interval

                raise HTTPException(status_code=504, detail="Video generation timed out")

        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    else:
        raise HTTPException(status_code=400, detail="Invalid model specified")