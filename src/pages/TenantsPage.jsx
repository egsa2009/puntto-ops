import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Search, Building2, ChevronRight, Filter, Plus, X, Check, AlertTriangle } from 'lucide-react'

const STATUS_CONFIG = {
  trial:     { label: 'Trial',      color: 'bg-blue-100 text-blue-700'    },
  active:    { label: 'Activo',     color: 'bg-green-100 text-green-700'  },
  expired:   { label: 'Vencido',    color: 'bg-amber-100 text-amber-700'  },
  suspended: { label: 'Suspendido', color: 'bg-red-100 text-red-700'      },
  cancelled: { label: 'Cancelado',  color: 'bg-gray-100 text-gray-500'    },
}

export default function TenantsPage() {
  const [tenants,  setTenants]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const navigate  = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState(null)
  const [plans,     setPlans]     = useState([])
  const [newForm,   setNewForm]   = useState({
    name:              '',
    slug:              '',
    plan_id:           'trial',
    starts_at:         new Date().toISOString().slice(0, 16),
    ends_at:           new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    grace_period_days: 0,
  })

  useEffect(() => {
    loadTenants()
    supabase.from('subscription_plans').select('*').eq('is_active', true)
      .then(({ data }) => setPlans(data || []))
  }, [])

  function showToast(ok, text) {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 3500)
  }

  function slugify(name) {
    return name.toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleCreateTenant(e) {
    e.preventDefault()
    setSaving(true)

    // 1. Crear el tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name:          newForm.name.trim(),
        slug:          newForm.slug.trim() || slugify(newForm.name.trim()),
        primary_color: '#00b8cc',
        is_active:     true,
      })
      .select()
      .single()

    if (tenantErr) {
      showToast(false, 'Error al crear negocio: ' + tenantErr.message)
      setSaving(false)
      return
    }

    // 2. Crear tenant_config por defecto
    await supabase.from('tenant_config').insert({
      tenant_id:             tenant.id,
      min_purchase_amount:   50000,
      points_expiry_days:    180,
      expiry_warning_days:   15,
      referrer_bonus_points: 20,
      referred_bonus_points: 10,
      points_multiplier:     1,
      welcome_bonus_enabled: false,
      welcome_bonus_points:  0,
      points_scale_json: [
        { min: 0,      max: 49999,  points: 0  },
        { min: 50000,  max: 149999, points: 5  },
        { min: 150000, max: 299999, points: 15 },
        { min: 300000, max: 499999, points: 35 },
        { min: 500000, max: null,   points: 80 },
      ],
    })

    // 3. Crear suscripcion
    const plan = plans.find(p => p.id === newForm.plan_id)
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        tenant_id:         tenant.id,
        plan_id:           newForm.plan_id,
        status:            newForm.plan_id === 'trial' ? 'trial' : 'active',
        starts_at:         new Date(newForm.starts_at).toISOString(),
        ends_at:           new Date(newForm.ends_at).toISOString(),
        grace_period_days: newForm.grace_period_days,
      })
      .select()
      .single()

    if (subErr) {
      showToast(false, 'Negocio creado pero error en suscripcion: ' + subErr.message)
      setSaving(false)
      setShowModal(false)
      await loadTenants()
      return
    }

    // 4. Vincular suscripcion al tenant
    await supabase.from('tenants').update({ subscription_id: sub.id }).eq('id', tenant.id)

    // 5. Registrar evento
    await supabase.from('subscription_events').insert({
      subscription_id: sub.id,
      tenant_id:       tenant.id,
      event_type:      'created',
      new_status:      newForm.plan_id === 'trial' ? 'trial' : 'active',
      new_ends_at:     new Date(newForm.ends_at).toISOString(),
      notes:           'Negocio creado desde panel operador',
    })

    showToast(true, `Negocio "${tenant.name}" creado correctamente`)
    setShowModal(false)
    setNewForm({
      name: '', slug: '', plan_id: 'trial',
      starts_at: new Date().toISOString().slice(0, 16),
      ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      grace_period_days: 0,
    })
    setSaving(false)
    await loadTenants()
    navigate(`/tenants/${tenant.id}`)
  }

  async function loadTenants() {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select(`
        id, status, starts_at, ends_at, plan_id,
        tenants!subscriptions_tenant_id_fkey (
          id, name, logo_url, created_at
        ),
        subscription_plans!subscriptions_plan_id_fkey (
          name
        )
      `)
      .order('created_at', { ascending: false })

    const now = new Date()
    const rows = (subs || []).map(s => ({
      ...s,
      tenant:   s.tenants,
      plan:     s.subscription_plans,
      daysLeft: Math.ceil((new Date(s.ends_at) - now) / 1000 / 60 / 60 / 24),
    }))

    setTenants(rows)
    setLoading(false)
  }

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.tenant?.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || t.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Negocios</h1>
          <p className="text-gray-500 text-sm mt-1">{tenants.length} negocios registrados</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-dark font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> Nuevo negocio
        </button>
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
            <option value="all">Todos los estados</option>
            <option value="trial">Trial</option>
            <option value="active">Activos</option>
            <option value="expired">Vencidos</option>
            <option value="suspended">Suspendidos</option>
            <option value="cancelled">Cancelados</option>
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
              <tr key={row.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
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
                <td className="px-6 py-4 text-gray-600">{row.plan?.name || row.plan_id}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_CONFIG[row.status]?.color}`}>
                    {STATUS_CONFIG[row.status]?.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(row.ends_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                </td>
                <td className="px-6 py-4">
                  {row.status === 'cancelled' ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <span className={`font-bold text-sm ${
                      row.daysLeft < 0 ? 'text-red-500' :
                      row.daysLeft <= 3 ? 'text-red-500' :
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

      {/* Modal nuevo negocio */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 text-lg">Nuevo negocio</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio</label>
                <input type="text" value={newForm.name} required
                  onChange={e => setNewForm({ ...newForm, name: e.target.value, slug: slugify(e.target.value) })}
                  placeholder="Ej: Restaurante El Buen Sabor"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                  <span className="px-3 py-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-300">/</span>
                  <input type="text" value={newForm.slug} required
                    onChange={e => setNewForm({ ...newForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="restaurante-el-buen-sabor"
                    className="flex-1 px-3 py-3 text-sm focus:outline-none" />
                </div>
                <p className="text-gray-400 text-xs mt-1">Se genera automático del nombre. Solo letras, números y guiones.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan inicial</label>
                <select value={newForm.plan_id}
                  onChange={e => {
                    const plan = plans.find(p => p.id === e.target.value)
                    const ends = new Date(Date.now() + (plan?.duration_days || 14) * 24 * 60 * 60 * 1000)
                    setNewForm({ ...newForm, plan_id: e.target.value, ends_at: ends.toISOString().slice(0, 16) })
                  }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.price_cop === 0 ? 'Gratis' : '$' + p.price_cop.toLocaleString('es-CO')} / {p.duration_days} dias
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
                  <input type="datetime-local" value={newForm.starts_at}
                    onChange={e => setNewForm({ ...newForm, starts_at: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento</label>
                  <input type="datetime-local" value={newForm.ends_at}
                    onChange={e => setNewForm({ ...newForm, ends_at: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-primary text-dark font-bold py-3 rounded-xl text-sm hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Plus size={16} />
                  {saving ? 'Creando...' : 'Crear negocio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
