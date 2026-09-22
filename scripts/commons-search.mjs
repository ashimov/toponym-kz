// Поиск исторических фотографий на Викискладе (Wikimedia Commons).
// Использование: node scripts/commons-search.mjs "Верный" "Алма-Ата 1930"
// Печатает YAML-фрагмент для поля media карточки. Год берётся из метаданных файла,
// его нужно проверить глазами по описанию.
const API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia требует контакт (URL или e-mail) в User-Agent, иначе отвечает 429.
// Укажи свой: COMMONS_CONTACT="https://github.com/<you>/toponym-kz" npm run photos
const UA = `ToponymKZ/0.1 (+${process.env.COMMONS_CONTACT ?? 'https://github.com/toponym-kz'}; student research map of Kazakhstan toponyms)`;

// Не чаще одного запроса в 1.5 с, при 429 ждём и повторяем: так требует Wikimedia.
let last = 0;
async function api(params, attempt = 0) {
  const wait = Math.max(0, last + 1500 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (r.status === 429 || r.status >= 500) {
    if (attempt >= 4) throw new Error(`Commons API: ${r.status} после ${attempt} попыток`);
    const backoff = 15000 * (attempt + 1);
    console.error(`  … ${r.status}, жду ${backoff / 1000} с`);
    await new Promise((res) => setTimeout(res, backoff));
    return api(params, attempt + 1);
  }
  return r.json();
}

const YEAR_RE = /\b(1[5-9]\d\d|20[0-2]\d)\b/g;
const yearsIn = (s) => [...String(s ?? '').matchAll(YEAR_RE)].map((m) => Number(m[1]));

// Год снимка. У сканов открыток в DateTimeOriginal часто стоит год сканирования,
// а настоящий год — в названии файла или описании («Aulie-Ata, 1930—1940»).
// Возвращает число, null (год неизвестен) или 'modern' (современный снимок, отсеять).
function pickYear(meta, title, caption, maxYear) {
  const shot = yearsIn(meta?.DateTimeOriginal?.value)[0] ?? null;
  if (shot != null && shot <= maxYear) return shot;
  const old = [...yearsIn(title), ...yearsIn(caption)].filter((y) => y <= maxYear).sort((a, b) => a - b);
  if (old.length) return old[0];
  return shot != null ? 'modern' : null;
}
// Убираем HTML; Викисклад иногда отдаёт текст дважды («Unknown authorUnknown author») — схлопываем.
const strip = (s) => {
  const t = String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const half = t.slice(0, t.length / 2);
  return t.length % 2 === 0 && half && t === half + half ? half : t;
};

export async function search(query, { limit = 20, maxYear = 1991 } = {}) {
  const s = await api({ action: 'query', list: 'search', srsearch: `${query} filetype:bitmap`, srnamespace: 6, srlimit: limit });
  const titles = (s.query?.search ?? []).map((x) => x.title);
  if (!titles.length) return [];
  const info = await api({
    action: 'query', titles: titles.join('|'), prop: 'imageinfo',
    iiprop: 'url|extmetadata|size', iiurlwidth: 640, iiextmetadatafilter: 'DateTimeOriginal|DateTime|LicenseShortName|Artist|ImageDescription|Credit',
  });
  const out = [];
  for (const p of Object.values(info.query?.pages ?? {})) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const m = ii.extmetadata ?? {};
    const caption = strip(m.ImageDescription?.value).slice(0, 160);
    const y = pickYear(m, p.title, caption, maxYear);
    if (y === 'modern') continue;
    out.push({
      file: p.title.replace(/^File:/, ''),
      year: y,
      caption,
      author: strip(m.Artist?.value).slice(0, 80),
      license: m.LicenseShortName?.value ?? '',
      thumb: ii.thumburl,
      page: ii.descriptionurl,
    });
  }
  return out.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] !== '--category') {
  const queries = process.argv.slice(2);
  if (!queries.length) { console.error('Укажи запросы: node scripts/commons-search.mjs "Верный" "Алма-Ата"'); process.exit(1); }
  for (const q of queries) {
    console.log(`\n# ${q}`);
    for (const r of await search(q)) {
      console.log(`  - file: "${r.file}"\n    year: ${r.year ?? 'null'}\n    caption: "${r.caption.replace(/"/g, "'")}"\n    author: "${r.author.replace(/"/g, "'")}"\n    license: "${r.license}"\n    # ${r.page}`);
    }
  }
}

// Метаданные конкретных файлов (для поля media).
export async function fileInfo(files) {
  const out = [];
  for (let i = 0; i < files.length; i += 50) {
    const info = await api({
      action: 'query', titles: files.slice(i, i + 50).map((f) => `File:${f}`).join('|'), prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: 640, iiextmetadatafilter: 'DateTimeOriginal|LicenseShortName|Artist|ImageDescription',
    });
    for (const p of Object.values(info.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const m = ii.extmetadata ?? {};
      const caption = strip(m.ImageDescription?.value).slice(0, 160);
      const y = pickYear(m, p.title, caption, 2100);
      out.push({ file: p.title.replace(/^File:/, ''), year: y === 'modern' ? null : y, caption, author: strip(m.Artist?.value).slice(0, 80), license: m.LicenseShortName?.value ?? '', thumb: ii.thumburl, page: ii.descriptionurl });
    }
  }
  return out;
}

// Обход категории Викисклада: файлы + подкатегории по годам (глубина 2).
export async function categoryFiles(category, { maxYear = 1991, depth = 2, limit = 80 } = {}) {
  const seen = new Set();
  const files = [];
  async function walk(cat, d) {
    if (seen.has(cat) || files.length >= limit) return;
    seen.add(cat);
    const r = await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmtype: 'file|subcat', cmlimit: 200 });
    for (const m of r.query?.categorymembers ?? []) {
      if (m.ns === 6) files.push(m.title);
      else if (m.ns === 14 && d < depth) {
        const y = m.title.match(/\b(1[5-9]\d\d|20[0-2]\d)\b/);
        if (y && Number(y[1]) > maxYear) continue;               // «Almaty in 2015» пропускаем
        if (d > 0 && !y && !/history|historical|old|by year|by decade|postcard|век/i.test(m.title)) continue;
        await walk(m.title, d + 1);
      }
    }
  }
  await walk(category, 0);
  const out = [];
  for (let i = 0; i < files.length; i += 50) {
    const info = await api({
      action: 'query', titles: files.slice(i, i + 50).join('|'), prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: 640, iiextmetadatafilter: 'DateTimeOriginal|LicenseShortName|Artist|ImageDescription',
    });
    for (const p of Object.values(info.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const m = ii.extmetadata ?? {};
      const caption = strip(m.ImageDescription?.value).slice(0, 160);
      const y = pickYear(m, p.title, caption, maxYear);
      if (y === 'modern') continue;
      out.push({ file: p.title.replace(/^File:/, ''), year: y, caption, author: strip(m.Artist?.value).slice(0, 80), license: m.LicenseShortName?.value ?? '', thumb: ii.thumburl, page: ii.descriptionurl });
    }
  }
  return out.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

if (process.argv[2] === '--category') {
  for (const cat of process.argv.slice(3)) {
    console.log(`\n# ${cat}`);
    for (const r of await categoryFiles(cat.startsWith('Category:') ? cat : `Category:${cat}`)) {
      console.log(`  - file: "${r.file}"\n    year: ${r.year ?? 'null'}\n    caption: "${r.caption.replace(/"/g, "'")}"\n    license: "${r.license}"`);
    }
  }
}
