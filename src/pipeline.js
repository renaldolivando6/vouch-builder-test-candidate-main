// Pipeline orchestrator: ingest -> normalize -> flag -> link -> render.
// Stateless: everything needed is in the input. Emits structured logs so a
// builder/agent can debug a bad handover (which hotel, which night, why).

import { normalizeEvents } from './normalize/events.js';
import { normalizeNightLogs } from './normalize/nightlogs.js';
import { flagObservations } from './flag.js';
import { linkThreads } from './link.js';
import { renderHandover } from './render.js';
import { morningAfter } from './shifts.js';

export async function buildHandover({
  events,
  nightLogs = null,
  nightLogsShiftId = '2026-05-27', // see CLAUDE.md: prose shift is passed in for now
  log = () => {},
} = {}) {
  const hotel = events?.hotel ?? { id: 'unknown', name: 'Unknown Hotel' };
  log({ level: 'info', msg: 'ingest', hotel_id: hotel.id, event_count: events?.events?.length ?? 0, has_night_logs: !!nightLogs });

  // Normalize both sources into observations.
  const jsonObs = normalizeEvents(events);
  const proseObs = nightLogs ? await normalizeNightLogs(nightLogs, { shiftId: nightLogsShiftId }) : [];
  const observations = flagObservations([...jsonObs, ...proseObs]);
  log({ level: 'info', msg: 'normalized', hotel_id: hotel.id, observation_count: observations.length, json: jsonObs.length, prose: proseObs.length });

  // Reconcile into cross-night threads.
  const threads = linkThreads(observations);
  const latestShift = observations
    .map((o) => o.shift_id)
    .filter(Boolean)
    .reduce((a, b) => (a > b ? a : b), '');
  const forDate = morningAfter(latestShift);
  log({ level: 'info', msg: 'linked', hotel_id: hotel.id, thread_count: threads.length, latest_shift: latestShift, for_morning: forDate });

  // Render the action-first handover.
  const buckets = await renderHandover(threads, { forDate, log });
  const counts = {
    on_fire: buckets.on_fire.length,
    pending: buckets.pending.length,
    fyi: buckets.fyi.length,
  };
  log({ level: 'info', msg: 'rendered', hotel_id: hotel.id, ...counts });

  return {
    hotel,
    generated_for_shift: latestShift,
    for_morning: forDate,
    counts,
    observation_count: observations.length,
    thread_count: threads.length,
    handover: buckets,
  };
}
