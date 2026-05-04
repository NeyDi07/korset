export default function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onChange(!checked)
      }}
      style={{
        position: 'relative',
        width: 48,
        height: 28,
        borderRadius: 999,
        border: checked ? '1px solid var(--primary)' : '1px solid var(--glass-soft-border)',
        background: checked ? 'var(--primary)' : 'var(--glass-subtle)',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        }}
      />
    </button>
  )
}
