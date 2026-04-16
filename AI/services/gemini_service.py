import os
import json
import uuid
from pathlib import Path
from google import genai
from google.genai import types
from dotenv import load_dotenv
from services.router import resolve_query
from io import BytesIO


load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

chat_sessions = {}
PUBLIC_IMAGE_DIR = Path(__file__).resolve().parents[1] / "public" / "images"
PUBLIC_IMAGE_DIR.mkdir(parents=True, exist_ok=True)

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

SOCIAL_MEDIA_IMAGE_SYSTEM_PROMPT = """
You are an AI image prompt optimizer for a social media management platform.

Your job is to enhance user image prompts and generate captions for the resulting images.

Rules:
1. Take the user's basic image idea and transform it into a detailed, professional prompt optimized for AI image generation.
2. Focus on visual details: lighting, composition, style, colors, mood, and specific visual elements.
3. Make prompts descriptive but not overly long - aim for 50-100 words.
4. Ensure prompts are suitable for social media: high-quality, engaging, and brand-appropriate.
5. Generate a short, catchy caption (under 150 characters) that complements the image.
6. Suggest 3-5 relevant hashtags for the image content.
7. Always ensure the content is unique and original.
8. Output valid JSON only using this exact shape:
{
  "improved_prompt": "detailed optimized prompt for image generation",
  "caption": "short catchy caption for the image",
  "hashtags": ["tag1", "tag2", "tag3"],
  "content_type": "image"
}
9. Never wrap the JSON in code fences.
10. Do not include explanations about what you are doing.
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


def _improve_image_prompt(user_prompt: str):
    prompt = (
        f"{SOCIAL_MEDIA_IMAGE_SYSTEM_PROMPT}\n\n"
        f"User's basic image idea:\n{user_prompt}\n\n"
        "Please enhance this prompt and generate a caption."
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    cleaned = (response.text or "").strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()

    try:
        parsed = json.loads(cleaned)
    except Exception:
        # Fallback structure
        parsed = {
            "improved_prompt": user_prompt,
            "caption": user_prompt[:150] if user_prompt else "",
            "hashtags": [],
            "content_type": "image"
        }

    if not isinstance(parsed, dict):
        parsed = {
            "improved_prompt": user_prompt,
            "caption": user_prompt[:150] if user_prompt else "",
            "hashtags": [],
            "content_type": "image"
        }

    return {
        "improved_prompt": str(parsed.get("improved_prompt", user_prompt)).strip(),
        "caption": str(parsed.get("caption", "")).strip(),
        "hashtags": parsed.get("hashtags", []) if isinstance(parsed.get("hashtags", []), list) else [],
        "content_type": "image",
        "raw_response": response.text
    }


def _generate_caption_only(user_prompt: str):
    """Generate a short catchy caption for an image prompt without enhancing the prompt itself."""
    prompt = (
        "You are a social media caption writer. Generate a short, catchy caption (under 150 characters) "
        "for an image that would be generated from this prompt. Make it engaging and suitable for social media.\n\n"
        f"Image prompt: {user_prompt}\n\n"
        "Output valid JSON only using this exact shape:\n"
        "{\n"
        '  "caption": "short catchy caption for the image",\n'
        '  "hashtags": ["tag1", "tag2", "tag3"]\n'
        "}\n"
        "Never wrap the JSON in code fences."
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    cleaned = (response.text or "").strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()

    try:
        parsed = json.loads(cleaned)
    except Exception:
        # Fallback structure
        parsed = {
            "caption": user_prompt[:150] if user_prompt else "",
            "hashtags": []
        }

    if not isinstance(parsed, dict):
        parsed = {
            "caption": user_prompt[:150] if user_prompt else "",
            "hashtags": []
        }

    return {
        "caption": str(parsed.get("caption", user_prompt[:150] if user_prompt else "")).strip(),
        "hashtags": parsed.get("hashtags", []) if isinstance(parsed.get("hashtags", []), list) else []
    }


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


def generate_image(prompt: str, public_url_base: str | None = None, enhance_prompt: bool = True):
    # Optionally improve the prompt and generate caption using Gemini
    enhanced_prompt = prompt
    caption = ""
    hashtags = []
    
    if enhance_prompt:
        try:
            improved_data = _improve_image_prompt(prompt)
            enhanced_prompt = improved_data["improved_prompt"]
            caption = improved_data["caption"]
            hashtags = improved_data["hashtags"]
            print(f"Original prompt: {prompt}")
            print(f"Enhanced prompt: {enhanced_prompt}")
        except Exception as e:
            print(f"Prompt improvement failed: {str(e)}, using original prompt")
            enhanced_prompt = prompt
            # Generate caption even if enhancement fails
            try:
                caption_data = _generate_caption_only(prompt)
                caption = caption_data["caption"]
                hashtags = caption_data["hashtags"]
            except Exception as caption_error:
                print(f"Caption generation also failed: {str(caption_error)}")
                caption = prompt[:150] if prompt else ""
                hashtags = []
    else:
        print(f"Using raw prompt (enhancement disabled): {prompt}")
        enhanced_prompt = prompt
        # Still generate AI caption for raw prompts
        try:
            caption_data = _generate_caption_only(prompt)
            caption = caption_data["caption"]
            hashtags = caption_data["hashtags"]
        except Exception as e:
            print(f"Caption generation failed for raw prompt: {str(e)}")
            caption = prompt[:150] if prompt else ""
            hashtags = []

    # Use Gemini Imagen with the enhanced prompt
    try:
        print(f"Generating image with Gemini: {enhanced_prompt}")
        response = client.models.generate_images(
            model="imagen-4.0-fast-generate-001",
            prompt=enhanced_prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="1:1",
                person_generation="allow_adult"
            )
        )
        print("Image generation response received")

        if response.generated_images:
            image = response.generated_images[0]
            image_bytes = image.image.image_bytes
            filename = f"{uuid.uuid4().hex}.png"
            file_path = PUBLIC_IMAGE_DIR / filename
            file_path.write_bytes(image_bytes)

            if public_url_base:
                image_url = f"{public_url_base.rstrip('/')}/public/images/{filename}"
            else:
                image_url = f"/public/images/{filename}"

            print(f"Image generated successfully and saved to {file_path}")
            return {
                "image_url": image_url,
                "source": "gemini_imagen",
                "image_path": str(file_path),
                "caption": caption,
                "hashtags": hashtags,
                "improved_prompt": enhanced_prompt,
                "original_prompt": prompt
            }
        else:
            print("No images generated")
            raise Exception("No image generated")
    except Exception as e:
        print(f"Gemini image generation failed: {str(e)}")
        # Fallback to mock
        return {
            "image_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
            "source": "mock",
            "caption": caption or "Beautiful image",
            "hashtags": hashtags or ["#image", "#photo"],
            "improved_prompt": enhanced_prompt,
            "original_prompt": prompt
        }


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
