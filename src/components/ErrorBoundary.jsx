import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Körset ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#07070F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
              color: '#E8E8FF', marginBottom: 8,
            }}>
              Что-то пошло не так
            </h2>
            <p style={{ fontSize: 14, color: '#8E8EB6', lineHeight: 1.6, marginBottom: 24 }}>
              Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '14px 32px', borderRadius: 14, border: 'none',
                background: '#7C3AED', color: '#fff',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                boxShadow: '0 4px 24px rgba(124,58,237,0.3)',
              }}
            >
              Перезагрузить
            </button>
            {this.state.error && (
              <p style={{
                marginTop: 24, fontSize: 11, color: '#8E8EB6', opacity: 0.4,
                fontFamily: 'monospace', wordBreak: 'break-all',
              }}>
                {String(this.state.error)}
              </p>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
