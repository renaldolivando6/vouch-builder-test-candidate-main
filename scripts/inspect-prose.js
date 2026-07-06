// Dev-only: run the LLM prose extractor on night-logs.md and print the result.
// Requires GEMINI_API_KEY in .env. Run: node scripts/inspect-prose.js

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { normalizeNightLogs } from '../src/normalize/nightlogs.js';

const text = readFileSync('data/night-logs.md', 'utf8');

// The header declares this shift as the night of 27→28 May; year comes from the
// surrounding structured data. Passed in for now (see CLAUDE.md known simplifications).
const observations = await normalizeNightLogs(text, { shiftId: '2026-05-27' });

console.log(`\nExtracted ${observations.length} observations from night-logs.md\n`);

for (const o of observations) {
  const room = o.room.length ? o.room.join('/') : '-';
  console.log(
    `${o.obs_id} [${o.status_as_reported}] ${o.category}  room=${room}  lang=${o.original_lang}  flags=[${o.flags.join(', ')}]`
  );
  console.log(`   summary: ${o.summary}`);
  if (o.translation) console.log(`   translation: ${o.translation}`);
  console.log(`   source: ${o.source.ref}`);
  console.log(`   raw_text: "${o.source.raw_text}"`);
  console.log('');
}
