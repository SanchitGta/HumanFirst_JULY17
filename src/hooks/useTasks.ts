import { useEffect, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '../types'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('kanban-tasks')
    return saved ? (JSON.parse(saved) as Task[]) : []
  })

  useEffect(() => {
    localStorage.setItem('kanban-tasks', JSON.stringify(tasks))
  }, [tasks])

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

  function moveTask(activeId: string, targetColumnId: TaskStatus, overTaskId: string | null) {
    setTasks((prev) => {
      const active = prev.find((t) => t.id === activeId)
      if (!active) return prev

      if (active.columnId === targetColumnId) {
        const columnTasks = prev
          .filter((t) => t.columnId === active.columnId)
          .sort((a, b) => a.order - b.order)
        const activeIndex = columnTasks.findIndex((t) => t.id === activeId)
        const overIndex = overTaskId
          ? columnTasks.findIndex((t) => t.id === overTaskId)
          : columnTasks.length - 1
        if (overIndex === -1 || activeIndex === overIndex) return prev
        const reordered = arrayMove(columnTasks, activeIndex, overIndex).map((t, i) => ({
          ...t,
          order: i,
        }))
        return prev.map((t) => reordered.find((r) => r.id === t.id) ?? t)
      } else {
        const targetTasks = prev
          .filter((t) => t.columnId === targetColumnId)
          .sort((a, b) => a.order - b.order)
        const insertAt = overTaskId
          ? Math.max(0, targetTasks.findIndex((t) => t.id === overTaskId))
          : targetTasks.length
        const newTargetTasks = [
          ...targetTasks.slice(0, insertAt),
          { ...active, columnId: targetColumnId },
          ...targetTasks.slice(insertAt),
        ].map((t, i) => ({ ...t, order: i }))
        const newSourceTasks = prev
          .filter((t) => t.columnId === active.columnId && t.id !== activeId)
          .sort((a, b) => a.order - b.order)
          .map((t, i) => ({ ...t, order: i }))
        const updatedIds = new Set([...newTargetTasks, ...newSourceTasks].map((t) => t.id))
        const unchanged = prev.filter((t) => !updatedIds.has(t.id))
        return [...unchanged, ...newTargetTasks, ...newSourceTasks]
      }
    })
  }

  return { tasks, addTask, updateTask, deleteTask, moveTask }
}
