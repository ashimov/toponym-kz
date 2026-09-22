import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
// Запасная подложка, если OpenFreeMap недоступен: растровые тайлы OSM + шрифты с demotiles.maplibre.org
const FALLBACK_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.6, 'raster-opacity': 0.85 } }],
};
let usingFallback = false;
const font = (bold) => (usingFallback ? ['Noto Sans Regular'] : [bold ? 'Noto Sans Bold' : 'Noto Sans Regular']);
const KZ_BOUNDS = [[46.4, 40.5], [87.4, 55.6]];
const CURRENT_YEAR = 2026;

const TYPE_LABEL = {
  city: 'Город', town: 'Посёлок', village: 'Село', river: 'Река', lake: 'Озеро', sea: 'Море',
  mountain: 'Гора', range: 'Горы', desert: 'Пустыня', steppe: 'Степь', region: 'Регион', site: 'Городище', other: 'Другое',
};
const TYPE_GROUP = {
  city: 'settlement', town: 'settlement', village: 'settlement', site: 'settlement',
  river: 'water', lake: 'water', sea: 'water',
  mountain: 'relief', range: 'relief', desert: 'relief', steppe: 'relief', region: 'relief', other: 'relief',
};
const GROUP_LABEL = { settlement: 'Ойконимы', water: 'Гидронимы', relief: 'Оронимы и регионы' };
const LAYER_LABEL = {
  turkic: 'Тюркский', mongolic: 'Монгольский', iranian: 'Иранский', arabic: 'Арабский', russian: 'Русский',
  soviet: 'Советский', hybrid: 'Смешанный', substrate: 'Субстрат', unknown: 'Не установлен',
};
const LAYER_COLOR = {
  turkic: '#0f766e', mongolic: '#b45309', iranian: '#6d28d9', arabic: '#15803d', russian: '#9a3412',
  soviet: '#dc2626', hybrid: '#4f46e5', substrate: '#475569', unknown: '#9ca3af',
};
const REL_LABEL = { high: 'Надёжно', medium: 'Вероятно', low: 'Гипотеза', folk: 'Народная', rejected: 'Отвергнута' };
const STATUS_LABEL = { draft: 'Черновик', reviewed: 'Проверено', published: 'Опубликовано' };
const SCRIPT_LABEL = { cyrillic: 'кириллица', latin: 'латиница', arabic: 'арабица', 'old-turkic': 'руника', greek: 'греч.', chinese: 'кит.', other: '' };

