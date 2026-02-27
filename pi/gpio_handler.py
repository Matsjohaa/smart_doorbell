"""
GPIO handler for the doorbell button.
Uses RPi.GPIO with edge detection and debouncing.
"""

import logging
from typing import Callable

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

from config import BUTTON_GPIO_PIN, BUTTON_DEBOUNCE_MS

logger = logging.getLogger(__name__)


def setup_button(on_press: Callable[[], None]) -> None:
    """
    Configure the button GPIO pin and register a callback.

    Args:
        on_press: Function to call when the button is pressed.
    """
    if not GPIO_AVAILABLE:
        logger.warning("RPi.GPIO not available – button disabled (dev mode)")
        return

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(BUTTON_GPIO_PIN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

    def _callback(channel: int) -> None:
        logger.info("Button pressed (GPIO %d)", channel)
        on_press()

    GPIO.add_event_detect(
        BUTTON_GPIO_PIN,
        GPIO.RISING,
        callback=_callback,
        bouncetime=BUTTON_DEBOUNCE_MS,
    )
    logger.info("Button listener registered on GPIO %d", BUTTON_GPIO_PIN)


def cleanup() -> None:
    """Release GPIO resources."""
    if GPIO_AVAILABLE:
        GPIO.cleanup()
        logger.info("GPIO cleaned up")
