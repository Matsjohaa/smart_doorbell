"""
Push notification module using Firebase Cloud Messaging (FCM).

Setup:
  1. Create a Firebase project at https://console.firebase.google.com
  2. Download the service account JSON key.
  3. Place it at pi/data/firebase_service_account.json
  4. In the mobile app, register for FCM and subscribe to the topic "doorbell".
"""

import logging
import os

from config import FIREBASE_CREDENTIALS_PATH

logger = logging.getLogger(__name__)

_initialized = False

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("firebase-admin not installed – notifications disabled")


def init_firebase() -> None:
    """Initialize the Firebase Admin SDK."""
    global _initialized

    if not FIREBASE_AVAILABLE:
        return

    if not os.path.exists(FIREBASE_CREDENTIALS_PATH):
        logger.warning(
            "Firebase credentials not found at %s – notifications disabled",
            FIREBASE_CREDENTIALS_PATH,
        )
        return

    cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)
    _initialized = True
    logger.info("Firebase initialized")


def send_notification(
    person_name: str,
    confidence: float,
    image_path: str,
    event_id: int,
) -> bool:
    """
    Send a push notification to all devices subscribed to the "doorbell" topic.

    Returns True if sent successfully, False otherwise.
    """
    if not _initialized:
        logger.warning("Firebase not initialized – skipping notification")
        return False

    title = "Doorbell"
    if person_name and person_name not in ("Unknown", "No face detected"):
        body = f"{person_name} is at the door (confidence: {confidence:.0%})"
    else:
        body = "Someone is at the door"

    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data={
            "event_id": str(event_id),
            "person_name": person_name or "Unknown",
            "confidence": str(round(confidence, 3)),
            "image_path": image_path,
        },
        topic="doorbell",
    )

    try:
        response = messaging.send(message)
        logger.info("Notification sent: %s", response)
        return True
    except Exception as e:
        logger.error("Failed to send notification: %s", e)
        return False
