/**
 * API service for communicating with the Raspberry Pi backend.
 *
 * Change PI_BASE_URL to match your Pi's IP address on the local network.
 */

// ─── Configuration ─────────────────────────────────────────────────────
// Replace with your Raspberry Pi's local IP address
const PI_BASE_URL = "http://192.168.1.100:5000";

// ─── Types ─────────────────────────────────────────────────────────────

export interface DoorbellEvent {
  id: number;
  timestamp: string;
  person_id: number | null;
  person_name: string | null;
  confidence: number | null;
  image_path: string;
  seen: number; // 0 or 1
}

export interface Person {
  id: number;
  name: string;
  image_path: string;
  created_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${PI_BASE_URL}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Stream URL ────────────────────────────────────────────────────────

/** Returns the full URL for the MJPEG live camera stream. */
export function getStreamUrl(): string {
  return `${PI_BASE_URL}/stream`;
}

/** Returns the full URL for a captured image. */
export function getCaptureUrl(imagePath: string): string {
  // imagePath from the DB is an absolute path on the Pi,
  // extract just the filename for the /captures/ endpoint.
  const filename = imagePath.split("/").pop();
  return `${PI_BASE_URL}/captures/${filename}`;
}

/** Returns the full URL for a known face image. */
export function getKnownFaceUrl(imagePath: string): string {
  const filename = imagePath.split("/").pop();
  return `${PI_BASE_URL}/known_faces/${filename}`;
}

// ─── Events ────────────────────────────────────────────────────────────

export async function fetchEvents(
  limit = 50,
  offset = 0
): Promise<DoorbellEvent[]> {
  return apiFetch<DoorbellEvent[]>(
    `/events?limit=${limit}&offset=${offset}`
  );
}

export async function fetchEvent(id: number): Promise<DoorbellEvent> {
  return apiFetch<DoorbellEvent>(`/events/${id}`);
}

export async function markEventSeen(id: number): Promise<void> {
  await apiFetch(`/events/${id}/seen`, { method: "PATCH" });
}

// ─── People ────────────────────────────────────────────────────────────

export async function fetchPeople(): Promise<Person[]> {
  return apiFetch<Person[]>("/people");
}

export async function addPerson(
  name: string,
  imageUri: string
): Promise<{ id: number; name: string }> {
  const formData = new FormData();
  formData.append("name", name);

  // React Native file upload format
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("image", {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  const url = `${PI_BASE_URL}/people`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "multipart/form-data" },
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || `API ${res.status}`);
  }
  return res.json();
}

export async function deletePerson(id: number): Promise<void> {
  await apiFetch(`/people/${id}`, { method: "DELETE" });
}

// ─── Test / Debug ──────────────────────────────────────────────────────

/** Simulate a doorbell press (for testing without hardware). */
export async function triggerDoorbell(): Promise<void> {
  await apiFetch("/trigger", { method: "POST" });
}
