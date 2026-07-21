import PriorityBadge from './PriorityBadge.jsx'
import { formatDueDate } from '../utils/date.js'

export default function TaskRow({ task, overdue, dueToday, onToggleComplete, onOpenEdit, onRequestDelete }) {
  const completed = task.status === 'done'

  function handleToggle(e) {
    e.stopPropagation()
    onToggleComplete(task)
  }

  function handleEdit(e) {
    e.stopPropagation()
    onOpenEdit(task)
  }

  function handleDelete(e) {
    e.stopPropagation()
    onRequestDelete(task)
  }

  let dueChipClass = 'chip chip-due'
  let dueLabel = formatDueDate(task.due_date)
  if (overdue) {
    dueChipClass += ' overdue'
    dueLabel = `Overdue · ${dueLabel}`
  } else if (dueToday) {
    dueChipClass += ' today'
    dueLabel = 'Today'
  }

  return (
    <div
      className={`task-row${overdue ? ' overdue' : ''}${completed ? ' completed' : ''}`}
      onClick={() => onOpenEdit(task)}
    >
      <span className="row-check">
        <span
          className={`checkbox-fancy${completed ? ' checked' : ''}`}
          role="checkbox"
          aria-checked={completed}
          tabIndex={0}
          onClick={handleToggle}
        />
      </span>
      <div className="row-main">
        <div className="row-title-line">
          <span className="row-title">{task.title}</span>
        </div>
        {task.description && <div className="row-desc">{task.description}</div>}
        <div className="row-meta">
          {task.due_date && <span className={dueChipClass}>{dueLabel}</span>}
        </div>
      </div>
      <span className="row-priority">
        <PriorityBadge priority={task.priority} />
      </span>
      <span className="row-actions">
        <button aria-label="Edit task" onClick={handleEdit}>
          Edit
        </button>
        <button className="danger" aria-label="Delete task" onClick={handleDelete}>
          Delete
        </button>
      </span>
    </div>
  )
}