const state = {
  year: CURRENT_YEAR,
  query: '',
  groups: new Set(Object.keys(GROUP_LABEL)),
  layers: new Set(Object.keys(LAYER_LABEL)),
  selected: null,
  toponyms: [],
  sources: new Map(),
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtYear = (y) => (y == null ? '…' : y < 0 ? `${-y} до н. э.` : String(y));

// ---------- Форма названия для выбранного года ----------
function formsAt(t, year) {
  return (t.historical_forms ?? []).filter((f) => {
    const from = f.from ?? f.attested;
    if (from == null) return false;
    const to = f.to === undefined ? (f.attested != null && f.from == null ? f.attested : null) : f.to;
    return from <= year && (to == null || year < to || (year === CURRENT_YEAR && to >= CURRENT_YEAR));
  });
}

function labelAt(t, year) {
  if (year >= CURRENT_YEAR) return { label: t.names.kk_cyr, visible: true, renamed: false };
  const active = formsAt(t, year);
  const isSettlement = TYPE_GROUP[t.type] === 'settlement';
  if (!active.length) {
    if (isSettlement && t.first_attested != null && year < t.first_attested) return { label: '', visible: false, renamed: false };
    return { label: t.names.kk_cyr, visible: true, renamed: false };
  }
  const official = active.filter((f) => f.official);
  const pick = (official.length ? official : active).sort((a, b) => (b.from ?? 0) - (a.from ?? 0))[0];
  return { label: pick.form, visible: true, renamed: pick.form !== t.names.kk_cyr };
}

// ---------- Фильтрация ----------
function matches(t) {
  if (!state.groups.has(TYPE_GROUP[t.type])) return false;
  if (!state.layers.has(t.layer)) return false;
  if (!labelAt(t, state.year).visible) return false;
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  const hay = [
    ...Object.values(t.names),
    ...(t.historical_forms ?? []).map((f) => f.form),
    ...t.etymology.map((e) => e.gloss),
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function toGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: state.toponyms.filter(matches).map((t) => {
      const { label, renamed } = labelAt(t, state.year);
      return {
        type: 'Feature',
        id: t.id,
        geometry: { type: 'Point', coordinates: [t.coords[1], t.coords[0]] },
        properties: {
          id: t.id, label, renamed, layer: t.layer, type: t.type,
          color: LAYER_COLOR[t.layer], gloss: t.best_gloss ?? '',
          selected: t.id === state.selected,
          size: TYPE_GROUP[t.type] === 'settlement' ? 1 : 0.85,
        },
      };
    }),
  };
}

// ---------- Фотографии (кэш public/data/photos/<id>.json, собирается npm run photos) ----------
const photoCache = new Map();
async function loadPhotos(id) {
  if (photoCache.has(id)) return photoCache.get(id);
  const p = fetch(`./data/photos/${id}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => (j ? j.photos : null)).catch(() => null);
  photoCache.set(id, p);
  return p;
}
const dedupe = (t) => { t = String(t ?? ''); const h = t.slice(0, t.length / 2); return t.length % 2 === 0 && h && t === h + h ? h : t; };
const bigThumb = (url) => url?.replace(/\/(\d+)px-/, '/1400px-');

function renderGallery(t) {
  const box = $('#gallery');
  if (!box) return;
  loadPhotos(t.id).then((photos) => {
    if (state.selected !== t.id) return;
    if (!photos || !photos.length) {
      box.innerHTML = !t.commons_categories?.length && !t.media?.length
        ? `<div class="gal-empty">Для этой карточки не указаны категории Викисклада (поле <code>commons_categories</code>).</div>`
        : photos === null
          ? `<div class="gal-empty">Фотографии ещё не выкачаны: <code>npm run photos -- ${esc(t.id)}</code></div>`
          : `<div class="gal-empty">В указанных категориях Викисклада нет снимков до 1991 года. Добавь снимки вручную через поле <code>media</code>.</div>`;
      return;
    }
    const year = state.year < CURRENT_YEAR ? state.year : null;
    const dated = photos.filter((p) => p.year != null);
    let nearest = null;
    if (year != null && dated.length) nearest = dated.reduce((a, b) => (Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a));
    const decades = new Map();
    for (const p of photos) {
      const key = p.year == null ? 'Без даты' : `${Math.floor(p.year / 10) * 10}-е`;
      if (!decades.has(key)) decades.set(key, []);
      decades.get(key).push(p);
    }
    box.innerHTML = `<div class="gal-head">${photos.length} фото с Викисклада${year != null ? ` · ближайшие к ${fmtYear(year)} выделены` : ''}</div>` +
      [...decades.entries()].map(([dec, list]) => (list.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)), `
        <div class="gal-decade"><div class="gal-dec-title">${esc(dec)}</div><div class="gal-row">${list.map((p) => {
          const near = year != null && p.year != null && Math.abs(p.year - year) <= 5;
          return `<figure class="ph ${near ? 'near' : ''} ${p === nearest ? 'nearest' : ''} ${p.curated ? 'curated' : ''}" data-file="${esc(p.file)}" title="${esc(p.caption || p.file)}">
            <img loading="lazy" src="${esc(p.thumb)}" alt="${esc(p.caption || p.file)}" />
            <figcaption>${p.year != null ? fmtYear(p.year) : '—'}</figcaption>
          </figure>`;
        }).join('')}</div></div>`)).join('');
    box.querySelectorAll('.ph').forEach((el) => (el.onclick = () => openLightbox(photos.find((p) => p.file === el.dataset.file), photos)));
    box.querySelector('.nearest')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
}

function openLightbox(p, all) {
  let lb = $('#lightbox');
  if (!lb) {
    lb = document.createElement('div'); lb.id = 'lightbox';
    lb.innerHTML = `<button class="lb-close" aria-label="Закрыть">×</button><button class="lb-prev" aria-label="Назад">‹</button><button class="lb-next" aria-label="Вперёд">›</button><div class="lb-body"><img /><div class="lb-cap"></div></div>`;
    document.body.appendChild(lb);
    lb.querySelector('.lb-close').onclick = () => lb.remove();
    lb.onclick = (e) => { if (e.target === lb) lb.remove(); };
    document.addEventListener('keydown', (e) => { if (!$('#lightbox')) return; if (e.key === 'Escape') lb.remove(); if (e.key === 'ArrowRight') lb._next?.(); if (e.key === 'ArrowLeft') lb._prev?.(); });
  }
  const i = all.indexOf(p);
  lb._next = () => openLightbox(all[(i + 1) % all.length], all);
  lb._prev = () => openLightbox(all[(i - 1 + all.length) % all.length], all);
  lb.querySelector('.lb-next').onclick = lb._next;
  lb.querySelector('.lb-prev').onclick = lb._prev;
  const img = lb.querySelector('img');
  img.onerror = () => { if (img.src !== p.thumb) img.src = p.thumb; };   // оригинал меньше 1400px — берём миниатюру
  img.src = bigThumb(p.thumb);
  lb.querySelector('.lb-cap').innerHTML = `<b>${p.year != null ? fmtYear(p.year) : 'дата не указана'}</b> ${esc(p.caption || p.file)}
    <div class="lb-meta">${p.author ? esc(dedupe(p.author)) + ' · ' : ''}${esc(p.license)} · <a href="${esc(p.page)}" target="_blank" rel="noopener">Викисклад ↗</a>
    ${p.year != null ? `· <a href="#" class="lb-year">карта в ${fmtYear(p.year)}</a>` : ''}</div>`;
  const yl = lb.querySelector('.lb-year');
  if (yl) yl.onclick = (e) => { e.preventDefault(); setYear(p.year); lb.remove(); };
}

function setYear(y) {
  yearInput.value = Math.min(Math.max(y, Number(yearInput.min)), CURRENT_YEAR);
  yearInput.dispatchEvent(new Event('input'));
}

// ---------- Карта ----------
const map = new maplibregl.Map({
  container: 'map',
  style: STYLE,
  bounds: KZ_BOUNDS,
  fitBoundsOptions: { padding: 30 },
  minZoom: 3,
  maxZoom: 14,
  attributionControl: { compact: true },
});
window.__map = map;   // для отладки в консоли
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });

async function loadAll() {
  const [toponyms, sources, regions, country, regionLabels] = await Promise.all([
    fetch('./data/toponyms.json').then((r) => r.json()),
    fetch('./data/sources.json').then((r) => r.json()),
    fetch('./data/kz-regions.geojson').then((r) => r.json()),
    fetch('./data/kz-country.geojson').then((r) => r.json()),
    fetch('./data/kz-regions-labels.geojson').then((r) => r.json()),
  ]);
  state.toponyms = toponyms.sort((a, b) => a.names.kk_cyr.localeCompare(b.names.kk_cyr, 'kk'));
  state.sources = new Map(sources.map((s) => [s.id, s]));
  return { regions, country, regionLabels };
}

// Данные грузятся независимо от подложки: список и карточка появляются сразу.
const dataReady = loadAll().then((geo) => {
  buildChips();
  buildLegend();
  renderList();
  $('#stats').textContent = `${state.toponyms.filter(matches).length} из ${state.toponyms.length} топонимов`;
  let [hid, hyear] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (!hyear && /^-?\d+$/.test(hid)) [hid, hyear] = ['', hid];   // #1925 — только год
  if (hyear && Number(hyear)) setYear(Number(hyear));
  if (hid) select(hid, true);
  renderChronicle();
  return geo;
});

// Если стиль не загрузился за 20 с активной вкладки или упал с ошибкой — запасная подложка.
// В фоновой вкладке браузер останавливает отрисовку, поэтому там таймер не считаем.
let loaded = false;
let styleTimer = null;
function armStyleTimer() {
  clearTimeout(styleTimer);
  if (loaded || usingFallback || document.visibilityState !== 'visible') return;
  styleTimer = setTimeout(() => { if (!loaded && document.visibilityState === 'visible') useFallback('таймаут'); }, 20000);
}
document.addEventListener('visibilitychange', armStyleTimer);
armStyleTimer();
map.on('error', (e) => {
  const msg = String(e?.error?.message ?? '');
  if (!loaded && !usingFallback && (/openfreemap/.test(String(e?.error?.url ?? '')) || /style|Failed to fetch|NetworkError/i.test(msg))) useFallback(msg);
});
function useFallback(reason) {
  if (usingFallback) return;
  usingFallback = true;
  console.warn('Подложка OpenFreeMap недоступна, включаю запасную:', reason);
  map.setStyle(FALLBACK_STYLE);
}

map.on('load', () => { loaded = true; clearTimeout(styleTimer); });
map.on('style.load', () => { addOverlays().catch((err) => console.error(err)); });

async function addOverlays() {
  const { regions, country, regionLabels } = await dataReady;
  if (map.getSource('toponyms')) return;   // уже добавлено для этого стиля

  // Подписи населённых пунктов базовой карты внутри Казахстана скрываем:
  // их место занимают наши топонимы. За границей подписи остаются для контекста.
  const kzGeom = country.features[0].geometry;
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'symbol' && layer['source-layer'] === 'place') {
      const prev = map.getFilter(layer.id);
      map.setFilter(layer.id, prev ? ['all', prev, ['!', ['within', kzGeom]]] : ['!', ['within', kzGeom]]);
    }
  }

  map.addSource('country', { type: 'geojson', data: country });
  map.addSource('regions', { type: 'geojson', data: regions, promoteId: 'iso' });
  map.addSource('region-labels', { type: 'geojson', data: regionLabels });
  map.addSource('toponyms', { type: 'geojson', data: toGeoJSON(), promoteId: 'id' });
  map.addLayer({ id: 'country-fill', type: 'fill', source: 'country', paint: { 'fill-color': '#f2ead9', 'fill-opacity': 0.28 } });
  map.addLayer({
    id: 'regions-fill', type: 'fill', source: 'regions',
    paint: { 'fill-color': '#0f766e', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0] },
  });
  map.addLayer({
    id: 'regions-line', type: 'line', source: 'regions',
    paint: { 'line-color': '#8a7f6a', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1.2], 'line-opacity': 0.7, 'line-dasharray': [3, 2] },
  });
  map.addLayer({ id: 'country-line', type: 'line', source: 'country', paint: { 'line-color': '#5c5241', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 8, 2.2] } });
  map.addLayer({
    id: 'regions-label', type: 'symbol', source: 'region-labels', minzoom: 4.2,
    filter: ['==', ['get', 'kind'], 'region'],
    layout: { 'text-field': ['get', 'name_kk'], 'text-size': 11, 'text-font': font(false), 'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-max-width': 8 },
    paint: { 'text-color': '#8a7f6a', 'text-halo-color': '#f7f4ee', 'text-halo-width': 1.2 },
  });

  map.addLayer({
    id: 'toponyms-halo', type: 'circle', source: 'toponyms',
    paint: { 'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 14, 0], 'circle-color': ['get', 'color'], 'circle-opacity': 0.25 },
  });
  map.addLayer({
    id: 'toponyms', type: 'circle', source: 'toponyms',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['*', ['get', 'size'], 5], 8, ['*', ['get', 'size'], 9]],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#fffdf9',
      'circle-stroke-width': 1.5,
    },
  });
  map.addLayer({
    id: 'toponyms-label', type: 'symbol', source: 'toponyms',
    layout: {
      'text-field': ['get', 'label'], 'text-font': font(true), 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 8, 14],
      'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-allow-overlap': false,
    },
    paint: { 'text-color': '#1d1a15', 'text-halo-color': '#fffdf9', 'text-halo-width': 1.6 },
  });

  let hoverIso = null;
  map.on('mousemove', 'regions-fill', (e) => {
    const iso = e.features?.[0]?.id;
    if (hoverIso && hoverIso !== iso) map.setFeatureState({ source: 'regions', id: hoverIso }, { hover: false });
    if (iso) map.setFeatureState({ source: 'regions', id: iso }, { hover: true });
    hoverIso = iso;
  });
  map.on('mouseleave', 'regions-fill', () => {
    if (hoverIso) map.setFeatureState({ source: 'regions', id: hoverIso }, { hover: false });
    hoverIso = null;
  });

  map.on('mouseenter', 'toponyms', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    const p = e.features[0].properties;
    popup.setLngLat(e.features[0].geometry.coordinates)
      .setHTML(`<b>${esc(p.label)}</b><div class="muted">${esc(TYPE_LABEL[p.type])} · ${esc(p.gloss)}</div>`)
      .addTo(map);
  });
  map.on('mouseleave', 'toponyms', () => { map.getCanvas().style.cursor = ''; popup.remove(); });
  map.on('click', 'toponyms', (e) => select(e.features[0].properties.id, false));

  render();
}

// ---------- UI ----------
function buildChips() {
  const tc = $('#type-chips');
  for (const [g, label] of Object.entries(GROUP_LABEL)) {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = label; b.setAttribute('aria-pressed', 'true');
    b.onclick = () => { toggle(state.groups, g, b); render(); };
    tc.appendChild(b);
  }
  const lc = $('#layer-chips');
  for (const [l, label] of Object.entries(LAYER_LABEL)) {
    const b = document.createElement('button');
    b.className = 'chip'; b.innerHTML = `<span class="dot" style="--c:${LAYER_COLOR[l]}"></span>${label}`;
    b.setAttribute('aria-pressed', 'true');
    b.onclick = () => { toggle(state.layers, l, b); render(); };
    lc.appendChild(b);
  }
}
function toggle(set, key, btn) {
  if (set.has(key)) set.delete(key); else set.add(key);
  btn.setAttribute('aria-pressed', String(set.has(key)));
}

function buildLegend() {
  const used = new Set(state.toponyms.map((t) => t.layer));
  $('#legend').innerHTML = `<div class="title">Языковой пласт</div>` +
    Object.entries(LAYER_LABEL).filter(([l]) => used.has(l))
      .map(([l, label]) => `<div class="row"><span class="dot" style="--c:${LAYER_COLOR[l]}"></span>${label}</div>`).join('');
}

function render() {
  map.getSource('toponyms')?.setData(toGeoJSON());
  renderList();
  $('#stats').textContent = `${state.toponyms.filter(matches).length} из ${state.toponyms.length} топонимов`;
}

function renderList() {
  const list = $('#list');
  const items = state.toponyms.filter(matches);
  if (!items.length) { list.innerHTML = `<div class="empty">Ничего не найдено для этого года и фильтров</div>`; return; }
  list.innerHTML = items.map((t) => {
    const { label, renamed } = labelAt(t, state.year);
    return `<button class="item ${renamed ? 'renamed' : ''}" data-id="${t.id}">
      <span class="dot" style="--c:${LAYER_COLOR[t.layer]}"></span>
      <span><div class="name">${esc(label)}${renamed ? `<small>${esc(t.names.kk_cyr)}</small>` : ''}</div>
      <div class="gloss">${esc(t.best_gloss ?? '')}</div></span>
      <span class="type">${esc(TYPE_LABEL[t.type])}${t.photos ? `<span class="cam" title="${t.photos} фото">📷 ${t.photos}</span>` : ''}</span>
    </button>`;
  }).join('');
  list.querySelectorAll('.item').forEach((b) => (b.onclick = () => select(b.dataset.id, true)));
}

function select(id, fly) {
  const t = state.toponyms.find((x) => x.id === id);
  if (!t) return;
  state.selected = id;
  updateHash();
  map.getSource('toponyms')?.setData(toGeoJSON());
  renderCard(t);
  $('#list').hidden = true;
  $('#chronicle').hidden = true;
  $('#card').hidden = false;
  $('#panel').classList.add('open');
  if (fly) map.flyTo({ center: [t.coords[1], t.coords[0]], zoom: Math.max(map.getZoom(), 6), duration: 900 });
}

function updateHash() {
  const y = state.year < CURRENT_YEAR ? String(state.year) : '';
  const h = state.selected ? '#' + state.selected + (y ? '/' + y : '') : y ? '#' + y : '';
  history.replaceState(null, '', location.pathname + location.search + h);
}

function closeCard() {
  state.selected = null;
  updateHash();
  map.getSource('toponyms')?.setData(toGeoJSON());
  $('#card').hidden = true;
  const active = document.querySelector('.tab[aria-pressed="true"]')?.dataset.tab ?? 'list';
  $('#list').hidden = active !== 'list';
  $('#chronicle').hidden = active !== 'chronicle';
}

function citeSource(id) {
  const s = state.sources.get(id);
  if (!s) return `<li><code>${esc(id)}</code> — нет в sources.yaml</li>`;
  const parts = [s.author?.replace(/\.\s*$/, ''), `<b>${esc(s.title)}</b>`, [s.place, s.publisher].filter(Boolean).join(': '), s.year].filter(Boolean);
  return `<li>${parts.map((p, i) => (i === 1 ? p : esc(p))).join('. ')}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">↗</a>` : ''}${s.note ? `<div>${esc(s.note)}</div>` : ''}</li>`;
}

function renderCard(t) {
  const n = t.names;
  const active = new Set(formsAt(t, state.year).map((f) => f.form + (f.from ?? '')));
  const forms = [...(t.historical_forms ?? [])].sort((a, b) => (a.from ?? a.attested ?? 0) - (b.from ?? b.attested ?? 0));
  const allSources = [...new Set([
    ...(t.sources ?? []),
    ...t.etymology.map((e) => e.source),
    ...forms.map((f) => f.source),
  ].filter(Boolean))];

  $('#card').innerHTML = `
    <button class="back">← К списку</button>
    <h2>${esc(n.kk_cyr)}</h2>
    <p class="alt">${n.kk_lat ? `<b>${esc(n.kk_lat)}</b> · ` : ''}${esc(n.ru)}${n.en && n.en !== n.ru ? ` · ${esc(n.en)}` : ''}</p>
    <div class="badges">
      <span class="badge">${esc(TYPE_LABEL[t.type])}</span>
      <span class="badge layer" style="--c:${LAYER_COLOR[t.layer]}">${esc(LAYER_LABEL[t.layer])}</span>
      ${t.region ? `<span class="badge">${esc(t.region)}</span>` : ''}
      <span class="badge status-${t.status}">${esc(STATUS_LABEL[t.status])}</span>
    </div>

    <h3>Этимология</h3>
    ${t.etymology.map((e) => `
      <div class="ety rel-b-${e.reliability}">
        <div class="gloss">${esc(e.gloss)}</div>
        <div class="meta"><span class="rel rel-${e.reliability}">${REL_LABEL[e.reliability]}</span>${e.language ? `<span>${esc(e.language)}</span>` : ''}${e.source ? `<span>· ${esc(shortCite(e.source))}</span>` : ''}</div>
        ${e.analysis ? `<p>${esc(e.analysis)}</p>` : ''}
        ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
      </div>`).join('')}

    ${forms.length ? `<h3>Исторические формы</h3>
    <ul class="timeline">${forms.map((f) => `
      <li class="tl ${f.official ? 'official' : ''} ${active.has(f.form + (f.from ?? '')) ? 'active' : ''}">
        <div class="years">${f.from != null ? `${fmtYear(f.from)} — ${f.to === undefined ? '' : fmtYear(f.to)}` : ''}${f.attested != null && f.attested !== f.from ? ` (фиксация ${fmtYear(f.attested)})` : ''}${f.attested != null && f.from == null ? fmtYear(f.attested) : ''}${f.official === false ? ' · неофиц.' : ''}</div>
        <div class="form">${esc(f.form)}<small>${[f.language, SCRIPT_LABEL[f.script]].filter(Boolean).map(esc).join(', ')}${f.source ? ` · ${esc(shortCite(f.source))}` : ''}</small></div>
        ${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}
      </li>`).join('')}</ul>` : ''}

    ${TYPE_GROUP[t.type] === 'settlement' || t.commons_categories?.length || t.media?.length ? `<h3>Фотографии по годам</h3><div id="gallery" class="gallery"><div class="gal-empty">Загрузка…</div></div>` : ''}

    ${allSources.length ? `<h3>Источники</h3><ul class="src">${allSources.map(citeSource).join('')}</ul>` : ''}

    ${t.links ? `<h3>Ссылки</h3><div class="links">
      ${t.links.wikidata ? `<a href="https://www.wikidata.org/wiki/${esc(t.links.wikidata)}" target="_blank" rel="noopener">Wikidata ${esc(t.links.wikidata)}</a>` : ''}
      ${t.links.osm ? `<a href="https://www.openstreetmap.org/${esc(t.links.osm)}" target="_blank" rel="noopener">OSM</a>` : ''}
      <a href="https://www.openstreetmap.org/?mlat=${t.coords[0]}&mlon=${t.coords[1]}#map=9/${t.coords[0]}/${t.coords[1]}" target="_blank" rel="noopener">Координаты ${t.coords[0]}, ${t.coords[1]}</a>
    </div>` : ''}
    <h3>Файл</h3><div class="links"><code>data/toponyms/${esc(t.id)}.yaml</code></div>
  `;
  $('#card .back').onclick = closeCard;
  renderGallery(t);
}

function shortCite(id) {
  const s = state.sources.get(id);
  if (!s) return id;
  const a = (s.author ?? s.title).split(/[,(]/)[0].trim();
  return s.year ? `${a} ${s.year}` : a;
}

// ---------- Хроника переименований ----------
function renameEvents() {
  const ev = [];
  for (const t of state.toponyms) {
    const forms = (t.historical_forms ?? []).filter((f) => f.official === true && Number.isInteger(f.from)).sort((a, b) => a.from - b.from);
    for (let i = 1; i < forms.length; i++) {
      const prev = forms[i - 1], cur = forms[i];
      // Переименование — когда прежнее название закончилось в год начала нового.
      // Параллельные формы на разных языках (Жайық и Яик) так не считаются.
      if (prev.form === cur.form || prev.to == null || Math.abs(prev.to - cur.from) > 1) continue;
      ev.push({ year: cur.from, id: t.id, from: prev.form, to: cur.form, why: cur.note ?? '', type: t.type });
    }
  }
  return ev.sort((a, b) => a.year - b.year || a.to.localeCompare(b.to, 'ru'));
}

function renderChronicle() {
  const box = $('#chronicle');
  const ev = renameEvents();
  box.innerHTML = ev.map((e) => `<button class="chron" data-id="${e.id}" data-year="${e.year}">
    <span class="y">${fmtYear(e.year)}</span>
    <span><div class="what"><span>${esc(e.from)}</span><span class="arrow">→</span><b>${esc(e.to)}</b></div>${e.why ? `<div class="why">${esc(e.why)}</div>` : ''}</span>
  </button>`).join('') || '<div class="empty">Нет переименований</div>';
  box.querySelectorAll('.chron').forEach((b) => (b.onclick = () => { setYear(Number(b.dataset.year)); select(b.dataset.id, true); }));
  markChronicle();
}
function markChronicle() {
  $('#chronicle')?.querySelectorAll('.chron').forEach((b) => b.classList.toggle('here', state.year < CURRENT_YEAR && Math.abs(Number(b.dataset.year) - state.year) <= 2));
}

document.querySelectorAll('.tab').forEach((tab) => (tab.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-pressed', String(x === tab)));
  const which = tab.dataset.tab;
  if (state.selected) closeCard();
  $('#list').hidden = which !== 'list';
  $('#chronicle').hidden = which !== 'chronicle';
}));

// ---------- События ----------
$('#search').addEventListener('input', (e) => { state.query = e.target.value.trim(); if (state.selected) closeCard(); render(); });
const yearInput = $('#year');
yearInput.addEventListener('input', () => {
  state.year = Number(yearInput.value);
  $('#year-out').textContent = state.year >= CURRENT_YEAR ? 'сегодня' : fmtYear(state.year);
  updateHash();
  render();
  markChronicle();
  if (state.selected) renderCard(state.toponyms.find((t) => t.id === state.selected));
});
$('#panel-toggle').onclick = () => $('#panel').classList.toggle('open');
