import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Building2, Bell, CreditCard,
  Activity, LogOut, Shield, ChevronRight
} from 'lucide-react'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/tenants',   icon: Building2,       label: 'Negocios'     },
  { to: '/alerts',    icon: Bell,            label: 'Alertas'      },
  { to: '/plans',     icon: CreditCard,      label: 'Planes'       },
  { to: '/activity',  icon: Activity,        label: 'Actividad'    },
]

export default function Layout() {
  const { operator, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    window.location.replace('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar */}
      <aside className="w-64 bg-dark flex flex-col fixed h-full z-20">

        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Puntto Ops</p>
              <p className="text-white/40 text-xs">Panel operador</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-primary border-l-2 border-primary'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Operador info */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-sm font-bold">
                {operator?.full_name?.charAt(0) || 'O'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{operator?.full_name}</p>
              <p className="text-white/40 text-xs truncate">{operator?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors text-sm font-medium mt-1"
          >
            <LogOut size={16} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
