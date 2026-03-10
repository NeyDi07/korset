import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import products from '../data/products.json'
import { formatPrice, CATEGORY_LABELS, checkProductFit } from '../utils/fitCheck.js'
import { loadProfile } from '../utils/profile.js'

import { BrowserMultiFormatReader } from '@zxing/browser'
import {
  BarcodeFormat,
  DecodeHintType
} from '@zxing/library'

export default function ScanScreen() {
  const navigate = useNavigate()
  const profile = loadProfile()

  const videoRef = useRef(null)
  const codeReaderRef = useRef(null)
  const controlsRef = useRef(null)

  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [lastCode, setLastCode] = useState('')
  const [manual, setManual] = useState('')

  const demoProducts = useMemo(() => {
    // можно оставить/удалить – список демо как fallback
    const ids = ['snickers50', 'snickers80', 'step50', 'cocacola05', 'cocacolazero05', 'tassay05']
    return ids.map(id => products.find(p => p.id === id)).filter(Boolean)
  }, [])

  const getCategoryClass = (cat) => {
    if (cat === 'grocery') return 'grocery'
    if (cat === 'electronics') return 'electronics'
    return 'diy'
  }

  const getFitDot = (product) => {
    const { fits } = checkProductFit(product, profile)
    return fits
  }

  function normalizeEAN(text) {
    if (!text) return ''
    // оставляем только цифры
    const digits = String(text).replace(/\D/g, '')
    // EAN-13 обычно 13 цифр, но иногда сканер вернёт больше/меньше
    // берём последние 13, если длиннее
    if (digits.length > 13) return digits.slice(-13)
    return digits
  }

  function openProductByEAN(eanRaw) {
    const ean = normalizeEAN(eanRaw)
    if (!ean) return false

    const found = products.find(p => String(p.ean || '') === ean)
    if (found) {
      navigate(`/product/${found.id}`)
      return true
    }
    return false
  }

  async function startScan() {
    setError('')
    setLastCode('')
    setManual('')
    setIsScanning(true)

    try {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.QR_CODE // пусть будет, не мешает. если вдруг на упаковке QR — тоже ок
      ])

      const reader = new BrowserMultiFormatReader(hints, 250)
      codeReaderRef.current = reader

      // задняя камера
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err, controlsInner) => {
          controlsRef.current = controlsInner
          if (result) {
            const raw = result.getText()
            setLastCode(raw)

            const ok = openProductByEAN(raw)
            if (!ok) {
              setError(`Товар с кодом ${normalizeEAN(raw) || raw} не найден в базе. Введите код вручную.`)
              // НЕ останавливаем скан сразу, но можно остановить, чтобы не мигало:
              stopScan()
            } else {
              stopScan()
            }
          }
        }
      )

      controlsRef.current = controls
    } catch (e) {
      setIsScanning(false)
      setError('Не удалось запустить камеру. Проверь разрешение камеры и HTTPS.')
      console.error(e)
    }
  }

  function stopScan() {
    try {
      if (controlsRef.current) {
        controlsRef.current.stop()
        controlsRef.current = null
      }
      if (codeReaderRef.current) {
        codeReaderRef.current.reset()
        codeReaderRef.current = null
      }
    } catch (e) {
      // ignore
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    return () => stopScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="screen">
      {/* Scan button area */}
      <div className="scan-btn-container">
        {!isScanning ? (
          <>
            <button className="scan-btn" onClick={startScan}>
              <div className="scan-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 7V4h3" />
                  <path d="M20 7V4h-3" />
                  <path d="M4 17v3h3" />
                  <path d="M20 17v3h-3" />
                  <path d="M7 8h1" />
                  <path d="M7 12h1" />
                  <path d="M7 16h1" />
                  <path d="M10 8h1" />
                  <path d="M10 12h1" />
                  <path d="M10 16h1" />
                  <path d="M13 8h1" />
                  <path d="M13 12h1" />
                  <path d="M13 16h1" />
                  <path d="M16 8h1" />
                  <path d="M16 12h1" />
                  <path d="M16 16h1" />
                </svg>
              </div>
              <span>Сканировать штрихкод (EAN)</span>
            </button>

            <p className="scan-hint">
              Наведи камеру на штрихкод. Если не считывается — введи EAN вручную.
            </p>

            {error && (
              <div className="card" style={{ marginTop: 10, borderColor: 'rgba(239,68,68,0.35)' }}>
                <div style={{ color: 'var(--error-bright)', fontSize: 13, lineHeight: 1.4 }}>{error}</div>
              </div>
            )}

            <div className="card" style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 6 }}>Ввод вручную (EAN)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  className="ai-input"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="например 5000159461122"
                  inputMode="numeric"
                />
                <button
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => {
                    const ok = openProductByEAN(manual)
                    if (!ok) setError('Не нашли товар по этому EAN. Проверь код или добавь товар в базу.')
                  }}
                >
                  Открыть
                </button>
              </div>
              {lastCode && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                  Последнее сканирование: <b>{normalizeEAN(lastCode) || lastCode}</b>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 10 }}>
                Камера включена. Наведи на штрихкод (EAN).
              </div>

              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
                  muted
                  playsInline
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="btn btn-secondary btn-full" onClick={stopScan}>
                  Остановить
                </button>
              </div>

              {error && (
                <div style={{ marginTop: 10, color: 'var(--error-bright)', fontSize: 13, lineHeight: 1.4 }}>
                  {error}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="divider" />

      {/* Demo list fallback */}
      <div className="section">
        <div className="section-title" style={{ marginBottom: 12 }}>Быстрый доступ (MVP)</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 10, lineHeight: 1.5 }}>
          Если штрихкод не считывается на этой упаковке — выбери товар здесь.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {demoProducts.map((product, i) => {
            const fits = profile?.presetId ? getFitDot(product) : null
            return (
              <div
                key={product.id}
                className="product-item"
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="product-emoji" style={{ display: 'grid', placeItems: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-bright)' }}>
                    <rect x="4" y="4" width="7" height="7" rx="1" />
                    <rect x="13" y="4" width="7" height="7" rx="1" />
                    <rect x="4" y="13" width="7" height="7" rx="1" />
                    <path d="M13 13h7v7" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="product-name" style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {product.name}
                  </div>
                  <div className="product-meta">
                    <span className="product-price">{formatPrice(product.priceKzt)}</span>
                    <span className="product-shelf">{product.shelf}</span>
                    <span className={`category-badge ${getCategoryClass(product.category)}`}>
                      {CATEGORY_LABELS[product.category]}
                    </span>
                  </div>
                </div>
                {fits !== null && (
                  <span style={{ fontSize: 16, flexShrink: 0, color: fits ? 'var(--success-bright)' : 'var(--error-bright)' }}>
                    {fits ? '✓' : '×'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}