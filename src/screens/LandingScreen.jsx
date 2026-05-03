import { useMemo } from 'react'
import './LandingScreen.css'
import { useI18n } from '../i18n/index.js'
import { useTheme } from '../utils/theme.js'

function collectStrArr(t, exists, prefix) {
  const arr = []
  let i = 0
  while (exists(`${prefix}.${i}`)) {
    arr.push(t(`${prefix}.${i}`))
    i++
  }
  return arr
}

function collectObjArr(t, exists, prefix, fields) {
  const arr = []
  let i = 0
  while (exists(`${prefix}.${i}.${fields[0]}`)) {
    const obj = {}
    for (const f of fields) obj[f] = t(`${prefix}.${i}.${f}`)
    arr.push(obj)
    i++
  }
  return arr
}

function Icon({ name }) {
  return (
    <span className="material-symbols-outlined landing-icon" aria-hidden="true">
      {name}
    </span>
  )
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="landing-section-title">
      {eyebrow && <div className="landing-eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  )
}

function RetailDashboardPreview({ dashboard }) {
  return (
    <aside
      className="landing-retail-dashboard"
      data-testid="landing-retail-dashboard"
      aria-label={dashboard.aria}
    >
      <div className="landing-retail-dashboard__top">
        <div>
          <span>{dashboard.kicker}</span>
          <h3>{dashboard.title}</h3>
        </div>
        <div className="landing-retail-dashboard__status">
          <span />
          {dashboard.status}
        </div>
      </div>

      <div className="landing-retail-dashboard__metrics">
        {dashboard.metrics.map((metric) => (
          <div key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>

      <div className="landing-retail-dashboard__middle">
        <div className="landing-retail-dashboard__chart">
          <div className="landing-retail-dashboard__chart-head">
            <span>{dashboard.chartTitle}</span>
            <strong>{dashboard.chartValue}</strong>
          </div>
          <div className="landing-retail-dashboard__bars" aria-hidden="true">
            {dashboard.bars.map((bar, index) => (
              <i key={`${bar}-${index}`} style={{ '--bar-height': `${bar}%` }} />
            ))}
          </div>
        </div>

        <div className="landing-retail-dashboard__qr">
          <div aria-hidden="true">
            {Array.from({ length: 16 }).map((_, index) => (
              <i key={index} />
            ))}
          </div>
          <span>{dashboard.qr}</span>
        </div>
      </div>

      <div className="landing-retail-dashboard__feed">
        {dashboard.feed.map((item) => (
          <div key={item.title}>
            <Icon name={item.icon} />
            <span>{item.title}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default function LandingScreen() {
  const { t, exists } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const d = useMemo(
    () => ({
      nav: { retail: t('landing.nav.retail'), themeToggle: t('landing.nav.themeToggle') },
      hero: {
        chipsLabel: t('landing.hero.chipsLabel'),
        chips: collectStrArr(t, exists, 'landing.hero.chips'),
        title: t('landing.hero.title'),
        text: t('landing.hero.text'),
        primary: t('landing.hero.primary'),
        secondary: t('landing.hero.secondary'),
      },
      demo: {
        aria: t('landing.demo.aria'),
        phoneTitle: t('landing.demo.phoneTitle'),
        productBrand: t('landing.demo.productBrand'),
        productName: t('landing.demo.productName'),
        productMeta: t('landing.demo.productMeta'),
        status: t('landing.demo.status'),
        result: t('landing.demo.result'),
        chips: collectStrArr(t, exists, 'landing.demo.chips'),
        orbitTop: t('landing.demo.orbitTop'),
        orbitBottom: t('landing.demo.orbitBottom'),
      },
      how: {
        eyebrow: t('landing.how.eyebrow'),
        title: t('landing.how.title'),
        text: t('landing.how.text'),
        steps: collectObjArr(t, exists, 'landing.how.steps', ['icon', 'title', 'text']),
      },
      fit: {
        eyebrow: t('landing.fit.eyebrow'),
        title: t('landing.fit.title'),
        text: t('landing.fit.text'),
        cards: collectObjArr(t, exists, 'landing.fit.cards', ['tone', 'icon', 'title', 'text']),
        disclaimer: t('landing.fit.disclaimer'),
      },
      audience: {
        eyebrow: t('landing.audience.eyebrow'),
        title: t('landing.audience.title'),
        text: t('landing.audience.text'),
        cards: collectObjArr(t, exists, 'landing.audience.cards', ['icon', 'title', 'text']),
      },
      compare: {
        beforeLabel: t('landing.compare.beforeLabel'),
        beforeTitle: t('landing.compare.beforeTitle'),
        beforeText: t('landing.compare.beforeText'),
        afterLabel: t('landing.compare.afterLabel'),
        afterTitle: t('landing.compare.afterTitle'),
        afterText: t('landing.compare.afterText'),
      },
      features: {
        eyebrow: t('landing.features.eyebrow'),
        title: t('landing.features.title'),
        text: t('landing.features.text'),
        cards: collectObjArr(t, exists, 'landing.features.cards', ['icon', 'title', 'text']),
      },
      stats: collectObjArr(t, exists, 'landing.stats', ['value', 'label']),
      retail: {
        eyebrow: t('landing.retail.eyebrow'),
        title: t('landing.retail.title'),
        text: t('landing.retail.text'),
        cta: t('landing.retail.cta'),
        dashboard: {
          aria: t('landing.retail.dashboard.aria'),
          kicker: t('landing.retail.dashboard.kicker'),
          title: t('landing.retail.dashboard.title'),
          status: t('landing.retail.dashboard.status'),
          chartTitle: t('landing.retail.dashboard.chartTitle'),
          chartValue: t('landing.retail.dashboard.chartValue'),
          qr: t('landing.retail.dashboard.qr'),
          metrics: collectObjArr(t, exists, 'landing.retail.dashboard.metrics', ['value', 'label']),
          bars: [38, 54, 46, 72, 63, 88, 78],
          feed: collectObjArr(t, exists, 'landing.retail.dashboard.feed', [
            'icon',
            'title',
            'value',
          ]),
        },
        scenario: collectObjArr(t, exists, 'landing.retail.scenario', ['icon', 'title', 'text']),
      },
      pricing: {
        eyebrow: t('landing.pricing.eyebrow'),
        title: t('landing.pricing.title'),
        text: t('landing.pricing.text'),
        early: {
          badge: t('landing.pricing.early.badge'),
          title: t('landing.pricing.early.title'),
          price: t('landing.pricing.early.price'),
          text: t('landing.pricing.early.text'),
        },
        soon: collectObjArr(t, exists, 'landing.pricing.soon', ['badge', 'title', 'text']),
      },
      connect: {
        eyebrow: t('landing.connect.eyebrow'),
        title: t('landing.connect.title'),
        text: t('landing.connect.text'),
        steps: collectStrArr(t, exists, 'landing.connect.steps'),
      },
      faq: {
        eyebrow: t('landing.faq.eyebrow'),
        title: t('landing.faq.title'),
        items: collectObjArr(t, exists, 'landing.faq.items', ['q', 'a']),
      },
      footer: {
        title: t('landing.footer.title'),
        text: t('landing.footer.text'),
        made: t('landing.footer.made'),
        copyright: t('landing.footer.copyright'),
        groups: (() => {
          const groups = collectObjArr(t, exists, 'landing.footer.groups', ['title'])
          return groups.map((g, i) => ({
            ...g,
            links: collectObjArr(t, exists, `landing.footer.groups.${i}.links`, ['label', 'href']),
          }))
        })(),
      },
    }),
    [t, exists]
  )

  return (
    <main className="landing-page-v2">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="Körset">
          <img src="/icon_logo.svg" alt="" />
          <span>Körset</span>
        </a>
        <div className="landing-header__actions">
          <a className="landing-header__retail" href="#retail">
            {d.nav.retail}
          </a>
          <button
            className="landing-theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={d.nav.themeToggle}
            title={d.nav.themeToggle}
          >
            <span>{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
          </button>
        </div>
      </header>

      <section className="landing-hero" data-testid="landing-consumer">
        <div className="landing-hero__copy">
          <div className="landing-pills" aria-label={d.hero.chipsLabel}>
            {d.hero.chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <h1>{d.hero.title}</h1>
          <p>{d.hero.text}</p>
          <div className="landing-hero__actions">
            <a className="landing-btn landing-btn--primary" href="/stores">
              {d.hero.primary}
              <Icon name="arrow_forward" />
            </a>
            <a className="landing-btn landing-btn--ghost" href="#how">
              {d.hero.secondary}
            </a>
          </div>
        </div>

        <div className="landing-hero__visual" aria-label={d.demo.aria}>
          <div className="landing-kinetic-glass" aria-hidden="true">
            <span />
          </div>
          <div className="landing-orbit-card landing-orbit-card--top">
            <Icon name="verified" />
            <span>{d.demo.orbitTop}</span>
          </div>
          <div className="landing-scan-stage">
            <div className="landing-shelf-product" aria-hidden="true">
              <span className="landing-product-pack__brand">{d.demo.productBrand}</span>
              <span className="landing-product-pack__name">{d.demo.productName}</span>
              <span className="landing-product-pack__meta">{d.demo.productMeta}</span>
              <div className="landing-shelf-product__barcode">
                {Array.from({ length: 14 }).map((_, index) => (
                  <i key={index} />
                ))}
              </div>
            </div>
            <div className="landing-hand" aria-hidden="true">
              <span className="landing-hand__finger landing-hand__finger--one" />
              <span className="landing-hand__finger landing-hand__finger--two" />
              <span className="landing-hand__finger landing-hand__finger--three" />
              <span className="landing-hand__thumb" />
              <span className="landing-hand__palm" />
            </div>
            <div className="landing-phone">
              <div className="landing-phone__top">
                <span>{d.demo.phoneTitle}</span>
                <Icon name="qr_code_scanner" />
              </div>
              <div className="landing-scan-window">
                <div className="landing-product-pack">
                  <span className="landing-product-pack__brand">{d.demo.productBrand}</span>
                  <span className="landing-product-pack__name">{d.demo.productName}</span>
                  <span className="landing-product-pack__meta">{d.demo.productMeta}</span>
                </div>
                <div className="landing-barcode" aria-hidden="true">
                  {Array.from({ length: 18 }).map((_, index) => (
                    <i key={index} />
                  ))}
                </div>
                <div className="landing-scan-line" />
              </div>
              <div className="landing-result-card">
                <div>
                  <span className="landing-status-dot" />
                  <strong>{d.demo.status}</strong>
                </div>
                <p>{d.demo.result}</p>
                <div className="landing-result-card__chips">
                  {d.demo.chips.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="landing-orbit-card landing-orbit-card--bottom">
            <Icon name="auto_awesome" />
            <span>{d.demo.orbitBottom}</span>
          </div>
        </div>
      </section>

      <section className="landing-section" id="how">
        <SectionTitle eyebrow={d.how.eyebrow} title={d.how.title} text={d.how.text} />
        <div className="landing-steps">
          {d.how.steps.map((step, index) => (
            <article className="landing-step" key={step.title}>
              <span className="landing-step__number">0{index + 1}</span>
              <Icon name={step.icon} />
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-fit-demo">
        <SectionTitle eyebrow={d.fit.eyebrow} title={d.fit.title} text={d.fit.text} />
        <div className="landing-fit-grid">
          {d.fit.cards.map((card) => (
            <article className={`landing-fit-card landing-fit-card--${card.tone}`} key={card.title}>
              <div>
                <Icon name={card.icon} />
                <h3>{card.title}</h3>
              </div>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
        <div className="landing-disclaimer">{d.fit.disclaimer}</div>
      </section>

      <section className="landing-section">
        <SectionTitle
          eyebrow={d.audience.eyebrow}
          title={d.audience.title}
          text={d.audience.text}
        />
        <div className="landing-audience-grid">
          {d.audience.cards.map((card) => (
            <article className="landing-mini-card" key={card.title}>
              <Icon name={card.icon} />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-compare-section">
        <div className="landing-compare">
          <div>
            <span>{d.compare.beforeLabel}</span>
            <h3>{d.compare.beforeTitle}</h3>
            <p>{d.compare.beforeText}</p>
          </div>
          <div>
            <span>{d.compare.afterLabel}</span>
            <h3>{d.compare.afterTitle}</h3>
            <p>{d.compare.afterText}</p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <SectionTitle
          eyebrow={d.features.eyebrow}
          title={d.features.title}
          text={d.features.text}
        />
        <div className="landing-feature-grid">
          {d.features.cards.map((card) => (
            <article className="landing-mini-card" key={card.title}>
              <Icon name={card.icon} />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-stats">
        {d.stats.map((stat) => (
          <div className="landing-stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="landing-retail" id="retail" data-testid="landing-retail">
        <div className="landing-retail__intro">
          <div className="landing-eyebrow">{d.retail.eyebrow}</div>
          <h2>{d.retail.title}</h2>
          <p>{d.retail.text}</p>
          <a className="landing-btn landing-btn--ghost landing-retail__cta" href="/retail">
            {d.retail.cta}
            <Icon name="arrow_forward" />
          </a>
        </div>
        <RetailDashboardPreview dashboard={d.retail.dashboard} />
        <div className="landing-retail__scenario">
          {d.retail.scenario.map((item) => (
            <article key={item.title}>
              <Icon name={item.icon} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-pricing" data-testid="landing-pricing">
        <SectionTitle eyebrow={d.pricing.eyebrow} title={d.pricing.title} text={d.pricing.text} />
        <div className="landing-pricing-grid">
          <article className="landing-price-card landing-price-card--active">
            <span>{d.pricing.early.badge}</span>
            <h3>{d.pricing.early.title}</h3>
            <strong>{d.pricing.early.price}</strong>
            <p>{d.pricing.early.text}</p>
            <a className="landing-btn landing-btn--primary" href="/retail">
              {d.retail.cta}
            </a>
          </article>
          {d.pricing.soon.map((plan) => (
            <article className="landing-price-card landing-price-card--locked" key={plan.title}>
              <span>{plan.badge}</span>
              <h3>{plan.title}</h3>
              <p>{plan.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-connect">
        <SectionTitle eyebrow={d.connect.eyebrow} title={d.connect.title} text={d.connect.text} />
        <div className="landing-connect__steps">
          {d.connect.steps.map((step) => (
            <span key={step}>{step}</span>
          ))}
        </div>
        <a className="landing-btn landing-btn--primary" href="/retail">
          {d.retail.cta}
        </a>
      </section>

      <section className="landing-section landing-faq">
        <SectionTitle eyebrow={d.faq.eyebrow} title={d.faq.title} />
        {d.faq.items.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      <footer className="landing-footer-v2">
        <div className="landing-footer-v2__cta">
          <h2>{d.footer.title}</h2>
          <a className="landing-btn landing-btn--primary" href="/stores">
            {d.hero.primary}
          </a>
        </div>
        <div className="landing-footer-v2__grid">
          <div>
            <div className="landing-brand landing-brand--footer">
              <img src="/icon_logo.svg" alt="" />
              <span>Körset</span>
            </div>
            <p>{d.footer.text}</p>
          </div>
          {d.footer.groups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3>{group.title}</h3>
              {group.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
          ))}
        </div>
        <div className="landing-footer-v2__bottom">
          <span>{d.footer.made}</span>
          <span>{d.footer.copyright}</span>
        </div>
      </footer>
    </main>
  )
}
