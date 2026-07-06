// Normalize structured events.json into Observations.
//
// This is pure, deterministic code — no LLM. Each JSON event maps 1:1 to one
// Observation, and the raw source text is preserved verbatim as the grounding
// anchor. We do NOT paraphrase here; faithfulness first.

import { shiftIdFromTimestamp } from '../shifts.js';

// Map the source `status` vocabulary to our normalized set.
function mapStatus(status) {
  switch (status) {
    case 'resolved':
      return 'resolved';
    case 'unresolved':
      return 'open';
    case 'pending':
      return 'pending';
    default:
      return 'unknown';
  }
}

// Normalize a single event object into an Observation.
export function normalizeEvent(evt) {
  return {
    obs_id: evt.id,
    source: { kind: 'json', ref: evt.id, raw_text: evt.description ?? '' },
    shift_id: shiftIdFromTimestamp(evt.timestamp),
    time: { kind: 'exact', value: evt.timestamp ?? null },
    room: evt.room ? [String(evt.room)] : [],
    guest: evt.guest ?? null,
    category: evt.type ?? 'unknown',
    summary: evt.description ?? '',
    status_as_reported: mapStatus(evt.status),
    original_lang: 'en',
    translation: null,
    flags: [], // flag detection (injection/contradiction/unsupported) is a later, deliberate pass
  };
}

// Normalize the full events.json payload into an array of Observations.
export function normalizeEvents(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  return events.map(normalizeEvent);
}
