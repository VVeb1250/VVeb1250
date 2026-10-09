// Draws the three cards in the profile README (activity, repos, languages) as SVG, once for each theme.
// Data comes from the public GitHub API, so nothing is fetched by whoever views the profile.
// Run: GH_TOKEN=... node scripts/cards.mjs   (a workflow does it every day; locally `gh auth token` is used)
// Colors are the portfolio's tokens (https://vveb1250.github.io): square corners, hairlines, mono labels, one blue accent.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const LOGIN = 'VVeb1250';
const REPOS = [
  { name: 'WhipUI', line: 'Two skills for coding agents: build from a spec, or turn a rough request into UX.' },
  { name: 'z80-workspace', line: 'A browser IDE for Z80 assembly that runs the course’s real assembler and board simulator.' },
  { name: 'assembly-yasm-helper', line: 'YASM and NASM language support for VS Code, with a standalone language server.' }
];
const SKIP_LANG = new Set(['HTML', 'CSS', 'Jupyter Notebook']); // markup and notebooks say little about what is written

const THEMES = {
  dark: { surface: '#161D23', rule: '#2C343C', ink: '#E7ECF0', ink2: '#A2ACB6', ink3: '#6C767F', acc: '#4CABFD', pal: ['#4CABFD', '#B0A4F8', '#E0A454', '#72C78B', '#E392CA', '#42C2E6', '#B3B959', '#F49286'] },
  light: { surface: '#F5F7F9', rule: '#CBD2D9', ink: '#111C26', ink2: '#4B5A68', ink3: '#75828F', acc: '#005E9D', pal: ['#005E9D', '#644FB1', '#885700', '#00773B', '#97397F', '#006F87', '#656900', '#A8372E'] }
};
const SANS = `Saira, Bahnschrift, 'Segoe UI', system-ui, -apple-system, sans-serif`;
const MONO = `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const W = 830;

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || execSync('gh auth token').toString().trim();
const H = { Authorization: `Bearer ${token}`, 'User-Agent': 'profile-cards', Accept: 'application/vnd.github+json' };
const rest = async (path) => { const r = await fetch(`https://api.github.com${path}`, { headers: H }); if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); };
const gql = async (query, variables) => {
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: H, body: JSON.stringify({ query, variables }) });
  const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const wrap = (text, n) => { const out = []; let cur = ''; for (const w of text.split(' ')) { if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; };

const frame = (t, w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="${t.surface}" stroke="${t.rule}"/>
${body}
</svg>
`;
const label = (t, x, y, text, anchor = 'start') => `<text x="${x}" y="${y}" fill="${t.ink3}" font-family="${MONO}" font-size="11" letter-spacing="1.3" text-anchor="${anchor}">${esc(text.toUpperCase())}</text>`;

// ---- data ----
const repos = (await rest(`/users/${LOGIN}/repos?type=owner&per_page=100&sort=pushed`)).filter((r) => !r.fork);
const lastPush = repos.reduce((a, r) => (r.pushed_at > a ? r.pushed_at : a), '');
const cal = (await gql(`query($l:String!){user(login:$l){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount}}}}}}`, { l: LOGIN })).user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks.slice(-52).map((w) => w.contributionDays.reduce((s, d) => s + d.contributionCount, 0));
const bytes = {};
for (const r of repos) for (const [k, v] of Object.entries(await rest(`/repos/${LOGIN}/${r.name}/languages`))) if (!SKIP_LANG.has(k)) bytes[k] = (bytes[k] || 0) + v;
const langs = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
const total = langs.reduce((s, [, v]) => s + v, 0);
const shown = langs.slice(0, 7), rest7 = langs.slice(7).reduce((s, [, v]) => s + v, 0);
if (rest7) shown.push(['Other', rest7]);
const byName = Object.fromEntries(repos.map((r) => [r.name, r]));

// ---- cards ----
function activity(t) {
  const h = 150, left = 24, gx = 372, gw = W - gx - 24, bw = gw / weeks.length, base = h - 36, max = Math.max(1, ...weeks);
  const bars = weeks.map((c, i) => { const bh = c ? Math.max(3, (c / max) * 70) : 2; return `<rect x="${(gx + i * bw).toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${bh.toFixed(1)}" fill="${c ? t.acc : t.rule}"/>`; }).join('');
  return frame(t, W, h, `${label(t, left, 34, 'Contributions · last 12 months')}
