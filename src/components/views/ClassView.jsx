import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO, isPast, addDays, isToday, isFuture } from 'date-fns'
import { BookCheck, FileText, ClipboardList, Plus, ChevronLeft, AlertCircle, CheckCircle2, Clock, Edit2, ExternalLink } from 'lucide-react'
import {
  useClasses, useLessonPlans, useMilestones, useCoverSlips,
  useHomework, useClassNotes, useUpsertClassNote,
  useAddMilestone, useDeleteMilestone, useUpdateClass,
  useTimetableSlots, useSchemes, useUpsertLessonPlan
} from '../../lib/hooks'
import { useProfile, useHolidays } from '../../lib/hooks'
import { getBookBrilliantStatus, getFutureLessonDates, getSoWSuggestion } from '../../lib/cycleEngine'
import { useToast } from '../../lib/toast'
import DayPanel from './DayPanel'

const MILESTONE_ICONS = { assessment: '📝', deadline: '🏁', other: '📌' }

export default function ClassView() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: classes = [] } = useClasses()
  const { data: plans = [] } = useLessonPlans()
  const { data: milestones = [] } = useMilestones()
  const { data: coverSlips = [] } = useCoverSlips()
  const { data: homework = [] } = useHomework()
  const { data: classNotes = [] } = useClassNotes()
  const { data: holidays = [] } = useHolidays()
  const { data: profile } = useProfile()
  const { data: slots = [] } = useTimetableSlots()
  const { data: schemes = [] } = useSchemes()
  const upsertNote = useUpsertClassNote()
  const addMilestone = useAddMilestone()
  const deleteMilestone = useDeleteMilestone()
  const updateClass = useUpdateClass()

  const cls = classes.find(c => c.id === classId)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [noteContent, setNoteContent] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({ date: '', label: '', type: 'assessment' })
  const [tab, setTab] = useState('upcoming') // 'upcoming' | 'history'

  const classNote = classNotes.find(n => n.class_id === classId)
  useEffect(() => { if (classNote) setNoteContent(classNote.content || '') }, [classNote])

  const bbStatus = cls ? getBookBrilliantStatus(cls, holidays) : 'due'

  // Upcoming lesson slots (next 10 from today)
  const upcomingSlots = useMemo(() => {
    if (!profile) return []
    const futureDates = getFutureLessonDates(classId, new Date(), slots, profile, holidays, 180)
    return futureDates.slice(0, 10).map(fd => {
      const plan = plans.find(p => p.class_id === classId && p.date === fd.date && p.period_number === fd.period_number)
      return { ...fd, plan }
    })
  }, [classId, plans, slots, profile, holidays])

  // Historical feed
  const historyItems = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const items = []
    plans.filter(p => p.class_id === classId && p.date && p.date < today)
      .forEach(p => items.push({ type: 'lesson', date: p.date, data: p }))
    milestones.filter(m => m.class_id === classId)
      .forEach(m => items.push({ type: 'milestone', date: m.date, data: m }))
    coverSlips.filter(c => c.class_id === classId)
      .forEach(c => items.push({ type: 'cover', date: c.date, data: c }))
    homework.filter(h => h.class_id === classId)
      .forEach(h => items.push({ type: 'homework', date: h.date_set, data: h }))
    return items.sort((a, b) => b.date < a.date ? -1 : 1) // reverse chron
  }, [plans, milestones, coverSlips, homework, classId])

  const handleSaveNote = async () => {
    try {
      await upsertNote.mutateAsync({ ...(classNote?.id ? { id: classNote.id } : {}), class_id: classId, content: noteContent })
      toast.success('Note saved'); setNoteEditing(false)
    } catch { toast.error('Failed to save note') }
  }

  const handleAddMilestone = async () => {
    if (!milestoneForm.date || !milestoneForm.label) return
    try {
      await addMilestone.mutateAsync({ class_id: classId, ...milestoneForm })
      toast.success('Milestone added'); setShowMilestoneForm(false); setMilestoneForm({ date: '', label: '', type: 'assessment' })
    } catch { toast.error('Failed to add milestone') }
  }

  const handleBookBrilliant = async () => {
    try {
      await updateClass.mutateAsync({
        id: classId,
        book_brilliant_done: !cls.book_brilliant_done,
        book_brilliant_reset_date: new Date().toISOString().slice(0, 10)
      })
      toast.success(cls.book_brilliant_done ? 'Book Brilliant unmarked' : 'Book Brilliant marked ✓')
    } catch { toast.error('Failed to update') }
  }

  // SoW indicator helper
  const getSowLabel = (plan) => {
    if (!cls?.sow_id) return null
    const sow = schemes.find(s => s.id === cls.sow_id)
    if (!sow) return null
    if (plan.sow_skipped && plan.sow_index !== null && plan.sow_index !== undefined) {
      return { on: false, skipped: true, text: `Skipped SoW #${plan.sow_index + 1}: ${sow.lessons[plan.sow_index] || ''}` }
    }
    if (plan.sow_index !== null && plan.sow_index !== undefined) {
      return { on: true, skipped: false, text: `SoW #${plan.sow_index + 1}: ${sow.lessons[plan.sow_index] || ''}` }
    }
    return { on: false, skipped: false, text: 'Custom' }
  }

  if (!cls) return <div className="p-6" style={{ color: 'var(--text-muted)' }}>Class not found</div>

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto animate-fade-in">
      <button onClick={() => navigate('/week')} className="btn-ghost mb-4 gap-1 text-xs -ml-2">
        <ChevronLeft size={14} /> Week View
      </button>

      {/* Class header */}
      <div className="card p-5 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0 mt-1" style={{ background: cls.color_code || '#888' }} />
            <div>
              <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{cls.name}</h2>
              {cls.room && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Room {cls.room}</p>}
            </div>
          </div>
          {/* Book Brilliant - once per half term */}
          <button onClick={handleBookBrilliant}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
            style={bbStatus === 'done'
              ? { background: 'rgba(125,184,141,0.15)', color: '#7db88d', borderColor: 'rgba(125,184,141,0.25)' }
              : bbStatus === 'overdue'
              ? { background: 'rgba(232,125,125,0.15)', color: '#e87d7d', borderColor: 'rgba(232,125,125,0.25)' }
              : { background: 'rgba(240,160,64,0.12)', color: '#f0a040', borderColor: 'rgba(240,160,64,0.2)' }
            }>
            {bbStatus === 'done' ? <CheckCircle2 size={14} /> : bbStatus === 'overdue' ? <AlertCircle size={14} /> : <Clock size={14} />}
            <span className="text-xs">Books marked {bbStatus === 'done' ? '✓' : bbStatus === 'overdue' ? '(overdue!)' : '(this half term)'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ background: 'var(--hover-bg)' }}>
        {[['upcoming', 'Upcoming'], ['history', 'History']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={tab === val ? { background: 'var(--bg-raised)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Upcoming lessons */}
      {tab === 'upcoming' && (
        <div className="space-y-2 mb-6">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Next 10 lessons — click to plan</p>
            <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} className="btn-ghost gap-1.5 text-xs">
              <Plus size={14} /> Add Milestone
            </button>
          </div>

          {showMilestoneForm && (
            <div className="card p-4 mb-2 space-y-3 animate-slide-up">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date</label><input type="date" className="input" value={milestoneForm.date} onChange={e => setMilestoneForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><label className="label">Type</label>
                  <select className="input" value={milestoneForm.type} onChange={e => setMilestoneForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="assessment">Assessment</option>
                    <option value="deadline">Deadline</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Label</label><input className="input" placeholder="e.g. End of Unit Test" value={milestoneForm.label} onChange={e => setMilestoneForm(f => ({ ...f, label: e.target.value }))} /></div>
              <div className="flex gap-2">
                <button onClick={handleAddMilestone} className="btn-primary flex-1">Add</button>
                <button onClick={() => setShowMilestoneForm(false)} className="btn-ghost flex-1">Cancel</button>
              </div>
            </div>
          )}

          {upcomingSlots.length === 0 && (
            <div className="card p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No upcoming lessons found. Check your timetable slots are set up in Settings.
            </div>
          )}

          {upcomingSlots.map((item, i) => {
            const plan = item.plan
            const isPlanned = !!plan?.plan_content
            const sowLabel = plan ? getSowLabel(plan) : null
            const dateObj = parseISO(item.date)
            const today = isToday(dateObj)

            return (
              <button key={`${item.date}-${item.period_number}`}
                onClick={() => setSelectedLesson({ date: item.date, classId, period: item.period_number, planId: plan?.id })}
                className="card-hover w-full text-left p-4 flex items-start gap-3"
                style={today ? { borderColor: 'rgba(230,176,32,0.3)', background: 'rgba(230,176,32,0.05)' } : {}}>
                <div className="text-center shrink-0 w-12">
                  <p className="text-xs font-mono" style={{ color: 'var(--gold)' }}>{format(dateObj, 'MMM')}</p>
                  <p className="font-semibold text-lg leading-none" style={{ color: 'var(--text-primary)' }}>{format(dateObj, 'd')}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>P{item.period_number}</p>
                </div>
                <div className="flex-1 min-w-0">
                  {isPlanned ? (
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--text-primary)' }}>{plan.plan_content}</p>
                  ) : (
                    <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Click to plan this lesson…</p>
                  )}
                  {sowLabel && (
                    <span className="inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full"
                      style={sowLabel.on
                        ? { background: 'rgba(96,144,192,0.15)', color: '#6090c0' }
                        : { background: 'var(--hover-bg)', color: 'var(--text-muted)' }
                      }>
                      {sowLabel.on ? '📚' : '✏️'} {sowLabel.on ? `SoW #${plan.sow_index + 1}` : 'Custom'}
                    </span>
                  )}
                </div>
                <Edit2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
              </button>
            )
          })}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="space-y-2 mb-6">
          {historyItems.length === 0 && (
            <div className="card p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No past lessons recorded yet.</div>
          )}
          {historyItems.map((item, i) => {
            if (item.type === 'lesson') {
              const plan = item.data
              const sowLabel = getSowLabel(plan)
              return (
                <button key={`lesson-${plan.id}`}
                  onClick={() => setSelectedLesson({ date: plan.date, classId, period: plan.period_number, planId: plan.id })}
                  className="card-hover w-full text-left p-4 flex items-start gap-3">
                  <div className="text-center shrink-0 w-12">
                    <p className="text-xs font-mono" style={{ color: 'var(--gold)' }}>{format(parseISO(plan.date), 'MMM')}</p>
                    <p className="font-semibold text-lg leading-none" style={{ color: 'var(--text-primary)' }}>{format(parseISO(plan.date), 'd')}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>P{plan.period_number}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    {plan.plan_content
                      ? <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{plan.plan_content}</p>
                      : <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No plan written</p>
                    }
                    {sowLabel && (
                      <span className="inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full"
                        style={sowLabel.on
                          ? { background: 'rgba(96,144,192,0.15)', color: '#6090c0' }
                          : { background: 'var(--hover-bg)', color: 'var(--text-muted)' }
                        }>
                        {sowLabel.on ? '📚' : '✏️'} {sowLabel.on ? `SoW #${plan.sow_index + 1}` : 'Custom'}
                      </span>
                    )}
                  </div>
                </button>
              )
            }
            if (item.type === 'milestone') {
              const m = item.data
              return (
                <div key={`m-${m.id}`} className="card flex items-center gap-3 px-4 py-3" style={{ borderColor: 'rgba(96,144,192,0.2)' }}>
                  <span className="text-base">{MILESTONE_ICONS[m.type]}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{format(parseISO(m.date), 'EEE d MMM yyyy')}</p>
                  </div>
                  <button onClick={() => deleteMilestone.mutate(m.id)} className="p-1" style={{ color: 'var(--text-muted)' }}>✕</button>
                </div>
              )
            }
            if (item.type === 'cover') {
              const c = item.data
              return (
                <div key={`cv-${c.id}`} className="card flex items-center gap-3 px-4 py-3" style={{ borderColor: 'rgba(96,144,192,0.15)' }}>
                  <FileText size={16} style={{ color: '#6090c0', flexShrink: 0 }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Cover slip</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{format(parseISO(c.date), 'EEE d MMM')} · P{c.period_number} · {c.room}</p>
                  </div>
                </div>
              )
            }
            if (item.type === 'homework') {
              const hw = item.data
              return (
                <div key={`hw-${hw.id}`} className="card flex items-center gap-3 px-4 py-3" style={{ borderColor: 'rgba(125,184,141,0.15)' }}>
                  <ClipboardList size={16} style={{ color: '#7db88d', flexShrink: 0 }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{hw.description}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set {format(parseISO(hw.date_set), 'd MMM')} · Due {format(parseISO(hw.date_due), 'd MMM')}</p>
                  </div>
                  {isPast(parseISO(hw.date_due)) && (
                    <span className="badge text-xs" style={{ background: 'rgba(232,125,125,0.15)', color: '#e87d7d' }}>overdue</span>
                  )}
                </div>
              )
            }
            return null
          })}
        </div>
      )}

      {/* Class Notes */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title text-base">Class Notes</h3>
          {!noteEditing
            ? <button onClick={() => { setNoteContent(classNote?.content || ''); setNoteEditing(true) }} className="btn-ghost text-xs">Edit</button>
            : <div className="flex gap-2">
                <button onClick={() => setNoteEditing(false)} className="btn-ghost text-xs">Cancel</button>
                <button onClick={handleSaveNote} className="btn-primary text-xs py-1.5 px-3">Save</button>
              </div>
          }
        </div>
        {noteEditing
          ? <textarea className="textarea w-full" rows={5} value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Notes about this class..." />
          : <p className="text-sm whitespace-pre-wrap" style={{ color: classNote?.content ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: classNote?.content ? 'normal' : 'italic' }}>
              {classNote?.content || 'No notes yet. Click Edit to add.'}
            </p>
        }
      </div>

      {selectedLesson && (
        <DayPanel lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
      )}
    </div>
  )
}
