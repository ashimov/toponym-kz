// Выкачивает метаданные исторических фото с Викисклада для карточек,
// у которых есть commons_categories или media, и кладёт их в public/data/photos/<id>.json.
// Сами картинки не скачиваются: сайт показывает миниатюры с upload.wikimedia.org.
// Запуск: npm run photos            (только карточки без кэша)
//         npm run photos -- --all   (обновить всё)
//         npm run photos -- almaty  (одна карточка)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadToponyms } from './lib.mjs';
import { categoryFiles, fileInfo } from './commons-search.mjs';

const out = path.join(ROOT, 'public/data/photos');
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const all = args.includes('--all');
const only = args.filter((a) => !a.startsWith('--'));

for (const { data: t } of loadToponyms()) {
  const cats = t.commons_categories ?? [];
  const curated = t.media ?? [];
  if (!cats.length && !curated.length) continue;
  if (only.length && !only.includes(t.id)) continue;
  const file = path.join(out, `${t.id}.json`);
  if (fs.existsSync(file) && !all && !only.length) continue;

  console.log(`${t.id}: ${cats.join(', ') || 'только media'}`);
  const byFile = new Map();
  for (const m of await fileInfo(curated.map((c) => c.file))) byFile.set(m.file, { ...m, curated: true });
  for (const c of curated) {
    const m = byFile.get(c.file);
    if (m) Object.assign(m, { year: c.year, caption: c.caption ?? m.caption, author: c.author ?? m.author, license: c.license ?? m.license });
    else console.warn(`  ! файл не найден на Викискладе: ${c.file}`);
  }
  for (const cat of cats) {
    for (const m of await categoryFiles(`Category:${cat}`)) if (!byFile.has(m.file)) byFile.set(m.file, m);
  }
  const photos = [...byFile.values()].sort((a, b) => Number(!!b.curated) - Number(!!a.curated) || (a.year ?? 9999) - (b.year ?? 9999));
  fs.writeFileSync(file, JSON.stringify({ id: t.id, fetched: new Date().toISOString().slice(0, 10), photos }, null, 1));
  console.log(`  → ${photos.length} фото`);
}
