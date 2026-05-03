const PACKAGING_ABBREV = [
  'КНВРТ',
  'ТБА',
  'Т/Б',
  'Ж/Б',
  'ЖБ',
  'П/Б',
  'ПБ',
  'ПЭТ',
  'ПЕТ',
  'П/Э',
  'ТБ',
  'С/Б',
  'СТ/Б',
]

const PACKAGING_ABBREV_WORD = ['СТБ', 'СТ\\.Б', 'ст\\.б']

const PACKAGING_ABBREV_RE = new RegExp(
  `(?:[\\s(/]|^)(?:${PACKAGING_ABBREV.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:[\\s).,]|$|\\d)`,
  'gi'
)

const PACKAGING_ABBREV_WORD_RE = new RegExp(
  `(?:[\\s(/]|^)(?:${PACKAGING_ABBREV_WORD.join('|')})(?:[\\s).,]|$|\\d)`,
  'gi'
)

const TAIL_PACKAGING_WORDS = [
  'стеклянная',
  'стекло',
  'пэт-бутылка',
  'бут\\.пэт',
  'бут\\.пет',
  'дой-пак',
  'дойпак',
  'флоу-пак',
  'flow-pack',
  'п/пакете',
  'п/пакет',
  'пакет',
  'пачка',
  'ведёрко',
  'туба',
  'пл/б',
  'жестебанка',
  'жесть',
  'консервная',
  'тетрапак',
  'тетра-пак',
  'тетра брик',
  'тетра',
  'pet',
]

const TAIL_PACKAGING_WORDS_RE = new RegExp(`\\s+(?:${TAIL_PACKAGING_WORDS.join('|')})\\s*$`, 'i')

const WEIGHT_TOKEN_RE = /(\d+[.,]?\d*)\s*(гр|г|кг|л|мл|шт)(?![а-яёa-z])/gi

const WEIGHT_UNIT_MAP = { гр: 'г', г: 'г', кг: 'кг', л: 'л', мл: 'мл', шт: 'шт' }

const FAT_PERCENT_RE = /(\d{1,2}[,.]?\d?)\s*%/g

const DOUBLE_SPACE_RE = / {2,}/g

function stripPackagingAbbrevs(name) {
  let result = name.replace(PACKAGING_ABBREV_RE, ' ')
  result = result.replace(PACKAGING_ABBREV_WORD_RE, ' ')
  return result.replace(DOUBLE_SPACE_RE, ' ').trim()
}

function stripTailPackagingWords(name) {
  return name.replace(TAIL_PACKAGING_WORDS_RE, '').replace(DOUBLE_SPACE_RE, ' ').trim()
}

function deduplicateWeight(name) {
  const tokens = []
  const re = /(\d+[.,]?\d*)\s*(гр|г|кг|л|мл|шт)(?![а-яёa-z])/gi
  let m
  while ((m = re.exec(name)) !== null) {
    tokens.push({
      num: parseFloat(m[1].replace(',', '.')),
      full: m[0],
      index: m.index,
      len: m[0].length,
    })
  }
  if (tokens.length < 2) return name
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].num === tokens[0].num) {
      return (name.slice(0, tokens[i].index) + name.slice(tokens[i].index + tokens[i].len))
        .replace(DOUBLE_SPACE_RE, ' ')
        .trim()
    }
  }
  return name
}

function formatFatPercent(name) {
  return name.replace(FAT_PERCENT_RE, (_, num) => `${num.replace('.', ',')} %`)
}

function formatWeight(name) {
  return name.replace(WEIGHT_TOKEN_RE, (_, num, unit) => {
    const norm = WEIGHT_UNIT_MAP[unit.toLowerCase()] || unit.toLowerCase()
    const fixedNum = num.replace('.', ',')
    return `${fixedNum} ${norm}`
  })
}

function isAllCaps(name) {
  return /^[^a-zа-яё]*$/.test(name) && /[a-zA-Zа-яА-ЯёЁ]/.test(name)
}

function applySentenceCase(name, brand) {
  if (!name) return name

  let result = name.toLowerCase()

  const words = result.split(/(\s+)/)
  let firstCyrillicCapped = false
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (/^\s+$/.test(w)) continue
    if (/^\d/.test(w)) {
      const afterDigit = w.replace(/^(\d+[.,]?\d*\s*)(.*)/, '$2')
      if (afterDigit && !firstCyrillicCapped) {
        words[i] =
          w.slice(0, w.length - afterDigit.length) +
          afterDigit[0].toUpperCase() +
          afterDigit.slice(1)
        if (/[а-яё]/.test(afterDigit[0])) firstCyrillicCapped = true
      }
      continue
    }
    if (/^[a-z]/.test(w) && w.length >= 2) {
      words[i] = w[0].toUpperCase() + w.slice(1)
      continue
    }
    if (/^[а-яё]/.test(w)) {
      if (!firstCyrillicCapped) {
        words[i] = w[0].toUpperCase() + w.slice(1)
        firstCyrillicCapped = true
      }
    }
  }
  result = words.join('')

  if (brand && brand.trim()) {
    const brandEsc = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(brandEsc, 'gi'), brand.trim())
  }

  return result
}

