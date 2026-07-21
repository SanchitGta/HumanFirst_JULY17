import { useEffect, useState } from 'react'
import { useLists } from './hooks/useLists.js'
import { useTasks } from './hooks/useTasks.js'
import { useTags } from './hooks/useTags.js'
import { useTaskFilters } from './hooks/useTaskFilters.js'
import Sidebar from './components/Sidebar.jsx'
import TaskListView from './components/TaskListView.jsx'
import TaskModal from './components/TaskModal.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'

export default function App() {
  const [selectedListId, setSelectedListId] = useState(null)
  const [taskModalState, setTaskModalState] = useState(null)
  const [confirmState, setConfirmState] = useState(null)

  const lists = useLists()
  const filters = useTaskFilters(selectedListId)
  const tasks = useTasks(selectedListId, filters.params, { onMutated: lists.refetch })
  const tags = useTags({ onMutated: tasks.refetch })

  useEffect(() => {
    if (selectedListId === null && lists.inboxId != null) {
      setSelectedListId(lists.inboxId)
    }
  }, [lists.inboxId, selectedListId])

  async function handleDeleteList(listId) {
    await lists.deleteList(listId)
    if (selectedListId === listId) {
      setSelectedListId(lists.inboxId)
    }
  }

  async function handleDeleteTag(tagId) {
    await tags.deleteTag(tagId)
    if (filters.tagId === tagId) filters.setTagId('all')
  }

  async function handleConfirm() {
    if (confirmState.kind === 'deleteTask') {
      await tasks.deleteTask(confirmState.target.id)
    } else if (confirmState.kind === 'deleteList') {
      await handleDeleteList(confirmState.target.id)
    } else if (confirmState.kind === 'deleteTag') {
      await handleDeleteTag(confirmState.target.id)
    }
    setConfirmState(null)
  }

  const selectedList = lists.lists.find((l) => l.id === selectedListId)

  if (lists.loading && lists.lists.length === 0) {
    return <div className="app-shell">Loading…</div>
  }

  return (
    <div className="app-shell">
      <div className="shell-body">
        <Sidebar
          lists={lists.lists}
          inboxId={lists.inboxId}
          selectedListId={selectedListId}
          onSelect={setSelectedListId}
          onCreateList={lists.createList}
          onRenameList={lists.renameList}
          onRequestDeleteList={(list) => setConfirmState({ kind: 'deleteList', target: list })}
          tags={tags.tags}
          onCreateTag={tags.createTag}
          onRenameTag={tags.renameTag}
          onRequestDeleteTag={(tag) => setConfirmState({ kind: 'deleteTag', target: tag })}
        />
        {selectedListId != null && (
          <TaskListView
            listId={selectedListId}
            listName={selectedList?.name ?? ''}
            tasks={tasks.tasks}
            loading={tasks.loading}
            error={tasks.error}
            onRetry={tasks.refetch}
            onToggleComplete={tasks.toggleComplete}
            onOpenCreate={() => setTaskModalState({ mode: 'create' })}
            onOpenEdit={(task) => setTaskModalState({ mode: 'edit', task })}
            onRequestDeleteTask={(task) => setConfirmState({ kind: 'deleteTask', target: task })}
            onQuickAdd={tasks.createTask}
            tags={tags.tags}
            filters={filters}
          />
        )}
      </div>

      {taskModalState && (
        <TaskModal
          mode={taskModalState.mode}
          task={taskModalState.task}
          lists={lists.lists}
          defaultListId={selectedListId}
          onSave={
            taskModalState.mode === 'edit'
              ? (payload) => tasks.updateTask(taskModalState.task.id, payload)
              : tasks.createTask
          }
          onRequestDelete={(task) => {
            setTaskModalState(null)
            setConfirmState({ kind: 'deleteTask', target: task })
          }}
          onClose={() => setTaskModalState(null)}
          allTags={tags.tags}
          assignTag={tasks.assignTagToTask}
          unassignTag={tasks.unassignTagFromTask}
          onTagsChanged={tasks.refetch}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          title={
            confirmState.kind === 'deleteList'
              ? `Delete "${confirmState.target.name}"?`
              : confirmState.kind === 'deleteTag'
                ? `Delete tag "${confirmState.target.name}"?`
                : 'Delete this task?'
          }
          message={
            confirmState.kind === 'deleteList'
              ? confirmState.target.task_count > 0
                ? `${confirmState.target.task_count} task(s) in this list will be moved to Inbox instead of being deleted.`
                : 'This list has no tasks. It will be removed permanently.'
              : confirmState.kind === 'deleteTag'
                ? "If this tag is assigned to any tasks, it will be removed from them. This can't be undone."
                : "This can't be undone."
          }
          confirmLabel={
            confirmState.kind === 'deleteList'
              ? 'Delete list'
              : confirmState.kind === 'deleteTag'
                ? 'Delete tag'
                : 'Delete task'
          }
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}
