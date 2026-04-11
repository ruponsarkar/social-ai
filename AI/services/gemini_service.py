import os
import json
from google import genai
from dotenv import load_dotenv
from services.router import route_query


load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

chat_sessions = {}

SOCIAL_MEDIA_TEXT_SYSTEM_PROMPT = """
You are an AI content writer for a social media management platform.

Your job is to generate clean, publishable marketing text that can be used directly by the application.

Rules:
1. Return useful content for Facebook, Instagram captions, and general marketing copy.
2. Keep tone human, natural, and engaging.
3. Avoid markdown unless explicitly requested.
4. Do not include explanations about what you are doing.
5. Do not include labels like "Here is your post" unless asked.
6. If the user asks for a text post, prioritize one final polished text output.
7. If possible, also provide a short caption and hashtag suggestions.
8. Output valid JSON only using this exact shape:
{
  "text": "main publish-ready content",
  "caption": "short optional caption",
  "hashtags": ["tag1", "tag2", "tag3"],
  "content_type": "text"
}
9. Never wrap the JSON in code fences.
""".strip()


def _get_or_create_chat(session_id: str):
    if session_id not in chat_sessions:
        chat_sessions[session_id] = client.chats.create(
            model="gemini-2.5-flash"
        )

    return chat_sessions[session_id]


def _extract_json_response(raw_text: str):
    cleaned = (raw_text or "").strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()

    try:
        parsed = json.loads(cleaned)
    except Exception:
        parsed = {
            "text": cleaned,
            "caption": cleaned[:160] if cleaned else "",
            "hashtags": [],
            "content_type": "text"
        }

    if not isinstance(parsed, dict):
        parsed = {
            "text": cleaned,
            "caption": cleaned[:160] if cleaned else "",
            "hashtags": [],
            "content_type": "text"
        }

    return {
        "text": str(parsed.get("text", cleaned)).strip(),
        "caption": str(parsed.get("caption", "")).strip(),
        "hashtags": parsed.get("hashtags", []) if isinstance(parsed.get("hashtags", []), list) else [],
        "content_type": "text",
        "raw_response": raw_text
    }


def generate_response(session_id: str, user_message: str):
    chat = _get_or_create_chat(session_id)

    routed = route_query(user_message)
    if routed:
        return {
            "text": str(routed),
            "caption": str(routed),
            "hashtags": [],
            "content_type": "text",
            "raw_response": str(routed)
        }

    prompt = (
        f"{SOCIAL_MEDIA_TEXT_SYSTEM_PROMPT}\n\n"
        f"User request:\n{user_message}"
    )

    response = chat.send_message(prompt)

    return _extract_json_response(response.text)


def stream_response(session_id: str, user_message: str):
    chat = _get_or_create_chat(session_id)
    tool_result = route_query(user_message)

    if tool_result:
        response = chat.send_message_stream(
            f"User asked: {user_message}\nAnswer: {tool_result}\nMake it conversational, don't modify the answer."
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text
        return

    # fallback to AI
    prompt = (
        "You are a social media copywriter. "
        "Reply with clean final text only, no markdown, no explanations.\n\n"
        f"User request:\n{user_message}"
    )
    stream = chat.send_message_stream(prompt)

    for chunk in stream:
        if chunk.text:
            yield chunk.text
