import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Search, Building2, ChevronRight, Filter } from 'lucide-react'

const STATUS_CONFIG = {
  trial:     { label: 'Trial',          color: 'bg-blue-100 text-blue-700'    },
  active:    { label: 'Activo',         color: 'bg-green-100 text-green-700'  },
  expired:   { label: 'Vencido',        color: 'bg-amber-100 text-amber-700'  },
  suspended: { label: 'Suspendido',     color: 'bg-red-100 text-red-700'      },
  cancelled: { label: 'Cancelado',      color: 'bg-gray-100 text-gray-500'    },
  none:      { label: 'Sin suscripcion',color: 'bg-gray-100 text-gray-400'    },
}

export default function TenantsPage() {
  const [tenants,  setTenants]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const navigate = useNavigate()

  useEffect(() => { loadTenants() }, [])

  async function loadTenants() {
    // 1. Cargar todos los tenants (sin join para evitar ambigüedad en PostgREST)
    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('id, name, logo_url, created_at')
      .order('created_at', { ascending: false })

    if (!tenantsData?.length) { setTenants([]); setLoading(false); return }

    // 2. Cargar suscripciones de esos tenants
    const tenantIds = tenantsData.map(t => t.id)
    const { data: subsData } = await supabase
      .from('subscriptions')
      .select('id, status, starts_at, ends_at, plan_id, tenant_id')
      .in('tenant_id', tenantIds)

    // 3. Cargar nombres de planes si hay suscripciones
    const planIds = [...new Set((subsData || []).map(s => s.plan_id).filter(Boolean))]
    let plansMap = {}
    if (planIds.length) {
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('id, name')
        .in('id', planIds)
      ;(plansData || []).forEach(p => { plansMap[p.id] = p.name })
    }

    // 4. Construir un map de tenant_id → suscripcion más reciente
    const subsMap = {}
    ;(subsData || []).forEach(s => {
      // Guardar la suscripcion más reciente por tenant (por si hay varias)
      if (!subsMap[s.tenant_id] || new Date(s.starts_at) > new Date(subsMap[s.tenant_id].starts_at)) {
        subsMap[s.tenant_id] = s
      }
    })

    // 5. Combinar
    const now = new Date()
    const rows = tenantsData.map(t => {
      const sub = subsMap[t.id] || null
      return {
        _key:     t.id,
        tenant:   t,
        status:   sub?.status || 'none',
        ends_at:  sub?.ends_at || null,
        plan_id:  sub?.plan_id || null,
        planName: sub?.plan_id ? (plansMap[sub.plan_id] || sub.plan_id) : null,
        daysLeft: sub?.ends_at
          ? Math.ceil((new Date(sub.ends_at) - now) / 1000 / 60 / 60 / 24)
          : null,
      }
    })

    setTenants(rows)
    setLoading(false)
  }

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.tenant?.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || t.status === filter
    return matchSearch && matchFilter
  })

  const filterOptions = [
    { value: 'all',       label: 'Todos los estados' },
    { value: 'trial',     label: 'Trial'             },
    { value: 'active',    label: 'Activos'           },
    { value: 'expired',   label: 'Vencidos'          },
    { value: 'suspended', label: 'Suspendidos'       },
    { value: 'cancelled', label: 'Cancelados'        },
    { value: 'none',      label: 'Sin suscripcion'   },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Negocios</h1>
          <p className="text-gray-500 text-sm mt-1">{tenants.length} negocios registrados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar negocio..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 shadow-sm">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filter} onChange={e => setFilter(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none py-2.5 bg-transparent"
          >
            {filterOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Negocio</th>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Plan</th>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Estado</th>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Vencimiento</th>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Dias restantes</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr><td colSpan={6} className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                No hay negocios con estos filtros
              </td></tr>
            )}
            {!loading && filtered.map(row => (
              <tr key={row._key} className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/tenants/${row.tenant?.id}`)}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      {row.tenant?.logo_url
                        ? <img src={row.tenant.logo_url} className="w-full h-full rounded-xl object-contain" />
                        : <Building2 size={16} className="text-primary" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{row.tenant?.name || '—'}</p>
                      <p className="text-gray-400 text-xs">
                        Desde {new Date(row.tenant?.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{row.planName || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_CONFIG[row.status]?.color}`}>
                    {STATUS_CONFIG[row.status]?.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {row.ends_at
                    ? new Date(row.ends_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
                    : <span className="text-gray-300">—</span>
                  }
                </td>
                <td className="px-6 py-4">
                  {!row.ends_at || row.status === 'cancelled' ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <span className={`font-bold text-sm ${
                      row.daysLeft < 0  ? 'text-red-500'   :
                      row.daysLeft <= 3 ? 'text-red-500'   :
                      row.daysLeft <= 7 ? 'text-amber-500' : 'text-gray-700'
                    }`}>
                      {row.daysLeft < 0 ? `Vencio hace ${Math.abs(row.daysLeft)}d` : `${row.daysLeft}d`}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <ChevronRight size={16} className="text-gray-400 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
