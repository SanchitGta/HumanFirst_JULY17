import { useState } from 'react'

export default function SidebarListItem({ list, isInbox, isSelected, onSelect, onRename, onRequestDelete }) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(list.name)
  const [error, setError] = useState(null)

  async function commitRename() {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenaming(false)
      setRenameValue(list.name)
      return
    }
    try {
      await onRename(list.id, trimmed)
      setRenaming(false)
      setError(null)
    } catch (err) {
      setError(err.message || 'Request failed')
    }
  }

  if (renaming) {
    return (
      <li>
        <div className="nav-item active">
          <input
            type="text"
            className="rename-input"
            value={renameValue}
            maxLength={40}
            aria-label="Rename list"
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') {
                setRenaming(false)
                setRenameValue(list.name)
              }
            }}
          />
        </div>
        {error && <span className="field-error">{error}</span>}
      </li>
    )
  }

  return (
    <li>
      <div
        className={`nav-item${isSelected ? ' active' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(list.id)}
      >
        <span className="nav-label">{list.name}</span>
        <span className="nav-count">{list.task_count}</span>
        <button
          className="icon-btn-sm"
          aria-label="Rename list"
          onClick={(e) => {
            e.stopPropagation()
            setRenaming(true)
          }}
        >
          Rename
        </button>
        {!isInbox && (
          <button
            className="icon-btn-sm"
            aria-label="Delete list"
            onClick={(e) => {
              e.stopPropagation()
              onRequestDelete(list)
            }}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  )
}
