import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Printer, Plus, X, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { useClasses, useCoverSlips, useAddCoverSlip, useLessonPlans, useProfile } from '../../lib/hooks'
import { useToast } from '../../lib/toast'

function generatePDFHtml(slip, className, logoDataUrl) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cover Slip — ${className}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: white; color: #1a1a2e; padding: 2cm; font-size: 11pt; line-height: 1.4; }
    .logo-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2pt solid #333; padding-bottom: 12pt; margin-bottom: 16pt; }
    .logo-placeholder { width: 80pt; height: 40pt; border: 1pt dashed #bbb; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: 8pt; }
    .title { font-family: 'Playfair Display', Georgia, serif; font-size: 22pt; font-weight: 700; letter-spacing: 0.05em; }
    .meta-grid { display: grid; grid-template-columns: 120pt 1fr 120pt 1fr; gap: 8pt 12pt; border-bottom: 1pt solid #ccc; padding-bottom: 12pt; margin-bottom: 16pt; }
    .meta-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-weight: 600; padding-top: 2pt; }
    .meta-value { font-size: 10pt; font-weight: 500; }
    .section-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; color: #333; margin-bottom: 6pt; border-bottom: 0.5pt solid #ddd; padding-bottom: 4pt; margin-top: 14pt; }
    .section-content { font-size: 11pt; line-height: 1.6; min-height: 80pt; white-space: pre-wrap; padding: 8pt 0; }
    .footer { border-top: 1pt solid #ccc; padding-top: 8pt; margin-top: 16pt; font-size: 9pt; color: #666; text-align: center; font-style: italic; }
  </style>
</head>
<body>
  <div class="logo-row">
    ${logoDataUrl
      ? `<img src="${logoDataUrl}" alt="School logo" style="height:40pt;object-fit:contain;" />`
      : `<div class="logo-placeholder">School Logo</div>`
    }
    <div class="title">COVER SLIP</div>
  </div>
  <div class="meta-grid">
    <span class="meta-label">Teacher</span><span class="meta-value">${slip.teacher_name || '—'}</span>
    <span class="meta-label">Class</span><span class="meta-value">${className}</span>
    <span class="meta-label">Date</span><span class="meta-value">${slip.date ? format(parseISO(slip.date), 'EEEE d MMMM yyyy') : '—'}</span>
    <span class="meta-label">Period</span><span class="meta-value">${slip.period_number || '—'}</span>
    <span class="meta-label">Room</span><span class="meta-value">${slip.room || '—'}</span>
    <span class="meta-label">Buddy Room</span><span class="meta-value">${slip.buddy_room || '—'}</span>
  </div>
  ${slip.key_question ? `<div class="section-label">KEY QUESTION</div><div class="section-content">${slip.key_question}</div>` : ''}
  <div class="section-label">TASK</div>
  <div class="section-content">${slip.task_instructions || ''}</div>
  <div class="footer">Thank you for covering this lesson.</div>
</body>
</html>`
}

function handlePrintSlip(slip, className) {
  const logoDataUrl = localStorage.getItem('cadence_school_logo') || ''
  const html = generatePDFHtml(slip, className, logoDataUrl)
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) { alert('Please allow popups to print cover slips'); return }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
}

export default function CoverSlipView() {
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const { data: classes = [] } = useClasses()
  const { data: coverSlips = [] } = useCoverSlips()
  const { data: lessonPlans = [] } = useLessonPlans()
  const { data: profile } = useProfile()
  const addCoverSlip = useAddCoverSlip()

  const prefillClassId = searchParams.get('classId')
  const prefillDate = searchParams.get('date')
  const prefillPeriod = searchParams.get('period')

  const [form, setForm] = useState({
    class_id: prefillClassId || '',
    date: prefillDate || '',
    period_number: prefillPeriod ? Number(prefillPeriod) : '',
    room: '',
    teacher_name: '',
    key_question: '',
    task_instructions: '',
    buddy_room: ''
  })
  const [showForm, setShowForm] = useState(!!prefillClassId)
  const [importFromLesson, setImportFromLesson] = useState(false)
  const [filterClassId, setFilterClassId] = useState('')
  const [expandedSlip, setExpandedSlip] = useState(null)

  useEffect(() => {
    if (profile?.display_name) setForm(f => ({ ...f, teacher_name: f.teacher_name || profile.display_name }))
  }, [profile])

  useEffect(() => {
    if (form.class_id) {
      const cls = classes.find(c => c.id === form.class_id)
      if (cls?.room) setForm(f => ({ ...f, room: f.room || cls.room }))
    }
  }, [form.class_id, classes])

  useEffect(() => {
    if (importFromLesson && form.class_id && form.date) {
      const nextPlan = lessonPlans
        .filter(p => p.class_id === form.class_id && p.date >= form.date)
        .sort((a, b) => a.date < b.date ? -1 : 1)[0]
      if (nextPlan?.plan_content) setForm(f => ({ ...f, task_instructions: nextPlan.plan_content }))
    }
  }, [importFromLesson, form.class_id, form.date])

  const handleSave = async () => {
    if (!form.class_id || !form.date) { toast.error('Class and date are required'); return }
    try {
      await addCoverSlip.mutateAsync(form)
      toast.success('Cover slip saved')
      setShowForm(false)
    } catch { toast.error('Failed to save') }
  }

  const handleSaveAndPrint = async () => {
    if (!form.class_id || !form.date) { toast.error('Class and date are required'); return }
    try {
      await addCoverSlip.mutateAsync(form)
      const cls = classes.find(c => c.id === form.class_id)
      handlePrintSlip(form, cls?.name || '')
      setShowForm(false)
      toast.success('Cover slip saved')
    } catch { toast.error('Failed to save') }
  }

  const filteredSlips = filterClassId
    ? coverSlips.filter(s => s.class_id === filterClassId)
    : coverSlips

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Cover Slips</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary gap-2">
          <Plus size={16} /> New
        </button>
      </div>

      {/* New slip form */}
      {showForm && (
        <div className="card p-5 mb-6 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="section-title text-base">New Cover Slip</h3>
            <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Class</label>
              <select className="input" value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                <option value="">Select…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Period</label><input type="number" className="input" min="1" max="6" value={form.period_number} onChange={e => setForm(f => ({ ...f, period_number: Number(e.target.value) }))} /></div>
            <div><label className="label">Room</label><input className="input" placeholder="e.g. B12" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} /></div>
            <div><label className="label">Buddy Room</label><input className="input" placeholder="e.g. B14" value={form.buddy_room} onChange={e => setForm(f => ({ ...f, buddy_room: e.target.value }))} /></div>
          </div>

          <div><label className="label">Teacher Name</label><input className="input" value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} /></div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={importFromLesson} onChange={e => setImportFromLesson(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Import task from next planned lesson</span>
          </label>

          <div><label className="label">Key Question</label><input className="input" placeholder="What should students be thinking about?" value={form.key_question} onChange={e => setForm(f => ({ ...f, key_question: e.target.value }))} /></div>
          <div><label className="label">Task Instructions</label><textarea className="textarea" rows={4} placeholder="Detailed task for the class…" value={form.task_instructions} onChange={e => setForm(f => ({ ...f, task_instructions: e.target.value }))} /></div>

          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-secondary flex-1">Save</button>
            <button onClick={handleSaveAndPrint} className="btn-primary flex-1 gap-2"><Printer size={16} /> Save & Print</button>
          </div>
        </div>
      )}

      {/* History with filter */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title text-base">History</h3>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select className="input text-xs" style={{ minHeight: 'unset', padding: '4px 8px', width: 'auto' }}
            value={filterClassId} onChange={e => setFilterClassId(e.target.value)}>
            <option value="">All classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {filteredSlips.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No cover slips yet{filterClassId ? ' for this class' : ''}.</p>
      )}

      <div className="space-y-2">
        {filteredSlips.map(slip => {
          const slipClass = classes.find(c => c.id === slip.class_id)
          const isExpanded = expandedSlip === slip.id
          return (
            <div key={slip.id} className="card overflow-hidden">
              {/* Summary row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: slipClass?.color_code || '#888' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{slipClass?.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {slip.date ? format(parseISO(slip.date), 'EEE d MMM yyyy') : '—'} · P{slip.period_number} · {slip.room}
                  </p>
                  {/* Task preview */}
                  {slip.task_instructions && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {slip.task_instructions.slice(0, 80)}{slip.task_instructions.length > 80 ? '…' : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handlePrintSlip(slip, slipClass?.name || '')} className="btn-ghost gap-1.5 text-xs px-2 py-1.5" style={{ minHeight: 'unset' }}>
                    <Printer size={13} /> Print
                  </button>
                  <button onClick={() => setExpandedSlip(isExpanded ? null : slip.id)} className="btn-ghost p-1.5" style={{ minHeight: 'unset' }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 animate-slide-up" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                    {[['Teacher', slip.teacher_name], ['Room', slip.room], ['Buddy Room', slip.buddy_room], ['Period', slip.period_number]].map(([l, v]) => (
                      v ? <div key={l}><span className="label" style={{ marginBottom: '2px' }}>{l}</span><span style={{ color: 'var(--text-primary)' }}>{v}</span></div> : null
                    ))}
                  </div>
                  {slip.key_question && (
                    <div>
                      <p className="label">Key Question</p>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{slip.key_question}</p>
                    </div>
                  )}
                  {slip.task_instructions && (
                    <div>
                      <p className="label">Task</p>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{slip.task_instructions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
