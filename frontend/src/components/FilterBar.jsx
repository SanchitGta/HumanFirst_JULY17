const STATUS_LABELS = { open: 'Open', done: 'Done' }
const PRIORITY_LABELS = { none: 'No priority', low: 'Low', medium: 'Medium', high: 'High' }

export default function FilterBar({
  status,
  priority,
  tagId,
  sort,
  order,
  search,
  tags,
  hasActiveFilters,
  onStatusChange,
  onPriorityChange,
  onTagChange,
  onSortChange,
  onOrderChange,
  onSearchClear,
  onClearAll,
}) {
  const tagLabel = tagId !== 'all' ? tags.find((t) => t.id === tagId)?.name ?? 'Unknown tag' : null

  return (
    <div className="filter-bar">
      <div className="filter-controls">
        <select
          className="select"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="done">Done</option>
        </select>
        <select
          className="select"
          aria-label="Filter by priority"
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value)}
        >
          <option value="all">All priorities</option>
          <option value="none">No priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select
          className="select"
          aria-label="Filter by tag"
          value={tagId === 'all' ? 'all' : String(tagId)}
          onChange={(e) => onTagChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <span className="filter-sep" />
        <select
          className="select"
          aria-label="Sort by"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="due_date">Due Date</option>
          <option value="priority">Priority</option>
          <option value="created_at">Created</option>
          <option value="title">Title</option>
        </select>
        <select
          className="select"
          aria-label="Sort order"
          value={order}
          onChange={(e) => onOrderChange(e.target.value)}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
        {hasActiveFilters && (
          <button className="btn btn-secondary btn-sm" onClick={onClearAll}>
            Clear filters
          </button>
        )}
      </div>
      {hasActiveFilters && (
        <div className="filter-chips">
          {status !== 'all' && (
            <button className="filter-chip" onClick={() => onStatusChange('all')}>
              {STATUS_LABELS[status] ?? status} ×
            </button>
          )}
          {priority !== 'all' && (
            <button className="filter-chip" onClick={() => onPriorityChange('all')}>
              {PRIORITY_LABELS[priority] ?? priority} ×
            </button>
          )}
          {tagId !== 'all' && (
            <button className="filter-chip" onClick={() => onTagChange('all')}>
              {tagLabel} ×
            </button>
          )}
          {search.trim() && (
            <button className="filter-chip" onClick={onSearchClear}>
              "{search.trim()}" ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}
