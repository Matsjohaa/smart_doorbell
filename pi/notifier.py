"""
Push notification module using the Expo Push Notification Service.

The mobile app registers its Expo push token with the Pi via POST /register-token.
When a doorbell event occurs, we send a push to all registered tokens via
Expo's HTTP API (no extra services required).

Docs: https://docs.expo.dev/push-notifications/sending-notifications/
"""

import json
import logging
import urllib.request
import urllib.error

import database

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_notification(
    person_name: str,
    confidence: float,
    image_path: str,
    event_id: int,
) -> bool:
    """
    Send a push notification to all registered Expo push tokens.

    Returns True if at least one notification was sent successfully.
    """
    tokens = database.get_push_tokens()
    if not tokens:
        logger.warning("No push tokens registered - skipping notification")
        return False

    title = "Doorbell"
    if person_name and person_name not in ("Unknown", "No face detected"):
        body = f"{person_name} is at the door (confidence: {confidence:.0%})"
    else:
        body = "Someone is at the door"

    # Build messages (one per token)
    messages = [
        {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": {
                "event_id": event_id,
                "person_name": person_name or "Unknown",
                "confidence": round(confidence, 3),
                "image_path": image_path,
            },
        }
        for token in tokens
    ]

    payload = json.dumps(messages).encode("utf-8")
    req = urllib.request.Request(
        EXPO_PUSH_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            # Check for invalid tokens and remove them
            for i, ticket in enumerate(result.get("data", [])):
                if ticket.get("status") == "error":
                    detail = ticket.get("details", {})
                    if detail.get("error") == "DeviceNotRegistered":
                        logger.info("Removing invalid token: %s", tokens[i][:20])
                        database.remove_push_token(tokens[i])
            logger.info("Push notification sent to %d device(s)", len(tokens))
            return True
    except urllib.error.URLError as e:
        logger.error("Failed to send push notification: %s", e)
        return False
