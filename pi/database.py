"""
SQLite database helpers for events and known people.
"""

import sqlite3
import os
from datetime import datetime, timezone

from config import DB_PATH


def _get_connection() -> sqlite3.Connection:
    """Return a connection with row_factory set to sqlite3.Row."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    conn = _get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS people (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            image_path  TEXT    NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT    NOT NULL,
            person_id   INTEGER,
            person_name TEXT,
            confidence  REAL,
            image_path  TEXT    NOT NULL,
            seen        INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS push_tokens (
            token       TEXT    PRIMARY KEY,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


# -- People CRUD --------------------------------------------------------

def add_person(name: str, image_path: str) -> int:
    """Add a known person. Returns the new person id."""
    conn = _get_connection()
    cur = conn.execute(
        "INSERT INTO people (name, image_path) VALUES (?, ?)",
        (name, image_path),
    )
    conn.commit()
    person_id = cur.lastrowid
    conn.close()
    return person_id


def get_all_people() -> list[dict]:
    """Return a list of all known people."""
    conn = _get_connection()
    rows = conn.execute("SELECT * FROM people ORDER BY name").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_person(person_id: int) -> dict | None:
    """Return a single person or None."""
    conn = _get_connection()
    row = conn.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_person(person_id: int) -> bool:
    """Delete a person and their image file. Returns True if deleted."""
    person = get_person(person_id)
    if not person:
        return False

    # Remove image file
    if os.path.exists(person["image_path"]):
        os.remove(person["image_path"])

    conn = _get_connection()
    conn.execute("DELETE FROM people WHERE id = ?", (person_id,))
    conn.commit()
    conn.close()
    return True


# -- Events CRUD --------------------------------------------------------

def add_event(
    image_path: str,
    person_id: int | None = None,
    person_name: str | None = None,
    confidence: float | None = None,
) -> int:
    """Log a doorbell event. Returns the new event id."""
    conn = _get_connection()
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.execute(
        """INSERT INTO events (timestamp, person_id, person_name, confidence, image_path)
           VALUES (?, ?, ?, ?, ?)""",
        (now, person_id, person_name, confidence, image_path),
    )
    conn.commit()
    event_id = cur.lastrowid
    conn.close()
    return event_id


def get_all_events(limit: int = 50, offset: int = 0) -> list[dict]:
    """Return events, most recent first."""
    conn = _get_connection()
    rows = conn.execute(
        "SELECT * FROM events ORDER BY id DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_event(event_id: int) -> dict | None:
    """Return a single event or None."""
    conn = _get_connection()
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def mark_event_seen(event_id: int) -> bool:
    """Mark an event notification as seen."""
    conn = _get_connection()
    cur = conn.execute("UPDATE events SET seen = 1 WHERE id = ?", (event_id,))
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed


# -- Push Tokens ---------------------------------------------------------

def add_push_token(token: str) -> None:
    """Store a push token (ignore if it already exists)."""
    conn = _get_connection()
    conn.execute(
        "INSERT OR IGNORE INTO push_tokens (token) VALUES (?)", (token,)
    )
    conn.commit()
    conn.close()


def get_push_tokens() -> list[str]:
    """Return all registered push tokens."""
    conn = _get_connection()
    rows = conn.execute("SELECT token FROM push_tokens").fetchall()
    conn.close()
    return [row["token"] for row in rows]


def remove_push_token(token: str) -> None:
    """Remove a push token (e.g. if delivery fails)."""
    conn = _get_connection()
    conn.execute("DELETE FROM push_tokens WHERE token = ?", (token,))
    conn.commit()
    conn.close()
