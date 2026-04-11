from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from services.gemini_service import generate_response
from services.gemini_service import stream_response

app = FastAPI()

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
