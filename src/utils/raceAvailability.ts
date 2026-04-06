/**
 * Determines the data availability status of a race.
 *
 * Rules:
 * - Past seasons (any year < current): all races have data
 * - Current season: only races whose date is today or earlier have data
 * - Future season (shouldn't happen): no races have data
 */
export function getRaceAvailability(
  raceDate: string,
  raceSeason: number
): 'available' | 'upcoming' | 'today' {
  const currentYear = new Date().getFullYear()

  if (raceSeason < currentYear) return 'available'
  if (raceSeason > currentYear) return 'upcoming'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(raceDate)
  date.setHours(0, 0, 0, 0)

  if (date.getTime() === today.getTime()) return 'today'
  if (date < today) return 'available'
  return 'upcoming'
}
