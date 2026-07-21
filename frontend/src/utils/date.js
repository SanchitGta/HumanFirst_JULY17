export function todayLocalISODate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isOverdue(task) {
  return Boolean(task.due_date) && task.due_date < todayLocalISODate() && task.status !== 'done'
}

export function isDueToday(task) {
  return task.due_date === todayLocalISODate()
}

export function formatDueDate(due_date) {
  if (!due_date) return ''
  const date = new Date(`${due_date}T00:00:00`)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
