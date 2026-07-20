import type { Task } from '../types'

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-default select-none">
      <p className="text-sm text-gray-800">{task.title}</p>
    </div>
  )
}
