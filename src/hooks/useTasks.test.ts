import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTasks } from './useTasks'

describe('useTasks', () => {
  it('adds a task to the bottom of the target column', () => {
    const { result } = renderHook(() => useTasks())
    const initialTodoCount = result.current.tasks.filter((t) => t.columnId === 'todo').length

    act(() => {
      result.current.addTask('todo', 'New task')
    })

    const todoTasks = result.current.tasks.filter((t) => t.columnId === 'todo')
    const added = todoTasks.find((t) => t.title === 'New task')

    expect(todoTasks).toHaveLength(initialTodoCount + 1)
    expect(added).toBeDefined()
    expect(added?.order).toBe(initialTodoCount)
  })

  it('rejects adding a task with an empty or whitespace-only title', () => {
    const { result } = renderHook(() => useTasks())
    const before = result.current.tasks.length

    act(() => {
      result.current.addTask('todo', '   ')
    })

    expect(result.current.tasks).toHaveLength(before)
  })

  it('trims the title when adding a task', () => {
    const { result } = renderHook(() => useTasks())

    act(() => {
      result.current.addTask('done', '  Trimmed title  ')
    })

    const added = result.current.tasks.find((t) => t.title === 'Trimmed title')
    expect(added).toBeDefined()
  })

  it('updates a task title and preserves columnId and order', () => {
    const { result } = renderHook(() => useTasks())
    const target = result.current.tasks[0]

    act(() => {
      result.current.updateTask(target.id, 'Updated title')
    })

    const updated = result.current.tasks.find((t) => t.id === target.id)
    expect(updated?.title).toBe('Updated title')
    expect(updated?.columnId).toBe(target.columnId)
    expect(updated?.order).toBe(target.order)
  })

  it('rejects updating a task to an empty title', () => {
    const { result } = renderHook(() => useTasks())
    const target = result.current.tasks[0]

    act(() => {
      result.current.updateTask(target.id, '   ')
    })

    const unchanged = result.current.tasks.find((t) => t.id === target.id)
    expect(unchanged?.title).toBe(target.title)
  })

  it('deletes a task by id', () => {
    const { result } = renderHook(() => useTasks())
    const target = result.current.tasks[0]
    const before = result.current.tasks.length

    act(() => {
      result.current.deleteTask(target.id)
    })

    expect(result.current.tasks).toHaveLength(before - 1)
    expect(result.current.tasks.find((t) => t.id === target.id)).toBeUndefined()
  })

  it('leaves order gaps in place after a delete rather than renumbering', () => {
    const { result } = renderHook(() => useTasks())
    const doneTasks = result.current.tasks.filter((t) => t.columnId === 'done')
    const [first, second] = doneTasks

    act(() => {
      result.current.deleteTask(first.id)
    })

    const remaining = result.current.tasks.find((t) => t.id === second.id)
    expect(remaining?.order).toBe(second.order)
  })
})
