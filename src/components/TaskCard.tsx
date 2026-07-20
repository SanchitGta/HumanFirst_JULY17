import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'

interface TaskCardProps {
  task: Task
  onUpdate: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelledRef = useRef(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function startEditing() {
    setDraft(task.title)
    setIsEditing(true)
  }

  function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed !== '') {
      onUpdate(task.id, trimmed)
    }
    setIsEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      cancelledRef.current = false
      commitEdit()
    } else if (e.key === 'Escape') {
      cancelledRef.current = true
      setIsEditing(false)
    }
  }

  function handleBlur() {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    commitEdit()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-grab active:cursor-grabbing select-none"
    >
      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full text-sm text-gray-800 border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
      ) : (
        <p className="text-sm text-gray-800 pr-4" onClick={startEditing}>
          {task.title}
        </p>
      )}
      <button
        type="button"
        aria-label="Delete task"
        onClick={() => onDelete(task.id)}
        className="invisible group-hover:visible absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-700 text-sm leading-none"
      >
        ×
      </button>
    </div>
  )
}
