"""
Flask REST API and MJPEG streaming server.

Endpoints:
  GET    /stream              - MJPEG live camera feed
  GET    /events              - List events (query: limit, offset)
  GET    /events/<id>         - Single event detail
  PATCH  /events/<id>/seen    - Mark event as seen
  GET    /people              - List known people
  POST   /people              - Add person (multipart: name + image file)
  DELETE /people/<id>         - Remove person
  GET    /captures/<filename> - Serve a captured image
  POST   /trigger             - Simulate a button press (for testing)
"""

import os
import logging

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

from config import CAPTURES_DIR, KNOWN_FACES_DIR, API_HOST, API_PORT
import database
import recognizer

logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# These will be set by main.py before the server starts
_camera = None
_doorbell_callback = None


def set_camera(camera):
    """Inject the Camera instance so the API can stream."""
    global _camera
    _camera = camera


def set_doorbell_callback(callback):
    """Inject the doorbell press handler for the /trigger endpoint."""
    global _doorbell_callback
    _doorbell_callback = callback


# -- Live Stream --------------------------------------------------------

@app.route("/stream")
def stream():
    """MJPEG live camera feed."""
    if _camera is None:
        return jsonify({"error": "Camera not available"}), 503

    def generate():
        for frame in _camera.stream_frames():
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            )

    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/stream/view")
def stream_view():
    """HTML page that embeds the MJPEG stream (for mobile WebView)."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
        <style>
            * { margin:0; padding:0; }
            body { background:#000; width:100vw; height:100vh; display:flex;
                   justify-content:center; align-items:center; overflow:hidden; }
            img  { max-width:100%; max-height:100%; object-fit:contain; }
        </style>
    </head>
    <body>
        <img src="/stream" />
    </body>
    </html>
    """
    return Response(html, mimetype="text/html")


# -- Events -------------------------------------------------------------

@app.route("/events")
def list_events():
    """Return a JSON list of events."""
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    events = database.get_all_events(limit=limit, offset=offset)
    return jsonify(events)


@app.route("/events/<int:event_id>")
def get_event(event_id):
    """Return a single event."""
    event = database.get_event(event_id)
    if event is None:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(event)


@app.route("/events/<int:event_id>/seen", methods=["PATCH"])
def mark_event_seen(event_id):
    """Mark an event notification as seen."""
    if database.mark_event_seen(event_id):
        return jsonify({"status": "ok"})
    return jsonify({"error": "Event not found"}), 404


# -- People -------------------------------------------------------------

@app.route("/people")
def list_people():
    """Return a JSON list of known people."""
    people = database.get_all_people()
    return jsonify(people)


@app.route("/people", methods=["POST"])
def add_person():
    """
    Add a new known person.
    Expects multipart form data with:
      - name: string
      - image: file upload  OR  capture_filename: string (existing capture on Pi)
    """
    name = request.form.get("name")
    image = request.files.get("image")
    capture_filename = request.form.get("capture_filename")

    if not name:
        return jsonify({"error": "'name' is required"}), 400

    if not image and not capture_filename:
        return jsonify({"error": "'image' or 'capture_filename' is required"}), 400

    if capture_filename:
        # Use an existing capture file from the Pi
        src_path = os.path.join(CAPTURES_DIR, capture_filename)
        if not os.path.isfile(src_path):
            return jsonify({"error": "Capture file not found"}), 404
        dest_filename = f"{name.lower().replace(' ', '_')}_{capture_filename}"
        filepath = os.path.join(KNOWN_FACES_DIR, dest_filename)
        import shutil
        shutil.copy2(src_path, filepath)
    else:
        # Save the uploaded image
        filename = f"{name.lower().replace(' ', '_')}_{image.filename}"
        filepath = os.path.join(KNOWN_FACES_DIR, filename)
        image.save(filepath)

    # Store in database
    person_id = database.add_person(name, filepath)

    # Compute face encoding
    if not recognizer.add_known_face(person_id, name, filepath):
        # No face found in image - roll back
        database.delete_person(person_id)
        return jsonify({"error": "No face detected in the uploaded image"}), 400

    logger.info("Added person: %s (id=%d)", name, person_id)
    return jsonify({"id": person_id, "name": name}), 201


@app.route("/people/<int:person_id>", methods=["DELETE"])
def delete_person(person_id):
    """Remove a known person and their encoding."""
    if not database.delete_person(person_id):
        return jsonify({"error": "Person not found"}), 404
    recognizer.remove_known_face(person_id)
    return jsonify({"status": "deleted"})


# -- Capture (Pi camera still photo) ------------------------------------

@app.route("/capture", methods=["POST"])
def capture_photo():
    """Take a still photo with the Pi camera and return the filename."""
    if _camera is None:
        return jsonify({"error": "Camera not available"}), 503

    filepath = _camera.capture()
    if filepath is None:
        return jsonify({"error": "Capture failed"}), 500

    filename = os.path.basename(filepath)
    return jsonify({"filename": filename}), 201


# -- Captures -----------------------------------------------------------

@app.route("/captures/<path:filename>")
def serve_capture(filename):
    """Serve a captured image file."""
    return send_from_directory(CAPTURES_DIR, filename)


@app.route("/known_faces/<path:filename>")
def serve_known_face(filename):
    """Serve a known face image file."""
    return send_from_directory(KNOWN_FACES_DIR, filename)


# -- Test / Debug -------------------------------------------------------

@app.route("/trigger", methods=["POST"])
def trigger():
    """Simulate a doorbell press (useful for testing without hardware)."""
    if _doorbell_callback is None:
        return jsonify({"error": "Doorbell callback not set"}), 503
    _doorbell_callback()
    return jsonify({"status": "triggered"})


# -- Startup ------------------------------------------------------------

def run_server():
    """Start the Flask development server (called from a thread)."""
    app.run(host=API_HOST, port=API_PORT, threaded=True)
