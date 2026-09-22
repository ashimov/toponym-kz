// Экспорт в Linked Places Format (LPF) — формат World Historical Gazetteer, Pelagios, Recogito.
// https://github.com/LinkedPasts/linked-places-format
// Запуск: npm run export:lpf  → public/data/toponyms.lpf.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadSources, loadToponyms } from './lib.mjs';

const sources = new Map(loadSources().map((s) => [s.id, s]));
const TYPE_AAT = {   // Getty AAT — словарь типов, который требует LPF
  city: { id: 'aat:300008389', label: 'cities' }, town: { id: 'aat:300008372', label: 'towns' }, village: { id: 'aat:300008375', label: 'villages' },
  river: { id: 'aat:300008707', label: 'rivers' }, lake: { id: 'aat:300008680', label: 'lakes' }, sea: { id: 'aat:300008694', label: 'seas' },
  mountain: { id: 'aat:300008795', label: 'mountains' }, range: { id: 'aat:300008795', label: 'mountains' }, desert: { id: 'aat:300008678', label: 'deserts' },
  steppe: { id: 'aat:300008756', label: 'steppes' }, region: { id: 'aat:300182722', label: 'regions' }, site: { id: 'aat:300000810', label: 'archaeological sites' }, other: { id: 'aat:300008347', label: 'inhabited places' },
};
const LANG = { kazakh: 'kk', russian: 'ru', turkic: 'trk', 'old-turkic': 'otk', arabic: 'ar', persian: 'fa', greek: 'grc', chinese: 'zh', iranian: 'ira', english: 'en' };
const iso = (y) => (y == null ? undefined : y < 0 ? `-${String(-y).padStart(4, '0')}` : String(y).padStart(4, '0'));
const cite = (id) => { const s = sources.get(id); return s ? { label: [s.author, s.title, s.year].filter(Boolean).join('. '), ...(s.url ? { '@id': s.url } : {}) } : undefined; };

const features = loadToponyms().map(({ data: t }) => {
  const names = [
    { toponym: t.names.kk_cyr, lang: 'kk' },
    t.names.kk_lat && { toponym: t.names.kk_lat, lang: 'kk-Latn' },
    t.names.ru && { toponym: t.names.ru, lang: 'ru' },
    t.names.en && { toponym: t.names.en, lang: 'en' },
    ...(t.historical_forms ?? []).map((f) => ({
      toponym: f.form,
      lang: LANG[f.language] ?? (f.language?.split(/\W/)[0] && LANG[f.language.split(/\W/)[0]]) ?? undefined,
      citations: f.source && cite(f.source) ? [cite(f.source)] : undefined,
      when: f.from != null || f.attested != null ? { timespans: [{ start: { in: iso(f.from ?? f.attested) }, ...(f.to != null ? { end: { in: iso(f.to) } } : {}) }] } : undefined,
    })),
  ].filter(Boolean);
  const years = (t.historical_forms ?? []).map((f) => f.from ?? f.attested).filter((y) => Number.isInteger(y));
  return {
    '@id': `https://toponym.kz/place/${t.id}`,
    type: 'Feature',
    properties: { title: t.names.kk_cyr, ccodes: ['KZ'], fclasses: [/city|town|village|site/.test(t.type) ? 'P' : /river|lake|sea/.test(t.type) ? 'H' : 'T'] },
    when: years.length ? { timespans: [{ start: { in: iso(Math.min(...years)) } }] } : undefined,
    names,
    types: [{ identifier: `http://vocab.getty.edu/${TYPE_AAT[t.type].id.replace(':', '/')}`, label: TYPE_AAT[t.type].label }],
    geometry: { type: 'Point', coordinates: [t.coords[1], t.coords[0]] },
    links: [
      t.links?.wikidata && { type: 'closeMatch', identifier: `https://www.wikidata.org/entity/${t.links.wikidata}` },
      t.links?.geonames && { type: 'closeMatch', identifier: `https://www.geonames.org/${t.links.geonames}` },
    ].filter(Boolean),
    descriptions: t.etymology.filter((e) => e.reliability !== 'rejected').map((e) => ({
      value: `[${e.reliability}] ${e.gloss}${e.analysis ? ' — ' + e.analysis.replace(/\s+/g, ' ') : ''}`,
      lang: 'ru',
      ...(e.source && cite(e.source) ? { citations: [cite(e.source)] } : {}),
    })),
  };
});

const out = {
  type: 'FeatureCollection',
  '@context': 'https://raw.githubusercontent.com/LinkedPasts/linked-places-format/main/linkedplaces-context-v1.1.jsonld',
  features,
};
fs.writeFileSync(path.join(ROOT, 'public/data/toponyms.lpf.json'), JSON.stringify(out, null, 1));
console.log(`toponyms.lpf.json: ${features.length} объектов`);
