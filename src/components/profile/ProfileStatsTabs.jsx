import { AnimatePresence, motion } from 'framer-motion'
import { HeartIcon } from '../icons/HeartIcon.jsx'
import ProductMiniCard from '../ProductMiniCard.jsx'
import './ProfileStatsTabs.css'

/**
 * Liquid-morph tabbed stats block for the profile screen.
 * Three pressable cards (Favorites / Preferences / History) share a single
 * expandable panel beneath them. The active card visually merges with the
 * panel via a shared `layoutId` glow that morphs between positions.
 *
 * Accepts pre-rendered `preferencesContent` so the parent owns its complex
 * Diet/Allergens form state.
 */
export default function ProfileStatsTabs({
  activeTab,
  onTabChange,
  favoritesCount,
  scanCount,
  preferencesCount,
  topFavorites,
  topHistory,
  loadingTab,
  preferencesContent,
  onViewAllFavorites,
  onViewAllHistory,
  t,
}) {
  const toggleTab = (tab) => onTabChange(activeTab === tab ? null : tab)

  const tabs = [
    {
      id: 'favorites',
      tone: 'favorites',
      value: favoritesCount,
      label: t.profile.favorites,
      iconBg: 'rgba(220,38,38,0.18)',
      iconBorder: 'rgba(248,113,113,0.55)',
      iconShadow: '0 4px 22px rgba(220,38,38,0.32)',
      icon: <HeartIcon filled size={24} color="#F87171" />,
    },
    {
      id: 'preferences',
      tone: 'preferences',
      value: preferencesCount,
      label: t.profile.preferencesTitle,
      iconBg: 'rgba(124,58,237,0.18)',
      iconBorder: 'rgba(167,139,250,0.55)',
      iconShadow: '0 4px 22px rgba(124,58,237,0.36)',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A78BFA"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      ),
    },
    {
      id: 'history',
      tone: 'history',
      value: scanCount,
      label: t.profile.scans,
      iconBg: 'rgba(16,185,129,0.18)',
      iconBorder: 'rgba(52,211,153,0.55)',
      iconShadow: '0 4px 22px rgba(16,185,129,0.32)',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#34D399"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8V6a2 2 0 012-2h2" />
          <path d="M16 4h2a2 2 0 012 2v2" />
          <path d="M20 16v2a2 2 0 01-2 2h-2" />
          <path d="M8 20H6a2 2 0 01-2-2v-2" />
          <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
        </svg>
      ),
    },
  ]

  // Spring presets shared across animations for a cohesive feel.
  const liquidSpring = { type: 'spring', stiffness: 360, damping: 34, mass: 0.7 }
  const heightSpring = { type: 'spring', stiffness: 320, damping: 36, mass: 0.8 }

  const renderTabBody = () => {
    if (activeTab === 'preferences') return preferencesContent

    if (activeTab === 'favorites') {
      if (loadingTab === 'favorites' && topFavorites === null) {
        return <TabSpinner text={t.profile.favoritesLoading || t.common.loading} />
      }
      if (topFavorites && topFavorites.length > 0) {
        return (
          <>
            <div className="stats-tabs__grid">
              {topFavorites.map((p) => (
                <ProductMiniCard key={p.ean || p.id} product={p} />
              ))}
            </div>
            {favoritesCount > topFavorites.length && (
              <button type="button" className="stats-tabs__view-all" onClick={onViewAllFavorites}>
                {t.profile.viewAll}
                <ChevronRightIcon />
              </button>
            )}
          </>
        )
      }
      return (
        <TabEmptyState
          tone="favorites"
          title={t.profile.favoritesEmpty}
          hint={t.profile.favoritesEmptyHint}
        />
      )
    }

    if (activeTab === 'history') {
      if (loadingTab === 'history' && topHistory === null) {
        return <TabSpinner text={t.profile.historyLoading || t.common.loading} />
      }
      if (topHistory && topHistory.length > 0) {
        return (
          <>
            <div className="stats-tabs__grid">
              {topHistory.map((p) => (
                <ProductMiniCard key={`${p.ean || p.id}-${p.scanDate || ''}`} product={p} />
              ))}
            </div>
            {scanCount > topHistory.length && (
              <button type="button" className="stats-tabs__view-all" onClick={onViewAllHistory}>
                {t.profile.viewAll}
                <ChevronRightIcon />
              </button>
            )}
          </>
        )
      }
      return (
        <TabEmptyState
          tone="history"
          title={t.profile.historyEmpty}
          hint={t.profile.historyEmptyHint}
        />
      )
    }

    return null
  }

  return (
    <div className={`stats-tabs ${activeTab ? `stats-tabs--open tone-${activeTab}` : ''}`}>
      <div className="stats-tabs__row">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={`stat-card ${isActive ? `is-active is-${tab.tone}` : ''}`}
              onClick={() => toggleTab(tab.id)}
              aria-expanded={isActive}
              aria-controls="profile-stats-panel"
            >
              {/* Liquid glow that morphs between the active card positions */}
              {isActive && (
                <motion.span
                  layoutId="stats-active-glow"
                  className={`stat-card__glow tone-${tab.tone}`}
                  transition={liquidSpring}
                  aria-hidden="true"
                />
              )}
              <span
                className="stat-card__icon-wrap"
                style={{
                  background: tab.iconBg,
                  borderColor: tab.iconBorder,
                  boxShadow: tab.iconShadow,
                }}
              >
                {tab.icon}
              </span>
              <span className="stat-card__value">{tab.value}</span>
              <span className="stat-card__label">{tab.label}</span>
            </button>
          )
        })}
      </div>

      <motion.div
        id="profile-stats-panel"
        className={`stats-tabs__panel-wrap ${activeTab ? 'is-open' : ''}`}
        initial={false}
        animate={{
          height: activeTab ? 'auto' : 0,
          opacity: activeTab ? 1 : 0,
        }}
        transition={heightSpring}
        style={{ overflow: 'hidden' }}
      >
        <div className={`stats-tabs__panel tone-${activeTab || 'none'}`}>
          <AnimatePresence mode="popLayout" initial={false}>
            {activeTab && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="stats-tabs__panel-content"
              >
                {renderTabBody()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

const TONE_STYLES = {
  favorites: {
    bg: 'rgba(220,38,38,0.18)',
    border: 'rgba(248,113,113,0.45)',
    color: '#F87171',
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#F87171"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  history: {
    bg: 'rgba(16,185,129,0.18)',
    border: 'rgba(52,211,153,0.45)',
    color: '#34D399',
    icon: (
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#34D399"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 8V6a2 2 0 012-2h2" />
        <path d="M16 4h2a2 2 0 012 2v2" />
        <path d="M20 16v2a2 2 0 01-2 2h-2" />
        <path d="M8 20H6a2 2 0 01-2-2v-2" />
        <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
      </svg>
    ),
  },
}

function TabEmptyState({ tone, title, hint }) {
  const cfg = TONE_STYLES[tone] || TONE_STYLES.favorites
  return (
    <div className="stats-tabs__empty">
      <div
        className="stats-tabs__empty-icon"
        style={{
          background: cfg.bg,
          border: `2px solid ${cfg.border}`,
          boxShadow: `0 6px 20px ${cfg.bg}`,
        }}
      >
        {cfg.icon}
      </div>
      <div className="stats-tabs__empty-title">{title}</div>
      <div className="stats-tabs__empty-hint">{hint}</div>
    </div>
  )
}

/**
 * In-tab loading indicator. Uses a rotating arc (CSS-driven so it's smooth
 * even when the main thread is busy hydrating product rows) and a short
 * localized label so users immediately understand the panel is working.
 * The arc colour is inherited from the parent panel's `--tone-color-strong`,
 * so it always matches the active tab.
 */
function TabSpinner({ text }) {
  return (
    <div className="stats-tabs__spinner" role="status" aria-live="polite">
      <svg viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r="20" />
      </svg>
      <span className="stats-tabs__spinner-text">{text}</span>
    </div>
  )
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
