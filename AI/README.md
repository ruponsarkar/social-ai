# AI Chat Service

This FastAPI service wraps Gemini for project-specific social media text generation.

## `/chat` response format

`POST /chat`

Request:

```json
{
  "session_id": "campaign-123",
  "message": "Create a Facebook post about digital marketing for small businesses with a friendly tone."
}
```

Response:

```json
{
  "session_id": "campaign-123",
  "ai": "Your main publish-ready post text",
  "data": {
    "text": "Your main publish-ready post text",
    "caption": "Optional shorter caption",
    "hashtags": ["digitalmarketing", "smallbusiness", "growth"],
    "content_type": "text",
    "raw_response": "{...original model output...}"
  }
}
```

## Recommended usage in this project

- Use `data.text` as the main text post body
- Use `data.caption` for shorter placements if needed
- Use `data.hashtags` when generating caption-based posts
- Use `ai` when you only need the final plain text quickly
