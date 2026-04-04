import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useI18n } from '../utils/i18n.js'

const DEFAULT_AVATARS = [
  { id: 'av1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arman&backgroundColor=7C3AED&clotheColor=3B82F6' },
  { id: 'av2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aisha&backgroundColor=EC4899&clotheColor=EC4899' },
  { id: 'av3', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daulet&backgroundColor=34D399&clotheColor=10B981' },
  { id: 'av4', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Madina&backgroundColor=F59E0B&clotheColor=F97316' },
  { id: 'av5', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Timur&backgroundColor=8B5CF6&clotheColor=6366F1' },
  { id: 'av6', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dana&backgroundColor=06B6D4&clotheColor=0EA5E9' },
  { id: 'av7', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sultan&backgroundColor=EF4444&clotheColor=DC2626' },
  { id: 'av8', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aliya&backgroundColor=A78BFA&clotheColor=7C3AED' },
  { id: 'av9', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Asel&backgroundColor=14B8A6&clotheColor=0F766E' },
]

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 500
        const MAX_HEIGHT = 500
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height
          height = MAX_HEIGHT
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82)
      }
      img.onerror = (error) => reject(error)
    }
    reader.onerror = (error) => reject(error)
  })
}

export default function SetupProfileScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang } = useI18n()

  const totalSteps = 2
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')

  const [selectedAvatarId, setSelectedAvatarId] = useState(DEFAULT_AVATARS[0].id)
  const [customAvatarUrl, setCustomAvatarUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const savedName = user?.user_metadata?.full_name
    if (savedName) setName(savedName)

    const googlePhoto = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
    const savedAvatar = user?.user_metadata?.avatar_id || googlePhoto

    if (savedAvatar) {
      if (savedAvatar.startsWith?.('http')) {
        setCustomAvatarUrl(savedAvatar)
        setSelectedAvatarId('custom')
      } else {
        setSelectedAvatarId(savedAvatar)
      }
    }
  }, [user])

  const handleNameChange = (e) => {
    const val = e.target.value
    setName(val)
    const regex = /^[a-zA-Zа-яА-ЯәіңғүұқөһӘІҢҒҮҰҚӨҺ0-9\s]*$/
    if (!regex.test(val)) {
      setNameError(lang === 'kz' ? 'Тек әріптер мен сандар рұқсат етілген' : 'Разрешены только буквы и цифры')
    } else {
      setNameError('')
    }
  }

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter' && name.trim() && !nameError) {
      setStep(2)
    }
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    setUploadingAvatar(true)
    try {
      const compressedBlob = await compressImage(file)
      const fileName = `${user.id}-${Date.now()}.jpg`

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setCustomAvatarUrl(publicUrl)
      setSelectedAvatarId('custom')
    } catch (error) {
      alert('Ошибка загрузки фото: ' + (error.message || 'Неизвестная ошибка'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handlePrimaryAction = async () => {
    if (step === 1) {
      if (!name.trim() || nameError) return
      setStep(2)
      return
    }

    setLoading(true)
    try {
      const finalAvatar = selectedAvatarId === 'custom' && customAvatarUrl ? customAvatarUrl : selectedAvatarId
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: name.trim() || 'User',
          avatar_id: finalAvatar,
          profile_setup_done: true,
        },
      })
      if (authError) throw authError
      navigate('/profile', { replace: true })
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / totalSteps) * 100

  return (
    <>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="screen" style={{ background: '#0F0F13', paddingTop: 0, paddingBottom: 40, display: 'flex', flexDirection: 'column', minHeight: '100vh', color: '#fff' }}>
        <div style={{ padding: '20px 24px', paddingTop: 60, position: 'relative', zIndex: 10 }}>
          {step > 1 && (
            <button onClick={handleBack} style={{ position: 'absolute', top: 50, left: 16, width: 44, height: 44, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED', letterSpacing: 1 }}>
              {lang === 'kz' ? `${step} ҚАДАМ ${totalSteps}-ДЕН` : `ШАГ ${step} ИЗ ${totalSteps}`}
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #7C3AED, #EC4899)', transition: 'width 0.35s ease' }} />
          </div>
        </div>

        <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
          {step === 1 && (
            <div style={{ animation: 'fadeUp 0.35s ease-out', maxWidth: 560 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 10, lineHeight: 1.15 }}>
                {lang === 'kz' ? 'Профильді толтыру' : 'Настройка профиля'}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 14, marginBottom: 32, lineHeight: 1.6, maxWidth: 420 }}>
                {lang === 'kz' ? 'Атыңызды немесе лақап атыңызды енгізіңіз. Бұл деректер профильде көрсетіледі.' : 'Укажите имя или псевдоним. Эти данные будут отображаться в вашем профиле.'}
              </p>

              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, padding: '22px 20px', backdropFilter: 'blur(12px)' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 10, display: 'block' }}>
                  {lang === 'kz' ? 'Аты немесе лақап аты' : 'Имя или псевдоним'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'kz' ? 'Атыңызды енгізіңіз' : 'Введите имя'}
                  value={name}
                  onChange={handleNameChange}
                  autoFocus
                  onKeyDown={handleNameKeyDown}
                  style={{ background: 'transparent', border: 'none', padding: '8px 0', color: '#fff', fontSize: 22, fontWeight: 700, width: '100%', outline: 'none', fontFamily: 'var(--font-display)' }}
                />
              </div>
              {nameError && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 12, fontWeight: 500, paddingLeft: 4 }}>{nameError}</div>}
            </div>
          )}

          {step === 2 && (
            <div style={{ animation: 'fadeUp 0.35s ease-out', flex: 1 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(236,72,153,0.14)', border: '1px solid rgba(236,72,153,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F9A8D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 10, lineHeight: 1.15 }}>
                {lang === 'kz' ? 'Аватар таңдаңыз' : 'Выберите аватар'}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 14, marginBottom: 28, lineHeight: 1.6, maxWidth: 430 }}>
                {lang === 'kz' ? 'Дайын аватарды таңдаңыз немесе өз фотоңызды жүктеңіз.' : 'Выберите готовый аватар или загрузите своё фото.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <div onClick={() => fileInputRef.current?.click()} style={{ aspectRatio: '1', borderRadius: 20, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '2px dashed rgba(255,255,255,0.2)', transition: 'all 0.2s ease', backdropFilter: 'blur(10px)' }}>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                  {uploadingAvatar ? (
                    <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#EC4899', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{lang === 'kz' ? 'Галерея' : 'Галерея'}</span>
                    </div>
                  )}
                </div>

                {customAvatarUrl && (
                  <div onClick={() => setSelectedAvatarId('custom')} style={{ aspectRatio: '1', borderRadius: 20, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: selectedAvatarId === 'custom' ? '2px solid #7C3AED' : '2px solid rgba(255,255,255,0.08)', boxShadow: selectedAvatarId === 'custom' ? '0 8px 24px rgba(124,58,237,0.25)' : 'none', transform: selectedAvatarId === 'custom' ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.2s ease', backdropFilter: 'blur(10px)' }}>
                    <img src={customAvatarUrl} alt="Your Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {selectedAvatarId === 'custom' && (
                      <div style={{ position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, background: '#34D399', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #0F0F13' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>
                )}

                {DEFAULT_AVATARS.map((av) => (
                  <div key={av.id} onClick={() => setSelectedAvatarId(av.id)} style={{ aspectRatio: '1', borderRadius: 20, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: selectedAvatarId === av.id ? '2px solid #7C3AED' : '2px solid rgba(255,255,255,0.08)', boxShadow: selectedAvatarId === av.id ? '0 8px 24px rgba(124,58,237,0.25)' : 'none', transform: selectedAvatarId === av.id ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.2s ease', backdropFilter: 'blur(10px)' }}>
                    <img src={av.url} alt="Avatar" style={{ width: '88%', height: '88%', objectFit: 'cover' }} />
                    {selectedAvatarId === av.id && (
                      <div style={{ position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, background: '#34D399', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #0F0F13' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '24px', position: 'relative', zIndex: 10 }}>
          <button onClick={handlePrimaryAction} disabled={loading || (step === 1 && (!name.trim() || nameError))} style={{ width: '100%', background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)', color: '#fff', border: 'none', padding: '18px', borderRadius: 20, fontSize: 18, fontWeight: 800, cursor: (loading || (step === 1 && (!name.trim() || nameError))) ? 'default' : 'pointer', opacity: (loading || (step === 1 && (!name.trim() || nameError))) ? 0.5 : 1, boxShadow: '0 10px 25px rgba(236,72,153,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, transition: 'all 0.2s' }}>
            {loading ? '...' : step === totalSteps ? (lang === 'kz' ? 'Профильді сақтау' : 'Сохранить профиль') : (lang === 'kz' ? 'Жалғастыру' : 'Продолжить')}
            {step < totalSteps && !loading && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
