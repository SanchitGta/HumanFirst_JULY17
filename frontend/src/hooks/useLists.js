import { useCallback, useEffect, useMemo, useState } from 'react'
import { listsApi } from '../api/client.js'

export function useLists() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listsApi.getLists()
      setLists(data)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const inboxId = useMemo(
    () => (lists.length ? Math.min(...lists.map((l) => l.id)) : null),
    [lists],
  )

  const createList = useCallback(
    async (name) => {
      await listsApi.createList(name)
      await refetch()
    },
    [refetch],
  )

  const renameList = useCallback(
    async (id, name) => {
      await listsApi.updateList(id, name)
      await refetch()
    },
    [refetch],
  )

  const deleteList = useCallback(
    async (id) => {
      await listsApi.deleteList(id)
      await refetch()
    },
    [refetch],
  )

  return { lists, inboxId, loading, error, refetch, createList, renameList, deleteList }
}
