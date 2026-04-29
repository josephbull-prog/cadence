import { useState, useMemo, useEffect } from 'react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, StickyNote, BookCheck, Calendar, Search } from 'lucide-react'
import { useProfile, useHolidays, useClasses, useTimetableSlots, useLessonPlans, useHomework } from '../../lib/hooks'
import { getCycleWeek, getScheduleForDate, isHoliday, isSingleDayHoliday, getHolidayLabel, toISO } from '../../lib/cycleEngine'
import DayPanel from './DayPanel'
import { useTheme } from '../../lib/theme'
import TimetableWeekView from './TimetableWeekView'
import UniversalSearch from '../ui/UniversalSearch'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const PERIODS = [1, 2, 3, 4, 5, 6]

export default function WeekView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const { style } = useTheme()

  // Press / to open search (when not typing in an input)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])


  const { data: profile } = useProfile()
  const { data: holidays = [] } = useHolidays()
  const { data: classes = [] } = useClasses()
  const { data: slots = [] } = useTimetableSlots()
  const { data: plans = [] } = useLessonPlans()
  const { data: homework = [] } = useHomework()

  const days = useMemo(() =>
    DAYS.map((name, i) => ({
      name, short: name.slice(0, 3),
      date: addDays(weekStart, i),
      iso: toISO(addDays(weekStart, i))
    })), [weekStart])

  const cycleWeek = profile ? getCycleWeek(weekStart, profile, holidays) : null

  const grid = useMemo(() => {
    const g = {}
    days.forEach(day => {
      g[day.iso] = {}
      const daySchedule = getScheduleForDate(day.date, slots, profile, holidays)
      daySchedule.forEach(({ slot }) => {
        const cls = classes.find(c => c.id === slot.class_id)
        const plan = plans.find(p => p.class_id === slot.class_id && p.date === day.iso && p.period_number === slot.period_number)
        const homeworkDue = homework.filter(h => h.class_id === slot.class_id && h.date_due === day.iso)
        g[day.iso][slot.period_number] = { slot, cls, plan, homeworkDue }
      })
    })
    return g
  }, [days, slots, classes, plans, holidays, profile, homework])

  const activePeriods = useMemo(() => {
    const set = new Set()
    days.forEach(day => Object.keys(grid[day.iso] || {}).forEach(p => set.add(Number(p))))
    return PERIODS.filter(p => set.has(p))
  }, [grid, days])

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(addDays(weekStart, 4), 'd MMM yyyy')}`
  const weekAB = cycleWeek === 1 ? 'Week A' : cycleWeek === 2 ? 'Week B' : null

  // For a single-day holiday, we show one merged note cell in the first active period row,
  // and empty cells in all other period rows — keeping the grid intact.
  const firstPeriod = activePeriods[0]

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Timetable style swaps to a class-row layout */}
      {/* Search bar — expands inline above the week nav */}
      {showSearch ? (
        <div className="mb-4 animate-slide-up">
          <UniversalSearch autoFocus onClose={() => setShowSearch(false)} />
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{weekLabel}</h2>
            <div className="flex items-center gap-2 mt-1">
              {weekAB && (
                <span className="badge text-xs"
                  style={cycleWeek === 1
                    ? { background: 'rgba(96,144,192,0.15)', color: '#6090c0', border: '1px solid rgba(96,144,192,0.2)' }
                    : { background: 'rgba(176,112,192,0.15)', color: '#b070c0', border: '1px solid rgba(176,112,192,0.2)' }
                  }>
                  {weekAB}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(true)} className="btn-ghost p-2 min-w-[44px]" title="Search (/)">
              <Search size={18} />
            </button>
            <button onClick={() => setWeekStart(d => subWeeks(d, 1))} className="btn-ghost p-2 min-w-[44px]"><ChevronLeft size={18} /></button>
            <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="btn-secondary text-xs px-3 py-2">Today</button>
            <button onClick={() => setWeekStart(d => addWeeks(d, 1))} className="btn-ghost p-2 min-w-[44px]"><ChevronRight size={18} /></button>
          </div>
        </div>
      )}

      {style === 'timetable' ? (
        <TimetableWeekView weekStart={weekStart} onLessonClick={setSelectedLesson} />
      ) : slots.length === 0 ? (
        <div className="card p-8 text-center">
          <Calendar size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No timetable yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Go to Settings to build your timetable.</p>
          <a href="/settings" className="btn-primary inline-flex">Set up timetable</a>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="min-w-[600px]">
            {/* Day headers */}
            <div className="grid mb-2" style={{ gridTemplateColumns: '56px repeat(5, 1fr)' }}>
              <div />
              {days.map(day => {
                const holidayLabel = getHolidayLabel(day.date, holidays)
                const isHol = isHoliday(day.date, holidays)
                const isSingle = isSingleDayHoliday(day.date, holidays)
                const today = isToday(day.date)
                return (
                  <div key={day.iso} className={`text-center pb-2 px-1 ${isHol && !isSingle ? 'opacity-40' : ''}`}>
                    <p className="text-xs uppercase tracking-wider font-medium"
                      style={{ color: today ? 'var(--gold)' : 'var(--text-muted)' }}>{day.short}</p>
                    <p className="text-lg font-semibold mt-0.5"
                      style={{ color: today ? 'var(--gold)' : 'var(--text-primary)' }}>{format(day.date, 'd')}</p>
                    {holidayLabel && (
                      <p className="text-xs truncate" style={{ color: isSingle ? '#6090c0' : '#f0a040' }}>
                        {holidayLabel}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Period rows — one row per period, grid stays intact */}
            {activePeriods.map(period => (
              <div key={period} className="grid mb-1.5" style={{ gridTemplateColumns: '56px repeat(5, 1fr)' }}>
                <div className="flex items-center justify-center">
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>P{period}</span>
                </div>

                {days.map(day => {
                  const cell = grid[day.iso]?.[period]
                  const isHol = isHoliday(day.date, holidays)
                  const isSingle = isSingleDayHoliday(day.date, holidays)
                  const holidayLabel = getHolidayLabel(day.date, holidays)
                  const today = isToday(day.date)

                  // Single-day holiday (INSET, odd day off, etc.)
                  // Show a clickable note cell on the FIRST period row only;
                  // all other period rows on that day just render an empty placeholder.
                  if (isHol && isSingle) {
                    if (period === firstPeriod) {
                      return (
                        <button
                          key={day.iso}
                          onClick={() => setSelectedLesson({ date: day.iso, classId: null, period, planId: null })}
                          className="mx-0.5 h-14 rounded-lg text-xs transition-all flex flex-col items-center justify-center gap-0.5"
                          style={{
                            background: 'rgba(96,144,192,0.08)',
                            border: '1px solid rgba(96,144,192,0.25)',
                            color: '#6090c0'
                          }}
                        >
                          <span>📋</span>
                          <span style={{ fontSize: '10px' }}>Add notes</span>
                        </button>
                      )
                    }
                    // Other periods on a single-day holiday: empty cell, no dashed border
                    return <div key={day.iso} className="mx-0.5 h-14" />
                  }

                  // Multi-day holiday
                  if (isHol) {
                    return (
                      <div key={day.iso} className="mx-0.5 h-14 rounded-lg flex items-center justify-center"
                        style={{ border: '1px dashed var(--border)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>—</span>
                      </div>
                    )
                  }

                  // Normal empty slot
                  if (!cell) return <div key={day.iso} className="mx-0.5 h-14 rounded-lg" />

                  // Lesson cell
                  const { cls, plan } = cell
                  return (
                    <button
                      key={day.iso}
                      onClick={() => setSelectedLesson({ date: day.iso, classId: cell.slot.class_id, period, planId: plan?.id })}
                      className="mx-0.5 h-14 rounded-lg text-left p-2 transition-all duration-150 hover:scale-[1.02] active:scale-95"
                      style={{
                        background: today ? 'rgba(230,176,32,0.08)' : style === 'editorial' ? 'transparent' : 'var(--bg-raised)',
                        border: `1px solid ${today ? 'rgba(230,176,32,0.2)' : 'var(--border)'}`,
                        borderLeftWidth: cls?.color_code ? '3px' : '1px',
                        borderLeftColor: cls?.color_code || (today ? 'rgba(230,176,32,0.2)' : 'var(--border)')
                      }}
                    >
                      <p className="text-xs font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {cls?.name || ''}
                      </p>
                      {plan?.plan_content && (
                        <p className="text-xs truncate mt-0.5 leading-tight" style={{ color: 'var(--text-muted)' }}>
                          {plan.plan_content.slice(0, 40)}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        {plan?.notes && <StickyNote size={10} style={{ color: 'var(--gold)' }} />}
                        {cell.homeworkDue?.length > 0 && <BookCheck size={10} style={{ color: '#7db88d' }} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedLesson && (
        <DayPanel lesson={selectedLesson} onClose={() => setSelectedLesson(null)} />
      )}
    </div>
  )
}
