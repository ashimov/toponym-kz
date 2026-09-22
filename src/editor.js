// Редактор карточки: форма → YAML. Ничего не сохраняет сам: скопируй или скачай файл в data/toponyms/.
import yaml from 'js-yaml';
import { TYPE_LABELS, LAYER_LABELS, REL_LABELS, KIND_LABELS } from './i18n.js';

const $ = (s) => document.querySelector(s);
const form = $('#form');
const REGIONS = {
  'KZ-10': 'Абай', 'KZ-11': 'Ақмола', 'KZ-15': 'Ақтөбе', 'KZ-19': 'Алматы обл.', 'KZ-23': 'Атырау', 'KZ-27': 'Батыс Қазақстан', 'KZ-31': 'Жамбыл',
  'KZ-33': 'Жетісу', 'KZ-35': 'Қарағанды', 'KZ-39': 'Қостанай', 'KZ-43': 'Қызылорда', 'KZ-47': 'Маңғыстау', 'KZ-55': 'Павлодар', 'KZ-59': 'Солтүстік Қазақстан',
  'KZ-61': 'Түркістан', 'KZ-62': 'Ұлытау', 'KZ-63': 'Шығыс Қазақстан', 'KZ-71': 'Астана', 'KZ-75': 'Алматы', 'KZ-79': 'Шымкент',
};
const SCRIPTS = ['cyrillic', 'latin', 'arabic', 'old-turkic', 'greek', 'chinese', 'other'];
let sources = [];

