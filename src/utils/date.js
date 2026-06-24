const pad = (value) => String(value).padStart(2, '0')

export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

export const localMonthKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  return `${year}-${month}`
}

// Attendance must use local calendar date, not UTC ISO date.
// This prevents India evening/night attendance from being saved under the wrong day.
export const todayKey = () => localDateKey()

export const formatDateTime = (value) => {
  if (!value) return '-'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}
