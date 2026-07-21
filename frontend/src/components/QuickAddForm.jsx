import { useState } from 'react'

export default function QuickAddForm({ listId, onSubmit }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('none')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required to add a task.')
      return
    }
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        due_date: dueDate || null,
        priority,
        list_id: listId,
      })
      setTitle('')
      setDueDate('')
      setPriority('none')
    } catch (err) {
      setError(err.message || 'Request failed')
    }
  }

  return (
    <form className="quick-add-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="qa-title"
        placeholder="Quick add a task — press Enter to save"
        aria-label="Quick add task title"
        maxLength={140}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        type="date"
        aria-label="Quick add due date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <select aria-label="Quick add priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="none">No priority</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <button type="submit" className="btn btn-secondary btn-sm">
        Add
      </button>
      {error && <div className="qa-error">{error}</div>}
    </form>
  )
}
