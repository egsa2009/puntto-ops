import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Building2, Users, AlertTriangle, TrendingUp, Clock, CheckCircle, XCircle, PauseCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const STATUS_CONFIG = {
  trial:     { label: 'Trial',     color: 'bg-blue-100 text-blue-700'   },
  active:    { label: 'Activo',    color: 'bg-green-100 text-green-700' },
  expired:   { label: 'Vencido',   color: 'bg-amber-100 text-amber-700' },
  suspended: { label: 'Suspendido',color: 'bg-red-100 text-red-700'     },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500'   },
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState(null)
  const [expiring, setExpiring] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [{ data: subs }, { data: tenants }] = await Promise.all([
        supabase.from('subscriptions').select('status, ends_at, tenant_id'),
        supabase.from('tenants').select('id'),
      ])

      const all = subs || []
      const now = new Date()

      // Métricas por estado
      const byStatus = all.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1
        return acc
      }, {})

      // Vencen en 7 días
      const exp = all.filter(s => {
        if (s.status !== 'active' && s.status !== 'trial') return false
        const days = (new Date(s.ends_at) - now) / 1000 / 60 / 60 / 24
        return days >= 0 && days <= 7
      }).sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at))

      setStats({
        total:     (tenants || []).length,
        active:    byStatus.active    || 0,
        trial:     byStatus.trial     || 0,
        suspended: byStatus.suspended || 0,
        expired:   byStatus.expired   || 0,
        cancelled: byStatus.cancelled || 0,
        expiring:  exp.length,
      })

      // Cargar detalle de los que vencen pronto
      if (exp.length > 0) {
        const ids = exp.map(s => s.tenant_id)
        const { data: tenantData } = await supabase
          .from('tenants').select('id, name').in('id', ids)

        const tenantMap = {}
        ;(tenantData || []).forEach(t => { tenantMap[t.id] = t })

        setExpiring(exp.map(s => ({
          ...s,
          tenant: tenantMap[s.tenant_id],
          daysLeft: Math.ceil((new Date(s.ends_at) - now) / 1000 / 60 / 60 / 24),
        })))
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  )

  const kpis = [
    { label: 'Total negocios',  value: stats.total,     icon: Building2,    color: 'text-primary',   bg: 'bg-primary/10'  },
    { label: 'Activos',         value: stats.active,    icon: CheckCircle,  color: 'text-green-600', bg: 'bg-green-50'    },
    { label: 'En trial',        value: stats.trial,     icon: Clock,        color: 'text-blue-600',  bg: 'bg-blue-50'     },
    { label: 'Suspendidos',     value: stats.suspended, icon: PauseCircle,  color: 'text-red-500',   bg: 'bg-red-50'      },
    { label: 'Vencen en 7d',    value: stats.expiring,  icon: AlertTriangle,color: 'text-amber-600', bg: 'bg-amber-50'    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Vision general de la plataforma Puntto</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Vencen pronto */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h3 className="font-bold text-gray-800">Vencen en los proximos 7 dias</h3>
          </div>
          <button
            onClick={() => navigate('/alerts')}
            className="text-primary text-sm font-medium hover:underline"
          >
            Ver todas las alertas
          </button>
        </div>

        {expiring.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircle size={36} className="text-green-400 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Sin vencimientos proximos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Negocio</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Vence</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Dias restantes</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((s, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-3 font-medium text-gray-800">{s.tenant?.name || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_CONFIG[s.status]?.color}`}>
                      {STATUS_CONFIG[s.status]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(s.ends_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`font-bold ${s.daysLeft <= 2 ? 'text-red-500' : s.daysLeft <= 5 ? 'text-amber-500' : 'text-gray-700'}`}>
                      {s.daysLeft} {s.daysLeft === 1 ? 'dia' : 'dias'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => navigate(`/tenants/${s.tenant_id}`)}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Ver detalle →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
