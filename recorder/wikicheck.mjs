// Daily cross-check of what each Major Order asks against the Helldivers Wiki's own text (1 Nov 2026).
// The game gives enemy units as bare ids; our names (src/game/enemies.json) were matched by hand.
// Each day the recorder reads the wiki's "Major Orders" page and checks, order by order:
//  - a unit we name differently from the wiki's objective ("Kill 60,000,000 Radicals")  -> problem
//  - a unit we don't know yet: the wiki's name becomes a hint the page can use at once    -> problem
//    (the health issue asks to add it to the list for good)
//  - a goal the wiki writes differently                                                    -> note only
// The wiki is written by players and lags a few hours behind a new order: an order missing from it
// is not an error, and goal differences never raise the alarm on their own.

const H = 3.6e6;
export const WIKI_URL = 'https://helldivers.wiki.gg/wiki/Major_Orders?action=raw';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "October 30th, 2186" (in-game year: 2186 is 2026), typos like "Octobr" included
export function wikiDate(s) {
  const m = /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(String(s || ''));
  if (!m) return null;
  const mon = MONTHS.findIndex(x => m[1].toLowerCase().startsWith(x) || (m[1].length >= 4 && x === m[1].toLowerCase().slice(0, 3)));
  if (mon < 0) return null;
  let y = Number(m[3]); if (y > 2100) y -= 160;
  return Date.UTC(y, mon, Number(m[2]));
}

// wiki text to plain words: struck-out old values dropped, links and templates reduced to their text
export function clean(s) {
  return String(s || '')
    .replace(/<(s|strike|del)>[\s\S]*?<\/\1>/gi, '')
    .replace(/\{\{Task[ _](Hold|Liberate)\|([^}]*)\}\}/gi, (_, k, p) => `${k} ${p.split('|').join(', ')}`)
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, ' ').replace(/'''?/g, '').replace(/<[^>]*>/g, ' ')
    .replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();
}

// [{ title, start, objectives: [{ verb, goal, name, text }] }]
export function parseWiki(raw) {
  const out = [];
  for (const block of String(raw || '').split('{{Major Order').slice(1)) {
    const field = (k) => { const m = new RegExp(`\\|\\s*${k}\\s*=([\\s\\S]*?)(?=\\n\\s*\\||\\n\\}\\})`).exec(block); return m ? m[1].trim() : ''; };
    const start = wikiDate(field('start_date'));
    const overview = field('overview');
    if (!start || !overview) continue;
    const objectives = overview.split(/\{\{\*\}\}/).slice(1).map(clean).filter(Boolean).map(text => {
      const num = /(\d{1,3}(?:,\d{3})+|\d+)/.exec(text);
      const goal = num ? Number(num[1].replace(/,/g, '')) : null;
      const verb = (/^[A-Za-z]+/.exec(text) || [''])[0].toLowerCase();
      // what is killed: the words after the number, up to "on / using / with / in / from / to / (" or the end
      const name = verb === 'kill' && num ? (text.slice(num.index + num[0].length).split(/\s+(?:on|using|with|in|from|to|across|within)\s+|\s*\(|\s*\.|\s*;/i)[0] || '').trim() : null;
      return { verb, goal, name, text };
    });
    for (const o of objectives) {
      // the weapon or stratagem an objective asks for: "... using the Orbital Railcannon Strike"
      const m = /\b(?:using|with)\s+(?:the\s+)?([A-Z0-9][^.;(]*?)(?:\s+(?:Stratagem|on|in|across|for)\b|[.;(]|$)/.exec(o.text);
      o.item = o.verb === 'kill' || o.verb === 'use' ? (m ? m[1].trim() : null) : null;
    }
    out.push({ title: clean(field('title')), start, objectives });
  }
  return out;
}

// "Dragon Roaches" = "Dragonroaches" = "Dragon Roach"; "Automaton Shredder Tanks" contains "Shredder Tanks"
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '').replace(/(es|s)$/, '');
export const sameName = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

// a plural from the wiki to a singular for "Radical kills" (only a hint until the list has the real one)
export function singular(s) {
  const w = String(s || '').trim();
  if (/less$/i.test(w)) return w;
  if (/ies$/i.test(w)) return w.slice(0, -3) + 'y';
  if (/(ch|sh|x|ss)es$/i.test(w)) return w.slice(0, -2);
  if (/s$/i.test(w)) return w.slice(0, -1);
  return w;
}

// the faction word an objective uses ("Kill 50,000,000 Automatons using ...")
const FAC_WORD = { 2: /terminid/i, 3: /automaton/i, 4: /illuminate/i };

// orders: [{ id, start (ms), tasks: raw game tasks }]; foes: src/game/enemies.json; items: id -> name we use
export function checkOrders(entries, orders, foes, items = {}) {
  const res = { checked: 0, matched: 0, mismatches: [], hints: {}, itemHints: {}, itemMismatches: [], notes: [] };
  for (const o of orders) {
    const all = (o.tasks || []).map(tk => {
      const vt = tk.valueTypes || [], v = tk.values || [];
      const at = (k) => { const i = vt.indexOf(k); return i >= 0 ? Number(v[i]) : 0; };
      return { unit: at(4), goal: at(3), type: tk.type, item: at(5), fac: at(1) };
    });
    const kills = all.filter(k => k.type === 3 && k.unit && k.goal);
    const withItem = all.filter(k => (k.type === 3 || k.type === 6) && k.item && k.goal);
    if ((!kills.length && !withItem.length) || !o.start) continue;
    res.checked++;
    // the wiki entry that started within 2 days and shares the most goals
    const near = entries.filter(e => Math.abs(e.start - o.start) < 48 * H);
    const score = (e) => [...kills, ...withItem].filter(k => e.objectives.some(x => x.goal === k.goal)).length;
    const e = near.sort((a, b) => score(b) - score(a))[0];
    if (!e || !score(e)) continue;
    res.matched++;
    for (const k of kills) {
      const w = e.objectives.find(x => x.verb === 'kill' && x.goal === k.goal && x.name);
      if (!w) { res.notes.push({ order: o.id, unit: k.unit, goal: k.goal, wiki: e.title, msg: 'goal not found on the wiki' }); continue; }
      const ours = foes[String(k.unit)];
      if (!ours) res.hints[String(k.unit)] = { many: w.name, one: singular(w.name), order: o.id, wiki: e.title };
      else if (!sameName(ours.many, w.name)) res.mismatches.push({ order: o.id, unit: k.unit, ours: ours.many, wiki: w.name, title: e.title });
    }
    // weapons and stratagems: the objective with the same goal, else the one naming the same faction
    // (goals get edited after launch, so the wiki may show the first ones)
    const used = new Set();
    for (const k of withItem) {
      const cands = e.objectives.filter(x => x.item && !used.has(x));
      const w = cands.find(x => x.goal === k.goal) || (FAC_WORD[k.fac] ? cands.filter(x => FAC_WORD[k.fac].test(x.text)) : []).find((x, i, a) => a.length === 1);
      if (!w) continue;
      used.add(w);
      const ours = items[String(k.item)];
      if (!ours) res.itemHints[String(k.item)] = w.item;
      else if (!sameName(ours, w.item)) res.itemMismatches.push({ order: o.id, item: k.item, ours, wiki: w.item, title: e.title });
    }
  }
  return res;
}
