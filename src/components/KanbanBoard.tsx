import type { Task, TaskStatus } from '../types'
import { Column } from './Column'

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'Todo' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Set up project structure', status: 'done' },
  { id: '2', title: 'Configure Tailwind CSS', status: 'done' },
  { id: '3', title: 'Build KanbanBoard component', status: 'in-progress' },
  { id: '4', title: 'Implement drag-and-drop', status: 'in-progress' },
  { id: '5', title: 'Add task creation form', status: 'todo' },
  { id: '6', title: 'Add LocalStorage persistence', status: 'todo' },
  { id: '7', title: 'Write documentation', status: 'todo' },
]

export function KanbanBoard() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <Column
          key={col.id}
          title={col.title}
          tasks={INITIAL_TASKS.filter((t) => t.status === col.id)}
        />
      ))}
    </div>
  )
}
