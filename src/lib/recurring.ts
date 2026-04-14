export type RecurringType = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly'

// Convert a createdAt value (Date object or ISO string) to YYYY-MM-DD
function toDateStr(createdAt: string | Date): string {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isTaskActiveOnDate(
  task: {
    dueDate?: string | null
    recurringType?: string | null
    recurringDays?: string | null
    recurringEnd?: string | null
    createdAt?: string | Date | null
  },
  date: string
): boolean {
  if (!task.recurringType) {
    return task.dueDate === date
  }
  // For recurring tasks: start date is dueDate if set, otherwise the creation date
  const startDate = task.dueDate || (task.createdAt ? toDateStr(task.createdAt) : null)
  if (startDate && date < startDate) return false
  if (task.recurringEnd && date > task.recurringEnd) return false
  return matchesPattern(task.recurringType, task.recurringDays, date)
}

export function isHabitActiveOnDate(
  habit: { recurringDays?: string | null; createdAt?: string | Date | null; startDate?: string | null },
  date: string
): boolean {
  // Never count a habit as active before it was created
  // Prefer startDate (local date string) over createdAt (UTC timestamp) to avoid timezone issues
  const start = habit.startDate || (habit.createdAt ? toDateStr(habit.createdAt) : null)
  if (start && date < start) return false
  if (!habit.recurringDays) return true // every day
  return matchesPattern('weekly', habit.recurringDays, date)
}

function matchesPattern(
  type: string,
  days: string | null | undefined,
  date: string
): boolean {
  const dow = new Date(date + 'T12:00:00').getDay()
  switch (type) {
    case 'daily':    return true
    case 'weekdays': return dow >= 1 && dow <= 5
    case 'weekends': return dow === 0 || dow === 6
    case 'weekly':
      if (!days) return false
      return days.split(',').map(Number).includes(dow)
    case 'monthly':  return true
    default:         return false
  }
}

export function recurringLabel(type: string, days?: string | null): string {
  switch (type) {
    case 'daily':    return 'Every day'
    case 'weekdays': return 'Weekdays'
    case 'weekends': return 'Weekends'
    case 'monthly':  return 'Monthly'
    case 'weekly': {
      if (!days) return 'Weekly'
      const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      return days.split(',').map(Number).map(d => names[d]).join(', ')
    }
    default: return type
  }
}
