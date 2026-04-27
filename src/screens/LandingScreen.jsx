import './LandingScreen.css'
import { dictionaries, useI18n } from '../utils/i18n.js'
import { useTheme } from '../utils/theme.js'

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

export default function LandingScreen() {
  const { t } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const d = t.landing || dictionaries.ru.landing

  return (
    <main className="landing-page-v2">
      <div className="landing-scan-beam" aria-hidden="true" />
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
          <div className="landing-orbit-card landing-orbit-card--top">
            <Icon name="verified" />
            <span>{d.demo.orbitTop}</span>
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
        </div>
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
