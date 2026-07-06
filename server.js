import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { buildHandover } from './src/pipeline.js';
import { handoverToHtml } from './src/view.js';

const app = express();
app.use(express.json({ limit: '4mb' }));

const PORT = process.env.PORT || 3000;

// Structured logger bound to a request id so a whole handover is traceable.
function makeLogger(reqId) {
  return (entry) => console.log(JSON.stringify({ ts: new Date().toISOString(), req_id: reqId, ...entry }));
}

// Bundled sample data (for the one-line curl demo).
function loadSample() {
  return {
    events: JSON.parse(readFileSync('data/events.json', 'utf8')),
    nightLogs: readFileSync('data/night-logs.md', 'utf8'),
  };
}

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'night-shift-handover' });
});

// Root -> the human-readable handover, so the bare URL isn't a 404.
app.get('/', (req, res) => res.redirect('/handover.html'));

// Core handler: build a handover from the given input and respond as JSON or HTML.
async function handle(req, res, input, wantsHtml) {
  const reqId = randomUUID();
  const log = makeLogger(reqId);
  try {
    const result = await buildHandover({ ...input, log });
    result.request_id = reqId;
    if (wantsHtml) {
      res.type('html').send(handoverToHtml(result));
    } else {
      res.json(result);
    }
  } catch (err) {
    log({ level: 'error', msg: 'handover_failed', error: String(err), stack: err?.stack });
    res.status(500).json({ error: 'handover_generation_failed', request_id: reqId, detail: String(err) });
  }
}

// GET /handover(.html) — runs the bundled sample so a plain curl / browser works.
app.get('/handover', (req, res) => handle(req, res, loadSample(), false));
app.get('/handover.html', (req, res) => handle(req, res, loadSample(), true));

// POST /handover — caller supplies { events, nightLogs, nightLogsShiftId }.
// ?format=html to get the page instead of JSON.
app.post('/handover', (req, res) => {
  const { events, nightLogs, nightLogsShiftId } = req.body || {};
  if (!events) {
    return res.status(400).json({ error: 'missing_events', detail: 'body must include an "events" object' });
  }
  handle(req, res, { events, nightLogs, nightLogsShiftId }, req.query.format === 'html');
});

app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'server_started', port: Number(PORT) }));
});
