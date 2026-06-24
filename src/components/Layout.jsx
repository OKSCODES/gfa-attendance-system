import { Link, NavLink } from 'react-router-dom'
import { LogOut, MapPin } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Layout = ({ children, navItems }) => {
  const { logout, session } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur md:bottom-0 md:left-0 md:right-auto md:w-72 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between px-5 md:h-auto md:flex-col md:items-stretch md:gap-8 md:p-6">
          <Link to="/" className="flex items-center gap-3 font-bold text-slate-900">
            <span className="rounded-2xl bg-blue-600 p-2 text-white"><MapPin size={20} /></span>
            <span>GeoFence</span>
          </Link>
          <div className="hidden rounded-2xl bg-slate-50 p-4 md:block">
            <p className="text-xs uppercase tracking-wide text-slate-400">Logged in as</p>
            <p className="mt-1 font-semibold text-slate-800">{session?.username || session?.email}</p>
            <p className="text-sm capitalize text-slate-500">{session?.role}</p>
          </div>
          <nav className="hidden gap-2 md:flex md:flex-col">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `rounded-xl px-4 py-3 text-sm font-semibold ${isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={logout} className="btn-secondary md:w-full"><LogOut size={18} /> Logout</button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="px-4 pb-10 pt-32 md:ml-72 md:px-8 md:pt-8">{children}</main>
    </div>
  )
}
export default Layout
