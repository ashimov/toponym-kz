// Подбирает links.wikidata для карточек: ищет по русскому и казахскому названию,
// берёт кандидата с координатами рядом с карточкой. Запуск:
//   node scripts/find-wikidata.mjs            — только показать
//   node scripts/find-wikidata.mjs --write    — записать в YAML
//   node scripts/find-wikidata.mjs --write --all  — перезаписать и уже заполненные
import fs from 'node:fs';
import path from 'node:path';
import { TOPONYMS_DIR, loadToponyms } from './lib.mjs';

const UA = `ToponymKZ/0.1 (+${process.env.COMMONS_CONTACT ?? 'https://github.com/toponym-kz'}; student research map)`;
const write = process.argv.includes('--write');
const all = process.argv.includes('--all');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TOL = { city: 60, town: 60, village: 60, site: 60, river: 1600, lake: 300, sea: 600, mountain: 150, range: 400, desert: 400, steppe: 500, region: 300, other: 300 };

// Тип объекта проверяем по описанию: ближайший по координатам часто оказывается
// университетом, вокзалом или районом с тем же именем.
const GOOD = {
  city: /\bгород|city\b|town\b|қала/i, town: /посёлок|поселок|город|town|village|кент/i, village: /село|деревня|village|ауыл/i, site: /городище|site|археолог/i,
  river: /река|river|өзен/i, lake: /озеро|lake|көл/i, sea: /море|sea|теңіз/i, mountain: /гора|mountain|тау/i, range: /горы|хребет|mountain|тау/i,
  desert: /пустыня|desert|шөл/i, steppe: /степь|steppe|мелкосопочник|дала/i, region: /полуостров|регион|область|peninsula|region|historical region/i, other: /./,
};
const BAD = /университет|станция|вокзал|район|администрация|остановка|улица|аэропорт|стадион|национальный парк|резерват|заповедник|объект.*наследия|university|station|district|administration|stop\b|street|airport|park|reserve|heritage|colliery|mine\b|футбольный|клуб|club/i;

const api = async (host, params) => {
  const u = new URL(`https://${host}/w/api.php`);
  Object.entries({ format: 'json', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  await new Promise((r) => setTimeout(r, 400));
  return (await fetch(u, { headers: { 'User-Agent': UA } })).json();
};
const km = (a, b) => {
  const R = 6371, d = Math.PI / 180;
  const x = (b[1] - a[1]) * d * Math.cos(((a[0] + b[0]) / 2) * d), y = (b[0] - a[0]) * d;
  return Math.round(Math.sqrt(x * x + y * y) * R);
};

for (const { file, data: t } of loadToponyms()) {
  if (only.length ? !only.includes(t.id) : t.links?.wikidata && !all) continue;
  const queries = [...new Set([t.names.ru?.split(' (')[0], t.names.kk_cyr, t.names.en].filter(Boolean))];
  const cands = new Map();
  for (const q of queries) {
    for (const lang of ['ru', 'kk', 'en']) {
      const r = await api('www.wikidata.org', { action: 'wbsearchentities', search: q, language: lang, uselang: 'ru', limit: 7, type: 'item' });
      for (const s of r.search ?? []) cands.set(s.id, s);
      if (cands.size >= 12) break;
    }
  }
  if (!cands.size) { console.log(`? ${t.id}: кандидатов нет`); continue; }
  const e = await api('www.wikidata.org', { action: 'wbgetentities', ids: [...cands.keys()].join('|'), props: 'labels|claims|descriptions', languages: 'ru|kk|en' });
  let best = null;
  for (const ent of Object.values(e.entities ?? {})) {
    const c = ent.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (!c) continue;
    const dist = km(t.coords, [c.latitude, c.longitude]);
    const inKZ = (ent.claims?.P17 ?? []).some((cl) => cl.mainsnak?.datavalue?.value?.id === 'Q232');
    const desc = [ent.descriptions?.ru?.value, ent.descriptions?.en?.value, ent.descriptions?.kk?.value].filter(Boolean).join(' | ');
    const label = ent.labels?.ru?.value ?? ent.labels?.en?.value ?? ent.labels?.kk?.value ?? '';
    if (!GOOD[t.type].test(desc) || BAD.test(desc) || BAD.test(label)) continue;   // тип обязан совпасть
    // Бонус за «правильный» класс P31: город, село, река, озеро, море, хребет, гора, пустыня
    const p31 = (ent.claims?.P31 ?? []).map((cl) => cl.mainsnak?.datavalue?.value?.id);
    const classy = p31.some((c) => ['Q515', 'Q1549591', 'Q7930989', 'Q3957', 'Q532', 'Q486972', 'Q4022', 'Q23397', 'Q165', 'Q46831', 'Q8502', 'Q8514', 'Q39816'].includes(c));
    const score = dist + (inKZ ? 0 : 200) - (classy ? 300 : 0);
    if (dist <= TOL[t.type] && (!best || score < best.score)) best = { id: ent.id, dist, inKZ, score, label, desc };
  }
  if (!best) { console.log(`? ${t.id}: подходящего нет. Кандидаты:\n${Object.values(e.entities ?? {}).map((x) => `     ${x.id} «${x.labels?.ru?.value ?? x.labels?.en?.value ?? ''}» — ${x.descriptions?.ru?.value ?? x.descriptions?.en?.value ?? ''}`).join('\n')}`); continue; }
  const same = best.id === t.links?.wikidata;
  console.log(`${same ? '=' : '→'} ${t.id.padEnd(12)} ${best.id.padEnd(9)} «${best.label}» ${best.dist} км · ${best.desc}`);
  if (write && !same) {
    const p = path.join(TOPONYMS_DIR, file);
    let s = fs.readFileSync(p, 'utf8');
    if (/^\s+wikidata: Q\d+/m.test(s)) s = s.replace(/^(\s+wikidata:) Q\d+/m, `$1 ${best.id}`);
    else if (/^links:/m.test(s)) s = s.replace(/^links:\n/m, `links:\n  wikidata: ${best.id}\n`);
    else s = s.replace(/^sources:/m, `links:\n  wikidata: ${best.id}\nsources:`);
    fs.writeFileSync(p, s);
  }
}
