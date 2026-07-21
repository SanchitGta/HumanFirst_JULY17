import { useEffect, useMemo, useState } from 'react'

export function useTaskFilters(listId) {
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [tagId, setTagId] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('due_date')
  const [order, setOrder] = useState('asc')

  useEffect(() => {
    setStatus('all')
    setPriority('all')
    setTagId('all')
    setSearch('')
    setSort('due_date')
    setOrder('asc')
  }, [listId])

  const params = useMemo(
    () => ({
      status: status === 'all' ? undefined : status,
      priority: priority === 'all' ? undefined : priority,
      tag_id: tagId === 'all' ? undefined : tagId,
      search: search.trim() ? search.trim() : undefined,
      sort,
      order,
    }),
    [status, priority, tagId, search, sort, order],
  )

  function clearFilters() {
    setStatus('all')
    setPriority('all')
    setTagId('all')
    setSearch('')
  }

  const hasActiveFilters =
    status !== 'all' || priority !== 'all' || tagId !== 'all' || search.trim() !== ''

  return {
    status,
    priority,
    tagId,
    search,
    sort,
    order,
    setStatus,
    setPriority,
    setTagId,
    setSearch,
    setSort,
    setOrder,
    params,
    clearFilters,
    hasActiveFilters,
  }
}
