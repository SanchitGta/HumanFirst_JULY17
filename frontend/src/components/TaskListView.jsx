import QuickAddForm from './QuickAddForm.jsx'
import TaskRow from './TaskRow.jsx'
import EmptyState from './EmptyState.jsx'
import { isOverdue, isDueToday } from '../utils/date.js'

export default function TaskListView({
  listId,
  listName,
  tasks,
  loading,
  error,
  onRetry,
  onToggleComplete,
  onOpenCreate,
  onOpenEdit,
  onRequestDeleteTask,
  onQuickAdd,
}) {
  return (
    <main className="main">
      <div className="topbar">
        <div className="topbar-title-row">
          <h1>{listName}</h1>
          <span className="task-total">{tasks.length} tasks</span>
          <div className="topbar-actions">
            <button className="btn btn-primary" onClick={onOpenCreate}>
              New Task
            </button>
          </div>
        </div>
      </div>

      <div className="quick-add-wrap">
        <QuickAddForm listId={listId} onSubmit={onQuickAdd} />
      </div>

      <div className="task-list-container">
        {loading && tasks.length === 0 && <p>Loading tasks…</p>}
        {!loading && error && (
          <div className="state-panel error">
            <h3>Couldn't load tasks</h3>
            <p>{error.message || 'Something went wrong while fetching this list.'}</p>
            <button className="btn btn-primary" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && tasks.length === 0 && (
          <EmptyState
            message="No tasks in this list yet."
            actionLabel="Add a task"
            onAction={onOpenCreate}
          />
        )}
        {!loading && !error && tasks.length > 0 && (
          <div className="task-list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                overdue={isOverdue(task)}
                dueToday={isDueToday(task)}
                onToggleComplete={onToggleComplete}
                onOpenEdit={onOpenEdit}
                onRequestDelete={onRequestDeleteTask}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
