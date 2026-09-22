// Собирает data/toponyms/*.yaml + data/sources.yaml → public/data/toponyms.json, sources.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadSources, loadToponyms } from './lib.mjs';

const out = path.join(ROOT, 'public/data');
fs.mkdirSync(out, { recursive: true });

const RANK = { high: 4, medium: 3, low: 2, folk: 1, rejected: 0 };

const toponyms = loadToponyms().map(({ data }) => {
  const forms = data.historical_forms ?? [];
  const years = forms.map((f) => f.from ?? f.attested).filter((y) => Number.isInteger(y));
  const photoFile = path.join(ROOT, 'public/data/photos', `${data.id}.json`);
  const photos = fs.existsSync(photoFile) ? JSON.parse(fs.readFileSync(photoFile, 'utf8')).photos.length : 0;
  const best = [...data.etymology].sort((a, b) => RANK[b.reliability] - RANK[a.reliability])[0];
  return {
    ...data,
    status: data.status ?? 'draft',
    first_attested: years.length ? Math.min(...years) : null,
    best_gloss: best?.gloss ?? null,
    best_reliability: best?.reliability ?? null,
    photos,
  };
});

fs.writeFileSync(path.join(out, 'toponyms.json'), JSON.stringify(toponyms));
fs.writeFileSync(path.join(out, 'sources.json'), JSON.stringify(loadSources()));

const byLayer = {};
for (const t of toponyms) byLayer[t.layer] = (byLayer[t.layer] ?? 0) + 1;
console.log(`toponyms.json: ${toponyms.length} карточек`, byLayer);
