from pathlib import Path
from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from services.gemini_service import generate_response
from services.gemini_service import stream_response
from services.gemini_service import generate_image

app = FastAPI()

PUBLIC_DIR = Path(__file__).resolve().parent / "public"
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/public", StaticFiles(directory=str(PUBLIC_DIR)), name="public")

# ✅ CORS fix
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ImageRequest(BaseModel):
    prompt: str

@app.get("/")
def home():
    return {"message": "AI Chat Server Running 🚀"}

@app.post("/chat")
def chat(request: ChatRequest):
    try:
        reply = generate_response(
            request.session_id,
            request.message
        )

        return {
            "session_id": request.session_id,
            "ai": reply.get("text", ""),
            "data": reply
        }

    except Exception as e:
        return {"error": str(e)}
    


@app.post("/chat-stream")
def chat_stream(request: ChatRequest):
    def generate():
        for chunk in stream_response(request.session_id, request.message):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

@app.post("/generate-image")
def generate_image_endpoint(image_request: ImageRequest, http_request: Request):
    try:
        public_url_base = str(http_request.base_url).rstrip("/")
        result = generate_image(image_request.prompt, public_url_base=public_url_base)
        return result
    except Exception as e:
        return {"error": str(e)}
