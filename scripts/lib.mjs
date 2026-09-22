import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const ROOT = new URL('..', import.meta.url).pathname;
export const TOPONYMS_DIR = path.join(ROOT, 'data/toponyms');

export function loadSources() {
  return yaml.load(fs.readFileSync(path.join(ROOT, 'data/sources.yaml'), 'utf8'));
}

export function loadToponyms() {
  return fs
    .readdirSync(TOPONYMS_DIR)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .map((f) => {
      try {
        return { file: f, data: yaml.load(fs.readFileSync(path.join(TOPONYMS_DIR, f), 'utf8')) };
      } catch (e) {
        console.error(`✗ ${f}: ошибка YAML — ${e.reason ?? e.message} (строка ${e.mark?.line + 1})`);
        process.exit(1);
      }
    });
}
