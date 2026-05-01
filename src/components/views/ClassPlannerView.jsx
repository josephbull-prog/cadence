/**
 * Class Planner — class rows × day columns.
 * Available in all layout styles via the nav.
 */
import { useState, useMemo } from 'react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, StickyNote, BookCheck } from 'lucide-react'
import { useClasses, useTimetableSlots, useLessonPlans, useHomework, useHolidays, useProfile } from '../../lib/hooks'
import { isHoliday, isSingleDayHoliday, getHolidayLabel, getCycleWeek, toISO } from '../../lib/cycleEngine'
import DayPanel from './DayPanel'

export default function ClassPlannerView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedLesson, setSelectedLesson] = useState(null)

  const { data: classes = [] } = useClasses()
  const { data: slots = [] } = useTimetableSlots()
  const { data: plans = [] } = useLessonPlans()
  const { data: homework = [] } = useHomework()
  const { data: holidays = [] } = useHolidays()
  const { data: profile } = useProfile()

  const days = useMemo(() => [0,1,2,3,4].map(i => {
    const date = addDays(weekStart, i)
    return { date, iso: toISO(date) }
  }), [weekStart])

  const cycleWeek = profile ? getCycleWeek(weekStart, profile, holidays) : null
  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(addDays(weekStart, 4), 'd MMM yyyy')}`
  const weekAB = cycleWeek === 1 ? 'Week A' : cycleWeek === 2 ? 'Week B' : null

  // For a class + day, find the best slot (earliest period that day)
  const getCell = (classId, dayIso) => {
    const day = days.find(d => d.iso === dayIso)
    if (!day) return null
    if (isHoliday(day.date, holidays)) {
      return { holiday: true, single: isSingleDayHoliday(day.date, holidays), label: getHolidayLabel(day.date, holidays) }
    }
    const cw = getCycleWeek(day.date, profile, holidays)
    const dow = day.date.getDay() || 7
    const classSlots = slots.filter(s => s.class_id === classId && s.day_of_week === dow && s.cycle_week === cw)
      .sort((a, b) => a.period_number - b.period_number)
    if (!classSlots.length) return null
    const slot = classSlots[0]
    const plan = plans.find(p => p.class_id === classId && p.date === dayIso && p.period_number === slot.period_number)
    const hwDue = homework.filter(h => h.class_id === classId && h.date_due === dayIso)
    return { slot, plan, hwDue }
  }

  const colW = `${Math.floor(560 / 5)}px`

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Class Planner</h2>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{weekLabel}</span>
            {weekAB && (
              <span className="badge text-xs" style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-color)', border: '1px solid var(--nav-active-border)' }}>
                {weekAB}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(d => subWeeks(d, 1))} className="btn-ghost p-2 min-w-[44px]"><ChevronLeft size={18} /></button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="btn-secondary text-xs px-3 py-2">Today</button>
          <button onClick={() => setWeekStart(d => addWeeks(d, 1))} className="btn-ghost p-2 min-w-[44px]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No classes set up yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Add classes in Settings first.</p>
          <a href="/settings" className="btn-primary inline-flex">Go to Settings</a>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
            <thead>
              <tr>
                {/* Class col header */}
                <th style={{ width: '140px', padding: '8px 12px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', position: 'sticky', left: 0, zIndex: 1 }}>
                  Class
                </th>
                {days.map(({ date, iso }) => {
                  const today = isToday(date)
                  const hol = isHoliday(date, holidays)
                  const label = getHolidayLabel(date, holidays)
                  const single = isSingleDayHoliday(date, holidays)
                  return (
                    <th key={iso} style={{
                      width: colW,
                      padding: '6px 8px', textAlign: 'center',
                      borderBottom: `2px solid ${today ? 'var(--gold)' : 'var(--border)'}`,
                      borderRight: '1px solid var(--border)',
                      background: today ? 'rgba(230,176,32,0.06)' : hol && !single ? 'var(--hover-bg)' : 'var(--bg-surface)',
                      opacity: hol && !single ? 0.5 : 1,
                    }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: today ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {format(date, 'EEE')}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 500, color: today ? 'var(--gold)' : 'var(--text-primary)', lineHeight: 1.1 }}>
                        {format(date, 'd')}
                      </div>
                      {label && (
                        <div style={{ fontSize: '9px', color: single ? '#6090c0' : '#f0a040', marginTop: '1px' }}>
                          {label}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {classes.map(cls => (
                <tr key={cls.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Class label — sticky */}
                  <td style={{
                    padding: '8px 12px', borderRight: '1px solid var(--border)',
                    background: 'var(--bg-surface)', position: 'sticky', left: 0, zIndex: 1,
                  }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: '3px', height: '36px', borderRadius: '2px', background: cls.color_code || '#888', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2 }}>{cls.name}</div>
                        {cls.room && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Rm {cls.room}</div>}
                      </div>
                    </div>
                  </td>

                  {/* Day cells */}
                  {days.map(({ date, iso }) => {
                    const cell = getCell(cls.id, iso)
                    const today = isToday(date)

                    if (!cell) {
                      return (
                        <td key={iso} style={{ padding: '5px', borderRight: '1px solid var(--border)', height: '64px', background: today ? 'rgba(230,176,32,0.03)' : 'transparent' }}>
                          <div style={{ height: '100%', borderRadius: '5px', border: '1px dashed var(--border)' }} />
                        </td>
                      )
                    }

                    if (cell.holiday) {
                      if (cell.single) {
                        return (
                          <td key={iso} style={{ padding: '5px', borderRight: '1px solid var(--border)', height: '64px' }}>
                            <button onClick={() => setSelectedLesson({ date: iso, classId: null, period: 1, planId: null })}
                              style={{ width: '100%', height: '100%', borderRadius: '5px', background: 'rgba(96,144,192,0.07)', border: '1px solid rgba(96,144,192,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#6090c0' }}>
                              📋
                            </button>
                          </td>
                        )
                      }
                      return (
                        <td key={iso} style={{ padding: '5px', borderRight: '1px solid var(--border)', height: '64px', opacity: 0.35 }}>
                          <div style={{ height: '100%', borderRadius: '5px', border: '1px dashed var(--border)' }} />
                        </td>
                      )
                    }

                    const { slot, plan, hwDue } = cell
                    const color = cls.color_code || '#888'
                    return (
                      <td key={iso} style={{ padding: '5px', borderRight: '1px solid var(--border)', height: '64px', background: today ? 'rgba(230,176,32,0.03)' : 'transparent' }}>
                        <button
                          onClick={() => setSelectedLesson({ date: iso, classId: cls.id, period: slot.period_number, planId: plan?.id })}
                          style={{
                            width: '100%', height: '100%', borderRadius: '6px',
                            background: color + '15', border: `1px solid ${color}30`,
                            borderLeftWidth: '3px', borderLeftColor: color,
                            padding: '5px 7px', textAlign: 'left', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                            overflow: 'hidden',
                            transition: 'all 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = color + '25' }}
                          onMouseLeave={e => { e.currentTarget.style.background = color + '15' }}
                        >
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '13px', flexShrink: 0 }}>P{slot.period_number}</div>
                          {plan?.plan_content ? (
                            <div style={{
                              fontSize: '11px', color: 'var(--text-primary)',
                              lineHeight: '14px',
                              maxHeight: '28px',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              flexShrink: 0,
                            }}>
                              {plan.plan_content}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '14px' }}>No plan yet</div>
                          )}
                          <div style={{ display: 'flex', gap: '3px', marginTop: 'auto', flexShrink: 0 }}>
                            {plan?.notes && <StickyNote size={9} style={{ color: 'var(--gold)' }} />}
                            {hwDue?.length > 0 && <BookCheck size={9} style={{ color: '#7db88d' }} />}
                          </div>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLesson && (
        <DayPanel lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
      )}
    </div>
  )
}
