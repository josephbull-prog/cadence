/**
 * Timetable-style week view.
 * Days across the top, periods down the left — like a real school timetable.
 * Each cell shows the class scheduled in that period/day slot.
 */
import { useMemo } from 'react'
import { format, addDays, isToday } from 'date-fns'
import { StickyNote, BookCheck } from 'lucide-react'
import { useClasses, useTimetableSlots, useLessonPlans, useHomework, useHolidays, useProfile } from '../../lib/hooks'
import { isHoliday, isSingleDayHoliday, getHolidayLabel, getCycleWeek, toISO } from '../../lib/cycleEngine'

const ALL_PERIODS = [1, 2, 3, 4, 5, 6]

export default function TimetableWeekView({ weekStart, onLessonClick }) {
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

  // Only show periods that have at least one slot
  const activePeriods = useMemo(() => {
    const used = new Set(slots.map(s => s.period_number))
    return ALL_PERIODS.filter(p => used.has(p))
  }, [slots])

  // Look up what's in a given period on a given day
  const getCell = (period, dayIso) => {
    const day = days.find(d => d.iso === dayIso)
    if (!day) return null
    if (isHoliday(day.date, holidays)) {
      const label = getHolidayLabel(day.date, holidays)
      const single = isSingleDayHoliday(day.date, holidays)
      return { holiday: true, label, single }
    }
    const cycleWeek = getCycleWeek(day.date, profile, holidays)
    const dow = day.date.getDay() || 7 // Mon=1…Fri=5
    const slot = slots.find(s => s.day_of_week === dow && s.period_number === period && s.cycle_week === cycleWeek)
    if (!slot) return null
    const cls = classes.find(c => c.id === slot.class_id)
    const plan = plans.find(p => p.class_id === slot.class_id && p.date === dayIso && p.period_number === period)
    const hwDue = homework.filter(h => h.class_id === slot.class_id && h.date_due === dayIso)
    return { slot, cls, plan, hwDue }
  }

  if (!slots.length) return null

  const thStyle = {
    padding: '6px 8px',
    fontSize: '11px',
    fontWeight: 500,
    textAlign: 'center',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-muted)',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {/* Period header corner */}
            <th style={{ ...thStyle, width: '44px', textAlign: 'center', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>P</th>
            {days.map(({ date, iso }) => {
              const today = isToday(date)
              const hol = isHoliday(date, holidays)
              const label = getHolidayLabel(date, holidays)
              return (
                <th key={iso} style={{
                  ...thStyle,
                  background: today ? 'rgba(230,176,32,0.08)' : hol ? 'var(--hover-bg)' : 'var(--bg-surface)',
                  color: today ? 'var(--gold)' : hol ? 'var(--text-muted)' : 'var(--text-primary)',
                  opacity: hol && !isSingleDayHoliday(date, holidays) ? 0.45 : 1,
                }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'inherit', opacity: 0.7 }}>
                    {format(date, 'EEE')}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 500, lineHeight: 1.1, color: 'inherit' }}>
                    {format(date, 'd')}
                  </div>
                  {label && (
                    <div style={{ fontSize: '9px', color: isSingleDayHoliday(date, holidays) ? '#6090c0' : '#f0a040', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label}
                    </div>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {activePeriods.map(period => (
            <tr key={period} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Period label */}
              <td style={{ textAlign: 'center', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', fontFamily: 'monospace' }}>
                P{period}
              </td>
              {days.map(({ date, iso }) => {
                const cell = getCell(period, iso)
                const today = isToday(date)

                // Single-day holiday in first period → note cell
                if (cell?.holiday && cell.single && period === activePeriods[0]) {
                  return (
                    <td key={iso} rowSpan={activePeriods.length}
                      style={{ padding: '6px', borderRight: '1px solid var(--border)', verticalAlign: 'middle', height: `${activePeriods.length * 60}px` }}>
                      <button onClick={() => onLessonClick({ date: iso, classId: null, period, planId: null })}
                        style={{ width: '100%', height: '100%', minHeight: '52px', borderRadius: '6px', background: 'rgba(96,144,192,0.08)', border: '1px solid rgba(96,144,192,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', cursor: 'pointer', color: '#6090c0' }}>
                        <span style={{ fontSize: '14px' }}>📋</span>
                        <span style={{ fontSize: '10px' }}>Notes</span>
                      </button>
                    </td>
                  )
                }
                if (cell?.holiday && cell.single) return null // merged above

                // Multi-day holiday
                if (cell?.holiday) {
                  return (
                    <td key={iso} style={{ padding: '4px', borderRight: '1px solid var(--border)', height: '60px' }}>
                      <div style={{ height: '100%', borderRadius: '5px', border: '1px dashed var(--border)' }} />
                    </td>
                  )
                }

                // Empty (no class this period/day)
                if (!cell) {
                  return (
                    <td key={iso} style={{ padding: '4px', borderRight: '1px solid var(--border)', height: '60px', background: today ? 'rgba(230,176,32,0.04)' : 'transparent' }}>
                      <div style={{ height: '100%', borderRadius: '5px', border: '1px dashed var(--border)' }} />
                    </td>
                  )
                }

                // Lesson cell
                const { cls, plan, hwDue } = cell
                const color = cls?.color_code || '#888'
                return (
                  <td key={iso} style={{ padding: '4px', borderRight: '1px solid var(--border)', height: '60px', background: today ? 'rgba(230,176,32,0.04)' : 'transparent' }}>
                    <button
                      onClick={() => onLessonClick({ date: iso, classId: cell.slot.class_id, period, planId: plan?.id })}
                      style={{
                        width: '100%', height: '100%', borderRadius: '6px', padding: '6px 8px',
                        background: color + '18', border: `1px solid ${color}35`,
                        borderLeftWidth: '3px', borderLeftColor: color,
                        textAlign: 'left', cursor: 'pointer', display: 'block', transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = color + '28' }}
                      onMouseLeave={e => { e.currentTarget.style.background = color + '18' }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {cls?.name || ''}
                      </div>
                      {plan?.plan_content && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {plan.plan_content}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
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
  )
}
