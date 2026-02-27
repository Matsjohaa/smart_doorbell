"""
Camera module – still capture and MJPEG live streaming.
Uses picamera2 on the Raspberry Pi.
"""

import io
import os
import time
import logging
import threading
from datetime import datetime

from config import (
    CAPTURES_DIR,
    CAMERA_RESOLUTION,
    STREAM_RESOLUTION,
    STREAM_FPS,
    JPEG_QUALITY,
)

logger = logging.getLogger(__name__)

try:
    from picamera2 import Picamera2
    PICAMERA_AVAILABLE = True
except ImportError:
    PICAMERA_AVAILABLE = False
    logger.warning("picamera2 not available – camera disabled (dev mode)")


class Camera:
    """Wrapper around picamera2 for capture and streaming."""

    def __init__(self) -> None:
        self._cam: Picamera2 | None = None
        self._lock = threading.Lock()
        self._started = False

    def start(self) -> None:
        """Initialize and start the camera."""
        if not PICAMERA_AVAILABLE:
            logger.warning("Camera not started – picamera2 unavailable")
            return

        self._cam = Picamera2()

        # Configure for still captures (main) and low-res stream (lores)
        config = self._cam.create_still_configuration(
            main={"size": CAMERA_RESOLUTION},
            lores={"size": STREAM_RESOLUTION, "format": "YUV420"},
            display="lores",
        )
        self._cam.configure(config)
        self._cam.start()
        self._started = True
        logger.info("Camera started: capture=%s, stream=%s",
                     CAMERA_RESOLUTION, STREAM_RESOLUTION)

    def capture(self) -> str | None:
        """
        Take a still photo and save it to the captures directory.
        Returns the file path of the saved image, or None on failure.
        """
        if not self._started or self._cam is None:
            logger.error("Cannot capture – camera not started")
            return None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"capture_{timestamp}.jpg"
        filepath = os.path.join(CAPTURES_DIR, filename)

        with self._lock:
            self._cam.capture_file(filepath)

        logger.info("Image captured: %s", filepath)
        return filepath

    def stream_frames(self):
        """
        Generator that yields JPEG frames for an MJPEG stream.
        Each yielded value is raw JPEG bytes.
        """
        if not self._started or self._cam is None:
            logger.error("Cannot stream – camera not started")
            return

        interval = 1.0 / STREAM_FPS
        while True:
            buf = io.BytesIO()
            with self._lock:
                self._cam.capture_file(buf, format="jpeg")
            yield buf.getvalue()
            time.sleep(interval)

    def stop(self) -> None:
        """Stop the camera."""
        if self._cam and self._started:
            self._cam.stop()
            self._started = False
            logger.info("Camera stopped")
