import { useState } from 'react'

export default function TagSidebarItem({ tag, onRename, onRequestDelete }) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(tag.name)
  const [error, setError] = useState(null)

  async function commitRename() {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenaming(false)
      setRenameValue(tag.name)
      return
    }
    try {
      await onRename(tag.id, trimmed)
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
            aria-label="Rename tag"
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') {
                setRenaming(false)
                setRenameValue(tag.name)
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
      <div className="nav-item">
        <span className="nav-label">{tag.name}</span>
        <button
          className="icon-btn-sm"
          aria-label="Rename tag"
          onClick={() => setRenaming(true)}
        >
          Rename
        </button>
        <button
          className="icon-btn-sm"
          aria-label="Delete tag"
          onClick={() => onRequestDelete(tag)}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
