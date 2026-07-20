import { KanbanBoard } from './components/KanbanBoard'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
        <p className="text-sm text-gray-500 mt-1">Drag and drop tasks between columns</p>
      </header>
      <main>
        <KanbanBoard />
      </main>
    </div>
  )
}

export default App
