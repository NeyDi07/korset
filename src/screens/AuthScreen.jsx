import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase.js'
import { useI18n } from '../utils/i18n.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { getReturnTo, normalizeReturnTo } from '../utils/authFlow.js'

/* ─── Error i18n mapping ─── */
const errMap = {
  'Invalid login credentials': {
    ru: 'Неверный email или пароль',
    kz: 'Қате email немесе құпиясөз',
  },
  'Email not confirmed': {
    ru: 'Email не подтверждён. Проверьте почту',
    kz: 'Email расталмаған. Поштаңызды тексеріңіз',
  },
  'User already registered': { ru: 'Этот email уже зарегистрирован', kz: 'Бұл email тіркелген' },
  'Password should be at least 6 characters': {
    ru: 'Пароль должен быть минимум 6 символов',
    kz: 'Құпиясөз кемінде 6 таңба болуы керек',
  },
  signup_disabled: { ru: 'Регистрация временно отключена', kz: 'Тіркелу уақытша өшірілген' },
}

function localizeError(msg, lang) {
  if (!msg) return ''
  for (const [key, val] of Object.entries(errMap)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return val[lang] || val.ru
  }
  // Generic fallback
  return lang === 'kz' ? 'Қате орын алды. Қайта көріңіз.' : 'Произошла ошибка. Попробуйте снова.'
}

/* ─── Password validation ─── */
function validatePassword(pw, lang) {
  const errors = []
  if (pw.length < 8) errors.push(lang === 'kz' ? 'Кемінде 8 таңба' : 'Минимум 8 символов')
  if (!/[0-9]/.test(pw)) errors.push(lang === 'kz' ? 'Кемінде 1 сан' : 'Минимум 1 цифра')
  if (!/[A-Za-z]/.test(pw)) errors.push(lang === 'kz' ? 'Кемінде 1 әріп' : 'Минимум 1 буква')
  return errors
}

const fontAdvent = "'Advent Pro', sans-serif"

function EyeBtn({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute',
        right: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.3)',
        cursor: 'pointer',
        padding: 4,
        display: 'flex',
      }}
    >
      {show ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      )}
    </button>
  )
}

