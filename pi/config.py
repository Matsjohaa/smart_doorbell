"""
Configuration constants for the smart doorbell system.
"""

import os

# -- Paths --------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CAPTURES_DIR = os.path.join(DATA_DIR, "captures")
KNOWN_FACES_DIR = os.path.join(DATA_DIR, "known_faces")
DB_PATH = os.path.join(DATA_DIR, "doorbell.db")

# -- GPIO ---------------------------------------------------------------
BUTTON_GPIO_PIN = 17          # BCM pin number for the doorbell button
BUTTON_DEBOUNCE_MS = 300      # Debounce time in milliseconds

# -- Camera -------------------------------------------------------------
CAMERA_RESOLUTION = (1640, 1232)   # Still capture resolution
STREAM_RESOLUTION = (640, 480)     # MJPEG stream resolution
STREAM_FPS = 15                    # Target FPS for live stream
JPEG_QUALITY = 85                  # JPEG compression quality (1-100)

# -- Face Recognition --------------------------------------------------
RECOGNITION_TOLERANCE = 0.5   # Lower = stricter matching (default 0.6)
RECOGNITION_MODEL = "hog"     # "hog" (faster on CPU) or "cnn" (more accurate)

# -- Flask API ----------------------------------------------------------
API_HOST = "0.0.0.0"
API_PORT = 5000

# -- Ensure directories exist ------------------------------------------
for _dir in (DATA_DIR, CAPTURES_DIR, KNOWN_FACES_DIR):
    os.makedirs(_dir, exist_ok=True)
