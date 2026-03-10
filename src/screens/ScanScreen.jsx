import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import products from '../data/products.json'
import { formatPrice, CATEGORY_LABELS, checkProductFit } from '../utils/fitCheck.js'
import { loadProfile } from '../utils/profile.js'

// ─── Scanner ──────────────────────────────────────────────────────────────────
function BarcodeScanner({ onDetected, onClose }) {
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const scannerRef = useRef(null)
  const detectedRef = useRef(false)
  const ELEMENT_ID = 'html5qr-scanner'

  useEffect(() => {
    let scanner = null

    async function start() {
      try {
        // Dynamic import — avoids SSR issues and ensures DOM is ready
        const { Html5Qrcode } = await import('html5-qrcode')

        scanner = new Html5Qrcode(ELEMENT_ID, { verbose: false })
        scannerRef.current = scanner

        // Get cameras list first to show permission dialog properly
        const cameras = await Html5Qrcode.getCameras()
        if (!cameras || cameras.length === 0) {
          setError('Камера не обнаружена на устройстве.')
          return
        }

        // Prefer back camera, fallback to last (usually back on mobile)
        const cam =
          cameras.find(c => /back|rear|environment/i.test(c.label)) ||
          cameras[cameras.length - 1]

        await scanner.start(
          cam.id,
          {
            fps: 15,
            qrbox: (w, h) => {
              const size = Math.min(w, h) * 0.6
              return { width: Math.round(size * 1.8), height: Math.round(size * 0.8) }
            },
            aspectRatio: 1.7,
            disableFlip: false,
          },
          (decodedText) => {
            if (detectedRef.current) return
            detectedRef.current = true
            // small vibration if supported
            try { navigator.vibrate?.(80) } catch {}
            onDetected(decodedText)
          },
          () => {} // per-frame failure is normal - ignore
        )

        setReady(true)
      } catch (e) {
        const msg = String(e.message || e)
        if (/permission|not allowed|denied/i.test(msg)) {
          setError('Доступ к камере отклонён.\nРазрешите доступ в настройках браузера и перезагрузите страницу.')
        } else if (/not found|no camera/i.test(msg)) {
          setError('Камера не найдена на устройстве.')
        } else {
          setError(`Ошибка камеры:\n${msg}`)
        }
      }
    }

    start()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current.clear()
      }
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      {/* Scanner mounts here — html5-qrcode injects video into this div */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
        <div
          id={ELEMENT_ID}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Purple corner markers overlay */}
        {ready && !error && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ position: 'relative', width: 260, height: 130 }}>
              {[
                { top: -3, left: -3,   borderTop: '3px solid #A78BFA', borderLeft: '3px solid #A78BFA',  borderRadius: '4px 0 0 0' },
                { top: -3, right: -3,  borderTop: '3px solid #A78BFA', borderRight: '3px solid #A78BFA', borderRadius: '0 4px 0 0' },
                { bottom: -3, left: -3,  borderBottom: '3px solid #A78BFA', borderLeft: '3px solid #A78BFA',  borderRadius: '0 0 0 4px' },
                { bottom: -3, right: -3, borderBottom: '3px solid #A78BFA', borderRight: '3px solid #A78BFA', borderRadius: '0 0 4px 0' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 24, height: 24, ...s }} />
              ))}
              {/* scan line */}
              <div style={{
                position: 'absolute', left: 4, right: 4, height: 2,
                background: 'linear-gradient(90deg,transparent,#A78BFA 30%,#7C3AED 70%,transparent)',
                animation: 'scanLine 2s ease-in-out infinite',
                borderRadius: 2,
              }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(7,7,15,0.97)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '32px 28px', gap: 18, textAlign: 'center',
          }}>
            <div style={{ fontSize: 56 }}>📷</div>
            <p style={{ color: '#F87171', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{error}</p>
            <button onClick={onClose} style={{
              padding: '13px 36px', borderRadius: 14, background: '#7C3AED',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>Закрыть</button>
          </div>
        )}

        {/* Close btn */}
        {!error && (
          <button onClick={onClose} style={{
            position: 'absolute', top: 52, right: 16, zIndex: 20,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.25)',
            color: '#fff', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>×</button>
        )}
      </div>

      {/* Status bar */}
      {!error && (
        <div style={{
          padding: '18px 24px 40px', background: '#09090F',
          borderTop: '1px solid rgba(139,92,246,0.2)', textAlign: 'center',
        }}>
          <p style={{ color: ready ? '#C4B5FD' : '#9898B8', fontSize: 15, fontWeight: 500 }}>
            {ready ? 'Наводите на штрихкод товара' : 'Запуск камеры...'}
          </p>
          <p style={{ color: '#58587A', fontSize: 12, marginTop: 6 }}>
            EAN-8 · EAN-13 · QR · Code-128
          </p>
        </div>
      )}

      {/* Override html5-qrcode default styles */}
      <style>{`
        #${ELEMENT_ID} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important; left: 0 !important;
        }
        #${ELEMENT_ID} img { display: none !important; }
        #${ELEMENT_ID} > div:not([id]) { display: none !important; }
        #${ELEMENT_ID} canvas { display: none !important; }
        @keyframes scanLine {
          0%   { top: 6%; }
          50%  { top: 88%; }
          100% { top: 6%; }
        }
      `}</style>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ScanScreen() {
  const navigate = useNavigate()
  const profile = loadProfile()
  const [scannerOpen, setScannerOpen] = useState(false)

  const hasProfile = Boolean(
    profile?.halal || profile?.halalOnly ||
    profile?.allergens?.length || profile?.dietGoals?.length
  )

  const handleDetected = (ean) => {
    setScannerOpen(false)
    const local = products.find(p => p.ean === ean)
    if (local) {
      navigate(`/product/${local.id}`)
    } else {
      navigate(`/product/ext/${ean}`)
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
          <button className="scan-btn" onClick={() => setScannerOpen(true)}>
            <div className="scan-icon">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span>Сканировать штрихкод</span>
          </button>
          <p className="scan-hint">Наведите камеру на штрихкод любого товара</p>
        </div>

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
                <div key={product.id} className="product-item"
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="product-emoji" style={{
                    background: 'var(--primary-dim)',
                    border: '1px solid rgba(139,92,246,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: 'var(--primary-bright)',
                  }}>{product.name[0]}</div>
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
                    }}>{fits ? '✓' : '✕'}</div>
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
