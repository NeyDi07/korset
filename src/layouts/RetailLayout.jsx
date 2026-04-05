import { Outlet } from 'react-router-dom'

// Reserved shell for the future B2B / retail dashboard.
// Intentionally not wired into the router yet, but kept here so the
// consumer app and future retail app do not get mixed again.
export default function RetailLayout() {
  return (
    <div className="retail-shell">
      <div className="retail-shell__content">
        <Outlet />
      </div>
    </div>
  )
}
