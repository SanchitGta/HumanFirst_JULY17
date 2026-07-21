import { useState } from 'react'
import SidebarListItem from './SidebarListItem.jsx'

export default function Sidebar({
  lists,
  inboxId,
  selectedListId,
  onSelect,
  onCreateList,
  onRenameList,
  onRequestDeleteList,
}) {
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [error, setError] = useState(null)

  async function handleAddList(e) {
    e.preventDefault()
    try {
      await onCreateList(newListName)
      setNewListName('')
      setAddingList(false)
      setError(null)
    } catch (err) {
      setError(err.message || 'Request failed')
    }
  }

  return (
    <aside className="sidebar" aria-label="Lists navigation">
      <h1>Tasks</h1>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <span className="sidebar-section-title">Lists</span>
          <button className="icon-btn-sm" aria-label="Add list" onClick={() => setAddingList(true)}>
            +
          </button>
        </div>
        <ul>
          {lists.map((list) => (
            <SidebarListItem
              key={list.id}
              list={list}
              isInbox={list.id === inboxId}
              isSelected={list.id === selectedListId}
              onSelect={onSelect}
              onRename={onRenameList}
              onRequestDelete={onRequestDeleteList}
            />
          ))}
        </ul>
        {addingList && (
          <form className="inline-add-row" onSubmit={handleAddList}>
            <input
              type="text"
              className="input"
              placeholder="List name"
              maxLength={40}
              aria-label="New list name"
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
            {error && <span className="field-error">{error}</span>}
          </form>
        )}
      </div>
    </aside>
  )
}
