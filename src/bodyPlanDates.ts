import { addDays } from './date'

export const BODY_PLAN_DAYS = 365

/** Extend starter-week dates in place by index so older workout links and swaps still resolve. */
export function bodyPlanDates(saved: string[] | undefined, today: string): string[] {
  if (saved?.length === BODY_PLAN_DAYS) return saved
  if (!saved?.length) return Array.from({ length: BODY_PLAN_DAYS }, (_, index) => addDays(today, index))

  const dates = [...saved]
  const used = new Set(dates)
  const first = [...dates].sort()[0]
  for (let offset = 7; dates.length < BODY_PLAN_DAYS; offset++) {
    const date = addDays(first, offset)
    if (used.has(date)) continue
    used.add(date)
    dates.push(date)
  }
  return dates
}
