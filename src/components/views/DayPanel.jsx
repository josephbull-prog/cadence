import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { X, FileText, SkipForward, BookOpen, AlertTriangle, Link, ExternalLink, Check, ChevronDown, FastForward } from 'lucide-react'
import { useClasses, useSchemes, useLessonPlans, useUpsertLessonPlan, useHolidays, useProfile, useTimetableSlots } from '../../lib/hooks'
import { getSoWSuggestion, getSoWProgress, computePushForward, getHolidayLabel, isSingleDayHoliday } from '../../lib/cycleEngine'
import { useToast } from '../../lib/toast'
import { db } from '../../lib/storage'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'

/**
 * SoW suggestion bar — replaces ghost text.
 * Shows the suggested lesson with three explicit actions:
 *   ✓ Accept  |  → Skip  |  ✏ Custom
 * Works on iPad (no Tab key required).
 */
function SoWSuggestionBar({ suggestion, onAccept, onSkip, onCustom, accepted, skipped }) {
  if (!suggestion) return null

  if (accepted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{ background: 'rgba(96,144,192,0.12)', border: '1px solid rgba(96,144,192,0.2)' }}>
        <BookOpen size={12} style={{ color: '#6090c0', flexShrink: 0 }} />
        <span style={{ color: '#6090c0' }}>SoW #{suggestion.index + 1}: <strong>{suggestion.title}</strong></span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>accepted</span>
        <button onClick={onCustom} className="text-xs underline" style={{ color: 'var(--text-muted)' }}>change</button>
      </div>
    )
  }

  if (skipped) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{ background: 'rgba(240,160,64,0.10)', border: '1px solid rgba(240,160,64,0.2)' }}>
        <FastForward size={12} style={{ color: '#f0a040', flexShrink: 0 }} />
        <span style={{ color: '#f0a040' }}>Skipping SoW #{suggestion.index + 1}: <strong>{suggestion.title}</strong></span>
        <button onClick={onAccept} className="ml-auto text-xs underline" style={{ color: 'var(--text-muted)' }}>undo</button>
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="px-3 py-2 flex items-start gap-2" style={{ background: 'var(--hover-bg)' }}>
        <BookOpen size={12} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
            SoW #{suggestion.index + 1}
            {suggestion.remaining > 0 && ` · ${suggestion.remaining} lesson${suggestion.remaining !== 1 ? 's' : ''} remaining`}
          </div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{suggestion.title}</div>
        </div>
      </div>
      <div className="flex" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={onAccept}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
          style={{ color: '#7db88d', background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(125,184,141,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Check size={12} /> Accept
        </button>
        <div style={{ width: '1px', background: 'var(--border)' }} />
        <button onClick={onSkip}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
          style={{ color: '#f0a040', background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,160,64,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <FastForward size={12} /> Skip this lesson
        </button>
        <div style={{ width: '1px', background: 'var(--border)' }} />
        <button onClick={onCustom}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all"
          style={{ color: 'var(--text-secondary)', background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg-strong)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          Custom
        </button>
      </div>
    </div>
  )
}

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

  const holidayLabel = getHolidayLabel(date, holidays)
  const isInsetDay = isSingleDayHoliday(date, holidays)

  // Content state
  const [content, setContent] = useState(existingPlan?.plan_content || '')
  const [notes, setNotes] = useState(existingPlan?.notes || '')
  const [resourceUrl, setResourceUrl] = useState(existingPlan?.resource_url || '')
  const [resourceLabel, setResourceLabel] = useState(existingPlan?.resource_label || '')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pushConfirm, setPushConfirm] = useState(false)
  const [showResourceLink, setShowResourceLink] = useState(!!(existingPlan?.resource_url))

  // SoW state — three modes: 'suggest' | 'accepted' | 'skipped' | 'custom'
  const [sowMode, setSowMode] = useState(() => {
    if (!existingPlan) return 'suggest'
    if (existingPlan.sow_skipped) return 'skipped'
    if (existingPlan.sow_index !== null && existingPlan.sow_index !== undefined && !existingPlan.is_off_piste) return 'accepted'
    if (existingPlan.is_off_piste) return 'custom'
    return 'suggest'
  })

  const suggestion = !isInsetDay ? getSoWSuggestion(classId, classes, schemes, allPlans) : null
  const sowProgress = !isInsetDay ? getSoWProgress(classId, classes, schemes, allPlans) : null

  // When user accepts SoW suggestion — fill the content field
  const handleSoWAccept = () => {
    if (!suggestion) return
    setContent(suggestion.title)
    setSowMode('accepted')
    setDirty(true)
  }

  // When user skips — clear content (or keep what they typed), mark as skipped
  const handleSoWSkip = () => {
    setSowMode('skipped')
    // Keep any content they already typed as a note about the skip
    setDirty(true)
  }

  // Switch to freeform custom entry
  const handleSoWCustom = () => {
    setSowMode('custom')
    setDirty(true)
  }

  const previousPlan = allPlans
    .filter(p => p.class_id === classId && p.date && p.date < date)
    .sort((a, b) => b.date < a.date ? -1 : 1)[0]

  const handleSave = async () => {
    setSaving(true)
    try {
      const isSowAccepted = sowMode === 'accepted' && suggestion
      const isSowSkipped = sowMode === 'skipped' && suggestion

      const planData = isInsetDay
        ? {
            ...(existingPlan?.id ? { id: existingPlan.id } : {}),
            user_id: user.id,
            class_id: null,
            date,
            period_number: null,
            plan_content: content,
            notes,
            resource_url: resourceUrl.trim() || null,
            resource_label: resourceLabel.trim() || null,
            sow_index: null,
            sow_skipped: false,
            is_off_piste: false,
          }
        : {
            ...(existingPlan?.id ? { id: existingPlan.id } : {}),
            user_id: user.id,
            class_id: classId,
            date,
            period_number: period,
            plan_content: content,
            notes,
            resource_url: resourceUrl.trim() || null,
            resource_label: resourceLabel.trim() || null,
            sow_index: (isSowAccepted || isSowSkipped) ? suggestion.index : (existingPlan?.sow_index ?? null),
            sow_skipped: isSowSkipped,
            is_off_piste: sowMode === 'custom',
          }

      await upsertPlan.mutateAsync(planData)
      toast.success(isSowSkipped ? 'Lesson skipped in SoW' : 'Lesson saved')
      onClose()
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
      if (unschedulable > 0) toast.info(`${unschedulable} lesson(s) saved as drafts.`)
      else toast.success('Lessons pushed forward')
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

  const title = isInsetDay ? (holidayLabel || 'Day off') : cls ? cls.name : 'Lesson'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => { if (!dirty) onClose() }} />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg flex flex-col animate-slide-in shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {isInsetDay && (
            <div className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'rgba(96,144,192,0.1)', border: '1px solid rgba(96,144,192,0.2)' }}>
              <p style={{ color: '#6090c0' }}>📋 Use the notes below to plan your day</p>
            </div>
          )}

          {/* Previous lesson */}
          {!isInsetDay && previousPlan?.plan_content && (
            <div className="rounded-lg p-3" style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Previous lesson</p>
              <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{previousPlan.plan_content}</p>
            </div>
          )}

          {/* SoW suggestion bar — iPad-friendly, no Tab required */}
          {suggestion && !isInsetDay && (
            <SoWSuggestionBar
              suggestion={suggestion}
              accepted={sowMode === 'accepted'}
              skipped={sowMode === 'skipped'}
              onAccept={handleSoWAccept}
              onSkip={handleSoWSkip}
              onCustom={handleSoWCustom}
            />
          )}

          {/* SoW progress mini-bar */}
          {sowProgress && !isInsetDay && (
            <div>
              <div className="flex items-center gap-1 flex-wrap">
                {sowProgress.map(item => (
                  <div key={item.index} title={item.title}
                    className="rounded-sm transition-all"
                    style={{
                      width: '14px', height: '8px',
                      background: item.status === 'taught' ? '#7db88d'
                               : item.status === 'skipped' ? '#f0a040'
                               : item.status === 'next' ? 'var(--gold)'
                               : 'var(--border)',
                    }} />
                ))}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                SoW progress · {sowProgress.filter(l => l.status === 'taught').length} taught
                {sowProgress.filter(l => l.status === 'skipped').length > 0 && ` · ${sowProgress.filter(l => l.status === 'skipped').length} skipped`}
                {` · ${sowProgress.filter(l => ['next','upcoming'].includes(l.status)).length} remaining`}
              </p>
            </div>
          )}

          {/* Lesson plan — show when not in pure-skip mode, or always for inset */}
          {sowMode !== 'skipped' && (
            <div>
              <label className="label">{isInsetDay ? 'Plan for the day' : 'Lesson plan'}</label>
              <textarea
                value={content}
                onChange={e => { setContent(e.target.value); setDirty(true) }}
                placeholder={isInsetDay ? 'What are you doing today?' : 'What are you covering?'}
                className="textarea"
                rows={5}
                autoFocus={!suggestion || sowMode === 'custom'}
              />
            </div>
          )}

          {sowMode === 'skipped' && (
            <div>
              <label className="label">Reason for skipping (optional)</label>
              <textarea
                value={content}
                onChange={e => { setContent(e.target.value); setDirty(true) }}
                placeholder="e.g. Covered in previous lesson, assessment week, ran out of time…"
                className="textarea"
                rows={3}
              />
            </div>
          )}

          {/* Resource link */}
          <div>
            {!showResourceLink ? (
              <button onClick={() => setShowResourceLink(true)}
                className="btn-ghost text-xs gap-1.5 -ml-1"
                style={{ minHeight: 'unset', padding: '4px 8px', color: 'var(--text-muted)' }}>
                <Link size={12} /> Add resource link
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label" style={{ marginBottom: 0 }}>Resource link</label>
                  <button onClick={() => { setShowResourceLink(false); setResourceUrl(''); setResourceLabel(''); setDirty(true) }}
                    className="text-xs" style={{ color: 'var(--text-muted)' }}>Remove</button>
                </div>
                <input className="input" placeholder="https://…" value={resourceUrl} type="url"
                  onChange={e => { setResourceUrl(e.target.value); setDirty(true) }} />
                <input className="input" placeholder="Label (e.g. BBC Bitesize — Forces)"
                  value={resourceLabel}
                  onChange={e => { setResourceLabel(e.target.value); setDirty(true) }} />
                {resourceUrl && (
                  <a href={resourceUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--gold)' }}>
                    <ExternalLink size={11} />
                    {resourceLabel || resourceUrl.replace(/^https?:\/\//, '').slice(0, 50)}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Sticky note */}
          <div>
            <label className="label">Sticky note</label>
            <textarea value={notes} onChange={e => { setNotes(e.target.value); setDirty(true) }}
              placeholder="Reminders, things to grab…" className="textarea" rows={3} />
          </div>

          {/* Actions */}
          {!isInsetDay && (
            <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={handlePushForward}
                className={`w-full ${pushConfirm ? 'btn-danger' : 'btn-secondary'} gap-2`}>
                {pushConfirm
                  ? <><AlertTriangle size={16} />Confirm — push all future lessons forward?</>
                  : <><SkipForward size={16} />Push Forward from here</>}
              </button>
              {pushConfirm && (
                <button onClick={() => setPushConfirm(false)} className="btn-ghost w-full text-xs">Cancel</button>
              )}
              <button onClick={handleGenerateCoverSlip} className="w-full btn-secondary gap-2">
                <FileText size={16} /> Generate Cover Slip
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="btn-ghost flex-1">{dirty ? 'Discard' : 'Close'}</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 disabled:opacity-40">
            {saving ? 'Saving…' : sowMode === 'skipped' ? 'Mark skipped' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
