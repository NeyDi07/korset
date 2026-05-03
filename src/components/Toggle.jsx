export default function Toggle({ checked, onChange, disabled = false }) {
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
        border: '1px solid var(--glass-soft-border)',
        background: checked ? 'linear-gradient(135deg,#7C3AED,#EC4899)' : 'var(--glass-bg)',
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
          boxShadow: checked ? '0 0 20px rgba(168,85,247,0.35)' : 'none',
        }}
      />
    </button>
  )
}
