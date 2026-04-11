import dateparser
from datetime import datetime, timedelta
import calendar

def handle_datetime_query(user_message: str):
    text = user_message.lower()
    now = datetime.now()

    if "time" in text:
        return now.strftime("%I:%M:%S %p")

    if "after tomorrow" in text:
        return (now + timedelta(days=2)).strftime("%A, %d %B %Y")

    if "tomorrow" in text:
        return (now + timedelta(days=1)).strftime("%A, %d %B %Y")

    weekdays = {
        "monday": 0, "tuesday": 1, "wednesday": 2,
        "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
    }

    for day, index in weekdays.items():
        if f"next {day}" in text:
            days_ahead = (index - now.weekday() + 7) % 7
            days_ahead = days_ahead if days_ahead != 0 else 7
            return (now + timedelta(days=days_ahead)).strftime("%A, %d %B %Y")

    if "end of this month" in text:
        last_day = calendar.monthrange(now.year, now.month)[1]
        return now.replace(day=last_day).strftime("%A, %d %B %Y")

    parsed_date = dateparser.parse(
        user_message,
        settings={
            "PREFER_DATES_FROM": "future",
            "RELATIVE_BASE": now
        }
    )

    if parsed_date:
        return parsed_date.strftime("%A, %d %B %Y")

    return now.strftime("%A, %d %B %Y %I:%M:%S %p")
