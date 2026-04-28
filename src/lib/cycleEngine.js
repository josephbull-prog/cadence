/**
 * Cycle Engine
 * Determines Week A/B, valid lesson dates, and handles the Push Forward cascade.
 */

import {
  startOfWeek, addWeeks, addDays, isBefore, isAfter,
  isWithinInterval, parseISO, format, differenceInCalendarWeeks,
  getDay, eachDayOfInterval, isWeekend
} from 'date-fns'

/**
 * Parse a date string or Date object to a Date.
 */
export function toDate(d) {
  if (!d) return null
  if (d instanceof Date) return d
  return parseISO(d)
}

/**
 * Format a Date to YYYY-MM-DD string.
 */
export function toISO(d) {
  if (!d) return null
  return format(d, 'yyyy-MM-dd')
}

/**
 * Check whether a date falls within any holiday range.
 */
export function isHoliday(date, holidays) {
  const d = toDate(date)
  return holidays.some(h => {
    const start = toDate(h.start_date)
    const end = toDate(h.end_date)
    return d >= start && d <= end
  })
}

/**
 * Get the holiday label for a date (if any).
 */
export function getHolidayLabel(date, holidays) {
  const d = toDate(date)
  const h = holidays.find(h => {
    const start = toDate(h.start_date)
    const end = toDate(h.end_date)
    return d >= start && d <= end
  })
  return h?.label || null
}

/**
 * Count whole weeks that fall *entirely* within a holiday range,
 * between cycleStart and targetDate (exclusive of targetDate's week).
 */
function countHolidayWeeks(cycleStart, targetDate, holidays) {
  let count = 0
  let weekStart = startOfWeek(toDate(cycleStart), { weekStartsOn: 1 })
  const target = toDate(targetDate)

  while (isBefore(weekStart, target)) {
    const weekEnd = addDays(weekStart, 4) // Mon → Fri
    // Is this entire work-week covered by holidays?
    const entireWeekHoliday = holidays.some(h => {
      const hs = toDate(h.start_date)
      const he = toDate(h.end_date)
      return hs <= weekStart && he >= weekEnd
    })
    if (entireWeekHoliday) count++
    weekStart = addWeeks(weekStart, 1)
  }
  return count
}

/**
 * Determine the cycle week (1 or 2) for a given date.
 * Returns null if the date is a holiday.
 * Returns 1 for 1-week timetables always.
 */
export function getCycleWeek(date, profile, holidays) {
  if (!profile?.cycle_start_date) return 1
  if (isHoliday(date, holidays)) return null

  if (profile.timetable_type === '1_week') return 1

  const d = toDate(date)
  const cycleStart = toDate(profile.cycle_start_date)
  const totalWeeks = differenceInCalendarWeeks(d, cycleStart, { weekStartsOn: 1 })
  const holidayWeeks = countHolidayWeeks(cycleStart, d, holidays)
  const effectiveWeeks = totalWeeks - holidayWeeks
  // 0 mod 2 = week 1 (A), 1 mod 2 = week 2 (B)
  return (effectiveWeeks % 2 === 0) ? 1 : 2
}

/**
 * Get all lesson slots for a specific class on a given date.
 * Returns array of slot objects (with period_number).
 */
export function getSlotsForDate(date, classId, timetableSlots, profile, holidays) {
  const cycleWeek = getCycleWeek(date, profile, holidays)
  if (cycleWeek === null) return [] // holiday

  const dayOfWeek = getDay(toDate(date)) // 0=Sun, 1=Mon...
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek // make Mon=1...Fri=5

  return timetableSlots.filter(slot =>
    slot.class_id === classId &&
    slot.day_of_week === adjustedDay &&
    slot.cycle_week === cycleWeek
  )
}

/**
 * Get all classes scheduled on a given date.
 * Returns array of { slot, cycleWeek } pairs.
 */
export function getScheduleForDate(date, timetableSlots, profile, holidays) {
  const cycleWeek = getCycleWeek(date, profile, holidays)
  if (cycleWeek === null) return []

  const dayOfWeek = getDay(toDate(date))
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek

  return timetableSlots
    .filter(slot =>
      slot.day_of_week === adjustedDay &&
      slot.cycle_week === cycleWeek
    )
    .sort((a, b) => a.period_number - b.period_number)
    .map(slot => ({ slot, cycleWeek }))
}

/**
 * Get all valid lesson dates for a class, from startDate onwards.
 * "Valid" means: the timetable says there's a lesson, AND it's not a holiday.
 */
