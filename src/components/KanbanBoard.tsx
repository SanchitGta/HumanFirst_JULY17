import type { TaskStatus } from '../types'
import { Column } from './Column'
import { useTasks } from '../hooks/useTasks'

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'Todo' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

export function KanbanBoard() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks()

  return (
    <div className="flex flex-col sm:flex-row gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <Column
          key={col.id}
          columnId={col.id}
          title={col.title}
          tasks={tasks.filter((t) => t.columnId === col.id).sort((a, b) => a.order - b.order)}
          onAddTask={addTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
        />
      ))}
    </div>
  )
}
