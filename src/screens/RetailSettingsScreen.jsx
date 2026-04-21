import { useState, useRef, useEffect } from 'react'
import { useI18n } from '../utils/i18n.js'
import { useStore } from '../contexts/StoreContext.jsx'
import { supabase } from '../utils/supabase.js'
import QRCode from 'react-qr-code'
import { clearStoreCatalog } from '../utils/retailAnalytics.js'
import ConfirmDangerModal from '../components/ConfirmDangerModal.jsx'

export default function RetailSettingsScreen() {
  const { lang } = useI18n()
  const { currentStore, updateStoreSettings } = useStore()
  const isKz = lang === 'kz'

  const [settings, setSettings] = useState({
    name: currentStore?.name || '',
    address: currentStore?.address || '',
    phone: currentStore?.phone || '',
    short_description: currentStore?.short_description || '',
    description: currentStore?.description || '',
    instagram_url: currentStore?.instagram_url || '',
    whatsapp_number: currentStore?.whatsapp_number || '',
    twogis_url: currentStore?.twogis_url || '',
    notifyMissing: currentStore?.notify_oos_enabled ?? true,
    notifyDaily: currentStore?.notify_daily_enabled ?? false,
  })
  const [showQR, setShowQR] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'ok' | 'error'
  const [savingToggle, setSavingToggle] = useState(null)
  const [showClearModal, setShowClearModal] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState(currentStore?.logo_url || null)
  const logoInputRef = useRef(null)
  const qrRef = useRef(null)

  // Sync ALL fields when store data arrives from Supabase
  useEffect(() => {
    if (currentStore) {
      setSettings((prev) => ({
        ...prev,
        name: currentStore.name || prev.name,
        address: currentStore.address || prev.address,
        phone: currentStore.phone || prev.phone,
        short_description: currentStore.short_description || prev.short_description,
        description: currentStore.description || prev.description,
        instagram_url: currentStore.instagram_url || prev.instagram_url,
        whatsapp_number: currentStore.whatsapp_number || prev.whatsapp_number,
        twogis_url: currentStore.twogis_url || prev.twogis_url,
        notifyMissing: currentStore.notify_oos_enabled ?? prev.notifyMissing,
        notifyDaily: currentStore.notify_daily_enabled ?? prev.notifyDaily,
      }))
      setLogoUrl(currentStore.logo_url || null)
    }
  }, [currentStore?.id])

  const handleChange = (key, val) => {
    setSettings((p) => ({ ...p, [key]: val }))
    setSaveStatus(null)
  }

  // Auto-save toggle to Supabase immediately on click
  const handleToggle = async (key, dbField) => {
    const newVal = !settings[key]
    // Optimistic update — feels instant
    setSettings((p) => ({ ...p, [key]: newVal }))
    setSavingToggle(key)
    const { error } = await updateStoreSettings({ [dbField]: newVal })
    setSavingToggle(null)
    if (error) {
      // Revert on failure
      setSettings((p) => ({ ...p, [key]: !newVal }))
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus(null)
    const { error } = await updateStoreSettings({
      name: settings.name,
      address: settings.address,
      phone: settings.phone || null,
      short_description: settings.short_description || null,
      description: settings.description || null,
      instagram_url: settings.instagram_url || null,
      whatsapp_number: settings.whatsapp_number
        ? settings.whatsapp_number.replace(/\D/g, '')
        : null,
      twogis_url: settings.twogis_url || null,
    })
    setIsSaving(false)
    setSaveStatus(error ? 'error' : 'ok')
    setTimeout(() => setSaveStatus(null), 3000)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !currentStore?.id) return

    // Client-side validation
    const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
    if (!ALLOWED.includes(file.type)) {
      alert(
        isKz ? 'Тек PNG, JPG, WEBP форматтары рұқсат етілген' : 'Разрешены только PNG, JPG, WEBP'
      )
      if (logoInputRef.current) logoInputRef.current.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert(isKz ? 'Файл 2MB-тан аспауы керек' : 'Файл не должен превышать 2MB')
      if (logoInputRef.current) logoInputRef.current.value = ''
      return
    }

    const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${currentStore.id}/logo.${ext}`
    setLogoUploading(true)

    const { error: uploadError } = await supabase.storage
      .from('store-logos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
      const msg = uploadError.message || uploadError.error || String(uploadError)
      const isBucketMissing = msg.includes('Bucket not found') || msg.includes('bucket')
      if (isBucketMissing) {
        alert(
          isKz
            ? 'Bucket табылмады. Supabase Dashboard → Storage → "store-logos" bucket жасаңыз (Public: иә)'
            : 'Bucket не найден. Создайте в Supabase Dashboard → Storage → New Bucket → name: "store-logos" (Public: вкл)'
        )
      } else {
        alert(isKz ? 'Жүктеу қатесі: ' + msg : 'Ошибка загрузки: ' + msg)
      }
      return
    }

    const { data: urlData } = supabase.storage.from('store-logos').getPublicUrl(path)
    const url = urlData?.publicUrl
    if (url) {
      await updateStoreSettings({ logo_url: url })
      setLogoUrl(url + '?t=' + Date.now()) // cache-bust
    }
    if (logoInputRef.current) logoInputRef.current.value = ''
    setLogoUploading(false)
  }

  // Generate store invite URL for QR code
  const storeInviteUrl = currentStore?.code
    ? `${window.location.origin}/join/${currentStore.code}`
    : `${window.location.origin}/join/demo-store`

  // Download QR code as PNG
  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = 400
      canvas.height = 400
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 400, 400)
      ctx.drawImage(img, 40, 40, 320, 320)

      // Add KÖRSET label
      ctx.fillStyle = '#7C3AED'
      ctx.fillRect(130, 350, 140, 30)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('KÖRSET', 200, 370)

      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.download = `korset-store-${currentStore?.code || 'invite'}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const handleConfirmClear = async () => {
    if (!currentStore?.id) return
    try {
      setIsClearing(true)
      await clearStoreCatalog(currentStore.id)
      setIsClearing(false)
      setShowClearModal(false)
    } catch (e) {
      setIsClearing(false)
      alert(isKz ? 'Қателік орын алды: ' + e.message : 'Ошибка при удалении: ' + e.message)
    }
  }
  const formatPhoneKz = (raw) => {
    const digits = raw.replace(/\D/g, '')
    let d = digits
    if (d.startsWith('8')) d = '7' + d.slice(1)
    else if (d.length > 0 && !d.startsWith('7')) d = '7' + d
    d = d.slice(0, 11)
    if (!d) return ''
    let r = '+7'
    if (d.length > 1) r += ' (' + d.slice(1, Math.min(4, d.length))
    if (d.length >= 4) r += ')'
    if (d.length > 4) r += ' ' + d.slice(4, Math.min(7, d.length))
    if (d.length > 7) r += '-' + d.slice(7, Math.min(9, d.length))
    if (d.length > 9) r += '-' + d.slice(9, 11)
    return r
  }

  const SECTION_LABEL_STYLE = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  }
  const CARD_STYLE = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
  }
  const INPUT_STYLE = {
    width: '100%',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '12px 14px',
    borderRadius: 10,
    fontSize: 15,
    outline: 'none',
    fontFamily: 'var(--font-body)',
  }
  const FIELD_LABEL = { fontSize: 13, color: 'var(--text-sub)', marginBottom: 6 }
  const DIVIDER = { height: 1, background: 'rgba(255,255,255,0.05)' }

  return (
    <>
      <ConfirmDangerModal
        open={showClearModal}
        title={isKz ? 'Каталогты тазарту' : 'Очистить каталог'}
        description={
          isKz
            ? 'Бұл әрекет барлық жүктелген тауарларды жояды. Бұл әрекетті болдырмау мүмкін емес.'
            : 'Это действие удалит все добавленные товары из каталога магазина. Отменить невозможно.'
        }
        confirmWord={isKz ? 'ТАЗАРТУ' : 'СБРОС'}
        confirmLabel={isKz ? 'Тазарту' : 'Удалить всё'}
        cancelLabel={isKz ? 'Болдырмау' : 'Отмена'}
        onConfirm={handleConfirmClear}
        onCancel={() => setShowClearModal(false)}
        loading={isClearing}
      />
      <div style={{ padding: '20px 16px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: '#fff',
              margin: '0 0 4px',
            }}
          >
            {isKz ? 'Магазин баптаулары' : 'Настройки профиля'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-sub)', margin: 0 }}>
            {isKz ? 'Сауда нүктесін басқару' : 'Управление торговой точкой'}
          </p>
        </div>

        {/* ── Лого магазина ── */}
        <div>
          <div style={SECTION_LABEL_STYLE}>{isKz ? 'ЛОГОТИП' : 'ЛОГОТИП МАГАЗИНА'}</div>
          <div style={{ ...CARD_STYLE, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 28, color: 'var(--text-dim)' }}
                  >
                    store
                  </span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, marginBottom: 4 }}>
                  {isKz ? 'Дүкен логотипі' : 'Логотип магазина'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
                  {isKz ? 'PNG, JPG · Макс. 2MB' : 'PNG, JPG · Макс. 2MB'}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleLogoUpload}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    background: 'rgba(56,189,248,0.1)',
                    border: '1px solid rgba(56,189,248,0.25)',
                    color: '#38BDF8',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: logoUploading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: logoUploading ? 0.6 : 1,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {logoUploading ? 'progress_activity' : 'upload'}
                  </span>
                  {logoUploading
                    ? isKz
                      ? 'Жүктелуде...'
                      : 'Загружаем...'
                    : isKz
                      ? 'Жүктеу'
                      : 'Загрузить'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Основная информация ── */}
        <div>
          <div style={SECTION_LABEL_STYLE}>{isKz ? 'НЕГІЗГІ АҚПАРАТ' : 'ОСНОВНАЯ ИНФОРМАЦИЯ'}</div>
          <div style={CARD_STYLE}>
            <div style={{ padding: '16px 16px' }}>
              <div style={FIELD_LABEL}>{isKz ? 'Дүкен атауы' : 'Название магазина'}</div>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => handleChange('name', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>

            <div style={DIVIDER} />

            <div style={{ padding: '16px 16px' }}>
              <div style={FIELD_LABEL}>{isKz ? 'Мекенжай' : 'Фактический адрес'}</div>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => handleChange('address', e.target.value)}
                style={INPUT_STYLE}
              />
            </div>

            <div style={DIVIDER} />

            <div style={{ padding: '16px 16px' }}>
              <div style={FIELD_LABEL}>{isKz ? 'Телефон' : 'Телефон'}</div>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => handleChange('phone', formatPhoneKz(e.target.value))}
                placeholder="+7 (700) 000-00-00"
                inputMode="numeric"
                style={INPUT_STYLE}
              />
            </div>
          </div>
        </div>

        {/* ── Описание магазина ── */}
        <div>
          <div style={SECTION_LABEL_STYLE}>{isKz ? 'СИПАТТАМА' : 'ОПИСАНИЕ'}</div>
          <div style={CARD_STYLE}>
            <div style={{ padding: '16px' }}>
              <div style={FIELD_LABEL}>
                {isKz ? 'Қысқаша сипаттама' : 'Краткое описание'}
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>
                  {isKz ? '(Басты экранда көрінеді)' : '(Видно на главном экране)'}
                </span>
              </div>
              <input
                type="text"
                value={settings.short_description}
                onChange={(e) => handleChange('short_description', e.target.value)}
                placeholder={
                  isKz ? 'Мысалы: Табиғи өнімдер дүкені' : 'Например: Магазин натуральных продуктов'
                }
                maxLength={120}
                style={INPUT_STYLE}
              />
              <div
                style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, textAlign: 'right' }}
              >
                {(settings.short_description || '').length}/120
              </div>
            </div>

            <div style={DIVIDER} />

            <div style={{ padding: '16px' }}>
              <div style={FIELD_LABEL}>
                {isKz ? 'Толық сипаттама' : 'Полное описание'}
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>
                  {isKz ? '(«Толығырақ» батырмасы арқылы)' : '(По кнопке «Подробнее»)'}
                </span>
              </div>
              <textarea
                value={settings.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder={
                  isKz
                    ? 'Дүкен тарихы, ерекшеліктері, жұмыс уақыты...'
                    : 'История магазина, особенности, режим работы...'
                }
                rows={4}
                style={{
                  ...INPUT_STYLE,
                  resize: 'vertical',
                  minHeight: 100,
                  lineHeight: 1.5,
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Контакты и соцсети ── */}
        <div>
          <div style={SECTION_LABEL_STYLE}>{isKz ? 'БАЙЛАНЫС' : 'КОНТАКТЫ И СОЦСЕТИ'}</div>
          <div style={CARD_STYLE}>
            {[
              {
                key: 'instagram_url',
                label: 'Instagram',
                icon: 'photo_camera',
                iconColor: '#E1306C',
                placeholder: 'https://instagram.com/yourstore',
                type: 'url',
              },
              {
                key: 'whatsapp_number',
                label: 'WhatsApp',
                icon: 'chat',
                iconColor: '#25D366',
                placeholder: '+7 (700) 000-00-00',
                type: 'tel',
                mask: true,
              },
              {
                key: 'twogis_url',
                label: '2GIS',
                icon: 'location_on',
                iconColor: '#2A6EDD',
                placeholder: 'https://2gis.kz/...',
                type: 'url',
              },
            ].map((field, idx, arr) => (
              <div key={field.key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `${field.iconColor}18`,
                      border: `1px solid ${field.iconColor}35`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 18, color: field.iconColor }}
                    >
                      {field.icon}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                      {field.label}
                    </div>
                    <input
                      type={field.type}
                      value={settings[field.key]}
                      onChange={(e) =>
                        field.mask
                          ? handleChange(field.key, formatPhoneKz(e.target.value))
                          : handleChange(field.key, e.target.value)
                      }
                      inputMode={field.mask ? 'numeric' : undefined}
                      placeholder={field.placeholder}
                      style={{
                        ...INPUT_STYLE,
                        padding: '8px 12px',
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>
                {idx < arr.length - 1 && <div style={{ ...DIVIDER, margin: '0 16px' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '13px 16px',
            borderRadius: 12,
            background: isSaving ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.85)',
            border: 'none',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: isSaving ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'background 0.2s',
          }}
        >
          {isSaving ? (
            <>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}
              >
                progress_activity
              </span>
              {isKz ? 'Сақталуда...' : 'Сохраняем...'}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                save
              </span>
              {isKz ? 'Сақтау' : 'Сохранить настройки'}
            </>
          )}
        </button>

        {/* Save status feedback */}
        {saveStatus === 'ok' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#4ADE80',
              fontSize: 13,
              marginTop: 8,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              check_circle
            </span>
            {isKz ? 'Сәтті сақталды' : 'Сохранено успешно'}
          </div>
        )}
        {saveStatus === 'error' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#F87171',
              fontSize: 13,
              marginTop: 8,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              error
            </span>
            {isKz ? 'Қате орын алды' : 'Ошибка сохранения. Попробуйте ещё раз.'}
          </div>
        )}

        {/* QR Code for Store Invite */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 8,
              paddingLeft: 4,
            }}
          >
            {isKz ? 'МАГАЗИНГА ШАҚЫРУ' : 'ПРИГЛАШЕНИЕ В МАГАЗИН'}
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(124,58,237,0.15)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#A78BFA"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>
                  {isKz ? 'QR-код арқылы қосылу' : 'Подключение по QR-коду'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                  {isKz
                    ? 'Клиенттер бұл кодты сканерлеп магазинге қосыла алады'
                    : 'Клиенты сканируют код для входа в магазин'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowQR(!showQR)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(124,58,237,0.25)',
                color: '#A78BFA',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: showQR ? 16 : 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {showQR ? 'visibility_off' : 'qr_code'}
              </span>
              {showQR
                ? isKz
                  ? 'Жасыру'
                  : 'Скрыть QR-код'
                : isKz
                  ? 'QR-кодты көрсету'
                  : 'Показать QR-код'}
            </button>

            {showQR && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                  padding: '20px 16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 12,
                  border: '1px dashed rgba(124,58,237,0.3)',
                }}
              >
                {/* Real QR Code */}
                <div
                  ref={qrRef}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    position: 'relative',
                  }}
                >
                  <QRCode
                    value={storeInviteUrl}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 20,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#7C3AED',
                      color: '#fff',
                      padding: '4px 14px',
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    KÖRSET
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                    {isKz ? 'Сілтеме:' : 'Ссылка:'}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#A78BFA',
                      fontFamily: 'monospace',
                      background: 'rgba(124,58,237,0.1)',
                      padding: '8px 12px',
                      borderRadius: 8,
                      wordBreak: 'break-all',
                    }}
                  >
                    {storeInviteUrl}
                  </div>
                </div>

                <div
                  style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
                >
                  <button
                    onClick={() => navigator.clipboard?.writeText(storeInviteUrl)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 10,
                      background: 'rgba(56,189,248,0.1)',
                      border: '1px solid rgba(56,189,248,0.25)',
                      color: '#38BDF8',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      content_copy
                    </span>
                    {isKz ? 'Көшіру' : 'Копировать'}
                  </button>

                  <button
                    onClick={downloadQR}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 10,
                      background: 'rgba(124,58,237,0.15)',
                      border: '1px solid rgba(124,58,237,0.3)',
                      color: '#A78BFA',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      download
                    </span>
                    {isKz ? 'Жүктеу PNG' : 'Скачать PNG'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 8,
              paddingLeft: 4,
            }}
          >
            {isKz ? 'ХАБАРЛАНДЫРУЛАР' : 'УВЕДОМЛЕНИЯ'}
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
            }}
          >
            {/* Toggle 1 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: 15, color: '#fff', fontWeight: 500, marginBottom: 4 }}>
                  {isKz ? 'Жоқ тауарлар' : 'Отсутствующие товары'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                  {isKz
                    ? 'Сатып алушылар таба алмаған тауарлар туралы хабарлау'
                    : 'Пуш-уведомление, если клиент не нашел товар'}
                </div>
              </div>
              <div
                onClick={() => handleToggle('notifyMissing', 'notify_oos_enabled')}
                style={{
                  width: 50,
                  height: 28,
                  borderRadius: 14,
                  cursor: savingToggle === 'notifyMissing' ? 'default' : 'pointer',
                  flexShrink: 0,
                  opacity: savingToggle === 'notifyMissing' ? 0.6 : 1,
                  background: settings.notifyMissing ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                  position: 'relative',
                  transition: 'background 0.3s, opacity 0.2s',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: settings.notifyMissing ? 25 : 3,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                />
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />

            {/* Toggle 2 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: 15, color: '#fff', fontWeight: 500, marginBottom: 4 }}>
                  {isKz ? 'Күнделікті есеп' : 'Ежедневный отчет'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                  {isKz ? 'Кешкі сканерлеу статистикасы' : 'Сводка сканирований каждый вечер'}
                </div>
              </div>
              <div
                onClick={() => handleToggle('notifyDaily', 'notify_daily_enabled')}
                style={{
                  width: 50,
                  height: 28,
                  borderRadius: 14,
                  cursor: savingToggle === 'notifyDaily' ? 'default' : 'pointer',
                  flexShrink: 0,
                  opacity: savingToggle === 'notifyDaily' ? 0.6 : 1,
                  background: settings.notifyDaily ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                  position: 'relative',
                  transition: 'background 0.3s, opacity 0.2s',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: settings.notifyDaily ? 25 : 3,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Опасная зона ── */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#EF4444',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 8,
              paddingLeft: 4,
            }}
          >
            {isKz ? 'ҚАУІПТІ АЙМАҚ' : 'ОПАСНАЯ ЗОНА'}
          </div>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 16,
            }}
          >
            <div
              style={{
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: '#EF4444', fontWeight: 500, marginBottom: 4 }}>
                  {isKz ? 'Каталогты тазарту' : 'Очистить каталог'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {isKz
                    ? 'Барлық жүктелген тауарларды өшіру'
                    : 'Удалить все добавленные товары из системы'}
                </div>
              </div>
              <button
                onClick={() => setShowClearModal(true)}
                disabled={isClearing}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  padding: '8px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isClearing ? 'wait' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {isKz ? 'Тазарту' : 'Сброс'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
