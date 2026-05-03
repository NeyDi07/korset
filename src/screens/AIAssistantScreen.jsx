import { useState, useRef, useEffect } from 'react'
import { useI18n } from '../i18n/index.js'
import KorsetAvatar from '../components/KorsetAvatar.jsx'
import { askGeneralAI } from '../services/ai.js'

export default function AIAssistantScreen() {
  const { lang, t, exists } = useI18n()
  const generalChips = []
  let gi = 0
  while (exists(`ai.generalChips.${gi}`)) {
    generalChips.push(t(`ai.generalChips.${gi}`))
    gi++
  }
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const reply = await askGeneralAI(newMessages, lang)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('ai.errorGeneric') }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          padding: '16px 20px 14px',
          flexShrink: 0,
          borderBottom: '1px solid var(--glass-soft-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <KorsetAvatar size={40} />
        <div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--text)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Körset AI
          </div>
          <div style={{ fontSize: 12, color: '#34D399', fontWeight: 500, marginTop: 1 }}>
            {t('ai.generalSubtitle')}
          </div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 16px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <KorsetAvatar size={34} />
            <div
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-soft-border)',
                padding: '13px 16px',
                borderRadius: '4px 18px 18px 18px',
                maxWidth: '85%',
                fontSize: 15,
                lineHeight: 1.65,
                color: 'var(--text)',
              }}
            >
              {t('ai.welcomeGeneral')}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end',
              gap: 10,
            }}
          >
            {msg.role === 'assistant' && <KorsetAvatar size={34} />}
            <div
              style={
                msg.role === 'user'
                  ? {
                      background: 'var(--primary)',
                      padding: '12px 16px',
                      borderRadius: '18px 18px 4px 18px',
                      maxWidth: '78%',
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: '#fff',
                      boxShadow: '0 4px 16px var(--primary-glow)',
                    }
                  : {
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-soft-border)',
                      padding: '13px 16px',
                      borderRadius: '4px 18px 18px 18px',
                      maxWidth: '85%',
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: 'var(--text)',
                    }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <KorsetAvatar size={34} />
            <div
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-soft-border)',
                padding: '14px 18px',
                borderRadius: '4px 18px 18px 18px',
              }}
            >
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--primary-bright)',
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: '86px',
          zIndex: 90,
          padding: '8px 16px 16px',
          background: 'var(--bg)',
          borderTop: '1px solid var(--glass-border)',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: 10,
            }}
          >
            {generalChips.map((chip) => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--glass-soft-border)',
                  background: 'var(--glass-subtle)',
                  color: 'var(--text-sub)',
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder={t('ai.inputGeneral')}
            disabled={loading}
            style={{
              flex: 1,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 24,
              padding: '13px 18px',
              fontSize: 15,
              color: 'var(--text)',
              fontFamily: 'var(--font-body)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'default',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-mid))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 16px var(--primary-glow)',
              opacity: input.trim() ? 1 : 0.5,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  )
}
