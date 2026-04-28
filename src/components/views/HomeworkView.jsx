import { useState, useMemo } from 'react'
import { format, parseISO, isPast, isToday, addDays } from 'date-fns'
import { Plus, Trash2, ClipboardList } from 'lucide-react'
import { useHomework, useAddHomework, useDeleteHomework, useClasses } from '../../lib/hooks'
import { useToast } from '../../lib/toast'

export default function HomeworkView() {
  const { data: homework = [] } = useHomework()
  const { data: classes = [] } = useClasses()
  const addHw = useAddHomework()
  const deleteHw = useDeleteHomework()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ class_id: '', description: '', date_set: '', date_due: '' })

  const grouped = useMemo(() => {
    const g = {}
    homework.forEach(hw => { if (!g[hw.date_due]) g[hw.date_due] = []; g[hw.date_due].push(hw) })
    return Object.entries(g).sort(([a], [b]) => a < b ? -1 : 1)
  }, [homework])

  const handleAdd = async () => {
    if (!form.class_id || !form.description || !form.date_set || !form.date_due) { toast.error('Fill in all fields'); return }
    try { await addHw.mutateAsync(form); toast.success('Homework added'); setShowForm(false); setForm({ class_id: '', description: '', date_set: '', date_due: '' }) }
    catch { toast.error('Failed to add') }
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Homework</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>All classes, grouped by due date</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary gap-2"><Plus size={16} /> Add</button>
      </div>

      {showForm && (
        <div className="card p-4 mb-5 space-y-3 animate-slide-up">
          <div>
            <label className="label">Class</label>
            <select className="input" value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="textarea" rows={2} placeholder="What's the task?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date Set</label><input type="date" className="input" value={form.date_set} onChange={e => setForm(f => ({ ...f, date_set: e.target.value }))} /></div>
            <div><label className="label">Date Due</label><input type="date" className="input" value={form.date_due} onChange={e => setForm(f => ({ ...f, date_due: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary flex-1">Add Homework</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </div>
      )}

      {grouped.length === 0 && (
        <div className="card p-8 text-center">
          <ClipboardList size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No homework set yet</p>
        </div>
      )}

      {grouped.map(([dueDate, items]) => {
        const due = parseISO(dueDate)
        const overdue = isPast(due) && !isToday(due)
        const dueSoon = !overdue && due <= addDays(new Date(), 3)
        return (
          <div key={dueDate} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold" style={{ color: overdue ? '#e87d7d' : dueSoon ? '#f0a040' : 'var(--text-secondary)' }}>
                Due {format(due, 'EEEE d MMMM')}
              </p>
              {overdue && <span className="badge text-xs" style={{ background: 'rgba(232,125,125,0.15)', color: '#e87d7d' }}>overdue</span>}
              {dueSoon && !overdue && <span className="badge text-xs" style={{ background: 'rgba(240,160,64,0.12)', color: '#f0a040' }}>soon</span>}
            </div>
            <div className="space-y-1.5">
              {items.map(hw => {
                const cls = classes.find(c => c.id === hw.class_id)
                return (
                  <div key={hw.id} className="card flex items-start gap-3 p-3">
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: cls?.color_code || '#888' }} />
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{hw.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cls?.name}</p>
                    </div>
                    <button onClick={() => deleteHw.mutate(hw.id)} className="p-1 min-w-[32px] transition-colors" style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#e87d7d'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
