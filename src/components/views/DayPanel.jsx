import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { X, FileText, SkipForward, BookOpen, AlertTriangle } from 'lucide-react'
import { useClasses, useSchemes, useLessonPlans, useUpsertLessonPlan, useHolidays, useProfile, useTimetableSlots } from '../../lib/hooks'
import { getSoWSuggestion, computePushForward, getHolidayLabel, isSingleDayHoliday } from '../../lib/cycleEngine'
import { useToast } from '../../lib/toast'
import { db } from '../../lib/storage'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'

export default function DayPanel({ lesson, onClose }) {
  const { date, classId, period, planId } = lesson
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const { data: classes = [] } = useClasses()
  const { data: schemes = [] } = useSchemes()
  const { data: allPlans = [] } = useLessonPlans()
  const { data: profile } = useProfile()
  const { data: holidays = [] } = useHolidays()
  const { data: slots = [] } = useTimetableSlots()
  const upsertPlan = useUpsertLessonPlan()

  const cls = classes.find(c => c.id === classId)
  const existingPlan = allPlans.find(p => p.id === planId) ||
    (classId
      ? allPlans.find(p => p.class_id === classId && p.date === date && p.period_number === period)
      : allPlans.find(p => !p.class_id && p.date === date))

  // Check if this is an INSET/holiday day
  const holidayLabel = getHolidayLabel(date, holidays)
  const isInsetDay = isSingleDayHoliday(date, holidays)

  const [content, setContent] = useState(existingPlan?.plan_content || '')
  const [notes, setNotes] = useState(existingPlan?.notes || '')
  const [dirty, setDirty] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [ghostVisible, setGhostVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pushConfirm, setPushConfirm] = useState(false)

  const previousPlan = allPlans
    .filter(p => p.class_id === classId && p.date && p.date < date)
    .sort((a, b) => b.date < a.date ? -1 : 1)[0]

  useEffect(() => {
    if (!existingPlan?.is_off_piste) {
      const sug = getSoWSuggestion(classId, classes, schemes, allPlans)
      setSuggestion(sug)
      setGhostVisible(!!sug && !content)
    }
  }, [classId, classes, schemes, allPlans])

  const handleContentChange = (e) => {
    setContent(e.target.value)
    setDirty(true)
    if (e.target.value.length > 0) setGhostVisible(false)
    else if (suggestion) setGhostVisible(true)
  }

  const handleContentKeyDown = (e) => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghostVisible && suggestion) {
      e.preventDefault()
      setContent(suggestion.title)
      setGhostVisible(false)
      setDirty(true)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const isSowAccepted = suggestion && content === suggestion.title
      const planData = isInsetDay
        ? {
            ...(existingPlan?.id ? { id: existingPlan.id } : {}),
            user_id: user.id,
            class_id: null,
            date,
            period_number: null,
            plan_content: content,
            notes,
            sow_index: null,
            is_off_piste: false
          }
        : {
            ...(existingPlan?.id ? { id: existingPlan.id } : {}),
            user_id: user.id,
            class_id: classId,
            date,
            period_number: period,
            plan_content: content,
            notes,
            sow_index: isSowAccepted ? suggestion.index : (existingPlan?.sow_index ?? null),
            is_off_piste: !!(content && !isSowAccepted && suggestion)
          }
      await upsertPlan.mutateAsync(planData)
      toast.success('Lesson saved')
      onClose() // close on save
    } catch (err) {
      toast.error('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePushForward = async () => {
    if (!pushConfirm) { setPushConfirm(true); return }
    try {
      const { updatedPlans, unschedulable } = computePushForward(classId, date, allPlans, slots, profile, holidays)
      for (const update of updatedPlans) {
        await db().from('lesson_plans').update({ date: update.date, period_number: update.period_number }).eq('id', update.id)
      }
      await qc.invalidateQueries({ queryKey: ['lesson_plans'] })
      if (unschedulable > 0) {
        toast.info(`${unschedulable} lesson(s) saved as drafts — beyond scheduled dates.`)
      } else {
        toast.success('Lessons pushed forward')
      }
      setPushConfirm(false)
      onClose()
    } catch (err) {
      toast.error('Push forward failed: ' + err.message)
    }
  }

  const handleGenerateCoverSlip = () => {
    onClose()
    navigate(`/cover-slip?classId=${classId}&date=${date}&period=${period}`)
  }

  const title = isInsetDay
    ? `INSET Day — ${holidayLabel}`
    : cls ? cls.name : 'Lesson'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => { if (!dirty) onClose() }} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg flex flex-col animate-slide-in shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {cls && !isInsetDay && (
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cls.color_code || '#888' }} />
          )}
          {isInsetDay && <span className="text-lg">📋</span>}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {format(parseISO(date), 'EEEE d MMMM')}{!isInsetDay && ` · Period ${period}`}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 min-w-[44px] shrink-0"><X size={18} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* INSET day note mode */}
          {isInsetDay && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(240,160,64,0.1)', borderColor: 'rgba(240,160,64,0.2)', border: '1px solid' }}>
              <p style={{ color: '#f0a040' }}>📋 INSET Day — use the note below to plan your day</p>
            </div>
          )}

          {/* Previous lesson continuity (not on INSET) */}
          {!isInsetDay && previousPlan?.plan_content && (
            <div className="rounded-lg p-3" style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Previous lesson</p>
              <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{previousPlan.plan_content}</p>
            </div>
          )}

          {/* Lesson plan / INSET notes */}
          <div>
            <label className="label">{isInsetDay ? 'Plan for the day' : 'Lesson Plan'}</label>
            <div className="relative">
              <textarea
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleContentKeyDown}
                placeholder={ghostVisible && suggestion ? '' : isInsetDay ? 'What are you doing today?' : 'What are you covering?'}
                className="textarea"
                rows={5}
                autoFocus
              />
              {ghostVisible && suggestion && (
                <div className="absolute top-0 left-0 p-3 text-sm pointer-events-none whitespace-pre-wrap break-words w-full"
                  style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {suggestion.title}
                </div>
              )}
              {ghostVisible && suggestion && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <BookOpen size={10} /> Next in SoW — press Tab to accept
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="label">Sticky Note</label>
            <textarea value={notes} onChange={e => { setNotes(e.target.value); setDirty(true) }}
              placeholder="Reminders, resources, things to grab..." className="textarea" rows={3} />
          </div>

          {/* Actions — not shown for INSET days */}
          {!isInsetDay && (
            <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={handlePushForward}
                className={`w-full ${pushConfirm ? 'btn-danger' : 'btn-secondary'} gap-2`}>
                {pushConfirm ? <><AlertTriangle size={16} />Confirm push all future lessons forward?</> : <><SkipForward size={16} />Push Forward from here</>}
              </button>
              {pushConfirm && <button onClick={() => setPushConfirm(false)} className="btn-ghost w-full text-xs">Cancel</button>}
              <button onClick={handleGenerateCoverSlip} className="w-full btn-secondary gap-2">
                <FileText size={16} /> Generate Cover Slip
              </button>
            </div>
          )}
        </div>

        {/* Save footer */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="btn-ghost flex-1">{dirty ? 'Discard' : 'Close'}</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
