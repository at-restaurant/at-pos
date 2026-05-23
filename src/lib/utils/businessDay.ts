// src/lib/utils/businessDay.ts
// Utility for End-of-Day aware date calculations

/**
 * Returns the configured business times from localStorage or IndexedDB.
 * Defaults to start: "16:00", end: "04:00"
 */
export function getBusinessTimes(): { start: string, end: string } {
    if (typeof window === 'undefined') return { start: '16:00', end: '04:00' }
    try {
        const saved = localStorage.getItem('business_settings')
        if (saved) {
            const parsed = JSON.parse(saved)
            const isValid = (time: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time)
            
            return {
                start: parsed?.start_of_day_time && isValid(parsed.start_of_day_time) ? parsed.start_of_day_time : '16:00',
                end: parsed?.end_of_day_time && isValid(parsed.end_of_day_time) ? parsed.end_of_day_time : '04:00'
            }
        }
    } catch { /* ignore */ }
    return { start: '16:00', end: '04:00' }
}

/**
 * Backward compatibility helper
 */
export function getEndOfDayTime(): string {
    return getBusinessTimes().end
}

/**
 * Returns the "business date" for a given point in time, considering the shift.
 * If start=16:00 and end=04:00, anything between 16:00 and 04:00+1d is the same business day.
 */
export function getBusinessDate(date: Date = new Date(), times?: { start: string, end: string }): string {
    const { start, end } = times || getBusinessTimes()
    
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)

    const currentHour = date.getHours()
    const currentMin = date.getMinutes()
    const currentTotalMin = currentHour * 60 + currentMin
    
    const startTotalMin = startHour * 60 + startMin
    const endTotalMin = endHour * 60 + endMin

    // If the shift crosses midnight (e.g. 16:00 to 04:00)
    if (startTotalMin > endTotalMin) {
        // If current time is strictly BEFORE the end time (e.g. 02:00 < 04:00), 
        // it belongs to yesterday's shift.
        if (currentTotalMin < endTotalMin) {
            const prev = new Date(date)
            prev.setDate(prev.getDate() - 1)
            return prev.toISOString().split('T')[0]
        }
        // If current time is strictly AFTER the start time (e.g. 17:00 > 16:00),
        // it belongs to today's shift.
        return date.toISOString().split('T')[0]
    } else {
        // Standard shift not crossing midnight (e.g. 08:00 to 20:00)
        // If before start time, it's the previous day's shift logic depending on requirements,
        // but typically business date aligns with calendar date in this case.
        if (currentTotalMin < startTotalMin) {
            const prev = new Date(date)
            prev.setDate(prev.getDate() - 1)
            return prev.toISOString().split('T')[0]
        }
        return date.toISOString().split('T')[0]
    }
}

/**
 * Returns the start/end ISO timestamps for a given business date range.
 */
export function getBusinessDateRange(range: 'today' | 'week' | 'month' | 'year'): { startDate: string; endDate: string } {
    const times = getBusinessTimes()
    const now = new Date()

    // Business day start = calendar date where the current business day began, at start time
    const businessDate = getBusinessDate(now, times)
    const businessDayStart = new Date(`${businessDate}T${times.start}:00`)

    // "now" (upper bound)
    const endDate = now.toISOString()

    if (range === 'today') {
        return {
            startDate: businessDayStart.toISOString(),
            endDate
        }
    }

    // For week / month / year: subtract from businessDayStart
    const start = new Date(businessDayStart)
    if (range === 'week') start.setDate(start.getDate() - 7)
    if (range === 'month') start.setMonth(start.getMonth() - 1)
    if (range === 'year') start.setFullYear(start.getFullYear() - 1)

    return {
        startDate: start.toISOString(),
        endDate
    }
}

/**
 * Used by the attendance system.
 * Returns the "reset key" for the current business period.
 * When this changes, attendance resets.
 */
export function getAttendanceResetKey(): string {
    const times = getBusinessTimes()
    const businessDate = getBusinessDate(new Date(), times)
    return `${businessDate}_shift`
}
