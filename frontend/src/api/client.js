const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function toQueryString(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

async function request(path, options = {}) {
  const response = await fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    let body = {}
    try {
      body = await response.json()
    } catch {
      body = {}
    }
    throw new ApiError(response.status, body.detail || 'Request failed')
  }
  if (response.status === 204) return undefined
  return response.json()
}

export const listsApi = {
  getLists: () => request('/api/lists'),
  createList: (name) =>
    request('/api/lists', { method: 'POST', body: JSON.stringify({ name }) }),
  updateList: (id, name) =>
    request(`/api/lists/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteList: (id) => request(`/api/lists/${id}`, { method: 'DELETE' }),
}

export const tasksApi = {
  getTasks: (params) => request(`/api/tasks${toQueryString(params)}`),
  createTask: (payload) =>
    request('/api/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  getTask: (id) => request(`/api/tasks/${id}`),
  updateTask: (id, payload) =>
    request(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  assignTag: (taskId, tagId) => request(`/api/tasks/${taskId}/tags/${tagId}`, { method: 'POST' }),
  unassignTag: (taskId, tagId) =>
    request(`/api/tasks/${taskId}/tags/${tagId}`, { method: 'DELETE' }),
}

export const tagsApi = {
  getTags: () => request('/api/tags'),
  createTag: (name) => request('/api/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  updateTag: (id, name) =>
    request(`/api/tags/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteTag: (id) => request(`/api/tags/${id}`, { method: 'DELETE' }),
}
