import { useState } from 'react'
import type { Task, TaskStatus } from '../types'

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Set up project structure', columnId: 'done', order: 0 },
  { id: '2', title: 'Configure Tailwind CSS', columnId: 'done', order: 1 },
  { id: '3', title: 'Build KanbanBoard component', columnId: 'in-progress', order: 0 },
  { id: '4', title: 'Implement drag-and-drop', columnId: 'in-progress', order: 1 },
  { id: '5', title: 'Add task creation form', columnId: 'todo', order: 0 },
  { id: '6', title: 'Add LocalStorage persistence', columnId: 'todo', order: 1 },
  { id: '7', title: 'Write documentation', columnId: 'todo', order: 2 },
]

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)

  function addTask(columnId: TaskStatus, title: string) {
    const trimmed = title.trim()
    if (trimmed === '') return

    setTasks((prev) => {
      const order = prev.filter((t) => t.columnId === columnId).length
      const newTask: Task = { id: crypto.randomUUID(), title: trimmed, columnId, order }
      return [...prev, newTask]
    })
  }

  function updateTask(id: string, title: string) {
    const trimmed = title.trim()
    if (trimmed === '') return

    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)))
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return { tasks, addTask, updateTask, deleteTask }
}