<text x="${left}" y="98" fill="${t.ink}" font-family="${SANS}" font-weight="700" font-size="52">${cal.totalContributions}</text>
<text x="${left}" y="124" fill="${t.ink2}" font-family="${SANS}" font-size="13">Last push ${esc(day(lastPush))}</text>
${label(t, gx, 34, 'Per week')}${label(t, W - 24, 34, `peak ${max}`, 'end')}
${bars}<line x1="${gx}" x2="${W - 24}" y1="${base + 0.5}" y2="${base + 0.5}" stroke="${t.ink}" stroke-width="1"/>
${label(t, gx, h - 14, '52 weeks ago')}${label(t, W - 24, h - 14, 'this week', 'end')}`);
}

function repoCards(t) {
  const h = 190, pad = 24, gap = 12, cw = (W - pad * 2 - gap * 2) / 3;
  const cards = REPOS.map((r, i) => {
    const d = byName[r.name], x = pad + i * (cw + gap), li = wrap(r.line, 33).slice(0, 3);
    const lang = d?.language ?? '', ci = Math.max(0, langs.findIndex(([k]) => k === lang));
    return `<g transform="translate(${x.toFixed(1)} 48)"><rect x="0.5" y="0.5" width="${(cw - 1).toFixed(1)}" height="${h - 48 - 24}" fill="none" stroke="${t.rule}"/>
<rect x="0" y="0" width="3" height="${h - 48 - 23}" fill="${t.acc}"/>
<text x="18" y="28" fill="${t.ink}" font-family="${SANS}" font-weight="700" font-size="17">${esc(r.name)}</text>
${li.map((s, k) => `<text x="18" y="${52 + k * 17}" fill="${t.ink2}" font-family="${SANS}" font-size="12.5">${esc(s)}</text>`).join('')}
<text x="18" y="${h - 48 - 40}" fill="${t.ink3}" font-family="${MONO}" font-size="10.5" letter-spacing="0.6"><tspan fill="${t.pal[ci % t.pal.length]}">●</tspan> ${esc(lang || '—')}${d ? ` · ${esc(day(d.pushed_at))}` : ''}</text></g>`;
  }).join('');
  return frame(t, W, h, `${label(t, pad, 34, 'Worth opening')}${cards}`);
}

function languageCard(t) {
  const h = 128, pad = 24, bw = W - pad * 2;
  let x = pad;
  const segs = shown.map(([k, v], i) => { const w = (v / total) * bw; const s = `<rect x="${x.toFixed(1)}" y="52" width="${Math.max(1, w - 2).toFixed(1)}" height="12" fill="${k === 'Other' ? t.rule : t.pal[i % t.pal.length]}"/>`; x += w; return s; }).join('');
  let lx = pad, ly = 92;
  const legend = shown.map(([k, v], i) => {
    const text = `${k} ${((v / total) * 100).toFixed(0)}%`, w = 24 + text.length * 7.4;
    if (lx + w > W - pad) { lx = pad; ly += 20; }
    const s = `<rect x="${lx}" y="${ly - 9}" width="9" height="9" fill="${k === 'Other' ? t.rule : t.pal[i % t.pal.length]}"/><text x="${lx + 16}" y="${ly}" fill="${t.ink2}" font-family="${MONO}" font-size="11.5">${esc(text)}</text>`;
    lx += w; return s;
  }).join('');
  return frame(t, W, ly > 92 ? h + 20 : h, `${label(t, pad, 34, 'Languages · public repos')}${label(t, W - pad, 34, 'excluding HTML, CSS, notebooks', 'end')}${segs}${legend}`);
}

mkdirSync('assets/cards', { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(`assets/cards/activity-${name}.svg`, activity(t));
  writeFileSync(`assets/cards/repos-${name}.svg`, repoCards(t));
  writeFileSync(`assets/cards/languages-${name}.svg`, languageCard(t));
}
console.log(`ok · ${cal.totalContributions} contributions · ${shown.map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`).join(', ')}`);
