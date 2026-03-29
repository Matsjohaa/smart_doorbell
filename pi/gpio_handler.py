

import logging
from typing import Callable

try:
    from gpiozero import Button
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

from config import BUTTON_GPIO_PIN, BUTTON_DEBOUNCE_MS

logger = logging.getLogger(__name__)

_button = None


def setup_button(on_press: Callable[[], None]) -> None:
    """
    Configure the button GPIO pin and register a callback.

    Args:
        on_press: Function to call when the button is pressed.
    """
    global _button

    if not GPIO_AVAILABLE:
        logger.warning("gpiozero not available - button disabled (dev mode)")
        return

    bounce_seconds = BUTTON_DEBOUNCE_MS / 1000.0
    _button = Button(BUTTON_GPIO_PIN, pull_up=False, bounce_time=bounce_seconds)

    def _callback() -> None:
        logger.info("Button pressed (GPIO %d)", BUTTON_GPIO_PIN)
        on_press()

    _button.when_pressed = _callback
    logger.info("Button listener registered on GPIO %d", BUTTON_GPIO_PIN)


def cleanup() -> None:
    """Release GPIO resources."""
    global _button
    if _button is not None:
        _button.close()
        _button = None
        logger.info("GPIO cleaned up")
