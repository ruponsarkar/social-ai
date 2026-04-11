import requests
from rapidfuzz import fuzz
from services.tools import handle_datetime_query

API_URL = "https://pageuptechnologies.com/api/code"


def fetch_api_data():
    try:
        res = requests.get(API_URL)
        return res.json()
    except Exception as e:
        print("API error:", e)
        return []


def match_api_response(user_message: str):
    data = fetch_api_data()

    best_score = 0
    best_match = None

    for item in data:
        question = item.get("name") or ""   # ✅ safe fallback
        answer = item.get("code") or ""     # ✅ safe fallback

        if not question or not answer:
            continue  # skip invalid data

        score = fuzz.partial_ratio(
            user_message.lower(),
            question.lower()
        )

        if score > 75 and score > best_score:
            best_score = score
            best_match = answer

    return best_match

def is_datetime_query(text: str):
    text = text.lower()
    return any(word in text for word in [
        "time", "date", "day", "week", "month",
        "year", "tomorrow", "next", "after"
    ])

def route_query(user_message: str):
    api_result = match_api_response(user_message)
    if api_result:
        return api_result

    if is_datetime_query(user_message):
        result = handle_datetime_query(user_message)
        if result:
            return result

    return None
