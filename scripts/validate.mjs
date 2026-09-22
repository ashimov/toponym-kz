// Проверяет все карточки по data/schema.json и ссылки на источники.
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT, loadSources, loadToponyms } from './lib.mjs';

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const sourceIds = new Set(loadSources().map((s) => s.id));
const seen = new Set();
let errors = 0;

for (const { file, data } of loadToponyms()) {
  const problems = [];
  if (!validate(data)) {
    for (const e of validate.errors) problems.push(`${e.instancePath || '/'} ${e.message}`);
  }
  if (data?.id && data.id !== path.basename(file, path.extname(file))) {
    problems.push(`id "${data.id}" не совпадает с именем файла`);
  }
  if (seen.has(data?.id)) problems.push(`дубликат id ${data.id}`);
  seen.add(data?.id);

  const [lat, lon] = data?.coords ?? [];
  if (lat < 40 || lat > 56 || lon < 46 || lon > 88) {
    problems.push(`координаты [${lat}, ${lon}] вне Казахстана (проверь порядок: широта, долгота)`);
  }
  for (const s of data?.sources ?? []) if (!sourceIds.has(s)) problems.push(`неизвестный источник "${s}"`);
  for (const e of data?.etymology ?? []) if (e.source && !sourceIds.has(e.source)) problems.push(`неизвестный источник "${e.source}" в этимологии`);
  for (const h of data?.historical_forms ?? []) {
    if (h.source && !sourceIds.has(h.source)) problems.push(`неизвестный источник "${h.source}" в форме "${h.form}"`);
    if (h.from != null && h.to != null && h.to < h.from) problems.push(`форма "${h.form}": to < from`);
  }

  if (problems.length) {
    errors += problems.length;
    console.error(`✗ ${file}`);
    for (const p of problems) console.error(`    ${p}`);
  } else {
    console.log(`✓ ${file}`);
  }
}

if (errors) {
  console.error(`\n${errors} ошибок`);
  process.exit(1);
}
console.log(`\nВсе карточки валидны (${seen.size})`);