export default function AuthScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, t } = useI18n()
  const { user } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'verify' | 'forgot'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const infoMessage = location.state?.message || null
  const returnTo = getReturnTo(location, '/')
  const [focusedField, setFocusedField] = useState(null)

  const otpRefs = useRef([])

  useEffect(() => {
    if (user) {
      navigate(returnTo, { replace: true })
    }
  }, [user, returnTo, navigate])

  const pwErrors = mode === 'register' ? validatePassword(password, lang) : []
  const pwMismatch = mode === 'register' && confirmPassword && password !== confirmPassword

  const canSubmit = () => {
    if (mode === 'forgot') return email.trim().length > 3
    if (mode === 'register')
      return email && password && confirmPassword && pwErrors.length === 0 && !pwMismatch
    return email && password
  }

  /* ─── Auth handlers ─── */
  const handleAuth = async (e) => {
    e.preventDefault()
    if (!canSubmit()) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMode('verify')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setSuccess(
          lang === 'kz'
            ? 'Қалпына келтіру сілтемесі жіберілді'
            : 'Ссылка для сброса отправлена на почту'
        )
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(returnTo, { replace: true })
      }
    } catch (err) {
      setError(localizeError(err.message, lang))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const token = otp.join('')
    if (token.length !== 6) return
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
      if (error) throw error
    } catch (err) {
      setError(lang === 'kz' ? 'Қате код. Қайта көріңіз.' : 'Неверный код. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    try {
      const redirectTo = `${window.location.origin}/auth?returnTo=${encodeURIComponent(returnTo)}`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) throw error
    } catch (err) {
      setError(localizeError(err.message, lang))
    }
  }

  const handleOtpChange = (index, val) => {
    if (/[^0-9]/.test(val)) return
    const newOtp = [...otp]
    newOtp[index] = val
    setOtp(newOtp)
    if (val && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  /* ─── Shared input style ─── */
  const inputStyle = (field) => ({
    background: 'rgba(255,255,255,0.04)',
    border: `1.5px solid ${focusedField === field ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
    padding: '15px 48px 15px 16px',
    borderRadius: 14,
    color: '#fff',
    fontSize: 14,
    fontFamily: fontAdvent,
    width: '100%',
    outline: 'none',
    transition: 'border 0.2s',
    letterSpacing: 0.3,
  })

  /* ─── Title/subtitle per mode ─── */
  const titles = {
    login: {
      title: lang === 'kz' ? 'Қош келдіңіз' : 'С возвращением',
      sub: lang === 'kz' ? 'Аккаунтқа кіріңіз' : 'Войдите в аккаунт Körset',
    },
    register: {
      title: lang === 'kz' ? 'Тіркелу' : 'Создать аккаунт',
      sub: lang === 'kz' ? 'Körset-ке қосылыңыз' : 'Присоединяйтесь к Körset',
    },
    verify: {
      title: lang === 'kz' ? 'Кодты растау' : 'Подтверждение',
      sub:
        lang === 'kz'
          ? 'Поштаңызға жіберілген 6-таңбалы кодты енгізіңіз'
          : `Код отправлен на ${email}`,
    },
    forgot: {
      title: lang === 'kz' ? 'Құпиясөзді қалпына келтіру' : 'Сброс пароля',
      sub: lang === 'kz' ? 'Email-ді енгізіңіз' : 'Введите email для восстановления',
    },
  }
  const { title, sub } = titles[mode]

  return (
    <>
      <style>{`
        @keyframes floatA1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-15px) scale(1.08)} }
        @keyframes floatA2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-18px,12px) scale(0.92)} }
        .auth-input::placeholder { color: rgba(255,255,255,0.25) !important; }
        .auth-input:focus { border-color: rgba(124,58,237,0.5) !important; }
      `}</style>

      <div
        className="screen auth-screen"
        style={{
          background: 'var(--bg)',
          paddingTop: 0,
          paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflowX: 'hidden',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Background orbs */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -60,
              left: -60,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'rgba(124,58,237,0.12)',
              filter: 'blur(70px)',
              animation: 'floatA1 8s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '40%',
              right: -40,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: 'rgba(236,72,153,0.08)',
              filter: 'blur(60px)',
              animation: 'floatA2 10s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 60,
              left: 40,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'rgba(52,211,153,0.06)',
              filter: 'blur(50px)',
              animation: 'floatA1 12s ease-in-out infinite',
            }}
          />
        </div>

        {/* ── HEADER ── */}
        <div style={{ position: 'relative', zIndex: 10, padding: '0 20px' }}>
          {/* Back button */}
          <button
            onClick={() => {
              if (location.key !== 'default') navigate(-1)
              else navigate(normalizeReturnTo(returnTo, '/'), { replace: true })
            }}
            style={{
              position: 'absolute',
              top: 16,
              left: 20,
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Logo + Title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 64,
              paddingBottom: 24,
            }}
          >
            <img
              src="/icon_logo.svg"
              alt="Körset"
              style={{ width: 56, height: 56, marginBottom: 18, borderRadius: 16, flexShrink: 0 }}
            />
            <h1
              style={{
                fontFamily: fontAdvent,
                fontSize: 'clamp(24px, 6vw, 28px)',
                fontWeight: 700,
                color: '#fff',
                margin: 0,
                letterSpacing: 0.5,
                textAlign: 'center',
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontFamily: fontAdvent,
                fontSize: 14,
                color: 'rgba(255,255,255,0.4)',
                marginTop: 8,
                textAlign: 'center',
                lineHeight: 1.4,
                maxWidth: 280,
              }}
            >
              {sub}
            </p>
          </div>
        </div>

        {/* ── FORM CARD ── */}
        <div
          style={{
            padding: '0 22px 28px',
            position: 'relative',
            zIndex: 10,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20,
              padding: '24px 20px',
              marginBottom: 20,
            }}
          >
            {infoMessage && !error && !success && (
              <div
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.2)',
                  color: '#DDD6FE',
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontFamily: fontAdvent,
                  marginBottom: 18,
                  textAlign: 'center',
                  lineHeight: 1.45,
                }}
              >
                {infoMessage}
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#FCA5A5',
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontFamily: fontAdvent,
                  marginBottom: 18,
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#34D399',
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontFamily: fontAdvent,
                  marginBottom: 18,
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {success}
              </div>
            )}

            {/* ── VERIFY MODE ── */}
            {mode === 'verify' ? (
              <form
                onSubmit={handleVerifyOtp}
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="auth-input"
                      style={{
                        width: 44,
                        height: 52,
                        textAlign: 'center',
                        fontSize: 22,
                        fontWeight: 700,
                        fontFamily: fontAdvent,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1.5px solid rgba(124,58,237,0.2)',
                        borderRadius: 12,
                        color: '#fff',
                        outline: 'none',
                        transition: 'border 0.2s',
                      }}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.join('').length < 6}
                  style={{
                    background: '#7C3AED',
                    color: '#fff',
                    border: 'none',
                    padding: 16,
                    borderRadius: 14,
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: fontAdvent,
                    cursor: 'pointer',
                    opacity: loading || otp.join('').length < 6 ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {loading ? '...' : lang === 'kz' ? 'Растау' : 'Подтвердить'}
                </button>
              </form>
            ) : /* ── FORGOT MODE ── */
            mode === 'forgot' ? (
              <form
                onSubmit={handleAuth}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle('email')}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !canSubmit()}
                  style={{
                    background: '#7C3AED',
                    color: '#fff',
                    border: 'none',
                    padding: 16,
                    borderRadius: 14,
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: fontAdvent,
                    cursor: 'pointer',
                    opacity: loading || !canSubmit() ? 0.5 : 1,
                    marginTop: 4,
                  }}
                >
                  {loading ? '...' : lang === 'kz' ? 'Сілтеме жіберу' : 'Отправить ссылку'}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#A78BFA',
                    fontSize: 13,
                    fontFamily: fontAdvent,
                    cursor: 'pointer',
                    marginTop: 4,
                  }}
                >
                  {lang === 'kz' ? '← Кіру бетіне оралу' : '← Вернуться ко входу'}
                </button>
              </form>
            ) : (
              /* ── LOGIN / REGISTER ── */
              <form
                onSubmit={handleAuth}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                {/* Email */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle('email')}
                  />
                </div>

                {/* Password */}
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input"
                    placeholder={lang === 'kz' ? 'Құпиясөз' : 'Пароль'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    onFocus={() => setFocusedField('pw')}
                    onBlur={() => setFocusedField(null)}
                    style={inputStyle('pw')}
                  />
                  <EyeBtn show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                </div>

                {/* Password strength (register only) */}
                {mode === 'register' && password.length > 0 && (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}
                  >
                    {[
                      {
                        ok: password.length >= 8,
                        text: lang === 'kz' ? 'Кемінде 8 таңба' : 'Минимум 8 символов',
                      },
                      {
                        ok: /[0-9]/.test(password),
                        text: lang === 'kz' ? 'Кемінде 1 сан' : 'Минимум 1 цифра',
                      },
                      {
                        ok: /[A-Za-z]/.test(password),
                        text: lang === 'kz' ? 'Кемінде 1 әріп' : 'Минимум 1 буква',
                      },
                    ].map((rule, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: rule.ok
                              ? 'rgba(16,185,129,0.15)'
                              : 'rgba(255,255,255,0.05)',
                          }}
                        >
                          {rule.ok ? (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#34D399"
                              strokeWidth="3"
                              strokeLinecap="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <div
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.2)',
                              }}
                            />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: fontAdvent,
                            color: rule.ok ? '#34D399' : 'rgba(255,255,255,0.3)',
                          }}
                        >
                          {rule.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirm Password (register only) */}
                {mode === 'register' && (
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="auth-input"
                      placeholder={lang === 'kz' ? 'Құпиясөзді қайталаңыз' : 'Повторите пароль'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      onFocus={() => setFocusedField('cpw')}
                      onBlur={() => setFocusedField(null)}
                      style={{
                        ...inputStyle('cpw'),
                        borderColor: pwMismatch
                          ? 'rgba(239,68,68,0.5)'
                          : focusedField === 'cpw'
                            ? 'rgba(124,58,237,0.5)'
                            : 'rgba(255,255,255,0.08)',
                      }}
                    />
                    <EyeBtn
                      show={showConfirmPassword}
                      onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                    {pwMismatch && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#F87171',
                          marginTop: 4,
                          fontFamily: fontAdvent,
                          paddingLeft: 2,
                        }}
                      >
                        {lang === 'kz' ? 'Құпиясөздер сәйкес емес' : 'Пароли не совпадают'}
                      </div>
                    )}
                  </div>
                )}

                {/* Forgot password (login only) */}
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: -4 }}>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 12,
                        fontFamily: fontAdvent,
                        cursor: 'pointer',
                      }}
                    >
                      {lang === 'kz' ? 'Құпиясөзді ұмыттыңыз ба?' : 'Забыли пароль?'}
                    </button>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !canSubmit()}
                  style={{
                    background: '#7C3AED',
                    color: '#fff',
                    border: 'none',
                    padding: 16,
                    borderRadius: 14,
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: fontAdvent,
                    cursor: 'pointer',
                    opacity: loading || !canSubmit() ? 0.5 : 1,
                    marginTop: 6,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {loading
                    ? '...'
                    : mode === 'login'
                      ? lang === 'kz'
                        ? 'Кіру'
                        : 'Войти'
                      : lang === 'kz'
                        ? 'Тіркелу'
                        : 'Зарегистрироваться'}
                </button>
              </form>
            )}

            {/* ── GOOGLE AUTH ── */}
            {mode !== 'verify' && mode !== 'forgot' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.25)',
                      fontFamily: fontAdvent,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {lang === 'kz' ? 'немесе' : 'или'}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                </div>

                <button
                  onClick={handleGoogleAuth}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    padding: 14,
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: fontAdvent,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {mode === 'login'
                    ? lang === 'kz'
                      ? 'Google арқылы кіру'
                      : 'Войти через Google'
                    : lang === 'kz'
                      ? 'Google арқылы тіркелу'
                      : 'Регистрация через Google'}
                </button>
              </>
            )}
          </div>

          {/* ── FOOTER TOGGLE ── */}
          {mode !== 'verify' && mode !== 'forgot' && (
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <p
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: fontAdvent,
                  margin: 0,
                }}
              >
                {mode === 'login'
                  ? lang === 'kz'
                    ? 'Аккаунтыңыз жоқ па?'
                    : 'Ещё нет аккаунта?'
                  : lang === 'kz'
                    ? 'Аккаунтыңыз бар ма?'
                    : 'Уже есть аккаунт?'}
              </p>
              <button
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#A78BFA',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: fontAdvent,
                  cursor: 'pointer',
                  marginTop: 6,
                }}
              >
                {mode === 'login'
                  ? lang === 'kz'
                    ? 'Тіркелу'
                    : 'Зарегистрироваться'
                  : lang === 'kz'
                    ? 'Кіру'
                    : 'Войти в аккаунт'}
              </button>
            </div>
          )}

          {/* ── TERMS ── */}
          {mode === 'register' && (
            <div style={{ textAlign: 'center', marginTop: 20, padding: '0 10px' }}>
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.2)',
                  fontFamily: fontAdvent,
                  lineHeight: 1.5,
                }}
              >
                {lang === 'kz' ? (
                  <>
                    Тіркелу арқылы сіз{' '}
                    <span
                      onClick={() => navigate('/privacy-policy')}
                      style={{
                        color: 'rgba(255,255,255,0.4)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Құпиялылық саясатымен
                    </span>{' '}
                    келісесіз
                  </>
                ) : (
                  <>
                    Регистрируясь, вы принимаете{' '}
                    <span
                      onClick={() => navigate('/privacy-policy')}
                      style={{
                        color: 'rgba(255,255,255,0.4)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Политику конфиденциальности
                    </span>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
