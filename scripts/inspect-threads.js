// Dev-only: run the full normalize + link pipeline and print the threads so we
// can eyeball the reconciliation. Requires GEMINI_API_KEY (prose step).
// Run: node scripts/inspect-threads.js

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { normalizeEvents } from '../src/normalize/events.js';
import { normalizeNightLogs } from '../src/normalize/nightlogs.js';
import { linkThreads } from '../src/link.js';

const events = JSON.parse(readFileSync('data/events.json', 'utf8'));
const logText = readFileSync('data/night-logs.md', 'utf8');

const jsonObs = normalizeEvents(events);
const proseObs = await normalizeNightLogs(logText, { shiftId: '2026-05-27' });
const all = [...jsonObs, ...proseObs];

const threads = linkThreads(all);

console.log(`\n${all.length} observations -> ${threads.length} threads\n`);

// Print grouped by status, most actionable first.
const order = ['reopened', 'still_open', 'new_tonight', 'newly_resolved', 'resolved_earlier'];
const byStatus = new Map(order.map((s) => [s, []]));
for (const t of threads) {
  if (!byStatus.has(t.status)) byStatus.set(t.status, []);
  byStatus.get(t.status).push(t);
}

for (const status of byStatus.keys()) {
  const list = byStatus.get(status);
  if (!list.length) continue;
  console.log(`\n===== ${status.toUpperCase()} (${list.length}) =====`);
  for (const t of list) {
    const nights = t.spans_nights > 1 ? `, ${t.spans_nights} nights` : '';
    const flags = t.flags.filter((f) => f !== 'freetext_only');
    const flagStr = flags.length ? `  ⚑ [${flags.join(', ')}]` : '';
    console.log(`\n• ${t.subject}${nights} — ${t.category}${flagStr}`);
    console.log(`  obs: ${t.observation_ids.join(', ')}`);
    for (const o of t.observations) {
      const src = o.source.ref;
      console.log(`    - ${o.shift_id} [${o.status_as_reported}] ${o.summary.slice(0, 90)} (${src})`);
    }
  }
}
