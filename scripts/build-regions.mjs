// Строит public/data/kz-regions.geojson и kz-country.geojson
// из сырого ответа Overpass (data/raw-kz-admin.osm.json).
// Источник: OpenStreetMap, лицензия ODbL. Обновление: npm run regions.
import fs from 'node:fs';
import osmtogeojson from 'osmtogeojson';
import mapshaper from 'mapshaper';

const raw = JSON.parse(fs.readFileSync('data/raw-kz-admin.osm.json', 'utf8'));
const gj = osmtogeojson(raw, { flatProperties: true });

const polys = gj.features.filter(
  (f) =>
    f.id?.startsWith('relation/') &&
    /Polygon/.test(f.geometry.type) &&
    /^KZ/.test(f.properties['ISO3166-2'] ?? f.properties['ISO3166-1'] ?? ''),
);

const country = { type: 'FeatureCollection', features: [] };
const regions = { type: 'FeatureCollection', features: [] };

for (const f of polys) {
  const p = f.properties;
  const out = {
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      osm_id: f.id,
      iso: p['ISO3166-2'] ?? p['ISO3166-1'] ?? null,
      admin_level: Number(p.admin_level),
      name_kk: p['name:kk'] ?? p.name ?? null,
      name_ru: p['name:ru'] ?? null,
      name_en: p['name:en'] ?? null,
      // Внутри Казахстана city = город республиканского значения
      kind: p.admin_level === '2' ? 'country' : p.place === 'city' || /^KZ-7/.test(p['ISO3166-2'] ?? '') ? 'city' : 'region',
    },
  };
  (p.admin_level === '2' ? country : regions).features.push(out);
}

async function simplify(fc, pct, file) {
  const input = { 'in.geojson': JSON.stringify(fc) };
  const cmd = `-i in.geojson -simplify ${pct} keep-shapes -clean -o precision=0.0001 out.geojson`;
  const res = await mapshaper.applyCommands(cmd, input);
  fs.writeFileSync(file, res['out.geojson']);
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`${file}: ${fc.features.length} объектов, ${kb} КБ`);
}

await simplify(regions, '6%', 'public/data/kz-regions.geojson');

// Точки для подписей областей: одна на область (внутренняя точка полигона).
{
  const res = await mapshaper.applyCommands(
    '-i in.geojson -points inner -o out.geojson',
    { 'in.geojson': fs.readFileSync('public/data/kz-regions.geojson', 'utf8') },
  );
  fs.writeFileSync('public/data/kz-regions-labels.geojson', res['out.geojson']);
  console.log('public/data/kz-regions-labels.geojson: точки подписей');
}
await simplify(country, '6%', 'public/data/kz-country.geojson');
