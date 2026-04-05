import { Outlet } from 'react-router-dom'

export default function RetailLayout() {
  return (
    <div className="retail-shell">
      <div className="retail-shell__content public-scroll-surface">
        <Outlet />
      </div>
    </div>
  )
}
