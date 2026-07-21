import { useCallback, useEffect, useState } from 'react'
import { tasksApi } from '../api/client.js'

export function useTasks(listId, { onMutated } = {}) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (listId == null) return
    setLoading(true)
    try {
      const data = await tasksApi.getTasks({ list_id: listId })
      setTasks(data)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [listId])

  useEffect(() => {
    refetch()
  }, [refetch])

  const createTask = useCallback(
    async (payload) => {
      await tasksApi.createTask(payload)
      await refetch()
      onMutated?.()
    },
    [refetch, onMutated],
  )

  const updateTask = useCallback(
    async (id, payload) => {
      await tasksApi.updateTask(id, payload)
      await refetch()
      onMutated?.()
    },
    [refetch, onMutated],
  )

  const deleteTask = useCallback(
    async (id) => {
      await tasksApi.deleteTask(id)
      await refetch()
      onMutated?.()
    },
    [refetch, onMutated],
  )

  const toggleComplete = useCallback(
    (task) => updateTask(task.id, { status: task.status === 'done' ? 'open' : 'done' }),
    [updateTask],
  )

  return { tasks, loading, error, refetch, createTask, updateTask, deleteTask, toggleComplete }
}
