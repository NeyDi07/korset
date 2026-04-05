import { Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="public-shell">
      <div className="public-shell__content">
        <Outlet />
      </div>
    </div>
  )
}
