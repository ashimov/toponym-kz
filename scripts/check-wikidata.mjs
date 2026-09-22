// Сверяет links.wikidata каждой карточки с Wikidata: название и координаты.
// Запуск: node scripts/check-wikidata.mjs
import { loadToponyms } from './lib.mjs';

const UA = `ToponymKZ/0.1 (+${process.env.COMMONS_CONTACT ?? 'https://github.com/toponym-kz'}; student research map)`;
const cards = loadToponyms().map((x) => x.data).filter((t) => t.links?.wikidata);
const ids = cards.map((t) => t.links.wikidata);

const entities = {};
for (let i = 0; i < ids.length; i += 50) {
  const u = new URL('https://www.wikidata.org/w/api.php');
  Object.entries({ action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels|claims', languages: 'kk|ru|en', format: 'json' })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
  Object.assign(entities, j.entities ?? {});
}

const km = (a, b) => {
  const R = 6371, d = Math.PI / 180;
  const x = (b[1] - a[1]) * d * Math.cos(((a[0] + b[0]) / 2) * d), y = (b[0] - a[0]) * d;
  return Math.round(Math.sqrt(x * x + y * y) * R);
};

// Допуск по типу: у рек и морей Wikidata ставит точку в устье или в центре акватории.
const TOL = { city: 80, town: 80, village: 80, site: 80, river: 1600, lake: 300, sea: 600, mountain: 150, range: 400, desert: 400, steppe: 500, region: 300, other: 300 };
let bad = 0;
for (const t of cards) {
  const e = entities[t.links.wikidata];
  if (!e || e.missing !== undefined) { console.log(`✗ ${t.id}: ${t.links.wikidata} не существует`); bad++; continue; }
  const label = e.labels?.kk?.value ?? e.labels?.ru?.value ?? e.labels?.en?.value ?? '?';
  const coord = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  const dist = coord ? km(t.coords, [coord.latitude, coord.longitude]) : null;
  const labelOk = [t.names.kk_cyr, t.names.ru, t.names.en].some((n) => n && (label.toLowerCase().includes(n.toLowerCase().split(' ')[0]) || n.toLowerCase().includes(label.toLowerCase().split(' ')[0])));
  const far = dist != null && dist > TOL[t.type];
  const mark = !labelOk || far ? '✗' : '✓';
  if (mark === '✗') bad++;
  console.log(`${mark} ${t.id.padEnd(12)} ${t.links.wikidata.padEnd(9)} «${label}» ${dist != null ? `${dist} км от карточки` : 'без координат'}${!labelOk ? '  ← название не совпадает' : ''}${far ? '  ← далеко' : ''}`);
}
console.log(bad ? `\n${bad} проблем` : '\nВсе идентификаторы совпадают');
