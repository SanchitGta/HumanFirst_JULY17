export default function TagMultiSelect({ allTags, selectedIds, onToggle }) {
  if (allTags.length === 0) {
    return <span className="tag-multiselect-empty">No tags yet. Create one from the sidebar.</span>
  }

  return (
    <div className="tag-multiselect">
      {allTags.map((tag) => {
        const selected = selectedIds.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            className={`tag-chip${selected ? ' selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onToggle(tag.id)}
          >
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}
