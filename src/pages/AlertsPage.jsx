import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, PauseCircle, CheckCircle } from 'lucide-react'

const SECTIONS = [
  { key: 'critical', label: 'Critico — vencen en 0-2 dias',   color: 'text-red-500',    bg: 'bg-red-50',    icon: AlertTriangle },
  { key: 'warning',  label: 'Alerta — vencen en 3-7 dias',    color: 'text-amber-500',  bg: 'bg-amber-50',  icon: Clock         },
  { key: 'grace',    label: 'En periodo de gracia',            color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock         },
  { key: 'suspended',label: 'Suspendidos',                     color: 'text-red-400',    bg: 'bg-red-50',    icon: PauseCircle   },
]

export default function AlertsPage() {
  const [groups,  setGroups]  = useState({ critical: [], warning: [], grace: [], suspended: [] })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('id, status, ends_at, grace_period_days, tenant_id, plan_id')
        .in('status', ['active', 'trial', 'expired', 'suspended'])

      const tenantIds = [...new Set((subs || []).map(s => s.tenant_id))]
      const { data: tenants } = await supabase
        .from('tenants').select('id, name').in('id', tenantIds)

      const tenantMap = {}
      ;(tenants || []).forEach(t => { tenantMap[t.id] = t })

      const now = new Date()
      const result = { critical: [], warning: [], grace: [], suspended: [] }

      for (const s of (subs || [])) {
        const tenant   = tenantMap[s.tenant_id]
        const endsAt   = new Date(s.ends_at)
        const daysLeft = Math.ceil((endsAt - now) / 1000 / 60 / 60 / 24)
        const row      = { ...s, tenant, daysLeft }

        if (s.status === 'suspended') {
          result.suspended.push(row)
        } else if (s.status === 'expired') {
          result.grace.push(row)
        } else if (daysLeft >= 0 && daysLeft <= 2) {
          result.critical.push(row)
        } else if (daysLeft >= 3 && daysLeft <= 7) {
          result.warning.push(row)
        }
      }

      setGroups(result)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  )

  const total = Object.values(groups).reduce((a, g) => a + g.length, 0)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Alertas</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total === 0 ? 'Sin alertas activas' : `${total} negocios requieren atencion`}
        </p>
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Todo en orden</p>
          <p className="text-gray-300 text-sm mt-1">No hay negocios con alertas activas</p>
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map(({ key, label, color, bg, icon: Icon }) => {
            const items = groups[key]
            if (items.length === 0) return null
            return (
              <div key={key} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className={`px-6 py-4 border-b border-gray-100 flex items-center gap-2 ${bg}`}>
                  <Icon size={16} className={color} />
                  <h3 className={`font-bold text-sm ${color}`}>{label}</h3>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white ${color}`}>
                    {items.length}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Negocio</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Vencimiento</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Dias</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(row => (
                      <tr key={row.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-6 py-3 font-medium text-gray-800">{row.tenant?.name || '—'}</td>
                        <td className="px-6 py-3 text-gray-500">
                          {new Date(row.ends_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`font-bold ${color}`}>
                            {row.daysLeft < 0 ? `Hace ${Math.abs(row.daysLeft)}d` : `${row.daysLeft}d`}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => navigate(`/tenants/${row.tenant_id}`)}
                            className="text-primary text-xs font-medium hover:underline"
                          >
                            Gestionar →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
