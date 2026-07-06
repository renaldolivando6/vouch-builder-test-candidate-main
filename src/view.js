// HTML view — clean, professional console styling (AWS-console inspired):
// light neutral surface, severity-labelled sections, flag badges, monospace
// source citations. Server-rendered string; no framework, no client JS.

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Human-readable flag labels.
const FLAG_LABELS = {
  injection_suspected: 'Injection suspected',
  unsupported_action: 'Unsupported action',
  contradiction: 'Contradiction',
  uncertain: 'Uncertain',
  unverified_span: 'Unverified source',
};
const flagLabel = (f) => FLAG_LABELS[f] || f.replace(/_/g, ' ');

// Severity section metadata (no emoji; professional labels).
const SECTIONS = [
  { key: 'on_fire', label: 'Immediate action', cls: 'sev-critical' },
  { key: 'pending', label: 'Needs follow-up', cls: 'sev-warning' },
  { key: 'fyi', label: 'Informational', cls: 'sev-info' },
];

function badgeHtml(item) {
  const badges = item.flags.map((f) => `<span class="badge">${esc(flagLabel(f))}</span>`);
  if (item.ungrounded) badges.push('<span class="badge badge-alert">Unverified — check source</span>');
  return badges.join('');
}

function itemHtml(item) {
  const src = item.source_refs.length
    ? `<div class="src">Source: ${item.source_refs.map((r) => `<code>${esc(r)}</code>`).join(' ')}</div>`
    : '';
  const badges = badgeHtml(item);
  return `<li class="item">
    <div class="item-body">${esc(item.line)} ${badges}</div>
    ${src}
  </li>`;
}

function sectionHtml(section, items) {
  const header = `<div class="sec-head">
      <span class="sev ${section.cls}">${esc(section.label)}</span>
      <span class="sec-count">${items.length}</span>
    </div>`;
  const body = items.length
    ? `<ul class="items">${items.map(itemHtml).join('')}</ul>`
    : `<p class="none">No items.</p>`;
  return `<section class="card">${header}${body}</section>`;
}

export function handoverToHtml(result) {
  const h = result.handover;
  const hotelName = esc(result.hotel?.name || 'Hotel');
  const sections = SECTIONS.map((s) => sectionHtml(s, h[s.key] || [])).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Night-Shift Handover — ${hotelName}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #f2f3f3; color: #16191f;
    font: 14px/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 24px 20px 48px; }
  header.top { background: #16191f; color: #fff; padding: 18px 20px; }
  header.top .inner { max-width: 900px; margin: 0 auto; }
  header.top h1 { font-size: 1.15rem; font-weight: 600; margin: 0; letter-spacing: 0.2px; }
  header.top .meta { color: #b9c0c9; font-size: 0.82rem; margin-top: 4px; }

  .card {
    background: #fff; border: 1px solid #d5dbdb; border-radius: 8px;
    margin: 16px 0; padding: 0; overflow: hidden;
    box-shadow: 0 1px 1px rgba(0,0,0,0.05);
  }
  .sec-head {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-bottom: 1px solid #eaeded; background: #fafbfc;
  }
  .sev {
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
    padding: 3px 9px; border-radius: 4px; border: 1px solid transparent;
  }
  .sev-critical { color: #d13212; background: #fdf0ee; border-color: #f5c4b8; }
  .sev-warning  { color: #8a6100; background: #fdf6e3; border-color: #f0d9a0; }
  .sev-info     { color: #0972d3; background: #eff6fd; border-color: #b8d7f5; }
  .sec-count { margin-left: auto; color: #5f6b7a; font-size: 0.8rem; font-variant-numeric: tabular-nums; }

  ul.items { list-style: none; margin: 0; padding: 0; }
  .item { padding: 12px 16px; border-bottom: 1px solid #eaeded; }
  .item:last-child { border-bottom: none; }
  .item-body { font-weight: 500; }
  .src { margin-top: 5px; color: #5f6b7a; font-size: 0.78rem; }
  .src code { background: #f2f3f3; border: 1px solid #e4e7e7; border-radius: 3px; padding: 0 5px; font-size: 0.92em; }

  .badge {
    display: inline-block; font-size: 0.7rem; font-weight: 600; vertical-align: middle;
    color: #5f6b7a; background: #f2f3f3; border: 1px solid #d5dbdb;
    border-radius: 4px; padding: 1px 7px; margin-left: 4px;
  }
  .badge-alert { color: #d13212; background: #fdf0ee; border-color: #f5c4b8; }
  .none { color: #5f6b7a; font-style: italic; margin: 0; padding: 14px 16px; }
  footer { color: #5f6b7a; font-size: 0.78rem; margin-top: 20px; }
</style></head>
<body>
  <header class="top"><div class="inner">
    <h1>Night-Shift Handover — ${hotelName}</h1>
    <div class="meta">Morning of ${esc(result.for_morning)} · shift ${esc(result.generated_for_shift)} · ${result.thread_count} issues reconciled from ${result.observation_count} events</div>
  </div></header>
  <div class="wrap">
    ${sections}
    <footer>Every line traces to source data (see citations). Badges mark items requiring verification before action.</footer>
  </div>
</body></html>`;
}
