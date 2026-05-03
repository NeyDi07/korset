const rules = {
  ru: new Intl.PluralRules('ru'),
  kk: new Intl.PluralRules('kk'),
}

export function selectPluralSuffix(lang, n) {
  const rule = lang === 'kz' ? rules.kk : rules.ru
  return rule.select(n)
}
