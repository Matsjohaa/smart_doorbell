"""
Face recognition module.

Uses the `face_recognition` library to:
  1. Encode known faces from stored images.
  2. Compare a captured image against known encodings.
"""

import os
import logging
import pickle

import numpy as np
import face_recognition

from config import KNOWN_FACES_DIR, RECOGNITION_TOLERANCE, RECOGNITION_MODEL
import database

logger = logging.getLogger(__name__)

# In-memory cache: {person_id: numpy encoding}
_known_encodings: dict[int, np.ndarray] = {}
_known_names: dict[int, str] = {}

ENCODINGS_CACHE_PATH = os.path.join(KNOWN_FACES_DIR, "_encodings.pkl")


# ── Encoding Management ───────────────────────────────────────────────

def _compute_encoding(image_path: str) -> np.ndarray | None:
    """Compute a 128-d face encoding from an image file."""
    image = face_recognition.load_image_file(image_path)
    encodings = face_recognition.face_encodings(image, model=RECOGNITION_MODEL)
    if not encodings:
        logger.warning("No face found in %s", image_path)
        return None
    return encodings[0]


def load_known_faces() -> None:
    """
    Load all known people from the database and compute/cache their encodings.
    Call this at startup.
    """
    global _known_encodings, _known_names
    _known_encodings.clear()
    _known_names.clear()

    # Try loading cached encodings first
    if os.path.exists(ENCODINGS_CACHE_PATH):
        try:
            with open(ENCODINGS_CACHE_PATH, "rb") as f:
                cached = pickle.load(f)
            _known_encodings = cached["encodings"]
            _known_names = cached["names"]
            logger.info("Loaded %d cached face encodings", len(_known_encodings))
        except Exception:
            logger.warning("Failed to load encoding cache, recomputing…")

    people = database.get_all_people()

    # Check if cache is still valid (same person ids)
    cached_ids = set(_known_encodings.keys())
    db_ids = {p["id"] for p in people}

    if cached_ids == db_ids and _known_encodings:
        return  # Cache is up to date

    # Recompute
    _known_encodings.clear()
    _known_names.clear()

    for person in people:
        pid = person["id"]
        path = person["image_path"]
        if not os.path.exists(path):
            logger.warning("Image missing for person %d: %s", pid, path)
            continue
        encoding = _compute_encoding(path)
        if encoding is not None:
            _known_encodings[pid] = encoding
            _known_names[pid] = person["name"]

    _save_cache()
    logger.info("Computed encodings for %d known people", len(_known_encodings))


def add_known_face(person_id: int, name: str, image_path: str) -> bool:
    """Compute and store the encoding for a newly added person."""
    encoding = _compute_encoding(image_path)
    if encoding is None:
        return False
    _known_encodings[person_id] = encoding
    _known_names[person_id] = name
    _save_cache()
    return True


def remove_known_face(person_id: int) -> None:
    """Remove a person's encoding from the cache."""
    _known_encodings.pop(person_id, None)
    _known_names.pop(person_id, None)
    _save_cache()


def _save_cache() -> None:
    """Persist encodings to disk so startup is faster next time."""
    with open(ENCODINGS_CACHE_PATH, "wb") as f:
        pickle.dump({"encodings": _known_encodings, "names": _known_names}, f)


# ── Recognition ───────────────────────────────────────────────────────

def recognize(image_path: str) -> dict:
    """
    Identify the person in a captured image.

    Returns:
        {
            "person_id": int | None,
            "person_name": str,        # Name or "Unknown"
            "confidence": float,        # 0.0–1.0 (1 = perfect match)
            "face_detected": bool,
        }
    """
    image = face_recognition.load_image_file(image_path)
    face_locations = face_recognition.face_locations(image, model=RECOGNITION_MODEL)

    if not face_locations:
        logger.info("No face detected in %s", image_path)
        return {
            "person_id": None,
            "person_name": "No face detected",
            "confidence": 0.0,
            "face_detected": False,
        }

    # Use the first (largest) face found
    unknown_encoding = face_recognition.face_encodings(image, face_locations)[0]

    if not _known_encodings:
        logger.info("No known faces registered – result is Unknown")
        return {
            "person_id": None,
            "person_name": "Unknown",
            "confidence": 0.0,
            "face_detected": True,
        }

    # Compare against all known faces
    known_ids = list(_known_encodings.keys())
    known_encs = [_known_encodings[pid] for pid in known_ids]

    distances = face_recognition.face_distance(known_encs, unknown_encoding)
    best_idx = int(np.argmin(distances))
    best_distance = distances[best_idx]

    if best_distance <= RECOGNITION_TOLERANCE:
        person_id = known_ids[best_idx]
        confidence = round(1.0 - best_distance, 3)
        person_name = _known_names[person_id]
        logger.info("Recognized: %s (confidence %.2f)", person_name, confidence)
        return {
            "person_id": person_id,
            "person_name": person_name,
            "confidence": confidence,
            "face_detected": True,
        }

    logger.info("Face detected but not recognized (best dist=%.3f)", best_distance)
    return {
        "person_id": None,
        "person_name": "Unknown",
        "confidence": round(1.0 - best_distance, 3),
        "face_detected": True,
    }
