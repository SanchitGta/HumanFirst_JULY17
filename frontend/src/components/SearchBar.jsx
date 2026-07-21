import { useEffect, useState } from 'react'

export default function SearchBar({ value, onChange }) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onChange(draft)
    }, 300)
    return () => clearTimeout(timer)
  }, [draft])

  function handleClear() {
    setDraft('')
    onChange('')
  }

  return (
    <div className="search-bar">
      <input
        type="search"
        className="search-input"
        aria-label="Search tasks"
        placeholder="Search tasks…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {draft && (
        <button className="search-clear" aria-label="Clear search" onClick={handleClear}>
          ×
        </button>
      )}
    </div>
  )
}
