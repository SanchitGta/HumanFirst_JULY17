import type { Task } from '../types'
import { TaskCard } from './TaskCard'

interface ColumnProps {
  title: string
  tasks: Task[]
}

export function Column({ title, tasks }: ColumnProps) {
  return (
    <div className="flex flex-col bg-gray-100 rounded-xl p-3 min-w-[260px] w-full sm:w-72 shrink-0">
      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 px-1 flex items-center gap-2">
        {title}
        <span className="bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 text-xs font-normal normal-case tracking-normal">
          {tasks.length}
        </span>
      </h2>
      <div className="flex flex-col gap-2 min-h-[80px]">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}
