import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from services.router import resolve_query


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
8. Always ensure the content is unique and original, not copied from existing sources.
9. Output valid JSON only using this exact shape:
{
  "text": "main publish-ready content",
  "caption": "short optional caption",
  "hashtags": ["tag1", "tag2", "tag3"],
  "content_type": "text"
}
10. Never wrap the JSON in code fences.
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


def _normalize_source(uri, title=None, source_type="web"):
    if not uri and not title:
        return None

    return {
        "type": source_type,
        "label": title or uri or source_type,
        "uri": uri,
    }


def _extract_grounded_sources(response):
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return []

    grounding_metadata = getattr(candidates[0], "grounding_metadata", None)
    if grounding_metadata is None and isinstance(candidates[0], dict):
        grounding_metadata = candidates[0].get("grounding_metadata")

    if not grounding_metadata:
        return []

    chunks = getattr(grounding_metadata, "grounding_chunks", None)
    if chunks is None and isinstance(grounding_metadata, dict):
        chunks = grounding_metadata.get("grounding_chunks", [])

    sources = []
    seen = set()

    for chunk in chunks or []:
        web = getattr(chunk, "web", None)
        if web is None and isinstance(chunk, dict):
            web = chunk.get("web")

        if not web:
            continue

        uri = getattr(web, "uri", None)
        title = getattr(web, "title", None)

        if isinstance(web, dict):
            uri = web.get("uri", uri)
            title = web.get("title", title)

        key = (uri, title)
        if key in seen:
            continue

        normalized = _normalize_source(uri=uri, title=title, source_type="google_search")
        if normalized:
            sources.append(normalized)
            seen.add(key)

    return sources


def _grounded_generate(user_message: str):
    grounding_tool = types.Tool(google_search=types.GoogleSearch())
    prompt = (
        f"{SOCIAL_MEDIA_TEXT_SYSTEM_PROMPT}\n\n"
        "You must use Google Search to research and gather information for creating the content. "
        "Base the content on current trends, facts, or examples found through Google Search. "
        "Always perform a search to ensure the content is informed and unique.\n\n"
        f"User request:\n{user_message}"
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[grounding_tool]
        ),
    )

    parsed = _extract_json_response(response.text)
    sources = _extract_grounded_sources(response)
    parsed["source"] = "gemini_google_search" if sources else "gemini"
    parsed["sources"] = sources
    return parsed


def generate_response(session_id: str, user_message: str):
    routed = resolve_query(user_message)
    if routed:
        return {
            "text": str(routed["text"]),
            "caption": str(routed["text"]),
            "hashtags": [],
            "content_type": "text",
            "raw_response": str(routed["text"]),
            "source": routed["source"],
            "sources": routed["sources"],
        }

    return _grounded_generate(user_message)


def stream_response(session_id: str, user_message: str):
    chat = _get_or_create_chat(session_id)
    tool_result = resolve_query(user_message)

    if tool_result:
        response = chat.send_message_stream(
            f"User asked: {user_message}\nAnswer: {tool_result['text']}\nMake it conversational, don't modify the answer."
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
