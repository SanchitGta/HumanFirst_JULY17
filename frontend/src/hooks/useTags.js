import { useCallback, useEffect, useState } from 'react'
import { tagsApi } from '../api/client.js'

export function useTags({ onMutated } = {}) {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await tagsApi.getTags()
      setTags(data)
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

  const createTag = useCallback(
    async (name) => {
      await tagsApi.createTag(name)
      await refetch()
      onMutated?.()
    },
    [refetch, onMutated],
  )

  const renameTag = useCallback(
    async (id, name) => {
      await tagsApi.updateTag(id, name)
      await refetch()
      onMutated?.()
    },
    [refetch, onMutated],
  )

  const deleteTag = useCallback(
    async (id) => {
      await tagsApi.deleteTag(id)
      await refetch()
      onMutated?.()
    },
    [refetch, onMutated],
  )

  return { tags, loading, error, refetch, createTag, renameTag, deleteTag }
}
