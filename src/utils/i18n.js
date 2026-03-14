import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'korset_lang'

export const dictionaries = {
  ru: {
    common: {
      appName: 'Körset',
      continue: 'Продолжить',
      skip: 'Пропустить',
      save: 'Сохранить',
      cancel: 'Отмена',
      back: 'Назад',
      loading: 'Загрузка...',
      notFound: 'Не найдено',
      scan: 'Скан',
      ai: 'ИИ',
      home: 'Главная',
      catalog: 'Каталог',
      profile: 'Профиль',
      favorites: 'Избранное',
      language: 'Язык',
      russian: 'Русский',
      kazakh: 'Қазақша',
      yes: 'Да',
      no: 'Нет',
      unknown: 'Неизвестно',
    },
    nav: { home: 'Главная', catalog: 'Каталог', scan: 'Скан', ai: 'ИИ', profile: 'Профиль' },
    onboarding: {
      title1: 'Этот товар тебе',
      title2: 'подходит?',
      subtitle: 'Выбери язык и скажи, что важно — Körset будет проверять каждый товар за тебя.',
      chooseLang: 'Выберите язык',
      choosePrefs: 'Что важно для вас',
      skipSetup: 'Продолжить без настройки',
      start: 'Начать сканировать →',
      skipSmall: 'Пропустить',
      opts: {
        halal: ['Халал', 'Только разрешённые продукты'],
        allergy_milk: ['Без молока', 'Аллергия или непереносимость'],
        allergy_gluten: ['Без глютена', 'Целиакия или диета'],
        allergy_nuts: ['Без орехов', 'Аллергия на орехи / арахис'],
        sugar_free: ['Без сахара', 'Диабет, диета или ЗОЖ'],
        vegan: ['Веган', 'Без мяса, молока и яиц'],
      },
    },
    home: {
      welcome: 'Добро пожаловать',
      subtitle: 'Сканируй товары и узнай — подходят ли они именно тебе',
      scanTitle: 'Сканировать штрихкод',
      scanSub: 'Наведи на любой товар в магазине',
      catalogTitle: 'Каталог',
      catalogSub: 'Все товары',
      aiTitle: 'AI помощник',
      aiSub: 'Спроси что угодно',
      how: 'Как это работает',
      steps: [
        'Сканируй штрихкод любого товара в магазине',
        'Körset найдёт состав, аллергены и КБЖУ',
        'AI мгновенно проверит — подходит ли товар тебе',
      ],
    },
    profile: {
      hero: 'Настройте профиль — AI мгновенно покажет подходит ли товар вам',
      religion: 'Религиозные требования',
      halalTitle: 'Только Халал',
      halalSub: 'Исключит товары без маркировки',
      diet: 'Диета и предпочтения',
      dietSub: 'Нажмите всё что подходит',
      allergens: 'Мои аллергены',
      allergensSub: 'Товары с этим составом будут помечены ⚠️',
      customAllergen: 'Добавить свой аллерген',
      customPlaceholder: 'Например: кунжут',
      priority: 'Приоритет подбора',
      prioritySub: 'Что важнее при поиске альтернатив',
      summary: 'Ваш профиль',
      summaryActive: 'Активных параметров',
      langTitle: 'Язык интерфейса',
      options: {
        sugar_free: 'Без сахара', dairy_free: 'Без молочки', gluten_free: 'Без глютена', vegan: 'Веган', vegetarian: 'Вегетарианец', keto: 'Кето', low_calorie: 'Меньше калорий',
        milk: 'Молоко', gluten: 'Глютен', nuts: 'Орехи', peanuts: 'Арахис', soy: 'Соя', eggs: 'Яйца', fish: 'Рыба', shellfish: 'Моллюски',
        price: ['Цена', 'Самый дешёвый'], balanced: ['Баланс', 'Цена + качество'], quality: ['Качество', 'Лучший состав'],
      },
    },
    catalog: {
      title: 'Каталог',
      count: 'товаров в базе',
      cats: { all: 'Все', fit: 'Для вас', grocery: 'Продукты', electronics: 'Электроника', diy: 'Стройка' },
      sorts: { fit: 'Подходящие мне', cheap: 'Сначала дешевле', pricey: 'Сначала дороже', rating: 'По рейтингу' },
      search: 'Поиск товара...',
      empty: 'Ничего не найдено',
    },
    scan: {
      searching: 'Ищем товар...',
      checkingDb: 'Проверяем базу данных',
      cameraNotFound: 'Камера не обнаружена',
      close: '← Назад',
      torchError: '⚠️ Фонарик недоступен в этом браузере',
      aim: 'Наведите на штрихкод товара',
      launching: 'Запуск камеры...',
      formats: 'Поддерживаются все форматы штрихкодов',
      headerTitle: 'Сканирование',
      helper: 'Отсканируй штрихкод и сразу узнай, подходит ли товар тебе',
      start: 'Запустить сканер',
      million: '3+ млн товаров',
      live: 'LIVE база данных',
      notFoundTitle: 'Товар не найден',
      notFoundSub: 'Попробуйте отсканировать другой штрихкод',
      scanAgain: 'Сканировать ещё раз',
    },
    aiGeneral: {
      title: 'Körset AI',
      online: 'Помощник в магазине',
      intro: 'Привет! Спроси меня про любой товар, рецепт или что найти в магазине 🛒',
      placeholder: 'Спросить про товары...',
      chips: ['Есть ли халал продукты?', 'Что без лактозы?', 'Где найти орехи?', 'Что для рататуя?'],
      error: 'Что-то пошло не так, попробуй ещё раз.',
    },
  },
  kz: {
    common: {
      appName: 'Körset', continue: 'Жалғастыру', skip: 'Өткізіп жіберу', save: 'Сақтау', cancel: 'Бас тарту', back: 'Артқа', loading: 'Жүктелуде...', notFound: 'Табылмады', scan: 'Скан', ai: 'ЖИ', home: 'Басты', catalog: 'Каталог', profile: 'Профиль', favorites: 'Таңдаулылар', language: 'Тіл', russian: 'Русский', kazakh: 'Қазақша', yes: 'Иә', no: 'Жоқ', unknown: 'Белгісіз'
    },
    nav: { home: 'Басты', catalog: 'Каталог', scan: 'Скан', ai: 'ЖИ', profile: 'Профиль' },
    onboarding: {
      title1: 'Бұл тауар саған', title2: 'сәйкес пе?', subtitle: 'Тілді таңда да, не маңызды екенін белгіле — Körset әр тауарды сен үшін тексереді.', chooseLang: 'Тілді таңдаңыз', choosePrefs: 'Сіз үшін не маңызды', skipSetup: 'Баптаусыз жалғастыру', start: 'Сканерлеуді бастау →', skipSmall: 'Өткізіп жіберу',
      opts: { halal: ['Халал', 'Тек рұқсат етілген өнімдер'], allergy_milk: ['Сүтсіз', 'Аллергия немесе көтере алмау'], allergy_gluten: ['Глютенсіз', 'Целиакия немесе диета'], allergy_nuts: ['Жаңғақсыз', 'Жаңғақ / жержаңғақ аллергиясы'], sugar_free: ['Қантсыз', 'Диабет, диета немесе салауатты өмір'], vegan: ['Веган', 'Етсіз, сүтсіз және жұмыртқасыз'] },
    },
    home: {
      welcome: 'Қош келдіңіз', subtitle: 'Тауарды сканерлеп, оның сізге сай келетінін біліңіз', scanTitle: 'Штрихкодты сканерлеу', scanSub: 'Дүкендегі кез келген тауарға бағыттаңыз', catalogTitle: 'Каталог', catalogSub: 'Барлық тауарлар', aiTitle: 'AI көмекші', aiSub: 'Кез келген сұрақ қойыңыз', how: 'Бұл қалай жұмыс істейді', steps: ['Дүкендегі кез келген тауардың штрихкодын сканерлеңіз', 'Körset құрамын, аллергендерін және КБЖУ-ны табады', 'AI тауардың сізге сай келетінін бірден тексереді'],
    },
    profile: {
      hero: 'Профильді баптаңыз — AI тауардың сізге сай келетінін бірден көрсетеді', religion: 'Діни талаптар', halalTitle: 'Тек Халал', halalSub: 'Белгісі жоқ тауарларды алып тастайды', diet: 'Диета және таңдаулар', dietSub: 'Сәйкес келетіндерінің бәрін белгілеңіз', allergens: 'Менің аллергендерім', allergensSub: 'Осы құрамдағы тауарлар ⚠️ деп белгіленеді', customAllergen: 'Өз аллергеніңізді қосу', customPlaceholder: 'Мысалы: күнжіт', priority: 'Ұсыныс басымдығы', prioritySub: 'Баламаларды іздегенде не маңызды', summary: 'Сіздің профиль', summaryActive: 'Белсенді параметрлер', langTitle: 'Интерфейс тілі',
      options: { sugar_free: 'Қантсыз', dairy_free: 'Сүтсіз', gluten_free: 'Глютенсіз', vegan: 'Веган', vegetarian: 'Вегетариан', keto: 'Кето', low_calorie: 'Калориясы аз', milk: 'Сүт', gluten: 'Глютен', nuts: 'Жаңғақ', peanuts: 'Жержаңғақ', soy: 'Соя', eggs: 'Жұмыртқа', fish: 'Балық', shellfish: 'Теңіз өнімдері', price: ['Баға', 'Ең арзан'], balanced: ['Теңгерім', 'Баға + сапа'], quality: ['Сапа', 'Ең жақсы құрам'] },
    },
    catalog: { title: 'Каталог', count: 'тауар базада', cats: { all: 'Барлығы', fit: 'Сізге сай', grocery: 'Өнімдер', electronics: 'Электроника', diy: 'Құрылыс' }, sorts: { fit: 'Маған сайлары', cheap: 'Алдымен арзаны', pricey: 'Алдымен қымбаты', rating: 'Рейтинг бойынша' }, search: 'Тауарды іздеу...', empty: 'Ештеңе табылмады' },
    scan: { searching: 'Тауар ізделуде...', checkingDb: 'Дерекқор тексерілуде', cameraNotFound: 'Камера табылмады', close: '← Артқа', torchError: '⚠️ Бұл браузерде шам қолжетімсіз', aim: 'Штрихкодқа бағыттаңыз', launching: 'Камера іске қосылуда...', formats: 'Барлық штрихкод форматтары қолдау табады', headerTitle: 'Сканерлеу', helper: 'Штрихкодты сканерлеп, тауардың сізге сай келетінін бірден біліңіз', start: 'Сканерді іске қосу', million: '3+ млн тауар', live: 'LIVE дерекқоры', notFoundTitle: 'Тауар табылмады', notFoundSub: 'Басқа штрихкодты сканерлеп көріңіз', scanAgain: 'Қайта сканерлеу' },
    aiGeneral: { title: 'Körset AI', online: 'Дүкендегі көмекші', intro: 'Сәлем! Маған кез келген тауар, рецепт немесе дүкеннен не табуға болатыны туралы сұрақ қойыңыз 🛒', placeholder: 'Тауарлар туралы сұраңыз...', chips: ['Халал өнімдер бар ма?', 'Лактозасыз не бар?', 'Жаңғақ қай жерде?', 'Рататуйға не керек?'], error: 'Бір нәрсе дұрыс болмады, тағы бір рет көріңіз.' },
  }
}

export function getLang() { return localStorage.getItem(STORAGE_KEY) || 'ru' }
export function setLang(lang) { localStorage.setItem(STORAGE_KEY, lang); window.dispatchEvent(new CustomEvent('korset-lang-change', { detail: lang })) }

function deepGet(obj, path) { return path.split('.').reduce((acc, part) => acc?.[part], obj) }

export function useI18n() {
  const [lang, setLangState] = useState(getLang())
  useEffect(() => {
    const h = (e) => setLangState(e.detail || getLang())
    window.addEventListener('korset-lang-change', h)
    return () => window.removeEventListener('korset-lang-change', h)
  }, [])
  const dict = dictionaries[lang] || dictionaries.ru
  const t = useMemo(() => (key, fallback) => deepGet(dict, key) ?? fallback ?? key, [dict])
  return { lang, setLang, t }
}

export function formatHomeDate(lang) {
  const locale = lang === 'kz' ? 'kk-KZ' : 'ru-RU'
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}
