import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '../types'
import { TaskCard } from './TaskCard'

interface ColumnProps {
  columnId: TaskStatus
  title: string
  tasks: Task[]
  onAddTask: (columnId: TaskStatus, title: string) => void
  onUpdateTask: (id: string, title: string) => void
  onDeleteTask: (id: string) => void
}

export function Column({ columnId, title, tasks, onAddTask, onUpdateTask, onDeleteTask }: ColumnProps) {
  const [inputValue, setInputValue] = useState('')
  const { setNodeRef } = useDroppable({ id: columnId })
  const taskIds = tasks.map((t) => t.id)

  function handleAdd() {
    const trimmed = inputValue.trim()
    if (trimmed === '') return
    onAddTask(columnId, trimmed)
    setInputValue('')
  }

  return (
    <div className="flex flex-col bg-gray-100 rounded-xl p-3 min-w-[260px] w-full sm:w-72 shrink-0">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 px-1 flex items-center gap-2">
        {title}
        <span className="bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 text-xs font-normal normal-case tracking-normal">
          {tasks.length}
        </span>
      </h2>
      <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[80px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
          ))}
        </SortableContext>
      </div>
      <div className="flex gap-1 mt-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="Add a task…"
          className="flex-1 min-w-0 text-sm rounded-md border border-gray-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1"
        >
          Add
        </button>
      </div>
    </div>
  )
}