export function getFutureLessonDates(classId, fromDate, timetableSlots, profile, holidays, limitDays = 365) {
  const dates = []
  const start = toDate(fromDate)
  const end = addDays(start, limitDays)
  let current = start

  // Get the slots for this class
  const classSlots = timetableSlots.filter(s => s.class_id === classId)
  if (classSlots.length === 0) return []

  while (isBefore(current, end)) {
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      const dayOfWeek = getDay(current)
      const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek
      const cycleWeek = getCycleWeek(current, profile, holidays)

      const matchingSlots = classSlots.filter(s =>
        s.day_of_week === adjustedDay && s.cycle_week === cycleWeek
      )
      for (const slot of matchingSlots) {
        dates.push({ date: toISO(current), period_number: slot.period_number, slot })
      }
    }
    current = addDays(current, 1)
  }

  return dates
}

/**
 * Push Forward engine.
 * Given a trigger date and a list of lesson plans for a class,
 * reassign each lesson plan's date to the next valid slot.
 *
 * Returns:
 *  - updatedPlans: array of {id, date} updates to apply
 *  - unschedulable: count of plans that couldn't be scheduled
 */
export function computePushForward(classId, triggerDate, lessonPlans, timetableSlots, profile, holidays) {
  // All future plans (>= triggerDate), ordered by date
  const affectedPlans = lessonPlans
    .filter(p => p.class_id === classId && p.date && p.date >= triggerDate)
    .sort((a, b) => a.date < b.date ? -1 : 1)

  if (affectedPlans.length === 0) return { updatedPlans: [], unschedulable: 0 }

  // Get the first affected plan's date's next slot date
  const futureDates = getFutureLessonDates(
    classId,
    triggerDate,
    timetableSlots,
    profile,
    holidays,
    400 // look up to ~1 year + a bit
  )

  // Find where the sequence should start: the slot AFTER the first affected plan
  const triggerSlotIndex = futureDates.findIndex(fd => fd.date === triggerDate)
  const startIndex = triggerSlotIndex >= 0 ? triggerSlotIndex + 1 : 0

  const updatedPlans = []
  let unschedulable = 0

  affectedPlans.forEach((plan, i) => {
    const slotIndex = startIndex + i
    if (slotIndex < futureDates.length) {
      updatedPlans.push({ id: plan.id, date: futureDates[slotIndex].date, period_number: futureDates[slotIndex].period_number })
    } else {
      updatedPlans.push({ id: plan.id, date: null })
      unschedulable++
    }
  })

  return { updatedPlans, unschedulable }
}

/**
 * Get the next SoW suggestion for a class.
 * Returns the lesson title string or null.
 */
export function getSoWSuggestion(classId, classes, schemesOfWork, lessonPlans) {
  const cls = classes.find(c => c.id === classId)
  if (!cls?.sow_id) return null

  const sow = schemesOfWork.find(s => s.id === cls.sow_id)
  if (!sow?.lessons?.length) return null

  // Find the highest sow_index used for this class
  const usedIndices = lessonPlans
    .filter(p => p.class_id === classId && p.sow_index !== null && p.sow_index !== undefined)
    .map(p => p.sow_index)

  const maxIndex = usedIndices.length > 0 ? Math.max(...usedIndices) : -1
  const nextIndex = maxIndex + 1

  if (nextIndex >= sow.lessons.length) return null
  return { title: sow.lessons[nextIndex], index: nextIndex }
}

/**
 * Determine Book Brilliant status for a class.
 * Returns: 'done' | 'due' | 'overdue'
 */
export function getBookBrilliantStatus(cls, holidays) {
  if (cls.book_brilliant_done) return 'done'

  if (!cls.book_brilliant_reset_date) return 'due'

  // Check if the half term has passed without resetting
  const resetDate = toDate(cls.book_brilliant_reset_date)
  const now = new Date()

  // Find the most recent half-term end (a holiday that ended before today)
  const pastHalfTerms = holidays
    .filter(h => toDate(h.end_date) < now)
    .sort((a, b) => b.end_date < a.end_date ? -1 : 1)

  if (pastHalfTerms.length === 0) return 'due'

  const lastHalfTermEnd = toDate(pastHalfTerms[0].end_date)
  // If the reset date is before the last half term ended, it's overdue
  if (resetDate < lastHalfTermEnd) return 'overdue'

  return 'due'
}

/**
 * Returns true if the date falls within a holiday that is exactly one day long
 * (start_date === end_date). Covers INSET days, odd days off, etc.
 */
export function isSingleDayHoliday(date, holidays) {
  const d = toDate(date)
  return holidays.some(h => {
    const start = toDate(h.start_date)
    const end = toDate(h.end_date)
    return d >= start && d <= end && h.start_date === h.end_date
  })
}
