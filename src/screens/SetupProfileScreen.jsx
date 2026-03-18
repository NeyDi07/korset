import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useProfile } from '../contexts/ProfileContext.jsx'
import { useI18n } from '../utils/i18n.js'

// Временные премиум-аватарки (через DiceBear, пока дизайнер не нарисует свои)
const DEFAULT_AVATARS = [
  { id: 'av1', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=7C3AED' },
  { id: 'av2', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Jack&backgroundColor=EC4899' },
  { id: 'av3', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Lily&backgroundColor=34D399' },
  { id: 'av4', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Leo&backgroundColor=FBBF24' },
  { id: 'av5', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Zoe&backgroundColor=8B5CF6' }
]

const ALLERGEN_OPTIONS = [
  { id: 'gluten', labelKz: 'Глютен', labelRu: 'Глютен' },
  { id: 'lactose', labelKz: 'Лактоза', labelRu: 'Лактоза' },
  { id: 'nuts', labelKz: 'Жаңғақтар', labelRu: 'Орехи' },
  { id: 'sugar', labelKz: 'Қант', labelRu: 'Сахар' }
]

// Функция сжатия картинки, чтобы не тратить место на сервере
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Сжимаем до JPG качества 0.8
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.8);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function SetupProfileScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { lang } = useI18n()
  
  const [step, setStep] = useState(1) // 1: Name, 2: Avatar, 3: Diet
  const [loading, setLoading] = useState(false)

  // Step 1: Name
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  
  // Step 2: Avatar
  const [selectedAvatarId, setSelectedAvatarId] = useState(DEFAULT_AVATARS[0].id)
  const [customAvatarUrl, setCustomAvatarUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef(null)

  // Step 3: Diet & Allergens
  const [halal, setHalal] = useState(profile?.halal || false)
  const [allergens, setAllergens] = useState(profile?.allergens || [])

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setName(user.user_metadata.full_name)
    }
    if (user?.user_metadata?.avatar_id) {
      if (user.user_metadata.avatar_id.startsWith('http')) {
        setCustomAvatarUrl(user.user_metadata.avatar_id)
        setSelectedAvatarId('custom')
      } else {
        setSelectedAvatarId(user.user_metadata.avatar_id)
      }
    }
  }, [user])

  // Валидация имени (Без спецсимволов)
  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    // Разрешаем буквы разных алфавитов, цифры и пробелы, никаких знаков и эмодзи
    const regex = /^[a-zA-Zа-яА-ЯәіңғүұқөһӘІҢҒҮҰҚӨҺ0-9\s]*$/;
    if (!regex.test(val)) {
      setNameError(lang === 'kz' ? 'Тек әріптер мен сандар рұқсат етілген' : 'Разрешены только буквы и цифры');
    } else {
      setNameError('');
    }
  }

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim() || nameError) return;
    }
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const toggleAllergen = (id) => {
    if (allergens.includes(id)) {
      setAllergens(allergens.filter(a => a !== id))
    } else {
      setAllergens([...allergens, id])
    }
  }

  // Загрузка фото из галереи в Supabase Storage
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingAvatar(true);
    try {
      // 1. Сжимаем картинку
      const compressedBlob = await compressImage(file);
      
      const fileName = `${user.id}-${Date.now()}.jpg`;
      
      // 2. Загружаем в корзину 'avatars'
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      // 3. Получаем публичную ссылку
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setCustomAvatarUrl(publicUrl);
      setSelectedAvatarId('custom');
      
    } catch (error) {
      alert("Ошибка загрузки фото: " + (error.message || "Неизвестная ошибка"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      let finalAvatar = selectedAvatarId;
      if (selectedAvatarId === 'custom' && customAvatarUrl) {
        finalAvatar = customAvatarUrl;
      }

      // 1. Сохраняем имя и аватарку в metadata юзера
      const { error: authError } = await supabase.auth.updateUser({
        data: { 
          full_name: name.trim() || 'User',
          avatar_id: finalAvatar,
          profile_setup_done: true
        }
      })
      if (authError) throw authError

      // 2. Сохраняем аллергии и диету 
      await updateProfile({ halal, allergens })
      
      // 3. Отправляем в профиль
      navigate('/profile', { replace: true })
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / 3) * 100

  return (
    <>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="screen" style={{ 
        background: '#0F0F13', paddingTop: 0, paddingBottom: 40, 
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        color: '#fff'
      }}>
        
        {/* Progress Bar Header */}
        <div style={{ padding: '20px 24px', paddingTop: 60, position: 'relative', zIndex: 10 }}>
          {step > 1 && (
            <button onClick={handleBack} style={{ position: 'absolute', top: 50, left: 16, width: 44, height: 44, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED', letterSpacing: 1 }}>
              {lang === 'kz' ? `${step} ҚАДАМ 3-ТЕН` : `ШАГ ${step} ИЗ 3`}
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #7C3AED, #EC4899)', transition: 'width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
          
          {step === 1 && (
            <div style={{ animation: 'fadeUp 0.4s ease-out' }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 8 }}>
                {lang === 'kz' ? 'Сәлем!' : 'Давайте знакомиться'}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 40 }}>
                {lang === 'kz' ? 'Біз сізді қалай атайық? Бұл атау басқаларға көрінбейді.' : 'Как нам к вам обращаться? Вы можете использовать псевдоним.'}
              </p>

              <input 
                type="text" 
                placeholder={lang === 'kz' ? 'Лақап ат' : 'Ваше Имя / Псевдоним'} 
                value={name} 
                onChange={handleNameChange} 
                autoFocus
                style={{ 
                  background: 'transparent', border: 'none', 
                  borderBottom: nameError ? '2px solid #EF4444' : '2px solid rgba(255,255,255,0.2)', 
                  padding: '16px 0', color: '#fff', fontSize: 24, fontWeight: 600, 
                  width: '100%', outline: 'none', transition: 'border 0.2s',
                  fontFamily: 'var(--font-display)'
                }} 
                onFocus={(e) => { if (!nameError) e.target.style.borderBottomColor = '#EC4899' }}
                onBlur={(e) => { if (!nameError) e.target.style.borderBottomColor = 'rgba(255,255,255,0.2)' }}
              />
              {nameError && (
                <div style={{ color: '#EF4444', fontSize: 13, marginTop: 8, fontWeight: 500 }}>
                  {nameError}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ animation: 'fadeUp 0.4s ease-out', flex: 1 }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 8 }}>
                {lang === 'kz' ? 'Аватар таңдаңыз' : 'Выберите аватар'}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 40 }}>
                {lang === 'kz' ? 'Өз фотоңызды жүктеңіз немесе дайын аватарды таңдаңыз.' : 'Загрузите свое фото или выберите готовый вариант.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                
                {/* Кнопка "Загрузить свое фото" */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ 
                    aspectRatio: '1', borderRadius: 24, background: 'rgba(255,255,255,0.05)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    border: selectedAvatarId === 'custom' ? '3px solid #7C3AED' : '3px solid rgba(255,255,255,0.1)',
                    boxShadow: selectedAvatarId === 'custom' ? '0 10px 20px rgba(124,58,237,0.3)' : 'none',
                    transform: selectedAvatarId === 'custom' ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }} 
                  />
                  
                  {uploadingAvatar ? (
                    <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#EC4899', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  ) : customAvatarUrl ? (
                    <img src={customAvatarUrl} alt="Your Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                    </div>
                  )}

                  {selectedAvatarId === 'custom' && (
                    <div style={{ position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, background: '#34D399', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #0F0F13' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                  )}
                </div>

                {/* Готовые аватарки (DiceBear) */}
                {DEFAULT_AVATARS.map(av => (
                  <div 
                    key={av.id} 
                    onClick={() => setSelectedAvatarId(av.id)}
                    style={{ 
                      aspectRatio: '1', borderRadius: 24, background: 'rgba(255,255,255,0.05)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      border: selectedAvatarId === av.id ? '3px solid #fff' : '3px solid rgba(255,255,255,0.1)',
                      boxShadow: selectedAvatarId === av.id ? '0 10px 20px rgba(0,0,0,0.3)' : 'none',
                      transform: selectedAvatarId === av.id ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                  >
                    <img src={av.url} alt="Avatar" style={{ width: '85%', height: '85%', objectFit: 'cover' }} />
                    
                    {/* Галочка выбора */}
                    {selectedAvatarId === av.id && (
                      <div style={{ position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, background: '#34D399', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #0F0F13' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    )}
                  </div>
                ))}

              </div>
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  {lang === 'kz' ? 'Бірінші ұяшықты басып фото жүктеңіз' : 'Нажмите на первый квадрат, чтобы загрузить фото из галереи'}
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ animation: 'fadeUp 0.4s ease-out', flex: 1 }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 8 }}>
                {lang === 'kz' ? 'Сіздің мақсатыңыз' : 'Ваши предпочтения'}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 30 }}>
                {lang === 'kz' ? 'Körset сізге ескерту үшін диетаңызды белгілеңіз.' : 'Мы будем предупреждать вас о запрещенных ингредиентах.'}
              </p>

              {/* Халяль */}
              <div 
                onClick={() => setHalal(!halal)}
                style={{
                  background: halal ? 'linear-gradient(135deg, rgba(52,211,153,0.2) 0%, rgba(16,185,129,0.2) 100%)' : 'rgba(255,255,255,0.05)',
                  border: halal ? '1px solid #34D399' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', transition: 'all 0.2s', marginBottom: 24
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: halal ? '#34D399' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    🌙
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: halal ? '#34D399' : '#fff' }}>Halal</div>
                    <div style={{ fontSize: 13, color: halal ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.5)' }}>
                      {lang === 'kz' ? 'Күмәнді қоспаларды жасыру' : 'Определять сомнительные добавки'}
                    </div>
                  </div>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: 8, border: halal ? '2px solid #34D399' : '2px solid rgba(255,255,255,0.3)', background: halal ? '#34D399' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {halal && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
              </div>

              {/* Аллергии */}
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{lang === 'kz' ? 'Аллергия немесе диета' : 'У меня аллергия на:'}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {ALLERGEN_OPTIONS.map(a => {
                  const isActive = allergens.includes(a.id)
                  return (
                    <div 
                      key={a.id}
                      onClick={() => toggleAllergen(a.id)}
                      style={{
                        background: isActive ? '#7C3AED' : 'rgba(255,255,255,0.05)',
                        border: isActive ? '1px solid #7C3AED' : '1px solid rgba(255,255,255,0.1)',
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                        padding: '12px 20px', borderRadius: 100, fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      {isActive && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      {lang === 'kz' ? a.labelKz : a.labelRu}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Bottom Button Action */}
        <div style={{ padding: '24px', position: 'relative', zIndex: 10 }}>
          <button 
            onClick={step === 3 ? handleFinish : handleNext}
            disabled={loading || (step === 1 && (!name.trim() || nameError))} 
            style={{ 
              width: '100%',
              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)', 
              color: '#fff', border: 'none', padding: '18px', 
              borderRadius: 20, fontSize: 18, fontWeight: 800, 
              cursor: (loading || (step === 1 && (!name.trim() || nameError))) ? 'default' : 'pointer', 
              opacity: (loading || (step === 1 && (!name.trim() || nameError))) ? 0.5 : 1,
              boxShadow: '0 10px 25px rgba(236,72,153,0.3)',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
              transition: 'all 0.2s'
            }}
          >
            {loading ? '...' : step === 3 ? (lang === 'kz' ? 'Бастау' : 'Начать использование') : (lang === 'kz' ? 'Жалғастыру' : 'Продолжить')}
            {step < 3 && !loading && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            )}
          </button>
        </div>

      </div>
    </>
  )
}