function trimLongName(name, maxLen = 80) {
  if (!name || name.length <= maxLen) return name
  let cut = name.lastIndexOf(' ', maxLen)
  if (cut < maxLen * 0.5) cut = maxLen
  return name.slice(0, cut).trim()
}

export function normalizeName(name, { brand } = {}) {
  if (!name || typeof name !== 'string') return name

  const wasAllCaps = isAllCaps(name)

  let result = name

  result = stripPackagingAbbrevs(result)
  result = stripTailPackagingWords(result)
  result = deduplicateWeight(result)

  if (wasAllCaps) {
    result = applySentenceCase(result, brand)
  }

  result = formatFatPercent(result)
  result = formatWeight(result)
  result = result.replace(DOUBLE_SPACE_RE, ' ').trim()
  result = trimLongName(result)

  return result
}

export function _test() {
  const cases = [
    {
      in: 'ПЕЧЕНЬЕ G&G С ПРОСЛОЙКОЙ ШОКОЛАДА 500ГР',
      brand: 'G&G',
      expect: 'Печенье G&G с прослойкой шоколада 500 г',
    },
    {
      in: 'КЕФИР FRESH HOUSE 2,5% Ж/Б 300ГР',
      brand: 'Fresh House',
      expect: 'Кефир Fresh House 2,5 % 300 г',
    },
    { in: 'МОЛОКО 3,2% ПЭТ 1Л', brand: null, expect: 'Молоко 3,2 % 1 л' },
    { in: '7 DAYS КРОССАНТ', brand: '7 DAYS', expect: '7 DAYS Кроссант' },
    {
      in: 'ШОКОЛАД ALPEN GOLD МОЛОЧНЫЙ 85ГР',
      brand: 'Alpen Gold',
      expect: 'Шоколад Alpen Gold молочный 85 г',
    },
    {
      in: 'МОЛОКО ПАСТЕРИЗОВАННОЕ 3,2% СТБ 930ГР',
      brand: null,
      expect: 'Молоко пастеризованное 3,2 % 930 г',
    },
    { in: 'СГУЩЕНКА ТБА 380ГР', brand: null, expect: 'Сгущенка 380 г' },
    { in: 'ПЕЧЕНЬЕ КНВРТ 200ГР', brand: null, expect: 'Печенье 200 г' },
    { in: 'МАСЛО СЛИВОЧНОЕ 82,5% П/Б 180ГР', brand: null, expect: 'Масло сливочное 82,5 % 180 г' },
    { in: 'КОФЕ РАСТВОРИМЫЙ Ж/Б 95ГР', brand: null, expect: 'Кофе растворимый 95 г' },
    { in: 'Йогурт клубничный 2% 150гр', brand: null, expect: 'Йогурт клубничный 2 % 150 г' },
    { in: 'Сок Добрый яблочный 1л', brand: 'Добрый', expect: 'Сок Добрый яблочный 1 л' },
    {
      in: 'Молоко Простоквашино ультрапастеризованное 2.5% ПЭТ 930г',
      brand: 'Простоквашино',
      expect: 'Молоко Простоквашино ультрапастеризованное 2,5 % 930 г',
    },
    {
      in: 'НАПИТОК COCA-COLA ZERO 0.5Л',
      brand: 'Coca-Cola',
      expect: 'Напиток Coca-Cola Zero 0,5 л',
    },
    {
      in: 'СЫР ХОХЛАНД ПЛАВЛЕНЫЙ ВЕРШКОВИЙ 140ГР ТБ',
      brand: 'Hohland',
      expect: 'Сыр хохланд плавленый вершковий 140 г',
    },
    { in: 'КЕФИР 2,5% 300ГР', brand: null, expect: 'Кефир 2,5 % 300 г' },
    {
      in: 'Шоколад Ritter Sport мини 100г',
      brand: 'Ritter Sport',
      expect: 'Шоколад Ritter Sport мини 100 г',
    },
    { in: 'E.RICH СОУС СЫРНЫЙ 250ГР', brand: 'E.RICH', expect: 'E.RICH Соус сырный 250 г' },
  ]

  let pass = 0,
    fail = 0
  for (const c of cases) {
    const got = normalizeName(c.in, { brand: c.brand })
    if (got === c.expect) {
      pass++
    } else {
      fail++
      console.log(`FAIL: "${c.in}" brand=${c.brand}\n  got:    "${got}"\n  expect: "${c.expect}"`)
    }
  }
  console.log(`\n${pass}/${pass + fail} tests passed`)
  return fail === 0
}
