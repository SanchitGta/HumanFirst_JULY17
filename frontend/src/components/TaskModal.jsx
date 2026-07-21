import { useState } from 'react'
import TagMultiSelect from './TagMultiSelect.jsx'

export default function TaskModal({
  mode,
  task,
  lists,
  defaultListId,
  onSave,
  onRequestDelete,
  onClose,
  allTags,
  assignTag,
  unassignTag,
  onTagsChanged,
}) {
  const isEdit = mode === 'edit'
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState(task?.priority ?? 'none')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [listId, setListId] = useState(task?.list_id ?? defaultListId)
  const [selectedTagIds, setSelectedTagIds] = useState(task?.tags?.map((t) => t.id) ?? [])
  const [createdTask, setCreatedTask] = useState(null)
  const [titleError, setTitleError] = useState(false)
  const [error, setError] = useState(null)

  function toggleTag(id) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSave() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError(true)
      return
    }
    setTitleError(false)
    const payload = {
      title: trimmedTitle,
      description: description || null,
      priority,
      due_date: dueDate || null,
      list_id: listId,
    }
    try {
      let taskId
      let baselineTagIds
      if (isEdit) {
        await onSave(payload)
        taskId = task.id
        baselineTagIds = task.tags.map((t) => t.id)
      } else if (createdTask) {
        taskId = createdTask.id
        baselineTagIds = createdTask.tags.map((t) => t.id)
      } else {
        const saved = await onSave(payload)
        setCreatedTask(saved)
        taskId = saved.id
        baselineTagIds = []
      }

      const toAdd = selectedTagIds.filter((id) => !baselineTagIds.includes(id))
      const toRemove = baselineTagIds.filter((id) => !selectedTagIds.includes(id))
      if (toAdd.length > 0 || toRemove.length > 0) {
        await Promise.all([
          ...toAdd.map((id) => assignTag(taskId, id)),
          ...toRemove.map((id) => unassignTag(taskId, id)),
        ])
        await onTagsChanged()
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Request failed')
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button className="modal-close" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className={`field${titleError ? ' invalid' : ''}`}>
            <label htmlFor="taskTitleInput">Title *</label>
            <input
              id="taskTitleInput"
              type="text"
              className="input"
              maxLength={140}
              placeholder="e.g. Renew car registration"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {titleError && <span className="field-error">Title is required.</span>}
          </div>
          <div className="field">
            <label htmlFor="taskDescInput">Description</label>
            <textarea
              id="taskDescInput"
              className="textarea"
              placeholder="Add more detail (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="taskListSelect">List</label>
              <select
                id="taskListSelect"
                className="select"
                value={listId}
                onChange={(e) => setListId(Number(e.target.value))}
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="taskPrioritySelect">Priority</label>
              <select
                id="taskPrioritySelect"
                className="select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="none">No priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="taskDueInput">Due date</label>
            <input
              id="taskDueInput"
              type="date"
              className="input"
              value={dueDate || ''}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Tags</label>
            <TagMultiSelect allTags={allTags} selectedIds={selectedTagIds} onToggle={toggleTag} />
          </div>
          {error && <span className="field-error">{error}</span>}
        </div>
        <div className={`modal-footer${isEdit ? ' spread' : ''}`}>
          {isEdit ? (
            <button className="btn btn-danger-ghost" onClick={() => onRequestDelete(task)}>
              Delete task
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              {isEdit ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
