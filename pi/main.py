"""
Smart Doorbell - Main entry point.

Initialises all subsystems and runs the event loop:
  1. Database
  2. Face recognition (load known faces)
  3. Camera
  4. Push notifications (Expo Push Service)
  5. GPIO button listener
  6. Flask API server (in a background thread)
"""

import logging
import sys
import threading
import signal

import database
import recognizer
import notifier
from camera import Camera
from gpio_handler import setup_button, cleanup as gpio_cleanup
from api import app, set_camera, set_doorbell_callback, run_server
from config import API_HOST, API_PORT

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")

# Global camera instance 
camera = Camera()


# Doorbell event handler

def on_doorbell_press() -> None:
    """Called when the physical button is pressed (or /trigger is hit)."""
    logger.info("=== Doorbell pressed ===")

    # 1. Capture image
    image_path = camera.capture()
    if image_path is None:
        logger.error("Image capture failed - aborting event")
        return

    # 2. Run face recognition
    result = recognizer.recognize(image_path)
    person_id = result["person_id"]
    person_name = result["person_name"]
    confidence = result["confidence"]

    # 3. Log event in database
    event_id = database.add_event(
        image_path=image_path,
        person_id=person_id,
        person_name=person_name,
        confidence=confidence,
    )

    logger.info(
        "Event #%d logged - %s (confidence=%.2f)",
        event_id, person_name, confidence,
    )

    # 4. Send push notification
    notifier.send_notification(
        person_name=person_name,
        confidence=confidence,
        image_path=image_path,
        event_id=event_id,
    )


# Graceful shutdown 
def shutdown(signum=None, frame=None) -> None:
    logger.info("Shutting down...")
    camera.stop()
    gpio_cleanup()
    sys.exit(0)


# Main
def main() -> None:
    logger.info("Starting Smart Doorbell system")

    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # 1. Init database
    database.init_db()
    logger.info("Database initialised")

    # 2. Load known face encodings
    recognizer.load_known_faces()

    # 3. Start camera
    camera.start()
    set_camera(camera)

    # 4. Set up GPIO button
    set_doorbell_callback(on_doorbell_press)
    setup_button(on_press=on_doorbell_press)

    # 5. Start Flask API in a background thread
    api_thread = threading.Thread(target=run_server, daemon=True)
    api_thread.start()
    logger.info("API server running on http://%s:%d", API_HOST, API_PORT)

    # Keep the main thread alive (GPIO callbacks run on a background thread)
    logger.info("System ready - waiting for doorbell presses...")
    signal.pause()


if __name__ == "__main__":
    main()
