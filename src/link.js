// Linker — the reconciliation core. Pure code, no LLM.
//
// Job 1 (group): stitch the flat observations into threads, where one thread =
//   one real-world issue that may span several nights and both sources.
// Job 2 (judge): compute each thread's status across nights:
//   still_open | newly_resolved | new_tonight | reopened | resolved_earlier
//
// Grouping is deterministic and explainable:
//   - Systemic issues (immigration/compliance) group by category — they are not
//     tied to one room (the scanner is offline hotel-wide; rooms listed are just
//     affected guests).
//   - Everything else groups by its primary room. The room may come from the
//     structured field, or be recovered from the text (e.g. "near room 215",
//     where the JSON left the room field null).
//   - Anything with no resolvable room stays a singleton thread.

// --- helpers -------------------------------------------------------------

function isSystemic(category) {
  return /compliance|immigration/i.test(category || '');
}

// The room an observation is *about*. Structured field wins; otherwise recover
// it from the text so text-only room references still link across sources.
function primaryRoom(obs) {
  if (obs.room && obs.room.length) return String(obs.room[0]);
  const text = `${obs.summary || ''} ${obs.source?.raw_text || ''}`;
  const m =
    text.match(/\b(?:room|rm)\.?\s*#?\s*(\d{2,4})\b/i) || text.match(/\bnear\s+(\d{2,4})\b/i);
  return m ? m[1] : null;
}

function groupKey(obs) {
  if (isSystemic(obs.category)) return 'compliance';
  const room = primaryRoom(obs);
  if (room) return `room:${room}`;
  return `single:${obs.obs_id}`;
}

const isClosed = (status) => status === 'resolved';

// Routine, positive events. A resolved check-in is a *success*, not the closing
// of a problem — so it must not be treated as a "resolution" that can "reopen".
const ROUTINE_RE = /check[_-]?in|walk[_-]?in|reception|\bnote\b|keycard|parcel/i;
const isRoutine = (category) => ROUTINE_RE.test(category || '');

// A sortable timestamp. Exact times sort precisely; prose (approx) sorts by its
// shift's evening so it orders correctly relative to other nights.
function sortTs(obs) {
  if (obs.time?.kind === 'exact' && obs.time.value) return obs.time.value;
  if (obs.shift_id) return `${obs.shift_id}T23:59:00+08:00`;
  return '9999';
}

// --- status computation --------------------------------------------------

function computeStatus(sortedObs, latestShift) {
  const shifts = sortedObs.map((o) => o.shift_id).filter(Boolean);
  const firstShift = shifts.length ? shifts.reduce((a, b) => (a < b ? a : b)) : null;
  const hasTonight = sortedObs.some((o) => o.shift_id === latestShift);
  const appearedBefore = firstShift != null && firstShift < latestShift;

  // Walk the timeline once to detect two distinct patterns:
  //  - reopened: a *problem* was resolved, then became open again (312 no-show
  //    charged, then disputed).
  //  - contradiction: a routine record was completed (check-in → in-house), then
  //    a later observation conflicts with it (205 found empty). System vs reality.
  let sawProblemClose = false;
  let sawRoutineClose = false;
  let reopened = false;
  let contradiction = false;
  for (const o of sortedObs) {
    if (isClosed(o.status_as_reported)) {
      if (isRoutine(o.category)) sawRoutineClose = true;
      else sawProblemClose = true;
    } else {
      if (sawProblemClose) reopened = true;
      if (sawRoutineClose) contradiction = true;
    }
  }

  const currentlyClosed = isClosed(sortedObs[sortedObs.length - 1].status_as_reported);

  let status;
  if (reopened && !currentlyClosed) status = 'reopened';
  else if (currentlyClosed) {
    if (hasTonight && appearedBefore) status = 'newly_resolved';
    else if (hasTonight) status = 'new_tonight'; // opened and closed on the same (latest) shift
    else status = 'resolved_earlier'; // closed on a prior night — old news for this handover
  } else if (!appearedBefore && hasTonight) status = 'new_tonight';
  else status = 'still_open';

  return { status, contradiction };
}

// --- public API ----------------------------------------------------------

// linkThreads(observations) -> Thread[]
export function linkThreads(observations) {
  const latestShift = observations
    .map((o) => o.shift_id)
    .filter(Boolean)
    .reduce((a, b) => (a > b ? a : b), '');

  // Group.
  const groups = new Map();
  for (const obs of observations) {
    const key = groupKey(obs);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(obs);
  }

  // Build threads.
  const threads = [];
  for (const [key, obsList] of groups) {
    const sorted = [...obsList].sort((a, b) => (sortTs(a) < sortTs(b) ? -1 : 1));
    const { status, contradiction } = computeStatus(sorted, latestShift);

    const shifts = sorted.map((o) => o.shift_id).filter(Boolean);
    const firstShift = shifts.length ? shifts.reduce((a, b) => (a < b ? a : b)) : null;
    const lastShift = shifts.length ? shifts.reduce((a, b) => (a > b ? a : b)) : null;

    const last = sorted[sorted.length - 1];
    const room = key === 'compliance' ? null : primaryRoom(last);
    const guest = sorted.map((o) => o.guest).find(Boolean) ?? null;

    // Bubble up flags from all observations (de-duped), plus derived thread flags.
    const flags = [
      ...new Set([...sorted.flatMap((o) => o.flags || []), ...(contradiction ? ['contradiction'] : [])]),
    ];

    threads.push({
      thread_id: `thr_${key.replace(/[:]/g, '-')}`,
      subject: key === 'compliance' ? 'immigration/compliance (systemic)' : room ? `room ${room}` : last.category,
      room,
      guest,
      category: last.category,
      status,
      resolved: isClosed(last.status_as_reported),
      first_seen_shift: firstShift,
      last_update_shift: lastShift,
      spans_nights: new Set(shifts).size,
      observation_ids: sorted.map((o) => o.obs_id),
      observations: sorted, // kept inline so the renderer has quotes to cite
      flags,
    });
  }

  return threads;
}
