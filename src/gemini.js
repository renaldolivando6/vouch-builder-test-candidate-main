// Thin Gemini client over the REST API (no SDK — fewer version unknowns).
// Uses the exact generateContent endpoint shape verified to work.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  // Keep answer text only; skip "thought" parts that thinking models may emit.
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');

  if (!text) {
    throw new Error(`Gemini returned no text. Raw: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return text;
}