const opts = (obj, sel = '') => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k} — ${v}</option>`).join('');
form.type.innerHTML = opts(TYPE_LABELS.ru, 'city');
form.layer.innerHTML = opts(LAYER_LABELS.ru, 'turkic');
form.region.innerHTML += Object.entries(REGIONS).map(([k, v]) => `<option value="${k}">${k} ${v}</option>`).join('');

const sourceSelect = (sel = '') => `<select name="source"><option value="">— источник —</option>${sources.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${s.id}</option>`).join('')}</select>`;

const TEMPLATES = {
  ety: (v = {}) => `
    <label class="wide">Значение (gloss)<input name="gloss" value="${esc(v.gloss)}" placeholder="«дельта, устье реки»" required /></label>
    <label>Язык<input name="language" value="${esc(v.language)}" placeholder="kazakh" /></label>
    <label>Надёжность<select name="reliability">${opts(REL_LABELS.ru, v.reliability ?? 'medium')}</select></label>
    <label>Источник${sourceSelect(v.source)}</label>
    <label class="wide">Разбор и аргументация<textarea name="analysis" rows="3">${esc(v.analysis)}</textarea></label>
    <label class="wide">Примечание<input name="note" value="${esc(v.note)}" /></label>`,
  morph: (v = {}) => `
    <label>Морфема<input name="form" value="${esc(v.form)}" placeholder="ақ" required /></label>
    <label>Значение<input name="gloss" value="${esc(v.gloss)}" placeholder="белый" required /></label>
    <label>Тип<select name="kind">${opts(KIND_LABELS.ru, v.kind ?? 'root')}</select></label>
    <label>Язык<input name="lang" value="${esc(v.lang)}" placeholder="если отличается" /></label>`,
  form: (v = {}) => `
    <label>Форма<input name="form" value="${esc(v.form)}" placeholder="Гурьев" required /></label>
    <label>Письменность<select name="script">${SCRIPTS.map((s) => `<option ${s === (v.script ?? 'cyrillic') ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label>Язык<input name="language" value="${esc(v.language)}" placeholder="russian" /></label>
    <label>С года<input name="from" type="number" value="${v.from ?? ''}" /></label>
    <label>По год <small>пусто = до сих пор</small><input name="to" type="number" value="${v.to ?? ''}" /></label>
    <label>Год фиксации<input name="attested" type="number" value="${v.attested ?? ''}" /></label>
    <label>Официальное<select name="official"><option value="" ${v.official == null ? 'selected' : ''}>не указано</option><option value="true" ${v.official === true ? 'selected' : ''}>да</option><option value="false" ${v.official === false ? 'selected' : ''}>нет</option></select></label>
    <label>Источник${sourceSelect(v.source)}</label>
    <label class="wide">Примечание<input name="note" value="${esc(v.note)}" /></label>`,
};
const LISTS = { ety: '#ety-list', morph: '#morph-list', form: '#form-list' };

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function addItem(kind, v) {
  const div = document.createElement('div');
  div.className = 'rep-item'; div.dataset.kind = kind;
  div.innerHTML = `<button type="button" class="rm" title="удалить">×</button>` + TEMPLATES[kind](v);
  div.querySelector('.rm').onclick = () => { div.remove(); update(); };
  $(LISTS[kind]).appendChild(div);
}
document.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => { addItem(b.dataset.add); update(); }));

function items(kind) {
  return [...$(LISTS[kind]).querySelectorAll('.rep-item')].map((el) => {
    const o = {};
    for (const f of el.querySelectorAll('[name]')) {
      let v = f.value.trim();
      if (v === '') continue;
      if (f.type === 'number') v = Number(v);
      if (f.name === 'official') v = v === 'true';
      o[f.name] = v;
    }
    return o;
  });
}

function collect() {
  const f = form;
  const card = {
    id: f.id.value.trim(),
    names: clean({ kk_cyr: f.kk_cyr.value.trim(), kk_lat: f.kk_lat.value.trim(), ru: f.ru.value.trim(), en: f.en.value.trim() }),
    type: f.type.value,
    coords: [Number(f.lat.value), Number(f.lon.value)],
    ...(f.region.value ? { region: f.region.value } : {}),
    layer: f.layer.value,
    status: f.status.value,
    etymology: items('ety'),
  };
  const morph = items('morph'); if (morph.length) card.morphemes = morph;
  const forms = items('form'); if (forms.length) card.historical_forms = forms;
  const cats = f.commons_categories.value.split('\n').map((s) => s.trim()).filter(Boolean); if (cats.length) card.commons_categories = cats;
  card.sources = f.sources.value.split(',').map((s) => s.trim()).filter(Boolean);
  if (f.wikidata.value.trim()) card.links = { wikidata: f.wikidata.value.trim() };
  if (f.notes.value.trim()) card.notes = f.notes.value.trim();
  return card;
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));

function problems(card) {
  const p = [];
  if (!/^[a-z0-9-]+$/.test(card.id)) p.push('id: только латиница, цифры и дефис');
  if (!card.names.kk_cyr || !card.names.ru) p.push('нужны казахское и русское названия');
  if (!(card.coords[0] >= 40 && card.coords[0] <= 56 && card.coords[1] >= 46 && card.coords[1] <= 88)) p.push('координаты вне Казахстана: порядок «широта, долгота»');
  if (!card.etymology.length) p.push('нужна хотя бы одна гипотеза этимологии');
  const known = new Set(sources.map((s) => s.id));
  for (const s of card.sources) if (!known.has(s)) p.push(`неизвестный источник «${s}» — добавь в sources.yaml`);
  for (const h of card.historical_forms ?? []) if (h.from != null && h.to != null && h.to < h.from) p.push(`форма «${h.form}»: год окончания раньше начала`);
  return p;
}

function update() {
  const card = collect();
  const text = yaml.dump(card, { lineWidth: 100, noRefs: true, quotingType: '"', forceQuotes: false });
  $('#yaml').textContent = text;
  $('#out-name').textContent = `data/toponyms/${card.id || '…'}.yaml`;
  const p = problems(card);
  $('#problems').innerHTML = p.map((x) => `<div>✗ ${esc(x)}</div>`).join('');
  return text;
}
form.addEventListener('input', update);
form.addEventListener('change', update);

$('#copy').onclick = async () => { await navigator.clipboard.writeText(update()); $('#copy').textContent = 'Скопировано'; setTimeout(() => ($('#copy').textContent = 'Копировать'), 1500); };
$('#download').onclick = () => {
  const text = update();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }));
  a.download = `${collect().id || 'toponym'}.yaml`;
  a.click();
};

function fill(card) {
  const f = form;
  f.id.value = card.id ?? ''; f.status.value = card.status ?? 'draft';
  f.kk_cyr.value = card.names?.kk_cyr ?? ''; f.kk_lat.value = card.names?.kk_lat ?? ''; f.ru.value = card.names?.ru ?? ''; f.en.value = card.names?.en ?? '';
  f.type.value = card.type ?? 'city'; f.layer.value = card.layer ?? 'turkic';
  f.lat.value = card.coords?.[0] ?? ''; f.lon.value = card.coords?.[1] ?? ''; f.region.value = card.region ?? '';
  f.wikidata.value = card.links?.wikidata ?? '';
  f.sources.value = (card.sources ?? []).join(', ');
  f.commons_categories.value = (card.commons_categories ?? []).join('\n');
  f.notes.value = card.notes ?? '';
  for (const k of Object.keys(LISTS)) $(LISTS[k]).innerHTML = '';
  for (const e of card.etymology ?? []) addItem('ety', e);
  for (const m of card.morphemes ?? []) addItem('morph', m);
  for (const h of card.historical_forms ?? []) addItem('form', h);
  update();
}

$('#open').onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try { fill(yaml.load(await file.text())); } catch (err) { alert('Не удалось прочитать YAML: ' + err.message); }
};

async function init() {
  const [src, tops] = await Promise.all([
    fetch('./data/sources.json').then((r) => r.json()).catch(() => []),
    fetch('./data/toponyms.json').then((r) => r.json()).catch(() => []),
  ]);
  sources = src;
  const sel = $('#load');
  for (const tp of tops) sel.insertAdjacentHTML('beforeend', `<option value="${tp.id}">${tp.names.kk_cyr} (${tp.id})</option>`);
  sel.onchange = () => {
    const tp = tops.find((x) => x.id === sel.value);
    if (!tp) return;
    const { first_attested, best_gloss, best_reliability, photos, ...card } = tp;   // служебные поля сборки не нужны
    fill(card);
  };
  const hash = decodeURIComponent(location.hash.slice(1));
  const preset = tops.find((x) => x.id === hash);
  if (preset) { sel.value = preset.id; sel.onchange(); }
  else { addItem('ety'); update(); }
}
init();
