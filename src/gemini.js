// Thin Gemini client over the REST API (no SDK — fewer version unknowns).
// Uses the exact generateContent endpoint shape verified to work.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Response cache keyed by the exact request. Same prompt -> same answer served
// from disk: no API call, deterministic output, and resilience to rate limits.
// Disabled with GEMINI_NO_CACHE=1.
const CACHE_DIR = '.cache/gemini';
const cacheEnabled = () => process.env.GEMINI_NO_CACHE !== '1';

function cachePath(model, system, prompt) {
  const key = createHash('sha256').update(`${model}\n${system || ''}\n${prompt}`).digest('hex');
  return `${CACHE_DIR}/${key}.txt`;
}

// Retry on transient failures (rate limits / 5xx) so a busy free tier doesn't
// silently drop us to the degraded fallback.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

// callGemini({ system, prompt, json }) -> string (model text output)
export async function callGemini({ system, prompt, json = true }) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  if (!key) throw new Error('GEMINI_API_KEY is not set (check your .env)');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: json ? { responseMimeType: 'application/json' } : {},
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const url = `${BASE}/${model}:generateContent?key=${key}`;

  // Serve from cache if we've seen this exact request before.
  const cacheFile = cachePath(model, system, prompt);
  if (cacheEnabled() && existsSync(cacheFile)) {
    return readFileSync(cacheFile, 'utf8');
  }

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Gemini API ${res.status}: ${errText.slice(0, 500)}`);
        if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
          lastErr = err;
          await sleep(attempt * 1500); // linear backoff: 1.5s, 3s
          continue;
        }
        throw err;
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      // Keep answer text only; skip "thought" parts that thinking models may emit.
      const text = parts
        .filter((p) => typeof p.text === 'string' && !p.thought)
        .map((p) => p.text)
        .join('');

      if (!text) throw new Error(`Gemini returned no text. Raw: ${JSON.stringify(data).slice(0, 500)}`);

      if (cacheEnabled()) {
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(cacheFile, text);
      }
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt >= MAX_ATTEMPTS) break;
      await sleep(attempt * 1500);
    }
  }
  throw lastErr;
}
