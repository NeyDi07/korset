import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'

export default function AppLayout() {
  const { pathname } = useLocation()
  const hideNav = pathname === '/qr-print'

  return (
    <div className="app-shell">
      <div className="app-frame">
        <Outlet />
        {!hideNav && <BottomNav />}
      </div>
    </div>
  )
}
