// Minimal HTML view — utility over beauty. One inline <style>, no framework,
// no build step. Three colour-coded sections; every line shows its source
// citation and any flags so the manager can trust and trace it.

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function itemHtml(item) {
  const flags = item.flags.length
    ? ` ${item.flags.map((f) => `<span class="flag">${esc(f)}</span>`).join(' ')}`
    : '';
  const grounding = item.ungrounded ? ' <span class="flag warn">unverified — check source</span>' : '';
  const refs = item.source_refs.length
    ? `<span class="cite">${item.source_refs.map(esc).join(', ')}</span>`
    : '';
  return `<li><span class="line">${esc(item.line)}</span>${flags}${grounding} ${refs}</li>`;
}

function sectionHtml(title, cls, items) {
  if (!items.length) return `<section class="${cls} empty"><h2>${esc(title)}</h2><p class="none">none</p></section>`;
  return `<section class="${cls}">
    <h2>${esc(title)} <span class="count">${items.length}</span></h2>
    <ul>${items.map(itemHtml).join('\n')}</ul>
  </section>`;
}

export function handoverToHtml(result) {
  const h = result.handover;
  const hotelName = esc(result.hotel?.name || 'Hotel');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Night Handover — ${hotelName}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 780px; margin: 24px auto; padding: 0 16px; }
  header { border-bottom: 2px solid currentColor; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 1.3rem; margin: 0; }
  .meta { opacity: 0.7; font-size: 0.85rem; margin-top: 4px; }
  section { border-left: 5px solid #999; padding: 4px 0 4px 14px; margin: 18px 0; }
  section h2 { font-size: 1.05rem; margin: 0 0 8px; }
  .on_fire { border-color: #d93025; } .pending { border-color: #e8a800; } .fyi { border-color: #8a8a8a; }
  .count { font-weight: normal; opacity: 0.6; font-size: 0.85rem; }
  ul { margin: 0; padding-left: 18px; } li { margin: 6px 0; }
  .line { font-weight: 500; }
  .cite { font-size: 0.78rem; opacity: 0.6; font-family: ui-monospace, monospace; }
  .flag { font-size: 0.72rem; background: #8884; border-radius: 4px; padding: 1px 6px; }
  .flag.warn { background: #d93025; color: #fff; }
  .none { opacity: 0.5; font-style: italic; margin: 0; }
</style></head>
<body>
  <header>
    <h1>🌙 Night-Shift Handover — ${hotelName}</h1>
    <div class="meta">Morning of ${esc(result.for_morning)} · shift ${esc(result.generated_for_shift)} ·
      ${result.thread_count} issues from ${result.observation_count} events</div>
  </header>
  ${sectionHtml('🔴 On fire — act now', 'on_fire', h.on_fire)}
  ${sectionHtml('🟡 Pending — decide / follow up today', 'pending', h.pending)}
  ${sectionHtml('⚪ FYI — awareness only', 'fyi', h.fyi)}
  <footer class="meta">Every line traces to source data. Flags mark items needing verification.</footer>
</body></html>`;
}
