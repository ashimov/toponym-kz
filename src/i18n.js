// Интерфейс на трёх языках. Содержимое карточек (этимологии, примечания) пока только на русском.
export const LANGS = ['kk', 'ru', 'en'];

export const UI = {
  ru: {
    title: 'Топонимы Казахстана', sub: 'Происхождение названий · исторические формы · источники',
    search: 'Поиск: Атырау, Иртыш, Гурьев…', year: 'Год', today: 'сегодня', filters: 'Фильтры', choropleth: 'Раскрасить области по пласту',
    tabList: 'Топонимы', tabChronicle: 'Хроника переименований', tabStats: 'Статистика',
    empty: 'Ничего не найдено для этого года и фильтров', noRenames: 'Нет переименований', of: 'из', toponyms: 'топонимов',
    borders: 'Границы: © OpenStreetMap, ODbL', editor: 'Редактор карточек', legend: 'Языковой пласт',
    back: '← К списку', etymology: 'Этимология', morphemes: 'Морфемы', forms: 'Исторические формы', photos: 'Фотографии по годам', sources: 'Источники', links: 'Ссылки', file: 'Файл',
    unofficial: 'неофиц.', attested: 'фиксация', coords: 'Координаты', photosFrom: 'фото с Викисклада', nearYear: 'ближайшие к {y} выделены', undated: 'Без даты', noDate: 'дата не указана',
    commons: 'Викисклад ↗', mapIn: 'карта в {y}', notFetched: 'Фотографии ещё не выкачаны:', noCats: 'Для этой карточки не указаны категории Викисклада (поле commons_categories).', noOld: 'В указанных категориях Викисклада нет снимков до 1991 года. Добавь снимки вручную через поле media.',
    loading: 'Загрузка…', notInSources: 'нет в sources.yaml', photo: 'фото',
    statLayers: 'Языковые пласты', statTypes: 'Типы объектов', statRel: 'Надёжность принятой гипотезы', statStatus: 'Статус проверки', statMorph: 'Частые морфемы', statRenames: 'Переименований в хронике', statCards: 'Карточек', statPhotos: 'Фотографий', statRegions: 'Областей с карточками',
  },
  kk: {
    title: 'Қазақстан топонимдері', sub: 'Атаулардың шығу тегі · тарихи формалар · дереккөздер',
    search: 'Іздеу: Атырау, Ертіс, Гурьев…', year: 'Жыл', today: 'бүгін', filters: 'Сүзгілер', choropleth: 'Облыстарды қабат бойынша бояу',
    tabList: 'Топонимдер', tabChronicle: 'Атау өзгерту шежіресі', tabStats: 'Статистика',
    empty: 'Бұл жыл мен сүзгілер бойынша ештеңе табылмады', noRenames: 'Атау өзгертулер жоқ', of: '/', toponyms: 'топоним',
    borders: 'Шекаралар: © OpenStreetMap, ODbL', editor: 'Карточка редакторы', legend: 'Тілдік қабат',
    back: '← Тізімге', etymology: 'Этимология', morphemes: 'Морфемалар', forms: 'Тарихи формалар', photos: 'Жылдар бойынша фотосуреттер', sources: 'Дереккөздер', links: 'Сілтемелер', file: 'Файл',
    unofficial: 'бейресми', attested: 'тіркелген', coords: 'Координаттар', photosFrom: 'Уикиқоймадан фото', nearYear: '{y} жылға жақындары белгіленген', undated: 'Күні жоқ', noDate: 'күні көрсетілмеген',
    commons: 'Уикиқойма ↗', mapIn: '{y} жылғы карта', notFetched: 'Фотосуреттер әлі жүктелмеген:', noCats: 'Бұл карточкада Уикиқойма санаттары көрсетілмеген (commons_categories өрісі).', noOld: 'Көрсетілген санаттарда 1991 жылға дейінгі суреттер жоқ. Суреттерді media өрісі арқылы қолмен қосыңыз.',
    loading: 'Жүктелуде…', notInSources: 'sources.yaml ішінде жоқ', photo: 'фото',
    statLayers: 'Тілдік қабаттар', statTypes: 'Нысан түрлері', statRel: 'Қабылданған болжамның сенімділігі', statStatus: 'Тексеру мәртебесі', statMorph: 'Жиі кездесетін морфемалар', statRenames: 'Шежіредегі атау өзгертулер', statCards: 'Карточкалар', statPhotos: 'Фотосуреттер', statRegions: 'Карточкасы бар облыстар',
  },
  en: {
    title: 'Toponyms of Kazakhstan', sub: 'Origins of names · historical forms · sources',
    search: 'Search: Atyrau, Irtysh, Guryev…', year: 'Year', today: 'today', filters: 'Filters', choropleth: 'Color regions by language layer',
    tabList: 'Toponyms', tabChronicle: 'Renaming timeline', tabStats: 'Statistics',
    empty: 'Nothing found for this year and filters', noRenames: 'No renamings', of: 'of', toponyms: 'toponyms',
    borders: 'Boundaries: © OpenStreetMap, ODbL', editor: 'Card editor', legend: 'Language layer',
    back: '← Back to list', etymology: 'Etymology', morphemes: 'Morphemes', forms: 'Historical forms', photos: 'Photographs by year', sources: 'Sources', links: 'Links', file: 'File',
    unofficial: 'unofficial', attested: 'attested', coords: 'Coordinates', photosFrom: 'photos from Wikimedia Commons', nearYear: 'closest to {y} highlighted', undated: 'Undated', noDate: 'date unknown',
    commons: 'Commons ↗', mapIn: 'map in {y}', notFetched: 'Photos not fetched yet:', noCats: 'No Wikimedia Commons categories set for this card (commons_categories field).', noOld: 'No pre-1991 images in the given Commons categories. Add images manually via the media field.',
    loading: 'Loading…', notInSources: 'missing in sources.yaml', photo: 'photos',
    statLayers: 'Language layers', statTypes: 'Feature types', statRel: 'Reliability of accepted hypothesis', statStatus: 'Review status', statMorph: 'Frequent morphemes', statRenames: 'Renamings in timeline', statCards: 'Cards', statPhotos: 'Photographs', statRegions: 'Regions with cards',
  },
};

