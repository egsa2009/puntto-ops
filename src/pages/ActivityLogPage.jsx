import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Activity, Filter } from 'lucide-react'

const EVENT_COLORS = {
  created:      'bg-blue-100 text-blue-700',
  updated:      'bg-gray-100 text-gray-600',
  extended:     'bg-green-100 text-green-700',
  active:       'bg-green-100 text-green-700',
  suspended:    'bg-amber-100 text-amber-700',
  cancelled:    'bg-red-100 text-red-700',
  reactivated:  'bg-green-100 text-green-700',
  plan_changed: 'bg-purple-100 text-purple-700',
}

export default function ActivityLogPage() {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('subscription_events')
        .select(`
          *,
          operator_profiles!subscription_events_triggered_by_fkey (full_name),
          tenants!subscription_events_tenant_id_fkey (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      setEvents(data || [])
    }
    load().catch(console.error).finally(() => setLoading(false))
  }, [])

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('es-CO', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    })
  }

  const filtered = filter === 'all'
    ? events
    : events.filter(e => e.event_type === filter)

  const eventTypes = [...new Set(events.map(e => e.event_type))]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Log de actividad</h1>
          <p className="text-gray-500 text-sm mt-1">Historial completo de acciones del equipo operador</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 shadow-sm">
          <Filter size={14} className="text-gray-400" />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none py-2.5 bg-transparent">
            <option value="all">Todos los eventos</option>
            {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Activity size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Sin eventos registrados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-gray-500 font-medium">Negocio</th>
                <th className="text-left px-6 py-4 text-gray-500 font-medium">Evento</th>
                <th className="text-left px-6 py-4 text-gray-500 font-medium">Detalle</th>
                <th className="text-left px-6 py-4 text-gray-500 font-medium">Operador</th>
                <th className="text-left px-6 py-4 text-gray-500 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(ev => (
                <tr key={ev.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {ev.tenants?.name || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${EVENT_COLORS[ev.event_type] || 'bg-gray-100 text-gray-600'}`}>
                      {ev.event_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs">
                    {ev.notes && <p className="truncate">{ev.notes}</p>}
                    {ev.new_ends_at && ev.previous_ends_at !== ev.new_ends_at && (
                      <p className="text-xs text-primary mt-0.5">
                        {fmtDate(ev.previous_ends_at)} → {fmtDate(ev.new_ends_at)}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {ev.operator_profiles?.full_name || 'Sistema'}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs whitespace-nowrap">
                    {fmtDate(ev.created_at)}
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
