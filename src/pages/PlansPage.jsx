import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Save, Check, AlertTriangle } from 'lucide-react'

function Toast({ msg, onClose }) {
  if (!msg) return null
  return (
    <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium flex items-center gap-2 ${
      msg.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {msg.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
      {msg.text}
      <button onClick={onClose} className="ml-2 opacity-70">✕</button>
    </div>
  )
}

export default function PlansPage() {
  const [plans,   setPlans]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(null)
  const [toast,   setToast]   = useState(null)

  useEffect(() => {
    supabase.from('subscription_plans').select('*').order('price_cop')
      .then(({ data }) => { setPlans(data || []); setLoading(false) })
  }, [])

  function showToast(ok, text) {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 3000)
  }

  function updateField(id, field, value) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  async function handleSave(plan) {
    setSaving(plan.id)
    const { error } = await supabase
      .from('subscription_plans')
      .update({
        name:                plan.name,
        price_cop:           plan.price_cop,
        duration_days:       plan.duration_days,
        max_customers:       plan.max_customers || null,
        max_campaigns_month: plan.max_campaigns_month || null,
        grace_period_days:   plan.grace_period_days,
        is_active:           plan.is_active,
      })
      .eq('id', plan.id)

    if (error) showToast(false, 'Error al guardar: ' + error.message)
    else showToast(true, `Plan "${plan.name}" actualizado`)
    setSaving(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  )

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast(null)} />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Planes</h1>
        <p className="text-gray-500 text-sm mt-1">Configura los planes disponibles para los negocios</p>
      </div>

      <div className="space-y-4">
        {plans.map(plan => (
          <div key={plan.id} className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-gray-800 text-lg">{plan.name}</h3>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {plan.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={plan.is_active}
                    onChange={e => updateField(plan.id, 'is_active', e.target.checked)}
                    className="w-4 h-4 accent-primary" />
                  Activo
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del plan</label>
                <input type="text" value={plan.name}
                  onChange={e => updateField(plan.id, 'name', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Precio (COP)</label>
                <input type="number" value={plan.price_cop} min={0}
                  onChange={e => updateField(plan.id, 'price_cop', parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Duracion (dias)</label>
                <input type="number" value={plan.duration_days} min={1}
                  onChange={e => updateField(plan.id, 'duration_days', parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Max clientes (vacio = ilimitado)</label>
                <input type="number" value={plan.max_customers || ''} min={1}
                  placeholder="Ilimitado"
                  onChange={e => updateField(plan.id, 'max_customers', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Max campanas/mes (vacio = ilimitado)</label>
                <input type="number" value={plan.max_campaigns_month || ''} min={1}
                  placeholder="Ilimitado"
                  onChange={e => updateField(plan.id, 'max_campaigns_month', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Dias de gracia</label>
                <input type="number" value={plan.grace_period_days} min={0} max={30}
                  onChange={e => updateField(plan.id, 'grace_period_days', parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            <button onClick={() => handleSave(plan)} disabled={saving === plan.id}
              className="flex items-center gap-2 bg-primary text-dark font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-primary-dark transition-colors disabled:opacity-50">
              <Save size={15} />
              {saving === plan.id ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