export const TYPE_LABELS = {
  ru: { city: 'Город', town: 'Посёлок', village: 'Село', river: 'Река', lake: 'Озеро', sea: 'Море', mountain: 'Гора', range: 'Горы', desert: 'Пустыня', steppe: 'Степь', region: 'Регион', site: 'Городище', other: 'Другое' },
  kk: { city: 'Қала', town: 'Кент', village: 'Ауыл', river: 'Өзен', lake: 'Көл', sea: 'Теңіз', mountain: 'Тау', range: 'Таулар', desert: 'Шөл', steppe: 'Дала', region: 'Аймақ', site: 'Қала жұрты', other: 'Басқа' },
  en: { city: 'City', town: 'Town', village: 'Village', river: 'River', lake: 'Lake', sea: 'Sea', mountain: 'Mountain', range: 'Range', desert: 'Desert', steppe: 'Steppe', region: 'Region', site: 'Site', other: 'Other' },
};
export const GROUP_LABELS = {
  ru: { settlement: 'Ойконимы', water: 'Гидронимы', relief: 'Оронимы и регионы' },
  kk: { settlement: 'Ойконимдер', water: 'Гидронимдер', relief: 'Оронимдер мен аймақтар' },
  en: { settlement: 'Settlements', water: 'Hydronyms', relief: 'Oronyms and regions' },
};
export const LAYER_LABELS = {
  ru: { turkic: 'Тюркский', mongolic: 'Монгольский', iranian: 'Иранский', arabic: 'Арабский', russian: 'Русский', soviet: 'Советский', hybrid: 'Смешанный', substrate: 'Субстрат', unknown: 'Не установлен' },
  kk: { turkic: 'Түркі', mongolic: 'Моңғол', iranian: 'Иран', arabic: 'Араб', russian: 'Орыс', soviet: 'Кеңестік', hybrid: 'Аралас', substrate: 'Субстрат', unknown: 'Анықталмаған' },
  en: { turkic: 'Turkic', mongolic: 'Mongolic', iranian: 'Iranian', arabic: 'Arabic', russian: 'Russian', soviet: 'Soviet', hybrid: 'Hybrid', substrate: 'Substrate', unknown: 'Unknown' },
};
export const REL_LABELS = {
  ru: { high: 'Надёжно', medium: 'Вероятно', low: 'Гипотеза', folk: 'Народная', rejected: 'Отвергнута' },
  kk: { high: 'Сенімді', medium: 'Ықтимал', low: 'Болжам', folk: 'Халықтық', rejected: 'Теріске шығарылған' },
  en: { high: 'Reliable', medium: 'Probable', low: 'Hypothesis', folk: 'Folk', rejected: 'Rejected' },
};
export const STATUS_LABELS = {
  ru: { draft: 'Черновик', reviewed: 'Проверено', published: 'Опубликовано' },
  kk: { draft: 'Қаралама', reviewed: 'Тексерілген', published: 'Жарияланған' },
  en: { draft: 'Draft', reviewed: 'Reviewed', published: 'Published' },
};
export const KIND_LABELS = {
  ru: { root: 'корень', suffix: 'аффикс', prefix: 'префикс', word: 'слово', term: 'геогр. термин' },
  kk: { root: 'түбір', suffix: 'жұрнақ', prefix: 'префикс', word: 'сөз', term: 'геогр. термин' },
  en: { root: 'root', suffix: 'suffix', prefix: 'prefix', word: 'word', term: 'geographic term' },
};
