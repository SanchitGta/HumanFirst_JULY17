import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import type { Task, TaskStatus } from '../types'
import { Column } from './Column'
import { TaskCard } from './TaskCard'
import { useTasks } from '../hooks/useTasks'

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'Todo' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

export function KanbanBoard() {
  const { tasks, addTask, updateTask, deleteTask, moveTask } = useTasks()
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over || active.id === over.id) return
    const activeTaskFound = tasks.find((t) => t.id === active.id)
    if (!activeTaskFound) return
    const overId = String(over.id)
    const overTask = tasks.find((t) => t.id === overId)
    const targetColumnId = overTask ? overTask.columnId : (overId as TaskStatus)
    moveTask(String(active.id), targetColumnId, overTask ? overId : null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} onUpdate={() => {}} onDelete={() => {}} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
