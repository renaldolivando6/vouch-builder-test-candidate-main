// Dev-only: normalize events.json and print the Observations so we can eyeball
// the shape before trusting anything downstream. Run: node scripts/inspect.js

import { readFileSync } from 'node:fs';
import { normalizeEvents } from '../src/normalize/events.js';
import { shiftLabel } from '../src/shifts.js';

const payload = JSON.parse(readFileSync('data/events.json', 'utf8'));
const observations = normalizeEvents(payload);

console.log(`\nNormalized ${observations.length} observations from events.json\n`);

// Group by shift so the night structure is visible.
const byShift = new Map();
for (const o of observations) {
  if (!byShift.has(o.shift_id)) byShift.set(o.shift_id, []);
  byShift.get(o.shift_id).push(o);
}

for (const shiftId of [...byShift.keys()].sort()) {
  console.log(`— ${shiftLabel(shiftId)} —`);
  for (const o of byShift.get(shiftId)) {
    const room = o.room.length ? `room ${o.room.join('/')}` : 'no room';
    console.log(
      `  ${o.obs_id}  [${o.status_as_reported.padEnd(8)}] ${o.category.padEnd(20)} ${room}`
    );
  }
  console.log('');
}

// Also dump one full observation so we can see every field.
console.log('Sample full observation:\n', JSON.stringify(observations[6], null, 2));
