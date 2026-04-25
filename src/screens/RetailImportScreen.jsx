import { useMemo, useState } from 'react'
import { parseRetailImportFile, applyRetailImport } from '../utils/retailImport.js'
import { useI18n } from '../utils/i18n.js'
import { useStore } from '../contexts/StoreContext.jsx'

const MAX_FILE_SIZE = 5 * 1024 * 1024

function StatCard({ label, value, color = '#38BDF8' }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: 14,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
    </div>
  )
}

export default function RetailImportScreen() {
  const { t: dict } = useI18n()
  const { storeId } = useStore()
  const t = dict.retail.import
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  const canApply = storeId && rows.length > 0 && status !== 'applying'
  const previewRows = useMemo(() => rows.slice(0, 8), [rows])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setMessage(t.fileTooLarge)
      return
    }

    setStatus('parsing')
    setMessage('')
    setResult(null)
    setFileName(file.name)

    try {
      const parsed = await parseRetailImportFile(file)
      setRows(parsed.rows)
      setErrors(parsed.errors)
      setStatus('ready')
      if (parsed.rows.length === 0) setMessage(t.empty)
    } catch {
      setRows([])
      setErrors([])
      setStatus('idle')
      setMessage(t.parseError)
    }
  }

  const handleApply = async () => {
    if (!canApply) return
    setStatus('applying')
    setMessage('')
    try {
      const nextResult = await applyRetailImport(storeId, rows)
      setResult(nextResult)
      setStatus('done')
    } catch (error) {
      setStatus('ready')
      setMessage(error.message || t.parseError)
    }
  }

  const reset = () => {
    setFileName('')
    setRows([])
    setErrors([])
    setResult(null)
    setStatus('idle')
    setMessage('')
  }

  return (
    <div style={{ padding: '20px 16px 80px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            color: '#fff',
            margin: '0 0 8px',
          }}
        >
          {t.title}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-sub)', margin: 0, lineHeight: 1.45 }}>
          {t.subtitle}
        </p>
      </div>

      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 176,
          padding: '28px 20px',
          borderRadius: 20,
          cursor: 'pointer',
          background: 'rgba(56,189,248,0.055)',
          border: '1.5px dashed rgba(56,189,248,0.46)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 38, color: '#38BDF8' }}>
          upload_file
        </span>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 12 }}>
          {fileName || t.choose}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', marginTop: 6 }}>
          {t.formats}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 10 }}>
          {t.template}
        </div>
        <input
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </label>

      {message && (
        <div
          style={{
            padding: 13,
            borderRadius: 14,
            color: '#FBBF24',
            background: 'rgba(251,191,36,0.09)',
            border: '1px solid rgba(251,191,36,0.2)',
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      {(rows.length > 0 || errors.length > 0) && (
        <div style={{ display: 'flex', gap: 10 }}>
          <StatCard label={t.validRows} value={rows.length} color="#34D399" />
          <StatCard label={t.errors} value={errors.length} color="#FBBF24" />
          <StatCard label={t.skipped} value={result?.skipped?.length || 0} color="#F87171" />
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <h3
              style={{ margin: 0, fontSize: 16, color: '#fff', fontFamily: 'var(--font-display)' }}
            >
              {result ? t.report : t.preview}
            </h3>
            <button
              onClick={reset}
              style={{
                background: 'none',
                border: 'none',
                color: '#93C5FD',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.reset}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {previewRows.map((row) => (
              <div
                key={row.ean}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 10,
                  padding: 12,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>{row.ean}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 3 }}>
                    {row.localName || row.shelfZone || row.stockStatus}
                  </div>
                </div>
                <div style={{ color: '#A7F3D0', fontWeight: 900 }}>{row.priceKzt} ₸</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {errors.slice(0, 5).map((error, index) => (
            <div key={`${error.row}-${index}`} style={{ fontSize: 12, color: '#FBBF24' }}>
              {error.row ? `${t.rowLabel} ${error.row}: ` : ''}
              {error.ean ? `${error.ean} — ` : ''}
              {error.message}
            </div>
          ))}
        </div>
      )}

      {result?.skipped?.length > 0 && (
        <div
          style={{
            padding: 13,
            borderRadius: 14,
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.18)',
            color: '#FCA5A5',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {t.unknownHint}
        </div>
      )}

      <button
        onClick={handleApply}
        disabled={!canApply}
        style={{
          padding: '15px 18px',
          borderRadius: 16,
          border: 'none',
          background: canApply
            ? 'linear-gradient(135deg, #0EA5E9, #2563EB)'
            : 'rgba(255,255,255,0.06)',
          color: canApply ? '#fff' : 'rgba(255,255,255,0.35)',
          fontSize: 15,
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          cursor: canApply ? 'pointer' : 'not-allowed',
          boxShadow: canApply ? '0 12px 26px rgba(14,165,233,0.22)' : 'none',
        }}
      >
        {!storeId
          ? t.noStore
          : status === 'applying'
            ? t.applying
            : result
              ? `${t.updated}: ${result.updated}`
              : t.apply}
      </button>
    </div>
  )
}
