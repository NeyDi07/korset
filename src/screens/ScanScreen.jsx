import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import products from '../data/products.json'
import { formatPrice, CATEGORY_LABELS, checkProductFit } from '../utils/fitCheck.js'
import { loadProfile } from '../utils/profile.js'

// ─── Barcode Scanner ──────────────────────────────────────────────────────────
function BarcodeScanner({ onDetected, onClose }) {
  const scannerRef = useRef(null)
  const [status, setStatus] = useState('Запуск камеры...')
  const [error, setError] = useState(null)
  const [active, setActive] = useState(false)
  const detectedRef = useRef(false)

  useEffect(() => {
    const scannerId = 'korset-scanner-view'

    async function start() {
      try {
        const scanner = new Html5Qrcode(scannerId)
        scannerRef.current = scanner

        const cameras = await Html5Qrcode.getCameras()
        if (!cameras.length) {
          setError('Камера не найдена на устройстве.')
          return
        }

        // prefer back camera
        const cam = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1]

        await scanner.start(
          cam.id,
          { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
          (decodedText) => {
            if (detectedRef.current) return
            detectedRef.current = true
            setStatus('✓ Считано!')
            scanner.stop().catch(() => {})
            onDetected(decodedText)
          },
          () => {} // ignore per-frame errors
        )

        setStatus('Наводите на штрихкод')
        setActive(true)
      } catch (e) {
        if (e.name === 'NotAllowedError' || String(e).includes('Permission')) {
          setError('Доступ к камере отклонён.\nРазрешите доступ в настройках браузера и попробуйте снова.')
        } else if (e.name === 'NotFoundError') {
          setError('Камера не найдена на устройстве.')
        } else {
          setError(`Ошибка: ${e.message || String(e)}`)
        }
      }
    }

    start()

    return () => {
      scannerRef.current?.stop().catch(() => {})
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      {/* Video area — html5-qrcode renders into this div */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          id="korset-scanner-view"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Corner overlay on top of video */}
        {!error && active && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ position: 'relative', width: 260, height: 155 }}>
              {[
                { top: -3, left: -3,  borderTop: '3px solid #A78BFA', borderLeft: '3px solid #A78BFA',  borderRadius: '4px 0 0 0'  },
                { top: -3, right: -3, borderTop: '3px solid #A78BFA', borderRight: '3px solid #A78BFA', borderRadius: '0 4px 0 0'  },
                { bottom: -3, left: -3,  borderBottom: '3px solid #A78BFA', borderLeft: '3px solid #A78BFA',  borderRadius: '0 0 0 4px' },
                { bottom: -3, right: -3, borderBottom: '3px solid #A78BFA', borderRight: '3px solid #A78BFA', borderRadius: '0 0 4px 0' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 26, height: 26, ...s }} />
              ))}
              <div style={{
                position: 'absolute', inset: '0 4px', height: 2,
                background: 'linear-gradient(90deg, transparent, #A78BFA 30%, #7C3AED 70%, transparent)',
                animation: 'scanLine 2s ease-in-out infinite',
                borderRadius: 2,
              }} />
            </div>
          </div>
        )}

        {/* Error screen */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(7,7,15,0.96)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px 24px', gap: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 52 }}>📷</div>
            <p style={{ color: '#F87171', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{error}</p>
            <button onClick={onClose} style={{
              padding: '13px 32px', borderRadius: 14,
              background: '#7C3AED', border: 'none',
              color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>Закрыть</button>
          </div>
        )}

        {/* Close button */}
        {!error && (
          <button onClick={onClose} style={{
            position: 'absolute', top: 52, right: 16, zIndex: 10,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(0,0,0,0.65)',
            border: '1.5px solid rgba(255,255,255,0.25)',
            color: 'white', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        )}
      </div>

      {/* Status bar */}
      {!error && (
        <div style={{
          padding: '20px 24px 40px',
          background: '#09090F',
          borderTop: '1px solid rgba(139,92,246,0.2)',
          textAlign: 'center',
        }}>
          <p style={{ color: active ? '#C4B5FD' : '#9898B8', fontSize: 15, fontWeight: 500 }}>
            {status}
          </p>
          <p style={{ color: '#58587A', fontSize: 12, marginTop: 6 }}>
            Штрихкод EAN-8 · EAN-13 · QR-код
          </p>
        </div>
      )}

      <style>{`
        /* hide html5-qrcode default UI */
        #korset-scanner-view video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        #korset-scanner-view img { display: none !important; }
        #korset-scanner-view canvas { display: none !important; }
        @keyframes scanLine {
          0%   { top: 8%; }
          50%  { top: 86%; }
          100% { top: 8%; }
        }
      `}</style>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ScanScreen() {
  const navigate = useNavigate()
  const profile = loadProfile()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [notFound, setNotFound] = useState(null)

  const hasProfile = Boolean(
    profile?.halal || profile?.halalOnly ||
    profile?.allergens?.length || profile?.dietGoals?.length
  )

  const handleDetected = (ean) => {
    setScannerOpen(false)
    const product = products.find(p => p.ean === ean)
    if (product) {
      navigate(`/product/${product.id}`)
    } else {
      setNotFound(ean)
    }
  }

  const demoProducts = products.slice(0, 8)

  return (
    <>
      {scannerOpen && (
        <BarcodeScanner onDetected={handleDetected} onClose={() => setScannerOpen(false)} />
      )}

      <div className="screen">
        <div className="scan-btn-container">
          <button
            className="scan-btn"
            onClick={() => { setNotFound(null); setScannerOpen(true) }}
          >
            <div className="scan-icon">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span>Сканировать штрихкод</span>
          </button>
          <p className="scan-hint">
            Наведите камеру на EAN штрихкод любого товара
          </p>
        </div>

        {notFound && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
              borderRadius: 'var(--radius)', padding: '14px 16px',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F87171', marginBottom: 4 }}>
                Товар не найден в каталоге
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                EAN: {notFound}
              </div>
            </div>
          </div>
        )}

        <div className="divider" />

        <div className="section">
          <div className="section-title" style={{ marginBottom: 10 }}>Демо-товары</div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
            Нажмите чтобы открыть карточку без сканирования
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demoProducts.map((product, i) => {
              const fits = hasProfile ? checkProductFit(product, profile).fits : null
              return (
                <div
                  key={product.id}
                  className="product-item"
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="product-emoji" style={{
                    background: 'var(--primary-dim)',
                    border: '1px solid rgba(139,92,246,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: 'var(--primary-bright)',
                  }}>
                    {product.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="product-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.name}
                    </div>
                    <div className="product-meta">
                      <span className="product-price">{formatPrice(product.priceKzt)}</span>
                      <span className="product-shelf">{product.shelf}</span>
                      <span className={`category-badge ${product.category}`}>{CATEGORY_LABELS[product.category]}</span>
                    </div>
                  </div>
                  {fits !== null && (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: fits ? 'rgba(16,185,129,0.15)' : 'rgba(220,38,38,0.12)',
                      border: `1.5px solid ${fits ? 'rgba(16,185,129,0.4)' : 'rgba(220,38,38,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700,
                      color: fits ? 'var(--success-bright)' : 'var(--error-bright)',
                    }}>
                      {fits ? '✓' : '✕'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
