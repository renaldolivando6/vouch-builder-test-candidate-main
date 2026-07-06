// Dev-only: run the full pipeline and print the handover. Requires GEMINI_API_KEY.
// Run: node scripts/inspect-handover.js

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { buildHandover } from '../src/pipeline.js';

const events = JSON.parse(readFileSync('data/events.json', 'utf8'));
const nightLogs = readFileSync('data/night-logs.md', 'utf8');

const result = await buildHandover({
  events,
  nightLogs,
  log: (e) => console.error(`  [log] ${JSON.stringify(e)}`), // logs to stderr
});

const sections = [
  ['🔴 ON FIRE', result.handover.on_fire],
  ['🟡 PENDING', result.handover.pending],
  ['⚪ FYI', result.handover.fyi],
];

console.log(`\n=== Night Handover — ${result.hotel.name} ===`);
console.log(`Morning of ${result.for_morning} · ${result.thread_count} issues from ${result.observation_count} events\n`);

for (const [title, items] of sections) {
  console.log(`\n${title} (${items.length})`);
  for (const it of items) {
    const flags = it.flags.length ? `  ⚑[${it.flags.join(', ')}]` : '';
    const grounded = it.ungrounded ? '  ⚠UNGROUNDED' : '';
    console.log(`  • ${it.line}${flags}${grounded}`);
    console.log(`      cite: ${it.source_refs.join(', ') || '(none)'}`);
  }
}
