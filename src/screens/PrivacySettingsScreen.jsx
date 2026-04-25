import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase.js'
import { useProfile } from '../contexts/ProfileContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useI18n } from '../utils/i18n.js'
import {
  clearLocalScanHistory,
  buildHistoryOwnerKey,
  readLocalScanHistory,
} from '../utils/localHistory.js'
import {
  DEFAULT_PRIVACY_SETTINGS,
  loadPrivacySettings,
  notifyPrivacyChanged,
} from '../utils/privacySettings.js'

function Section({ title, children }) {
  return (
    <div style={{ padding: '0 22px 18px' }}>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.28)',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        }}
      >
        {title}
      </div>
      <div className="glass-card" style={{ padding: 0 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, description, right, danger = false, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '15px 18px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: danger ? '#FCA5A5' : '#fff',
          }}
        >
          {label}
        </div>
        {description ? (
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              lineHeight: 1.45,
              color: 'rgba(255,255,255,0.45)',
              marginTop: 4,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  )
}

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onChange(!checked)
      }}
      style={{
        width: 50,
        height: 30,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.08)',
        background: checked ? 'linear-gradient(135deg,#7C3AED,#8B5CF6)' : 'rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        padding: 3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: checked ? '0 0 20px rgba(139,92,246,0.35)' : 'none',
        }}
      />
    </button>
  )
}

function ActionButton({ label, danger = false, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        border: 'none',
        borderRadius: 14,
        padding: '14px 16px',
        background: danger ? 'rgba(239,68,68,0.12)' : 'rgba(124,58,237,0.14)',
        color: danger ? '#FCA5A5' : '#DDD6FE',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {label}
    </button>
  )
}

export default function PrivacySettingsScreen() {
  const navigate = useNavigate()
  useParams()
  const { profile, updateProfile } = useProfile()
  const { user, internalUserId } = useAuth()
  const { clearRememberedStore } = useStore()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [statusText, setStatusText] = useState('')

  const privacy = useMemo(
    () => ({
      ...DEFAULT_PRIVACY_SETTINGS,
      ...loadPrivacySettings(),
      ...(profile?.privacy || {}),
    }),
    [profile]
  )

  const localHistoryCount = useMemo(() => {
    return readLocalScanHistory(buildHistoryOwnerKey(user)).length
  }, [user, profile])

  async function updatePrivacy(patch) {
    const next = { ...privacy, ...patch }
    await updateProfile({ privacy: next })
    notifyPrivacyChanged()
    setStatusText(t.privacy.saved)
  }

  async function handleLocalHistoryToggle(value) {
    if (!value) {
      const ok = window.confirm(t.privacy.confirmDisableLocal)
      if (!ok) return
      clearLocalScanHistory(buildHistoryOwnerKey(user))
      window.dispatchEvent(new CustomEvent('korset:scan_added'))
    }
    await updatePrivacy({ localHistoryEnabled: value })
  }

  async function handleRememberStoreToggle(value) {
    if (!value) {
      clearRememberedStore()
    }
    await updatePrivacy({ rememberStoreEnabled: value })
  }

  async function clearDeviceHistory() {
    const ok = window.confirm(t.privacy.confirmClearDevice)
    if (!ok) return
    clearLocalScanHistory(buildHistoryOwnerKey(user))
    window.dispatchEvent(new CustomEvent('korset:scan_added'))
    setStatusText(t.privacy.deviceHistoryCleared)
  }

  async function clearCloudHistory() {
    if (!user || !internalUserId) {
      setStatusText(t.privacy.loginForCloud)
      return
    }
    const ok = window.confirm(t.privacy.confirmClearCloud)
    if (!ok) return
    try {
      setBusy(true)
      const { error } = await supabase.from('scan_events').delete().eq('user_id', internalUserId)
      if (error) throw error
      window.dispatchEvent(new CustomEvent('korset:scan_added'))
      setStatusText(t.privacy.cloudHistoryDeleted)
    } catch (error) {
      console.error(error)
      setStatusText(t.privacy.cloudDeleteFailed)
    } finally {
      setBusy(false)
    }
  }

  async function resetPrivacySettings() {
    const ok = window.confirm(t.privacy.confirmReset)
    if (!ok) return
    await updateProfile({ privacy: { ...DEFAULT_PRIVACY_SETTINGS } })
    notifyPrivacyChanged()
    setStatusText(t.privacy.resetDone)
  }

  return (
    <div
      className="screen"
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'calc(110px + env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px 16px' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label={t.common.back}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: '#fff',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            letterSpacing: 1,
            color: '#fff',
          }}
        >
          {t.privacy.title}
        </div>
      </div>

      <div style={{ padding: '0 22px 18px' }}>
        <div className="glass-card" style={{ padding: 18 }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            {t.privacy.intro}
          </div>
        </div>
      </div>

      <Section title={t.privacy.sectionPersonalization}>
        <Row
          label={t.privacy.personalizedRecommendations}
          description={t.privacy.personalizedRecommendationsDesc}
          right={
            <Toggle
              checked={privacy.personalizationEnabled}
              onChange={(value) => updatePrivacy({ personalizationEnabled: value })}
            />
          }
        />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 18px' }} />
        <Row
          label={t.privacy.anonymousAnalytics}
          description={t.privacy.anonymousAnalyticsDesc}
          right={
            <Toggle
              checked={privacy.analyticsEnabled}
              onChange={(value) => updatePrivacy({ analyticsEnabled: value })}
            />
          }
        />
      </Section>

      <Section title={t.privacy.sectionDevice}>
        <Row
          label={t.privacy.localHistory}
          description={t.privacy.localHistoryDesc(localHistoryCount)}
          right={
            <Toggle checked={privacy.localHistoryEnabled} onChange={handleLocalHistoryToggle} />
          }
        />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 18px' }} />
        <Row
          label={t.privacy.rememberStore}
          description={t.privacy.rememberStoreDesc}
          right={
            <Toggle checked={privacy.rememberStoreEnabled} onChange={handleRememberStoreToggle} />
          }
        />
      </Section>

      <Section title={t.privacy.sectionData}>
        <div style={{ padding: 18, display: 'grid', gap: 10 }}>
          <ActionButton label={t.privacy.clearDeviceHistory} onClick={clearDeviceHistory} />
          <ActionButton
            label={t.privacy.clearCloudHistory}
            danger
            onClick={clearCloudHistory}
            disabled={!user || busy}
          />
          <ActionButton
            label={t.privacy.resetPrivacy}
            onClick={resetPrivacySettings}
            disabled={busy}
          />
        </div>
      </Section>

      <Section title={t.privacy.sectionPractical}>
        <Row
          label={t.privacy.ifAnalyticsOff}
          description={t.privacy.ifAnalyticsOffDesc}
          right={null}
        />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 18px' }} />
        <Row
          label={t.privacy.ifLocalHistoryOff}
          description={t.privacy.ifLocalHistoryOffDesc}
          right={null}
        />
      </Section>

      {statusText ? (
        <div style={{ padding: '0 22px 24px' }}>
          <div
            className="glass-card"
            style={{
              padding: '14px 16px',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.68)',
            }}
          >
            {statusText}
          </div>
        </div>
      ) : null}
    </div>
  )
}
