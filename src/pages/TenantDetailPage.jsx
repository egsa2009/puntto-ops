import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  ArrowLeft, Building2, Calendar, Clock, Save,
  PlayCircle, PauseCircle, XCircle, RefreshCw,
  Plus, MessageSquare, AlertTriangle, Check
} from 'lucide-react'

const STATUS_CONFIG = {
  trial:     { label: 'Trial',      color: 'bg-blue-100 text-blue-700',    icon: Clock        },
  active:    { label: 'Activo',     color: 'bg-green-100 text-green-700',  icon: PlayCircle   },
  expired:   { label: 'Vencido',    color: 'bg-amber-100 text-amber-700',  icon: AlertTriangle},
  suspended: { label: 'Suspendido', color: 'bg-red-100 text-red-700',      icon: PauseCircle  },
  cancelled: { label: 'Cancelado',  color: 'bg-gray-100 text-gray-500',    icon: XCircle      },
}

function Toast({ msg, onClose }) {
  if (!msg) return null
  return (
    <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium flex items-center gap-2 ${
      msg.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {msg.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
      {msg.text}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  )
}

export default function TenantDetailPage() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { operator } = useAuth()

  const [tenant,   setTenant]   = useState(null)
  const [sub,      setSub]      = useState(null)
  const [plans,    setPlans]    = useState([])
  const [events,   setEvents]   = useState([])
  const [notes,    setNotes]    = useState([])
  const [metrics,  setMetrics]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState(null)
  const [newNote,  setNewNote]  = useState('')

  // Formulario de suscripción
  const [form, setForm] = useState({
    plan_id:           '',
    starts_at:         '',
    ends_at:           '',
    grace_period_days: 3,
    notes:             '',
  })

  // Extensión rápida
  const [extDays, setExtDays] = useState(30)

  // Formulario de nueva suscripción (cuando no existe ninguna)
  const [newSubForm, setNewSubForm] = useState({
    plan_id:           '',
    status:            'trial',
    starts_at:         new Date().toISOString().slice(0, 16),
    ends_at:           new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    grace_period_days: 3,
    notes:             '',
  })
  const [creatingSub, setCreatingSub] = useState(false)

  useEffect(() => { load().catch(console.error).finally(() => setLoading(false)) }, [id])

  async function load() {
    const [
      { data: tenantData },
      { data: subsData },
      { data: plansData },
      { data: eventsData },
      { data: notesData },
    ] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', id).single(),
      supabase.from('subscriptions')
        .select('*, subscription_plans(name)')
        .eq('tenant_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('subscription_plans').select('*').eq('is_active', true),
      supabase.from('subscription_events')
        .select('*, operator_profiles(full_name)')
        .eq('tenant_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('operator_notes')
        .select('*, operator_profiles(full_name)')
        .eq('tenant_id', id)
        .order('created_at', { ascending: false }),
    ])

    setTenant(tenantData)
    setSub(subsData)
    setPlans(plansData || [])
    setEvents(eventsData || [])
    setNotes(notesData || [])

    if (subsData) {
      setForm({
        plan_id:           subsData.plan_id,
        starts_at:         subsData.starts_at?.slice(0, 16) || '',
        ends_at:           subsData.ends_at?.slice(0, 16) || '',
        grace_period_days: subsData.grace_period_days || 3,
        notes:             subsData.notes || '',
      })
    }

    // Metricas del negocio
    const [{ count: customers }, { count: purchases }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', id).eq('role', 'customer'),
      supabase.from('point_transactions').select('*', { count: 'exact', head: true }).eq('tenant_id', id).eq('type', 'purchase'),
    ])
    setMetrics({ customers: customers || 0, purchases: purchases || 0 })

  }

  function showToast(ok, text) {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 3500)
  }

  async function logEvent(type, prevStatus, newStatus, prevEnds, newEnds, notes) {
    await supabase.from('subscription_events').insert({
      subscription_id: sub.id,
      tenant_id:       id,
      event_type:      type,
      previous_status: prevStatus,
      new_status:      newStatus,
      previous_ends_at: prevEnds,
      new_ends_at:     newEnds,
      triggered_by:    operator.id,
      notes,
    })
  }

  async function handleSaveSub(e) {
    e.preventDefault()
    if (!sub) return
    setSaving(true)
    const { error } = await supabase
      .from('subscriptions')
      .update({
        plan_id:           form.plan_id,
        starts_at:         new Date(form.starts_at).toISOString(),
        ends_at:           new Date(form.ends_at).toISOString(),
        grace_period_days: form.grace_period_days,
        notes:             form.notes,
        updated_by:        operator.id,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', sub.id)

    if (error) { showToast(false, 'Error al guardar: ' + error.message) }
    else {
      await logEvent('updated', sub.status, sub.status, sub.ends_at, form.ends_at, 'Actualizacion manual')
      showToast(true, 'Suscripcion actualizada correctamente')
      await load()
    }
    setSaving(false)
  }

  async function handleStatusChange(newStatus, note) {
    if (!sub) return
    setSaving(true)
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: newStatus, updated_by: operator.id, updated_at: new Date().toISOString() })
      .eq('id', sub.id)

    if (error) { showToast(false, 'Error: ' + error.message) }
    else {
      await logEvent(newStatus, sub.status, newStatus, sub.ends_at, sub.ends_at, note)
      showToast(true, `Estado cambiado a ${STATUS_CONFIG[newStatus]?.label}`)
      await load()
    }
    setSaving(false)
  }

  async function handleExtend() {
    if (!extDays || extDays < 1 || !sub) return
    setSaving(true)
    const currentEnd  = new Date(sub.ends_at)
    const newEnd      = new Date(currentEnd.getTime() + extDays * 24 * 60 * 60 * 1000)
    const newEndISO   = newEnd.toISOString()

    const { error } = await supabase
      .from('subscriptions')
      .update({ ends_at: newEndISO, status: 'active', updated_by: operator.id, updated_at: new Date().toISOString() })
      .eq('id', sub.id)

    if (error) { showToast(false, 'Error: ' + error.message) }
    else {
      await logEvent('extended', sub.status, 'active', sub.ends_at, newEndISO, `Extendido ${extDays} dias`)
      showToast(true, `Suscripcion extendida ${extDays} dias`)
      await load()
    }
    setSaving(false)
  }

  async function handleCreateSub(e) {
    e.preventDefault()
    if (!newSubForm.plan_id) { showToast(false, 'Selecciona un plan'); return }
    setCreatingSub(true)
    const { error } = await supabase.from('subscriptions').insert({
      tenant_id:         id,
      plan_id:           newSubForm.plan_id,
      status:            newSubForm.status,
      starts_at:         new Date(newSubForm.starts_at).toISOString(),
      ends_at:           new Date(newSubForm.ends_at).toISOString(),
      grace_period_days: newSubForm.grace_period_days,
      notes:             newSubForm.notes || null,
    })
    if (error) { showToast(false, 'Error al crear: ' + error.message) }
    else {
      showToast(true, 'Suscripción creada correctamente')
      await load()
    }
    setCreatingSub(false)
  }

  async function handleAddNote() {
    if (!newNote.trim()) return
    const { error } = await supabase.from('operator_notes').insert({
      tenant_id:   id,
      operator_id: operator.id,
      note:        newNote.trim(),
    })
    if (!error) {
      setNewNote('')
      await load()
      showToast(true, 'Nota agregada')
    }
  }

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  )

  const daysLeft = sub ? Math.ceil((new Date(sub.ends_at) - new Date()) / 1000 / 60 / 60 / 24) : 0
  const StatusIcon = STATUS_CONFIG[sub?.status]?.icon || Clock

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/tenants')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            {tenant?.logo_url
              ? <img src={tenant.logo_url} className="w-full h-full rounded-2xl object-contain" />
              : <Building2 size={22} className="text-primary" />
            }
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{tenant?.name}</h1>
            <p className="text-gray-400 text-sm">Registrado el {fmtDate(tenant?.created_at)}</p>
          </div>
        </div>
        {sub && (
          <span className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${STATUS_CONFIG[sub.status]?.color}`}>
            <StatusIcon size={15} />
            {STATUS_CONFIG[sub.status]?.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Columna izquierda — suscripción y acciones */}
        <div className="col-span-2 space-y-6">

          {/* Metricas rapidas */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Clientes',      value: metrics?.customers  },
              { label: 'Compras total', value: metrics?.purchases  },
              { label: 'Dias restantes',value: daysLeft < 0 ? 'Vencido' : daysLeft,
                color: daysLeft < 0 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-gray-800' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl p-5 shadow-sm">
                <p className={`text-2xl font-bold ${color || 'text-gray-800'}`}>{value}</p>
                <p className="text-gray-400 text-sm mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Formulario de suscripción — edición si existe, creación si no */}
          {sub ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-5">Suscripcion actual</h3>
              <form onSubmit={handleSaveSub} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                    <select value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dias de gracia</label>
                    <input type="number" value={form.grace_period_days} min={0} max={30}
                      onChange={e => setForm({ ...form, grace_period_days: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                    <input type="datetime-local" value={form.starts_at}
                      onChange={e => setForm({ ...form, starts_at: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                    <input type="datetime-local" value={form.ends_at}
                      onChange={e => setForm({ ...form, ends_at: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nota interna de la suscripcion</label>
                  <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Ej: Renovado por transferencia bancaria..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-primary text-dark font-bold px-6 py-3 rounded-xl text-sm hover:bg-primary-dark transition-colors disabled:opacity-50">
                  <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-gray-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Plus size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Crear suscripcion</h3>
                  <p className="text-gray-400 text-xs">Este negocio aun no tiene suscripcion activa</p>
                </div>
              </div>
              <form onSubmit={handleCreateSub} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                    <select value={newSubForm.plan_id}
                      onChange={e => setNewSubForm({ ...newSubForm, plan_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">— Selecciona un plan —</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado inicial</label>
                    <select value={newSubForm.status}
                      onChange={e => setNewSubForm({ ...newSubForm, status: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="trial">Trial</option>
                      <option value="active">Activo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                    <input type="datetime-local" value={newSubForm.starts_at}
                      onChange={e => setNewSubForm({ ...newSubForm, starts_at: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                    <input type="datetime-local" value={newSubForm.ends_at}
                      onChange={e => setNewSubForm({ ...newSubForm, ends_at: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dias de gracia</label>
                    <input type="number" value={newSubForm.grace_period_days} min={0} max={30}
                      onChange={e => setNewSubForm({ ...newSubForm, grace_period_days: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nota interna (opcional)</label>
                    <input type="text" value={newSubForm.notes}
                      onChange={e => setNewSubForm({ ...newSubForm, notes: e.target.value })}
                      placeholder="Ej: Primer pago por PSE..."
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <button type="submit" disabled={creatingSub || !newSubForm.plan_id}
                  className="flex items-center gap-2 bg-primary text-dark font-bold px-6 py-3 rounded-xl text-sm hover:bg-primary-dark transition-colors disabled:opacity-50">
                  <Plus size={16} /> {creatingSub ? 'Creando...' : 'Crear suscripcion'}
                </button>
              </form>
            </div>
          )}

          {/* Extension rapida */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">Extension rapida</h3>
            <div className="flex gap-3">
              <div className="flex gap-2">
                {[7, 15, 30, 60].map(d => (
                  <button key={d} onClick={() => setExtDays(d)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      extDays === d ? 'bg-primary text-dark' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {d}d
                  </button>
                ))}
              </div>
              <input type="number" value={extDays} onChange={e => setExtDays(parseInt(e.target.value))}
                min={1} max={365}
                className="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-center" />
              <button onClick={handleExtend} disabled={saving}
                className="flex items-center gap-2 bg-primary text-dark font-bold px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition-colors disabled:opacity-50">
                <Plus size={16} /> Extender
              </button>
            </div>
            <p className="text-gray-400 text-xs mt-2">
              La extension suma dias a la fecha actual de vencimiento y activa la suscripcion si estaba suspendida.
            </p>
          </div>

          {/* Acciones de estado */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">Cambiar estado</h3>
            <div className="flex gap-3 flex-wrap">
              {sub?.status !== 'active' && sub?.status !== 'trial' && (
                <button onClick={() => handleStatusChange('active', 'Reactivado manualmente')} disabled={saving}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-50">
                  <PlayCircle size={16} /> Activar
                </button>
              )}
              {(sub?.status === 'active' || sub?.status === 'trial') && (
                <button onClick={() => handleStatusChange('suspended', 'Suspendido manualmente por operador')} disabled={saving}
                  className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50">
                  <PauseCircle size={16} /> Suspender
                </button>
              )}
              {sub?.status !== 'cancelled' && (
                <button onClick={() => handleStatusChange('cancelled', 'Cancelado por operador')} disabled={saving}
                  className="flex items-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
                  <XCircle size={16} /> Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Historial de eventos */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Historial de eventos</h3>
            </div>
            {events.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin eventos registrados</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {events.map(ev => (
                  <div key={ev.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{ev.event_type}</p>
                        {ev.notes && <p className="text-gray-400 text-xs mt-0.5">{ev.notes}</p>}
                        {ev.new_ends_at && ev.previous_ends_at !== ev.new_ends_at && (
                          <p className="text-xs text-primary mt-0.5">
                            Vencimiento: {fmtDate(ev.previous_ends_at)} → {fmtDate(ev.new_ends_at)}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-gray-400 text-xs">{fmtDate(ev.created_at)}</p>
                        {ev.operator_profiles && (
                          <p className="text-gray-300 text-xs mt-0.5">{ev.operator_profiles.full_name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha — notas */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-gray-500" />
              <h3 className="font-bold text-gray-800">Notas internas</h3>
            </div>
            <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
              {notes.length === 0 && (
                <p className="text-gray-300 text-sm text-center py-4">Sin notas</p>
              )}
              {notes.map(n => (
                <div key={n.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-700 text-sm">{n.note}</p>
                  <div className="flex justify-between mt-1.5">
                    <p className="text-gray-400 text-xs">{n.operator_profiles?.full_name}</p>
                    <p className="text-gray-300 text-xs">{fmtDate(n.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
            <textarea
              value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder="Agregar nota interna..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <button onClick={handleAddNote} disabled={!newNote.trim()}
              className="w-full mt-2 bg-primary text-dark font-semibold py-2.5 rounded-xl text-sm hover:bg-primary-dark transition-colors disabled:opacity-40">
              Agregar nota
            </button>
          </div>

          {/* Info del plan */}
          {sub && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3">Plan: {sub.subscription_plans?.name}</h3>
              {plans.find(p => p.id === sub.plan_id) && (() => {
                const p = plans.find(pl => pl.id === sub.plan_id)
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Precio</span>
                      <span className="font-medium">${p.price_cop?.toLocaleString('es-CO')} COP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Max clientes</span>
                      <span className="font-medium">{p.max_customers || 'Ilimitado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Campanas/mes</span>
                      <span className="font-medium">{p.max_campaigns_month || 'Ilimitado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gracia</span>
                      <span className="font-medium">{p.grace_period_days} dias</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
